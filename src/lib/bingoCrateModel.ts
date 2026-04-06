/**
 * bingoGamePlaylistModel.ts
 *
 * Helpers for managing immutable game playlists (call orders) attached to bingo sessions.
 * Each game playlist captures the generated call order at a point in time and is named with a
 * sequential letter (A, B, C…) scoped to the session so hosts can identify them easily.
 */

import { getBingoDb } from "./bingoDb";
import { planRoundSessionCalls, resolvePlaylistTracksForPlaylists } from "./bingoEngine";
import { getRoundSnapshotTracks } from "./bingoGameModel";
import { resolveRoundPlaylistIds, type RoundPlaylistEntry } from "./bingoRoundPlaylists";

const PLAYLIST_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type SessionCodeRow = {
  session_code: string;
};

export type PlaylistCallEntry = {
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

export type BingoSessionGamePlaylist = {
  id: number;
  session_id: number;
  round_number: number;
  playlist_name: string;
  playlist_letter: string;
  call_order: PlaylistCallEntry[];
  created_at: string;
};

type SessionPlaylistBackfillRow = {
  playlist_id: number | null;
  playlist_ids: number[] | null;
  round_playlist_ids: RoundPlaylistEntry[] | null;
  round_count: number;
  current_round: number;
  active_playlist_letter_by_round: { round: number; letter: string }[] | null;
};

async function deriveRoundCallOrder(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  roundNumber: number,
  session: SessionPlaylistBackfillRow,
  generation = 0
): Promise<PlaylistCallEntry[]> {
  const snapshotTracks = await getRoundSnapshotTracks(db, sessionId, roundNumber);
  if (snapshotTracks.length > 0) {
    const planned = planRoundSessionCalls(snapshotTracks, sessionId, roundNumber, generation);
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
      const planned = planRoundSessionCalls(resolvedTracks, sessionId, roundNumber, generation);
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
    return ((currentRoundCalls ?? []) as PlaylistCallEntry[]).map((row) => ({ ...row }));
  }

  return [];
}

/** Return the next available playlist letter for a session (across all rounds). */
async function getNextPlaylistLetter(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<string> {
  const { data } = await db
    .from("bingo_session_game_playlists")
    .select("playlist_letter")
    .eq("session_id", sessionId)
    .order("playlist_letter", { ascending: true });

  const usedLetters = new Set((data ?? []).map((row) => row.playlist_letter as string));
  const next = PLAYLIST_LETTERS.find((l) => !usedLetters.has(l));
  if (!next) throw new Error("All 26 playlist letters exhausted for this session.");
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

function formatPlaylistName(sessionCode: string | null, sessionId: number, playlistLetter: string): string {
  return `${sessionCode ?? sessionId} Playlist ${playlistLetter}`;
}

/** No-op stub — collection sync is handled by the dedicated admin endpoint. */
export async function syncCollectionPlaylistMirrorsForSession(
  _db: ReturnType<typeof getBingoDb>,
  _sessionId: number
): Promise<void> {
  // intentional no-op
}

/** No-op stub — collection sync is handled by the dedicated admin endpoint. */
export async function syncCollectionPlaylistMirrorsForAllSessions(
  _db: ReturnType<typeof getBingoDb>
): Promise<void> {
  // intentional no-op
}

/**
 * Persist the current call order for a session as a new named game playlist.
 * The playlist is automatically named "{sessionCode} Playlist {letter}".
 * Returns the newly-created row.
 */
export async function savePlaylistForRound(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  roundNumber: number,
  calls: PlaylistCallEntry[]
): Promise<BingoSessionGamePlaylist> {
  const letter = await getNextPlaylistLetter(db, sessionId);
  const sessionCode = await getSessionCode(db, sessionId);
  const playlistName = formatPlaylistName(sessionCode, sessionId, letter);

  const { data, error } = await db
    .from("bingo_session_game_playlists")
    .insert({
      session_id: sessionId,
      round_number: roundNumber,
      playlist_name: playlistName,
      playlist_letter: letter,
      call_order: calls as unknown as Record<string, unknown>[],
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save game playlist.");

  return {
    ...data,
    call_order: data.call_order as unknown as PlaylistCallEntry[],
  };
}

/** Return all game playlists for a session, ordered by letter. */
export async function getPlaylistsForSession(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<BingoSessionGamePlaylist[]> {
  const sessionCode = await getSessionCode(db, sessionId);
  const { data, error } = await db
    .from("bingo_session_game_playlists")
    .select("*")
    .eq("session_id", sessionId)
    .order("playlist_letter", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    playlist_name: formatPlaylistName(sessionCode, sessionId, row.playlist_letter),
    call_order: row.call_order as unknown as PlaylistCallEntry[],
  }));
}

/** Return a single game playlist by session id and letter, or null if not found. */
export async function getPlaylistByLetter(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  playlistLetter: string
): Promise<BingoSessionGamePlaylist | null> {
  const sessionCode = await getSessionCode(db, sessionId);
  const { data, error } = await db
    .from("bingo_session_game_playlists")
    .select("*")
    .eq("session_id", sessionId)
    .eq("playlist_letter", playlistLetter)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    ...data,
    playlist_name: formatPlaylistName(sessionCode, sessionId, data.playlist_letter),
    call_order: data.call_order as unknown as PlaylistCallEntry[],
  };
}

/** Return all game playlists for a specific round of a session. */
export async function getPlaylistsForRound(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  roundNumber: number
): Promise<BingoSessionGamePlaylist[]> {
  const sessionCode = await getSessionCode(db, sessionId);
  const { data, error } = await db
    .from("bingo_session_game_playlists")
    .select("*")
    .eq("session_id", sessionId)
    .eq("round_number", roundNumber)
    .order("playlist_letter", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    playlist_name: formatPlaylistName(sessionCode, sessionId, row.playlist_letter),
    call_order: row.call_order as unknown as PlaylistCallEntry[],
  }));
}

/**
 * Backfill missing game playlists for legacy sessions from existing immutable round data.
 *
 * Source priority per round:
 * 1) Existing round snapshots (bingo_session_round_tracks)
 * 2) Current round call rows (bingo_session_calls), current round only
 *
 * This intentionally avoids regenerating cards or overwriting existing call sheets.
 */
export async function backfillMissingLegacyPlaylists(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<void> {
  const { data: session, error: sessionError } = await db
    .from("bingo_sessions")
    .select("playlist_id, playlist_ids, round_playlist_ids, round_count, current_round, active_playlist_letter_by_round")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session) return;

  const typedSession = session as SessionPlaylistBackfillRow;
  const existingPlaylists = await getPlaylistsForSession(db, sessionId);

  for (let round = 1; round <= Math.max(1, typedSession.round_count || 1); round += 1) {
    const alreadyHasPlaylists = existingPlaylists.some((pl) => pl.round_number === round);
    if (alreadyHasPlaylists) continue;

    const callOrder = await deriveRoundCallOrder(db, sessionId, round, typedSession);

    if (callOrder.length === 0) continue;

    const createdPlaylist = await savePlaylistForRound(db, sessionId, round, callOrder);
    existingPlaylists.push(createdPlaylist);
  }

  const activeByRound = typedSession.active_playlist_letter_by_round ?? [];
  for (let round = 1; round <= Math.max(1, typedSession.round_count || 1); round += 1) {
    const hasActive = activeByRound.some((entry) => entry.round === round);
    if (hasActive) continue;

    const firstRoundPlaylist = existingPlaylists
      .filter((pl) => pl.round_number === round)
      .sort((left, right) => left.playlist_letter.localeCompare(right.playlist_letter))[0];

    if (firstRoundPlaylist) {
      await setActivePlaylistForRound(db, sessionId, round, firstRoundPlaylist.playlist_letter);
    }
  }
}

/**
 * Create a new game playlist from existing immutable session data.
 * Returns null when no source call-order data is available.
 */
export async function createPlaylistFromSessionData(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  roundNumber?: number
): Promise<BingoSessionGamePlaylist | null> {
  const { data: session, error } = await db
    .from("bingo_sessions")
    .select("playlist_id, playlist_ids, round_playlist_ids, current_round, round_count, active_playlist_letter_by_round")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!session) return null;

  const typedSession = session as SessionPlaylistBackfillRow;
  const effectiveRound = (roundNumber != null && roundNumber >= 1) ? roundNumber : (typedSession.current_round ?? 1);

  // Count ALL existing game playlists for this session so the new one gets a unique shuffle seed.
  const { data: existingAll } = await db
    .from("bingo_session_game_playlists")
    .select("id")
    .eq("session_id", sessionId);
  const generation = existingAll?.length ?? 0;

  const callOrder = await deriveRoundCallOrder(db, sessionId, effectiveRound, typedSession, generation);
  if (callOrder.length === 0) return null;

  return savePlaylistForRound(db, sessionId, effectiveRound, callOrder);
}

/**
 * Mark a playlist letter as the active game playlist for a round in the session.
 * Reads existing `active_playlist_letter_by_round` jsonb array and updates it.
 */
export async function setActivePlaylistForRound(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  roundNumber: number,
  playlistLetterOrNull: string | null
): Promise<void> {
  const { data: session } = await db
    .from("bingo_sessions")
    .select("active_playlist_letter_by_round")
    .eq("id", sessionId)
    .single();

  const existing: { round: number; letter: string }[] =
    (session?.active_playlist_letter_by_round as { round: number; letter: string }[] | null) ?? [];

  const without = existing.filter((entry) => entry.round !== roundNumber);
  const next =
    playlistLetterOrNull !== null
      ? [...without, { round: roundNumber, letter: playlistLetterOrNull }].sort((a, b) => a.round - b.round)
      : without;

  await db
    .from("bingo_sessions")
    .update({ active_playlist_letter_by_round: next })
    .eq("id", sessionId);
}

/** Return the active playlist letter for a round (null = none selected yet). */
export function getActivePlaylistLetter(
  activeCrateLetterByRound: { round: number; letter: string }[] | null,
  roundNumber: number
): string | null {
  if (!activeCrateLetterByRound) return null;
  return activeCrateLetterByRound.find((e) => e.round === roundNumber)?.letter ?? null;
}
