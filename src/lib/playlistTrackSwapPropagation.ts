import { getBingoDb } from "src/lib/bingoDb";
import { swapBingoSessionTrack } from "src/lib/bingoTrackSwap";
import { swapMusicGameSessionTrack, type SwappableMusicGameSlug } from "src/lib/musicGameTrackSwap";

type BingoSessionShape = {
  id: number;
  playlist_id: number | null;
  playlist_ids: number[] | null;
  master_playlist_ids: number[] | null;
  round_playlist_ids: Array<{ playlist_ids?: number[] }> | null;
};

type SessionFailure = {
  game: "bingo" | SwappableMusicGameSlug;
  session_id: number;
  error: string;
};

export type PlaylistTrackSwapPropagationResult = {
  ok: true;
  playlist_id: number;
  old_track_key: string;
  new_track_key: string;
  dry_run: boolean;
  affected_playlist_ids: number[];
  counts: {
    updated_collection_playlist_items: number;
    affected_bingo_sessions: number;
    affected_trivia_sessions: number;
    affected_name_that_tune_sessions: number;
    affected_genre_imposter_sessions: number;
  };
  failures: SessionFailure[];
};

type SwapInput = {
  playlistId: number;
  fromTrackKey: string;
  toTrackKey: string;
  dryRun?: boolean;
};

function includesPlaylistId(value: unknown, playlistId: number): boolean {
  return Array.isArray(value) && value.some((entry) => Number(entry) === playlistId);
}

function collectBingoSessionPlaylistIds(session: BingoSessionShape): number[] {
  const roundPlaylistIds = Array.isArray(session.round_playlist_ids)
    ? session.round_playlist_ids.flatMap((entry) => (Array.isArray(entry?.playlist_ids) ? entry.playlist_ids : []))
    : [];

  return Array.from(
    new Set(
      [
        session.playlist_id,
        ...(session.playlist_ids ?? []),
        ...(session.master_playlist_ids ?? []),
        ...roundPlaylistIds,
      ]
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  );
}

async function collectSessionIdsForGame(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbAny: any,
  table: string,
  callTable: string,
  playlistIds: number[],
  oldTrackKey: string
): Promise<number[]> {
  const { data, error } = await dbAny
    .from(table)
    .select(`id, ${callTable}!inner(playlist_track_key)`)
    .in("playlist_id", playlistIds)
    .eq(`${callTable}.playlist_track_key`, oldTrackKey);

  if (error) throw new Error(error.message);

  return Array.from(
    new Set(
      ((data ?? []) as Array<{ id: number }>)
        .map((row) => Number(row.id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );
}

export async function propagatePlaylistTrackSwap(input: SwapInput): Promise<PlaylistTrackSwapPropagationResult> {
  const playlistId = Number(input.playlistId);
  const oldTrackKey = String(input.fromTrackKey ?? "").trim();
  const newTrackKey = String(input.toTrackKey ?? "").trim();
  const dryRun = input.dryRun === true;

  if (!Number.isFinite(playlistId) || playlistId <= 0) {
    throw new Error("Invalid playlist id");
  }
  if (!oldTrackKey || !newTrackKey) {
    throw new Error("Both fromTrackKey and toTrackKey are required");
  }
  if (oldTrackKey === newTrackKey) {
    throw new Error("Source and destination track keys are identical");
  }

  const db = getBingoDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;

  const { data: bingoSessions, error: bingoError } = await dbAny
    .from("bingo_sessions")
    .select("id, playlist_id, playlist_ids, master_playlist_ids, round_playlist_ids");
  if (bingoError) throw new Error(bingoError.message);

  const typedBingoSessions = (bingoSessions ?? []) as BingoSessionShape[];
  const affectedBingoSessions = typedBingoSessions.filter((session) => {
    if (Number(session.playlist_id) === playlistId) return true;
    if (includesPlaylistId(session.playlist_ids, playlistId)) return true;
    if (includesPlaylistId(session.master_playlist_ids, playlistId)) return true;
    if (
      Array.isArray(session.round_playlist_ids) &&
      session.round_playlist_ids.some(
        (entry) => entry && typeof entry === "object" && includesPlaylistId((entry as { playlist_ids?: unknown }).playlist_ids, playlistId)
      )
    ) {
      return true;
    }
    return false;
  });

  const affectedPlaylistIds = new Set<number>([playlistId]);
  for (const session of affectedBingoSessions) {
    for (const candidateId of collectBingoSessionPlaylistIds(session)) {
      affectedPlaylistIds.add(candidateId);
    }
  }
  const affectedPlaylistIdList = Array.from(affectedPlaylistIds);

  const { data: playlistConflicts, error: playlistConflictError } = await dbAny
    .from("collection_playlist_items")
    .select("playlist_id, track_key")
    .in("playlist_id", affectedPlaylistIdList)
    .in("track_key", [oldTrackKey, newTrackKey]);
  if (playlistConflictError) throw new Error(playlistConflictError.message);

  const byPlaylist = new Map<number, Set<string>>();
  for (const row of (playlistConflicts ?? []) as Array<{ playlist_id: number; track_key: string }>) {
    if (!byPlaylist.has(row.playlist_id)) byPlaylist.set(row.playlist_id, new Set());
    byPlaylist.get(row.playlist_id)?.add(row.track_key);
  }

  const conflicts = Array.from(byPlaylist.entries())
    .filter(([, keys]) => keys.has(oldTrackKey) && keys.has(newTrackKey))
    .map(([id]) => id);
  if (conflicts.length > 0) {
    throw new Error(`Swap aborted: destination track already exists in playlist(s): ${conflicts.join(", ")}`);
  }

  const { data: playlistRows, error: playlistRowError } = await dbAny
    .from("collection_playlist_items")
    .select("id")
    .in("playlist_id", affectedPlaylistIdList)
    .eq("track_key", oldTrackKey);
  if (playlistRowError) throw new Error(playlistRowError.message);
  const updatedCollectionPlaylistItems = (playlistRows ?? []).length;

  if (!dryRun && updatedCollectionPlaylistItems > 0) {
    const { error: playlistUpdateError } = await dbAny
      .from("collection_playlist_items")
      .update({ track_key: newTrackKey })
      .in("playlist_id", affectedPlaylistIdList)
      .eq("track_key", oldTrackKey);
    if (playlistUpdateError) throw new Error(playlistUpdateError.message);
  }

  const triviaSessionIds = await collectSessionIdsForGame(dbAny, "trivia_sessions", "trivia_session_calls", affectedPlaylistIdList, oldTrackKey);
  const nttSessionIds = await collectSessionIdsForGame(dbAny, "ntt_sessions", "ntt_session_calls", affectedPlaylistIdList, oldTrackKey);
  const giSessionIds = await collectSessionIdsForGame(dbAny, "gi_sessions", "gi_session_calls", affectedPlaylistIdList, oldTrackKey);

  const failures: SessionFailure[] = [];

  for (const session of affectedBingoSessions) {
    try {
      await swapBingoSessionTrack({
        sessionId: session.id,
        fromTrackKey: oldTrackKey,
        toTrackKey: newTrackKey,
        dryRun,
      });
    } catch (error) {
      failures.push({
        game: "bingo",
        session_id: session.id,
        error: error instanceof Error ? error.message : "Bingo swap failed",
      });
    }
  }

  const runGameSwaps = async (game: SwappableMusicGameSlug, sessionIds: number[]) => {
    for (const sessionId of sessionIds) {
      try {
        await swapMusicGameSessionTrack({
          game,
          sessionId,
          fromTrackKey: oldTrackKey,
          toTrackKey: newTrackKey,
          dryRun,
        });
      } catch (error) {
        failures.push({
          game,
          session_id: sessionId,
          error: error instanceof Error ? error.message : "Session swap failed",
        });
      }
    }
  };

  await runGameSwaps("trivia", triviaSessionIds);
  await runGameSwaps("name-that-tune", nttSessionIds);
  await runGameSwaps("genre-imposter", giSessionIds);

  return {
    ok: true,
    playlist_id: playlistId,
    old_track_key: oldTrackKey,
    new_track_key: newTrackKey,
    dry_run: dryRun,
    affected_playlist_ids: affectedPlaylistIdList,
    counts: {
      updated_collection_playlist_items: updatedCollectionPlaylistItems,
      affected_bingo_sessions: affectedBingoSessions.length,
      affected_trivia_sessions: triviaSessionIds.length,
      affected_name_that_tune_sessions: nttSessionIds.length,
      affected_genre_imposter_sessions: giSessionIds.length,
    },
    failures,
  };
}