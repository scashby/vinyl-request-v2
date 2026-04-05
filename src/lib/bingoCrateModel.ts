/**
 * bingoCrateModel.ts
 *
 * Helpers for managing immutable call-order crates attached to bingo session rounds.
 * Each crate captures the generated call order at a point in time and is named with a
 * sequential letter (A, B, C…) scoped to the session so hosts can identify them easily.
 */

import { getBingoDb } from "./bingoDb";
import { planRoundSessionCalls, resolvePlaylistTracksForPlaylists } from "./bingoEngine";
import { getRoundSnapshotTracks } from "./bingoGameModel";
import { resolveRoundPlaylistIds, type RoundPlaylistEntry } from "./bingoRoundPlaylists";

const CRATE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type SessionCodeRow = {
  session_code: string;
};

export type CrateCallEntry = {
  id: number;
  call_index: number;
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
};

type SessionCrateBackfillRow = {
  playlist_id: number | null;
  playlist_ids: number[] | null;
  round_playlist_ids: RoundPlaylistEntry[] | null;
  round_count: number;
  current_round: number;
  active_crate_letter_by_round: { round: number; letter: string }[] | null;
};

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
      .select("id, call_index, ball_number, column_letter, track_title, artist_name, album_name, side, position, status")
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
  sessionId: number
): Promise<string> {
  const { data } = await db
    .from("bingo_session_crates")
    .select("crate_letter")
    .eq("session_id", sessionId)
    .order("crate_letter", { ascending: true });

  const usedLetters = new Set((data ?? []).map((row) => row.crate_letter as string));
  const next = CRATE_LETTERS.find((l) => !usedLetters.has(l));
  if (!next) throw new Error("All 26 crate letters exhausted for this session.");
  return next;
}

async function getSessionCode(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<string | null> {
  const { data, error } = await db
    .from("bingo_sessions")
    .select("session_code")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as SessionCodeRow | null)?.session_code ?? null;
}

function formatCrateName(sessionCode: string | null, sessionId: number, crateLetter: string): string {
  return `${sessionCode ?? sessionId} Playlist ${crateLetter}`;
}

/** No-op stub — collection sync is handled by the dedicated admin endpoint. */
export async function syncCollectionCrateMirrorsForSession(
  _db: ReturnType<typeof getBingoDb>,
  _sessionId: number
): Promise<void> {
  // intentional no-op
}

/** No-op stub — collection sync is handled by the dedicated admin endpoint. */
export async function syncCollectionCrateMirrorsForAllSessions(
  _db: ReturnType<typeof getBingoDb>
): Promise<void> {
  // intentional no-op
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
  const letter = await getNextCrateLetter(db, sessionId);
  const sessionCode = await getSessionCode(db, sessionId);
  const crateName = formatCrateName(sessionCode, sessionId, letter);

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
  const sessionCode = await getSessionCode(db, sessionId);
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
  const sessionCode = await getSessionCode(db, sessionId);
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
  const { data: session, error: sessionError } = await db
    .from("bingo_sessions")
    .select("playlist_id, playlist_ids, round_playlist_ids, round_count, current_round, active_crate_letter_by_round")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session) return;

  const typedSession = session as SessionCrateBackfillRow;
  const existingCrates = await getCratesForSession(db, sessionId);

  for (let round = 1; round <= Math.max(1, typedSession.round_count || 1); round += 1) {
    const alreadyHasCrates = existingCrates.some((crate) => crate.round_number === round);
    if (alreadyHasCrates) continue;

    const callOrder = await deriveRoundCallOrder(db, sessionId, round, typedSession);

    if (callOrder.length === 0) continue;

    const createdCrate = await saveCrateForRound(db, sessionId, round, callOrder);
    existingCrates.push(createdCrate);
  }

  const activeByRound = typedSession.active_crate_letter_by_round ?? [];
  for (let round = 1; round <= Math.max(1, typedSession.round_count || 1); round += 1) {
    const hasActive = activeByRound.some((entry) => entry.round === round);
    if (hasActive) continue;

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
  const { data: session, error } = await db
    .from("bingo_sessions")
    .select("playlist_id, playlist_ids, round_playlist_ids, current_round, round_count, active_crate_letter_by_round")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
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
