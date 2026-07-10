import { getBingoDb } from "src/lib/bingoDb";
import { resolveTrackKeys } from "src/lib/bingoEngine";

type SessionPlaylistEntry = {
  playlist_ids?: number[];
};

type BingoSessionRow = {
  id: number;
  session_code: string;
  playlist_id: number | null;
  playlist_ids: number[] | null;
  master_playlist_ids: number[] | null;
  round_playlist_ids: SessionPlaylistEntry[] | null;
};

type BingoCallRow = {
  id: number;
  playlist_track_key: string | null;
  track_title: string;
  artist_name: string;
};

type SwapCounts = {
  updated_collection_playlist_items: number;
  updated_bingo_session_round_tracks: number;
  updated_bingo_session_calls: number;
  updated_bingo_session_game_playlists: number;
  updated_bingo_session_crates: number;
  updated_bingo_cards: number;
  updated_crate_items: number;
};

export type BingoTrackSwapResult = {
  ok: true;
  session_id: number;
  session_code: string;
  old_track_key: string;
  new_track_key: string;
  new_track_title: string;
  new_artist_name: string;
  dry_run: boolean;
  counts: SwapCounts;
};

type SwapInput = {
  sessionId: number;
  fromTrackKey: string;
  toTrackKey: string;
  dryRun?: boolean;
};

const EMPTY_COUNTS: SwapCounts = {
  updated_collection_playlist_items: 0,
  updated_bingo_session_round_tracks: 0,
  updated_bingo_session_calls: 0,
  updated_bingo_session_game_playlists: 0,
  updated_bingo_session_crates: 0,
  updated_bingo_cards: 0,
  updated_crate_items: 0,
};

function normalizePlaylistIds(values: unknown[]): number[] {
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  );
}

function collectSessionPlaylistIds(session: BingoSessionRow): number[] {
  const roundPlaylistIds = Array.isArray(session.round_playlist_ids)
    ? session.round_playlist_ids.flatMap((entry) => (Array.isArray(entry?.playlist_ids) ? entry.playlist_ids : []))
    : [];

  return normalizePlaylistIds([
    session.playlist_id,
    ...(session.playlist_ids ?? []),
    ...(session.master_playlist_ids ?? []),
    ...roundPlaylistIds,
  ]);
}

function trackKeyFromCallOrderEntry(entry: unknown): string | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const row = entry as Record<string, unknown>;
  const keyA = typeof row.playlist_track_key === "string" ? row.playlist_track_key.trim() : "";
  if (keyA.length > 0) return keyA;
  const keyB = typeof row.track_key === "string" ? row.track_key.trim() : "";
  return keyB.length > 0 ? keyB : null;
}

function patchCallOrder(
  callOrder: unknown,
  oldTrackKey: string,
  next: { track_key: string; track_title: string; artist_name: string; album_name: string | null }
): { changed: boolean; value: unknown } {
  if (!Array.isArray(callOrder)) return { changed: false, value: callOrder };

  let changed = false;
  const patched = callOrder.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
    const row = entry as Record<string, unknown>;
    const rowTrackKey = trackKeyFromCallOrderEntry(row);
    if (rowTrackKey !== oldTrackKey) return entry;

    changed = true;
    return {
      ...row,
      playlist_track_key: next.track_key,
      track_key: next.track_key,
      track_title: next.track_title,
      artist_name: next.artist_name,
      album_name: next.album_name,
    };
  });

  return { changed, value: patched };
}

function patchCardGrid(
  grid: unknown,
  affectedCallIds: Set<number>,
  old: { track_title: string; artist_name: string },
  next: { track_title: string; artist_name: string }
): { changed: boolean; value: unknown } {
  if (!Array.isArray(grid)) return { changed: false, value: grid };

  let changed = false;
  const patched = grid.map((cell) => {
    if (!cell || typeof cell !== "object" || Array.isArray(cell)) return cell;
    const row = cell as Record<string, unknown>;
    const callId = Number(row.call_id);
    if (!Number.isFinite(callId) || !affectedCallIds.has(callId)) return cell;

    const label = typeof row.label === "string" ? row.label : "";
    const oldTrackOnly = old.track_title;
    const oldTrackArtist = `${old.track_title} - ${old.artist_name}`;

    let nextLabel = label;
    if (label === oldTrackOnly) nextLabel = next.track_title;
    if (label === oldTrackArtist) nextLabel = `${next.track_title} - ${next.artist_name}`;

    changed = true;
    return {
      ...row,
      track_title: next.track_title,
      artist_name: next.artist_name,
      label: nextLabel,
    };
  });

  return { changed, value: patched };
}

export async function swapBingoSessionTrack(input: SwapInput): Promise<BingoTrackSwapResult> {
  const sessionId = Number(input.sessionId);
  const oldTrackKey = String(input.fromTrackKey ?? "").trim();
  const newTrackKey = String(input.toTrackKey ?? "").trim();
  const dryRun = input.dryRun === true;

  if (!Number.isFinite(sessionId) || sessionId <= 0) {
    throw new Error("Invalid sessionId");
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

  const { data: session, error: sessionError } = await dbAny
    .from("bingo_sessions")
    .select("id, session_code, playlist_id, playlist_ids, master_playlist_ids, round_playlist_ids")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Bingo session not found");

  const typedSession = session as BingoSessionRow;
  const sessionPlaylistIds = collectSessionPlaylistIds(typedSession);

  const mirrorIds = new Set<number>();
  const { data: mirrorRowsA } = await dbAny
    .from("collection_playlists")
    .select("id")
    .ilike("name", `Bingo ${typedSession.session_code} Playlist %`);
  for (const row of (mirrorRowsA ?? []) as Array<{ id: number }>) mirrorIds.add(row.id);

  const { data: mirrorRowsB } = await dbAny
    .from("collection_playlists")
    .select("id")
    .ilike("name", `Bingo · ${typedSession.session_code} Playlist %`);
  for (const row of (mirrorRowsB ?? []) as Array<{ id: number }>) mirrorIds.add(row.id);

  const targetPlaylistIds = Array.from(new Set([...sessionPlaylistIds, ...Array.from(mirrorIds)]));

  if (targetPlaylistIds.length > 0) {
    const { data: possibleConflicts, error: conflictError } = await dbAny
      .from("collection_playlist_items")
      .select("playlist_id, track_key")
      .in("playlist_id", targetPlaylistIds)
      .in("track_key", [oldTrackKey, newTrackKey]);
    if (conflictError) throw new Error(conflictError.message);

    const byPlaylist = new Map<number, Set<string>>();
    for (const row of (possibleConflicts ?? []) as Array<{ playlist_id: number; track_key: string }>) {
      if (!byPlaylist.has(row.playlist_id)) byPlaylist.set(row.playlist_id, new Set());
      byPlaylist.get(row.playlist_id)?.add(row.track_key);
    }

    for (const [, keys] of byPlaylist) {
      if (keys.has(oldTrackKey) && keys.has(newTrackKey)) {
        throw new Error("Swap aborted: at least one target playlist already contains both old and new tracks");
      }
    }
  }

  const { data: roundConflictRows, error: roundConflictError } = await dbAny
    .from("bingo_session_round_tracks")
    .select("round_number, playlist_track_key")
    .eq("session_id", sessionId)
    .in("playlist_track_key", [oldTrackKey, newTrackKey]);
  if (roundConflictError) throw new Error(roundConflictError.message);

  const byRound = new Map<number, Set<string>>();
  for (const row of (roundConflictRows ?? []) as Array<{ round_number: number; playlist_track_key: string }>) {
    if (!byRound.has(row.round_number)) byRound.set(row.round_number, new Set());
    byRound.get(row.round_number)?.add(row.playlist_track_key);
  }
  for (const [, keys] of byRound) {
    if (keys.has(oldTrackKey) && keys.has(newTrackKey)) {
      throw new Error("Swap aborted: destination track already exists in at least one round");
    }
  }

  const resolvedMap = await resolveTrackKeys(db, [newTrackKey]);
  const resolved = resolvedMap.get(newTrackKey);
  if (!resolved) {
    throw new Error("Destination track key could not be resolved");
  }

  const counts: SwapCounts = { ...EMPTY_COUNTS };
  const nextMeta = {
    track_key: newTrackKey,
    track_title: resolved.track_title,
    artist_name: resolved.artist_name,
    album_name: resolved.album_name,
    side: resolved.side,
    position: resolved.position,
  };

  const { data: callRows, error: callError } = await dbAny
    .from("bingo_session_calls")
    .select("id, playlist_track_key, track_title, artist_name")
    .eq("session_id", sessionId)
    .eq("playlist_track_key", oldTrackKey);
  if (callError) throw new Error(callError.message);

  const typedCalls = (callRows ?? []) as BingoCallRow[];
  const affectedCallIds = new Set<number>(typedCalls.map((row) => row.id));
  const firstOld = typedCalls[0]
    ? { track_title: typedCalls[0].track_title, artist_name: typedCalls[0].artist_name }
    : { track_title: "", artist_name: "" };

  if (targetPlaylistIds.length > 0) {
    const { data: playlistItemRows, error: playlistSelectError } = await dbAny
      .from("collection_playlist_items")
      .select("id")
      .in("playlist_id", targetPlaylistIds)
      .eq("track_key", oldTrackKey);
    if (playlistSelectError) throw new Error(playlistSelectError.message);
    counts.updated_collection_playlist_items = (playlistItemRows ?? []).length;

    if (!dryRun && counts.updated_collection_playlist_items > 0) {
      const { error: playlistUpdateError } = await dbAny
        .from("collection_playlist_items")
        .update({ track_key: newTrackKey })
        .in("playlist_id", targetPlaylistIds)
        .eq("track_key", oldTrackKey);
      if (playlistUpdateError) throw new Error(playlistUpdateError.message);
    }
  }

  const { data: roundRows, error: roundSelectError } = await dbAny
    .from("bingo_session_round_tracks")
    .select("id")
    .eq("session_id", sessionId)
    .eq("playlist_track_key", oldTrackKey);
  if (roundSelectError) throw new Error(roundSelectError.message);
  counts.updated_bingo_session_round_tracks = (roundRows ?? []).length;

  if (!dryRun && counts.updated_bingo_session_round_tracks > 0) {
    const { error: roundUpdateError } = await dbAny
      .from("bingo_session_round_tracks")
      .update({
        playlist_track_key: newTrackKey,
        track_title: nextMeta.track_title,
        artist_name: nextMeta.artist_name,
        album_name: nextMeta.album_name,
        side: nextMeta.side,
        position: nextMeta.position,
      })
      .eq("session_id", sessionId)
      .eq("playlist_track_key", oldTrackKey);
    if (roundUpdateError) throw new Error(roundUpdateError.message);
  }

  counts.updated_bingo_session_calls = typedCalls.length;
  if (!dryRun && counts.updated_bingo_session_calls > 0) {
    const { error: callUpdateError } = await dbAny
      .from("bingo_session_calls")
      .update({
        playlist_track_key: newTrackKey,
        track_title: nextMeta.track_title,
        artist_name: nextMeta.artist_name,
        album_name: nextMeta.album_name,
        side: nextMeta.side,
        position: nextMeta.position,
        metadata_synced_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .eq("playlist_track_key", oldTrackKey);
    if (callUpdateError) throw new Error(callUpdateError.message);
  }

  const { data: gamePlaylists, error: gamePlaylistsError } = await dbAny
    .from("bingo_session_game_playlists")
    .select("id, call_order")
    .eq("session_id", sessionId);
  if (gamePlaylistsError) throw new Error(gamePlaylistsError.message);

  for (const row of (gamePlaylists ?? []) as Array<{ id: number; call_order: unknown }>) {
    const patched = patchCallOrder(row.call_order, oldTrackKey, {
      track_key: newTrackKey,
      track_title: nextMeta.track_title,
      artist_name: nextMeta.artist_name,
      album_name: nextMeta.album_name,
    });
    if (!patched.changed) continue;

    counts.updated_bingo_session_game_playlists += 1;
    if (!dryRun) {
      const { error: updateError } = await dbAny
        .from("bingo_session_game_playlists")
        .update({ call_order: patched.value })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);
    }
  }

  try {
    const { data: legacyCrates, error: legacyError } = await dbAny
      .from("bingo_session_crates")
      .select("id, call_order")
      .eq("session_id", sessionId);
    if (!legacyError) {
      for (const row of (legacyCrates ?? []) as Array<{ id: number; call_order: unknown }>) {
        const patched = patchCallOrder(row.call_order, oldTrackKey, {
          track_key: newTrackKey,
          track_title: nextMeta.track_title,
          artist_name: nextMeta.artist_name,
          album_name: nextMeta.album_name,
        });
        if (!patched.changed) continue;

        counts.updated_bingo_session_crates += 1;
        if (!dryRun) {
          const { error: updateError } = await dbAny
            .from("bingo_session_crates")
            .update({ call_order: patched.value })
            .eq("id", row.id);
          if (updateError) throw new Error(updateError.message);
        }
      }
    }
  } catch {
    // Legacy table may not exist on all environments.
  }

  const { data: cardRows, error: cardsError } = await dbAny
    .from("bingo_cards")
    .select("id, grid")
    .eq("session_id", sessionId);
  if (cardsError) throw new Error(cardsError.message);

  for (const row of (cardRows ?? []) as Array<{ id: number; grid: unknown }>) {
    const patched = patchCardGrid(row.grid, affectedCallIds, firstOld, {
      track_title: nextMeta.track_title,
      artist_name: nextMeta.artist_name,
    });
    if (!patched.changed) continue;

    counts.updated_bingo_cards += 1;
    if (!dryRun) {
      const { error: updateError } = await dbAny
        .from("bingo_cards")
        .update({ grid: patched.value })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);
    }
  }

  const targetCrateIds = new Set<number>();
  const { data: cratesA } = await dbAny
    .from("crates")
    .select("id")
    .eq("game_source", "bingo")
    .ilike("name", `Bingo ${typedSession.session_code}%`);
  for (const row of (cratesA ?? []) as Array<{ id: number }>) targetCrateIds.add(row.id);

  const { data: cratesB } = await dbAny
    .from("crates")
    .select("id")
    .eq("game_source", "bingo")
    .ilike("name", `Bingo · ${typedSession.session_code}%`);
  for (const row of (cratesB ?? []) as Array<{ id: number }>) targetCrateIds.add(row.id);

  if (targetCrateIds.size > 0) {
    const crateIdList = Array.from(targetCrateIds);
    const { data: crateRows, error: crateSelectError } = await dbAny
      .from("crate_items")
      .select("id")
      .in("crate_id", crateIdList)
      .eq("track_key", oldTrackKey);
    if (crateSelectError) throw new Error(crateSelectError.message);
    counts.updated_crate_items = (crateRows ?? []).length;

    if (!dryRun && counts.updated_crate_items > 0) {
      const { error: crateUpdateError } = await dbAny
        .from("crate_items")
        .update({ track_key: newTrackKey })
        .in("crate_id", crateIdList)
        .eq("track_key", oldTrackKey);
      if (crateUpdateError) throw new Error(crateUpdateError.message);
    }
  }

  return {
    ok: true,
    session_id: sessionId,
    session_code: typedSession.session_code,
    old_track_key: oldTrackKey,
    new_track_key: newTrackKey,
    new_track_title: nextMeta.track_title,
    new_artist_name: nextMeta.artist_name,
    dry_run: dryRun,
    counts,
  };
}
