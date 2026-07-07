import { getBingoDb } from "src/lib/bingoDb";
import {
  syncCollectionPlaylistMirrorsForSession,
  syncStoredPlaylistCallOrderTitlesForSession,
} from "src/lib/bingoCrateModel";
import { syncSessionPlaylistMetadata, type PlaylistSeededGameSlug } from "src/lib/playlistMetadataSync";

type PropagationSummary = {
  bingoSessionCount: number;
  syncedSessionCounts: Partial<Record<PlaylistSeededGameSlug, number>>;
};

function includesPlaylistId(value: unknown, playlistId: number): boolean {
  return Array.isArray(value) && value.some((entry) => Number(entry) === playlistId);
}

export async function propagateDisplayTitleChangesForPlaylist(playlistId: number): Promise<PropagationSummary> {
  const normalizedPlaylistId = Number(playlistId);
  if (!Number.isFinite(normalizedPlaylistId) || normalizedPlaylistId <= 0) {
    throw new Error("Invalid playlist id");
  }

  const db = getBingoDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;
  const syncedSessionCounts: Partial<Record<PlaylistSeededGameSlug, number>> = {};

  const { data: bingoSessions, error: bingoError } = await dbAny
    .from("bingo_sessions")
    .select("id, playlist_id, playlist_ids, master_playlist_ids, round_playlist_ids");

  if (bingoError) throw new Error(bingoError.message);

  const affectedBingoSessionIds = ((bingoSessions ?? []) as Array<Record<string, unknown>>)
    .filter((session) => {
      if (Number(session.playlist_id) === normalizedPlaylistId) return true;
      if (includesPlaylistId(session.playlist_ids, normalizedPlaylistId)) return true;
      if (includesPlaylistId(session.master_playlist_ids, normalizedPlaylistId)) return true;
      if (
        Array.isArray(session.round_playlist_ids) &&
        session.round_playlist_ids.some(
          (entry) => entry && typeof entry === "object" && includesPlaylistId((entry as { playlist_ids?: unknown }).playlist_ids, normalizedPlaylistId)
        )
      ) {
        return true;
      }
      return false;
    })
    .map((session) => Number(session.id))
    .filter((id) => Number.isFinite(id) && id > 0);

  for (const sessionId of affectedBingoSessionIds) {
    await syncSessionPlaylistMetadata("bingo", sessionId, { dryRun: false });
    await syncStoredPlaylistCallOrderTitlesForSession(db, sessionId);
    await syncCollectionPlaylistMirrorsForSession(db, sessionId);
  }
  syncedSessionCounts.bingo = affectedBingoSessionIds.length;

  const sessionTables: Array<{ table: string; game: Exclude<PlaylistSeededGameSlug, "bingo"> }> = [
    { table: "trivia_sessions", game: "trivia" },
    { table: "ntt_sessions", game: "name-that-tune" },
    { table: "gi_sessions", game: "genre-imposter" },
  ];

  for (const { table, game } of sessionTables) {
    const { data, error } = await dbAny.from(table).select("id").eq("playlist_id", normalizedPlaylistId);
    if (error) throw new Error(error.message);

    const sessionIds = ((data ?? []) as Array<{ id: number }>).map((row) => row.id).filter((id) => Number.isFinite(id) && id > 0);
    for (const sessionId of sessionIds) {
      await syncSessionPlaylistMetadata(game, sessionId, { dryRun: false });
    }
    syncedSessionCounts[game] = sessionIds.length;
  }

  return {
    bingoSessionCount: affectedBingoSessionIds.length,
    syncedSessionCounts,
  };
}