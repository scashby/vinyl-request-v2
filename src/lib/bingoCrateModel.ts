/**
 * bingoCrateModel.ts
 *
 * Helpers for managing immutable call-order crates attached to bingo session rounds.
 * Each crate captures the generated call order at a point in time and is named with a
 * sequential letter (A, B, C…) scoped to the session so hosts can identify them easily.
 */

import { getBingoDb } from "./bingoDb";
import { parseTrackKey, planRoundSessionCalls, resolvePlaylistTracksForPlaylists } from "./bingoEngine";
import { getRoundSnapshotTracks } from "./bingoGameModel";
import { resolveRoundPlaylistIds, type RoundPlaylistEntry } from "./bingoRoundPlaylists";

const CRATE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type SessionCrateContext = {
  session_code: string | null;
  game_preset_id: number | null;
  playlist_id: number | null;
  playlist_ids: number[] | null;
  round_playlist_ids: RoundPlaylistEntry[] | null;
  round_count: number;
  current_round: number;
  active_crate_letter_by_round: { round: number; letter: string }[] | null;
};

export type CrateCallEntry = {
  id: number;
  call_index: number;
  playlist_track_key?: string | null;
  ball_number: number | null;
  column_letter: string;
  track_title: string;
  artist_name: string;
  album_name: string | null;
  side: string | null;
  position: string | null;
  status: string;
};

export type BingoSessionCrate = {
  id: number;
  session_id: number;
  round_number: number;
  crate_name: string;
  crate_letter: string;
  call_order: CrateCallEntry[];
  created_at: string;
  source_session_id?: number | null;
  preset_id?: number | null;
};

type SessionCrateBackfillRow = SessionCrateContext;

type PresetCrateRow = {
  id: number;
  preset_id: number;
  crate_letter: string;
  crate_name: string;
  call_order: Record<string, unknown>[];
  created_from_session_id: number | null;
  created_for_round: number | null;
  created_at: string;
};

/**
 * Ensure ONE Game Crate mirror exists in the collection crates table for a session.
 *
 * A Game Crate is the pull list — the union of every unique track across ALL rounds
 * for this session. One item per distinct track_key so the host knows exactly which
 * records to have ready. Multiple rounds may share tracks; those are deduplicated.
 *
 * Named: "Bingo {sessionCode}"
 */
async function ensureGameCrateMirror(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  sessionCode: string | null
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawDb = db as any;
  const crateName = `Bingo ${sessionCode ?? sessionId}`;

  // Load all tracks from ALL rounds for this session, then deduplicate by track_key
  const { data: trackData, error: trackError } = await rawDb
    .from("bingo_session_round_tracks")
    .select("playlist_track_key")
    .eq("session_id", sessionId);

  if (trackError) throw new Error(trackError.message);

  const uniqueTrackKeys = Array.from(
    new Map(
      ((trackData ?? []) as Array<{ playlist_track_key: string }>)
        .map((row) => [row.playlist_track_key, row.playlist_track_key])
    ).values()
  );

  if (uniqueTrackKeys.length === 0) return;

  // Resolve track_key → inventory_id for each track
  const trackItems = uniqueTrackKeys
    .map((trackKey) => {
      const parsed = parseTrackKey(trackKey);
      if (!parsed.inventoryId || !Number.isFinite(parsed.inventoryId)) return null;
      return { inventoryId: parsed.inventoryId, trackKey };
    })
    .filter((item): item is { inventoryId: number; trackKey: string } => item !== null);

  if (trackItems.length === 0) return;

  // Find or create the collection crate record
  const { data: existingData, error: existingError } = await rawDb
    .from("crates")
    .select("id")
    .eq("name", crateName)
    .eq("is_smart", false)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  let crateId = Number((existingData as { id?: unknown } | null)?.id ?? NaN);

  if (!Number.isFinite(crateId)) {
    const { data: maxSortData, error: maxSortError } = await rawDb
      .from("crates")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxSortError) throw new Error(maxSortError.message);

    const nextSortOrder = Number((maxSortData as { sort_order?: unknown } | null)?.sort_order ?? -1) + 1;

    const { data: insertedData, error: insertError } = await rawDb
      .from("crates")
      .insert({
        name: crateName,
        icon: "🎯",
        color: "#f59e0b",
        is_smart: false,
        smart_rules: null,
        match_rules: "all",
        live_update: false,
        sort_order: nextSortOrder,
        game_source: "bingo",
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);
    crateId = Number((insertedData as { id?: unknown } | null)?.id ?? NaN);
    if (!Number.isFinite(crateId)) throw new Error("Failed to create game crate mirror.");
  }

  // Replace all crate_items with the current round tracks (track-level: inventory_id + track_key)
  const { error: deleteError } = await rawDb.from("crate_items").delete().eq("crate_id", crateId);
  if (deleteError) throw new Error(deleteError.message);

  const insertRows = trackItems.map((item, index) => ({
    crate_id: crateId,
    inventory_id: item.inventoryId,
    track_key: item.trackKey,
    position: index,
  }));

  const { error: insertItemsError } = await rawDb.from("crate_items").insert(insertRows);
  if (insertItemsError) throw new Error(insertItemsError.message);
}

/**
 * Ensure a Game Playlist mirror exists in collection_playlists for a given call-order snapshot.
 *
 * A Game Playlist is the ordered call sequence for a round — the same 75 tracks as the
 * Game Crate, arranged in the specific shuffled order balls are called.
 * Multiple variants per round: A, B, C…
 *
 * Named: "Bingo {sessionCode} Playlist {letter}"
 */
async function ensureGamePlaylistMirror(
  db: ReturnType<typeof getBingoDb>,
  sessionCode: string | null,
  sessionId: number,
  playlistLetter: string,
  calls: CrateCallEntry[]
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawDb = db as any;
  const playlistName = `Bingo ${sessionCode ?? sessionId} Playlist ${playlistLetter}`;

  // Filter to entries with a valid track key
  const validCalls = calls.filter((call) => {
    const key = String(call.playlist_track_key ?? "").trim();
    return key.length > 0;
  });

  if (validCalls.length === 0) return;

  // Find or create the collection_playlists record
  const { data: existingData, error: existingError } = await rawDb
    .from("collection_playlists")
    .select("id")
    .eq("name", playlistName)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  let playlistId = Number((existingData as { id?: unknown } | null)?.id ?? NaN);

  if (!Number.isFinite(playlistId)) {
    const { data: maxSortData, error: maxSortError } = await rawDb
      .from("collection_playlists")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxSortError) throw new Error(maxSortError.message);

    const nextSortOrder = Number((maxSortData as { sort_order?: unknown } | null)?.sort_order ?? -1) + 1;

    const { data: insertedData, error: insertError } = await rawDb
      .from("collection_playlists")
      .insert({
        name: playlistName,
        icon: "▶️",
        color: "#f59e0b",
        is_smart: false,
        smart_rules: null,
        match_rules: "all",
        live_update: false,
        sort_order: nextSortOrder,
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);
    playlistId = Number((insertedData as { id?: unknown } | null)?.id ?? NaN);
    if (!Number.isFinite(playlistId)) throw new Error("Failed to create game playlist mirror.");
  }

  // Replace all playlist items with the current call order
  const { error: deleteError } = await rawDb
    .from("collection_playlist_items")
    .delete()
    .eq("playlist_id", playlistId);
  if (deleteError) throw new Error(deleteError.message);

  const insertRows = validCalls.map((call) => ({
    playlist_id: playlistId,
    track_key: String(call.playlist_track_key).trim(),
    sort_order: call.call_index,
  }));

  const { error: insertItemsError } = await rawDb
    .from("collection_playlist_items")
    .insert(insertRows);
  if (insertItemsError) throw new Error(insertItemsError.message);
}

async function getSessionCrateContext(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<SessionCrateContext | null> {
  const { data, error } = await db
    .from("bingo_sessions")
    .select("session_code, game_preset_id, playlist_id, playlist_ids, round_playlist_ids, round_count, current_round, active_crate_letter_by_round")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as SessionCrateContext | null) ?? null;
}

async function deriveRoundCallOrder(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  roundNumber: number,
  session: SessionCrateBackfillRow
): Promise<CrateCallEntry[]> {
  const snapshotTracks = await getRoundSnapshotTracks(db, sessionId, roundNumber);
  if (snapshotTracks.length > 0) {
    const planned = planRoundSessionCalls(snapshotTracks, sessionId, roundNumber);
    return planned.map((row, index) => ({
      id: -(index + 1),
      call_index: row.call_index,
      playlist_track_key: row.playlist_track_key,
      ball_number: row.ball_number,
      column_letter: row.column_letter,
      track_title: row.track_title,
      artist_name: row.artist_name,
      album_name: row.album_name,
      side: row.side,
      position: row.position,
      status: "pending",
    }));
  }

  const playlistIds = resolveRoundPlaylistIds(session, roundNumber);
  if (playlistIds.length > 0) {
    const resolvedTracks = await resolvePlaylistTracksForPlaylists(db, playlistIds);
    if (resolvedTracks.length > 0) {
      const planned = planRoundSessionCalls(resolvedTracks, sessionId, roundNumber);
      return planned.map((row, index) => ({
        id: -(index + 1),
        call_index: row.call_index,
        playlist_track_key: row.playlist_track_key,
        ball_number: row.ball_number,
        column_letter: row.column_letter,
        track_title: row.track_title,
        artist_name: row.artist_name,
        album_name: row.album_name,
        side: row.side,
        position: row.position,
        status: "pending",
      }));
    }
  }

  if (roundNumber === session.current_round) {
    const { data: currentRoundCalls, error: callsError } = await db
      .from("bingo_session_calls")
      .select("id, call_index, ball_number, column_letter, track_title, artist_name, album_name, side, position, status, playlist_track_key")
      .eq("session_id", sessionId)
      .order("call_index", { ascending: true });

    if (callsError) throw new Error(callsError.message);
    return ((currentRoundCalls ?? []) as CrateCallEntry[]).map((row) => ({ ...row }));
  }

  return [];
}

/** Return the next available crate letter for a session (across all rounds). */
async function getNextCrateLetter(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  presetId: number | null
): Promise<string> {
  const { data } = presetId
    ? await db
        .from("bingo_preset_crates")
        .select("crate_letter")
        .eq("preset_id", presetId)
        .order("crate_letter", { ascending: true })
    : await db
        .from("bingo_session_crates")
        .select("crate_letter")
        .eq("session_id", sessionId)
        .order("crate_letter", { ascending: true });

  const usedLetters = new Set((data ?? []).map((row) => row.crate_letter as string));
  const next = CRATE_LETTERS.find((l) => !usedLetters.has(l));
  if (!next) throw new Error("All 26 crate letters exhausted for this session.");
  return next;
}


function formatCrateName(sessionCode: string | null, sessionId: number, crateLetter: string): string {
  return `${sessionCode ?? sessionId} Crate ${crateLetter}`;
}

/**
 * Persist the current call order for a round as a new named crate.
 * The crate is automatically named "{sessionId} Crate {letter}".
 * Returns the newly-created crate row.
 */
export async function saveCrateForRound(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  roundNumber: number,
  calls: CrateCallEntry[]
): Promise<BingoSessionCrate> {
  const context = await getSessionCrateContext(db, sessionId);
  const presetId = context?.game_preset_id ?? null;
  const letter = await getNextCrateLetter(db, sessionId, presetId);
  const sessionCode = context?.session_code ?? null;
  const crateName = formatCrateName(sessionCode, sessionId, letter);

  if (presetId) {
    const { data, error } = await db
      .from("bingo_preset_crates")
      .insert({
        preset_id: presetId,
        crate_name: crateName,
        crate_letter: letter,
        call_order: calls as unknown as Record<string, unknown>[],
        created_from_session_id: sessionId,
        created_for_round: roundNumber,
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message ?? "Failed to save crate.");

    const row = data as PresetCrateRow;
    // Mirror: game crate (source pool) + game playlist (call order)
    await ensureGameCrateMirror(db, sessionId, sessionCode);
    await ensureGamePlaylistMirror(db, sessionCode, sessionId, letter, calls);
    return {
      id: row.id,
      session_id: sessionId,
      round_number: row.created_for_round ?? roundNumber,
      crate_name: row.crate_name,
      crate_letter: row.crate_letter,
      call_order: row.call_order as unknown as CrateCallEntry[],
      created_at: row.created_at,
      source_session_id: row.created_from_session_id,
      preset_id: row.preset_id,
    };
  }

  const { data, error } = await db
    .from("bingo_session_crates")
    .insert({
      session_id: sessionId,
      round_number: roundNumber,
      crate_name: crateName,
      crate_letter: letter,
      call_order: calls as unknown as Record<string, unknown>[],
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save crate.");

  // Mirror: game crate (source pool) + game playlist (call order)
  await ensureGameCrateMirror(db, sessionId, sessionCode);
  await ensureGamePlaylistMirror(db, sessionCode, sessionId, letter, calls);

  return {
    ...data,
    call_order: data.call_order as unknown as CrateCallEntry[],
  };
}

/** Return all crates for a session, ordered by crate_letter. */
export async function getCratesForSession(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<BingoSessionCrate[]> {
  const context = await getSessionCrateContext(db, sessionId);
  const sessionCode = context?.session_code ?? null;

  if (context?.game_preset_id) {
    const { data, error } = await db
      .from("bingo_preset_crates")
      .select("*")
      .eq("preset_id", context.game_preset_id)
      .order("created_for_round", { ascending: true })
      .order("crate_letter", { ascending: true });

    if (error) throw new Error(error.message);
    return ((data ?? []) as PresetCrateRow[]).map((row) => ({
      id: row.id,
      session_id: sessionId,
      round_number: row.created_for_round ?? 1,
      crate_name: formatCrateName(sessionCode, sessionId, row.crate_letter),
      crate_letter: row.crate_letter,
      call_order: row.call_order as unknown as CrateCallEntry[],
      created_at: row.created_at,
      source_session_id: row.created_from_session_id,
      preset_id: row.preset_id,
    }));
  }

  const { data, error } = await db
    .from("bingo_session_crates")
    .select("*")
    .eq("session_id", sessionId)
    .order("crate_letter", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    crate_name: formatCrateName(sessionCode, sessionId, row.crate_letter),
    call_order: row.call_order as unknown as CrateCallEntry[],
  }));
}

/** Return all crates for a specific round of a session. */
export async function getCratesForRound(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  roundNumber: number
): Promise<BingoSessionCrate[]> {
  const context = await getSessionCrateContext(db, sessionId);
  const sessionCode = context?.session_code ?? null;

  if (context?.game_preset_id) {
    const { data, error } = await db
      .from("bingo_preset_crates")
      .select("*")
      .eq("preset_id", context.game_preset_id)
      .eq("created_for_round", roundNumber)
      .order("crate_letter", { ascending: true });

    if (error) throw new Error(error.message);
    return ((data ?? []) as PresetCrateRow[]).map((row) => ({
      id: row.id,
      session_id: sessionId,
      round_number: row.created_for_round ?? roundNumber,
      crate_name: formatCrateName(sessionCode, sessionId, row.crate_letter),
      crate_letter: row.crate_letter,
      call_order: row.call_order as unknown as CrateCallEntry[],
      created_at: row.created_at,
      source_session_id: row.created_from_session_id,
      preset_id: row.preset_id,
    }));
  }

  const { data, error } = await db
    .from("bingo_session_crates")
    .select("*")
    .eq("session_id", sessionId)
    .eq("round_number", roundNumber)
    .order("crate_letter", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    crate_name: formatCrateName(sessionCode, sessionId, row.crate_letter),
    call_order: row.call_order as unknown as CrateCallEntry[],
  }));
}

export async function syncCollectionCrateMirrorsForSession(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<void> {
  const session = await getSessionCrateContext(db, sessionId);
  if (!session) return;

  const sessionCode = session.session_code;
  const playlists = await getCratesForSession(db, sessionId);

  // Sync ONE Game Crate for the entire session (union of all round tracks)
  await ensureGameCrateMirror(db, sessionId, sessionCode);

  // Sync one Game Playlist per call-order snapshot (letter A, B, C…)
  for (const playlist of playlists) {
    let calls = playlist.call_order;
    // Stored call_order may pre-date playlist_track_key — re-derive when missing
    if (!calls.some((c) => c.playlist_track_key)) {
      const fresh = await deriveRoundCallOrder(db, sessionId, playlist.round_number, session as SessionCrateBackfillRow);
      if (fresh.length > 0) calls = fresh;
    }
    await ensureGamePlaylistMirror(db, sessionCode, sessionId, playlist.crate_letter, calls);
  }
}

export async function syncCollectionCrateMirrorsForAllSessions(
  db: ReturnType<typeof getBingoDb>
): Promise<void> {
  const { data, error } = await db.from("bingo_sessions").select("id");
  if (error) throw new Error(error.message);

  const sessionIds = (data ?? [])
    .map((row) => Number((row as { id?: unknown }).id))
    .filter((value) => Number.isFinite(value) && value > 0);

  for (const sessionId of sessionIds) {
    await backfillMissingLegacyCrates(db, sessionId);
    await syncCollectionCrateMirrorsForSession(db, sessionId);
  }
}

/**
 * Backfill missing crates for legacy sessions from existing immutable round data.
 *
 * Source priority per round:
 * 1) Existing round snapshots (bingo_session_round_tracks)
 * 2) Current round call rows (bingo_session_calls), current round only
 *
 * This intentionally avoids regenerating cards or overwriting existing call sheets.
 */
export async function backfillMissingLegacyCrates(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<void> {
  const session = await getSessionCrateContext(db, sessionId);
  if (!session) return;

  const typedSession = session as SessionCrateBackfillRow;
  const existingCrates = await getCratesForSession(db, sessionId);
  const createdForCurrentSession = new Map<number, string>();

  for (let round = 1; round <= Math.max(1, typedSession.round_count || 1); round += 1) {
    const alreadyHasCrates = typedSession.game_preset_id
      ? existingCrates.some((crate) => crate.round_number === round && crate.source_session_id === sessionId)
      : existingCrates.some((crate) => crate.round_number === round);
    if (alreadyHasCrates) continue;

    const callOrder = await deriveRoundCallOrder(db, sessionId, round, typedSession);

    if (callOrder.length === 0) continue;

    const createdCrate = await saveCrateForRound(db, sessionId, round, callOrder);
    existingCrates.push(createdCrate);
    createdForCurrentSession.set(round, createdCrate.crate_letter);
  }

  const activeByRound = typedSession.active_crate_letter_by_round ?? [];
  for (let round = 1; round <= Math.max(1, typedSession.round_count || 1); round += 1) {
    const hasActive = activeByRound.some((entry) => entry.round === round);
    if (hasActive) continue;

    const preferredLetter = createdForCurrentSession.get(round);
    if (preferredLetter) {
      await setActiveCrateForRound(db, sessionId, round, preferredLetter);
      continue;
    }

    const firstRoundCrate = existingCrates
      .filter((crate) => crate.round_number === round)
      .sort((left, right) => left.crate_letter.localeCompare(right.crate_letter))[0];

    if (firstRoundCrate) {
      await setActiveCrateForRound(db, sessionId, round, firstRoundCrate.crate_letter);
    }
  }
}

/**
 * Create a new crate for a round from existing immutable session data.
 * Returns null when no source call-order data is available for the requested round.
 */
export async function createCrateFromRoundData(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  roundNumber: number
): Promise<BingoSessionCrate | null> {
  const session = await getSessionCrateContext(db, sessionId);
  if (!session) return null;

  const callOrder = await deriveRoundCallOrder(db, sessionId, roundNumber, session as SessionCrateBackfillRow);
  if (callOrder.length === 0) return null;

  return saveCrateForRound(db, sessionId, roundNumber, callOrder);
}

/**
 * Mark a crate letter as the active crate for a round in the session.
 * Reads existing `active_crate_letter_by_round` jsonb array and updates it.
 */
export async function setActiveCrateForRound(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  roundNumber: number,
  crateLetterOrNull: string | null
): Promise<void> {
  const { data: session } = await db
    .from("bingo_sessions")
    .select("active_crate_letter_by_round")
    .eq("id", sessionId)
    .single();

  const existing: { round: number; letter: string }[] =
    (session?.active_crate_letter_by_round as { round: number; letter: string }[] | null) ?? [];

  const without = existing.filter((entry) => entry.round !== roundNumber);
  const next =
    crateLetterOrNull !== null
      ? [...without, { round: roundNumber, letter: crateLetterOrNull }].sort((a, b) => a.round - b.round)
      : without;

  await db
    .from("bingo_sessions")
    .update({ active_crate_letter_by_round: next })
    .eq("id", sessionId);
}

/** Return the active crate letter for a round (null = none selected yet). */
export function getActiveCrateLetter(
  activeCrateLetterByRound: { round: number; letter: string }[] | null,
  roundNumber: number
): string | null {
  if (!activeCrateLetterByRound) return null;
  return activeCrateLetterByRound.find((e) => e.round === roundNumber)?.letter ?? null;
}

export async function getCrateByLetter(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  crateLetter: string
): Promise<BingoSessionCrate | null> {
  const crates = await getCratesForSession(db, sessionId);
  return crates.find((crate) => crate.crate_letter === crateLetter) ?? null;
}
