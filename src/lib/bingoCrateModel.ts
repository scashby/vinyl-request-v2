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

const PLAYLIST_NAMES = [
  "Fox", "Owl", "Bear", "Wolf", "Hawk", "Elk", "Crow", "Deer", "Seal", "Wren",
  "Crane", "Heron", "Stork", "Robin", "Swift", "Falcon", "Eagle", "Dove", "Otter", "Whale",
  "Beaver", "Badger", "Moose", "Bison", "Cobra", "Gecko", "Quail", "Panda", "Koala", "Sloth",
  "Lemur", "Okapi", "Narwhal", "Viper", "Lynx", "Mink", "Ibis", "Tapir", "Dingo", "Finch",
];

const GAME_PLAYLISTS_TABLE = "bingo_session_game_playlists";
const LEGACY_CRATES_TABLE = "bingo_session_crates";
const ACTIVE_PLAYLIST_FIELD = "active_playlist_letter_by_round";
const ACTIVE_CRATE_FIELD = "active_crate_letter_by_round";
const GAME_PLAYLIST_SELECT = "id, session_id, round_number, playlist_name, playlist_letter, call_order, created_at";
const LEGACY_CRATE_SELECT = "id, session_id, round_number, playlist_name:crate_name, playlist_letter:crate_letter, call_order, created_at";
const PLAYLIST_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type SessionActivePlaylistEntry = {
  round: number;
  letter: string;
};

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
  track_key?: string | null;
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
  active_playlist_letter_by_round: SessionActivePlaylistEntry[] | null;
};

function getDynamicTableDb(db: ReturnType<typeof getBingoDb>): {
  from: (tableName: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string | number) => {
        eq: (column: string, value: string | number) => {
          order: (column: string, options: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }>;
          maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
        order: (column: string, options: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }>;
        maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      order: (column: string, options: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }>;
      maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      single: () => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    insert: (payload: unknown) => {
      select: (columns: string) => {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string | number) => Promise<{ error: { message: string } | null }>;
    };
    delete: () => {
      eq: (column: string, value: string | number) => {
        eq: (column: string, value: string | number) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
} {
  return db as unknown as {
    from: (tableName: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string | number) => {
          eq: (column: string, value: string | number) => {
            order: (column: string, options: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }>;
            maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
          };
          order: (column: string, options: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }>;
          maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
        order: (column: string, options: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }>;
        maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      insert: (payload: unknown) => {
        select: (columns: string) => {
          single: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
      update: (payload: Record<string, unknown>) => {
        eq: (column: string, value: string | number) => Promise<{ error: { message: string } | null }>;
      };
      delete: () => {
        eq: (column: string, value: string | number) => {
          eq: (column: string, value: string | number) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
  };
}

function isMissingSchemaObject(error: unknown, schemaObject: string): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const normalizedSchemaObject = schemaObject.toLowerCase();

  return (
    message.includes(normalizedSchemaObject) &&
    (message.includes("does not exist") ||
      message.includes("could not find") ||
      message.includes("schema cache") ||
      message.includes("column") ||
      message.includes("relation"))
  );
}

async function withPlaylistTableFallback<T>(
  operation: (tableName: typeof GAME_PLAYLISTS_TABLE | typeof LEGACY_CRATES_TABLE, selectClause: string, letterColumn: string, nameColumn: string) => Promise<T>
): Promise<T> {
  try {
    return await operation(GAME_PLAYLISTS_TABLE, GAME_PLAYLIST_SELECT, "playlist_letter", "playlist_name");
  } catch (error) {
    if (!isMissingSchemaObject(error, GAME_PLAYLISTS_TABLE)) {
      throw error;
    }

    return operation(LEGACY_CRATES_TABLE, LEGACY_CRATE_SELECT, "crate_letter", "crate_name");
  }
}

async function selectSessionPlaylistBackfillRow(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<SessionPlaylistBackfillRow | null> {
  const baseFields = "playlist_id, playlist_ids, round_playlist_ids, round_count, current_round";

  try {
    const { data, error } = await db
      .from("bingo_sessions")
      .select(`${baseFields}, ${ACTIVE_PLAYLIST_FIELD}`)
      .eq("id", sessionId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as SessionPlaylistBackfillRow | null) ?? null;
  } catch (error) {
    if (!isMissingSchemaObject(error, ACTIVE_PLAYLIST_FIELD)) {
      throw error;
    }

    const { data, error: legacyError } = await db
      .from("bingo_sessions")
      .select(`${baseFields}, ${ACTIVE_CRATE_FIELD}`)
      .eq("id", sessionId)
      .maybeSingle();

    if (legacyError) throw new Error(legacyError.message);
    if (!data) return null;

    const row = data as unknown as Record<string, unknown>;
    return {
      playlist_id: (row.playlist_id as number | null) ?? null,
      playlist_ids: (row.playlist_ids as number[] | null) ?? null,
      round_playlist_ids: (row.round_playlist_ids as RoundPlaylistEntry[] | null) ?? null,
      round_count: (row.round_count as number | null) ?? 1,
      current_round: (row.current_round as number | null) ?? 1,
      active_playlist_letter_by_round: (row[ACTIVE_CRATE_FIELD] as SessionActivePlaylistEntry[] | null) ?? null,
    };
  }
}

async function selectActivePlaylistLetters(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<{ entries: SessionActivePlaylistEntry[]; fieldName: typeof ACTIVE_PLAYLIST_FIELD | typeof ACTIVE_CRATE_FIELD }> {
  try {
    const { data, error } = await db
      .from("bingo_sessions")
      .select(ACTIVE_PLAYLIST_FIELD)
      .eq("id", sessionId)
      .single();

    if (error) throw new Error(error.message);
    return {
      entries: ((data as unknown as Record<string, unknown> | null)?.[ACTIVE_PLAYLIST_FIELD] as SessionActivePlaylistEntry[] | null) ?? [],
      fieldName: ACTIVE_PLAYLIST_FIELD,
    };
  } catch (error) {
    if (!isMissingSchemaObject(error, ACTIVE_PLAYLIST_FIELD)) {
      throw error;
    }

    const { data, error: legacyError } = await db
      .from("bingo_sessions")
      .select(ACTIVE_CRATE_FIELD)
      .eq("id", sessionId)
      .single();

    if (legacyError) throw new Error(legacyError.message);
    return {
      entries: ((data as unknown as Record<string, unknown> | null)?.[ACTIVE_CRATE_FIELD] as SessionActivePlaylistEntry[] | null) ?? [],
      fieldName: ACTIVE_CRATE_FIELD,
    };
  }
}

async function updateActivePlaylistLetters(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  fieldName: typeof ACTIVE_PLAYLIST_FIELD | typeof ACTIVE_CRATE_FIELD,
  entries: SessionActivePlaylistEntry[]
): Promise<void> {
  let error: { message: string } | null = null;

  if (fieldName === ACTIVE_PLAYLIST_FIELD) {
    const result = await db
      .from("bingo_sessions")
      .update({ active_playlist_letter_by_round: entries })
      .eq("id", sessionId);

    error = result.error;
  } else {
    const legacyDb = db as unknown as {
      from: (tableName: string) => {
        update: (payload: Record<string, unknown>) => {
          eq: (column: string, value: number) => Promise<{ error: { message: string } | null }>;
        };
      };
    };

    const result = await legacyDb
      .from("bingo_sessions")
      .update({ [ACTIVE_CRATE_FIELD]: entries })
      .eq("id", sessionId);

    error = result.error;
  }

  if (error) throw new Error(error.message);
}

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
      track_key: row.playlist_track_key,
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
        track_key: row.playlist_track_key,
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
    return ((currentRoundCalls ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as number,
      call_index: row.call_index as number,
      ball_number: row.ball_number as number | null,
      column_letter: row.column_letter as string,
      track_title: row.track_title as string,
      artist_name: row.artist_name as string,
      album_name: row.album_name as string | null,
      side: row.side as string | null,
      position: row.position as string | null,
      status: row.status as string,
      track_key: (row.playlist_track_key as string | null) ?? null,
    }));
  }

  return [];
}

/** Return the next available playlist letter for a session (across all rounds). */
async function getNextPlaylistLetter(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<string> {
  const data = await withPlaylistTableFallback<Array<{ playlist_letter: string }>>(async (tableName, selectClause, letterColumn) => {
    const { data: rows, error } = await getDynamicTableDb(db)
      .from(tableName)
      .select(tableName === GAME_PLAYLISTS_TABLE ? "playlist_letter" : "playlist_letter:crate_letter")
      .eq("session_id", sessionId)
      .order(letterColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{ playlist_letter: string }>;
  });

  const usedLetters = new Set<string>();
  for (const row of data ?? []) {
    const raw = String(row.playlist_letter ?? "").trim();
    if (!raw) continue;

    if (/^[A-Z]$/.test(raw)) {
      usedLetters.add(raw);
      continue;
    }

    // Compatibility: if prior code stored animal names in playlist_letter,
    // map them back to canonical A-Z slots before selecting the next letter.
    const legacyNameIndex = PLAYLIST_NAMES.findIndex((name) => name.toLowerCase() === raw.toLowerCase());
    if (legacyNameIndex >= 0 && legacyNameIndex < PLAYLIST_LETTERS.length) {
      usedLetters.add(PLAYLIST_LETTERS[legacyNameIndex]);
    }
  }

  const next = PLAYLIST_LETTERS.find((letter) => !usedLetters.has(letter));
  if (!next) throw new Error("All game playlist letters exhausted for this session.");
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
  // Legacy rows stored single uppercase letters (A, B, C…) — map them to the animal name at the same index.
  const displayName = /^[A-Z]$/.test(playlistLetter)
    ? (PLAYLIST_NAMES[playlistLetter.charCodeAt(0) - 65] ?? playlistLetter)
    : playlistLetter;
  return `${sessionCode ?? sessionId} Playlist ${displayName}`;
}

/** Sync a single game playlist to collection_playlists and collection_playlist_items. */
async function syncPlaylistToCollection(
  db: ReturnType<typeof getBingoDb>,
  playlist: BingoSessionGamePlaylist
): Promise<void> {
  try {
    const { data: existing } = await db
      .from("collection_playlists")
      .select("id")
      .eq("name", playlist.playlist_name)
      .maybeSingle();

    let collectionPlaylistId: number;

    if (existing) {
      collectionPlaylistId = (existing as { id: number }).id;
      // Patch icon/color if they were never set (e.g. entries created before this field was populated).
      await db
        .from("collection_playlists")
        .update({ icon: "🎲", color: "#451a7d" })
        .eq("id", collectionPlaylistId)
        .is("icon", null);
    } else {
      const { data: maxRow } = await db
        .from("collection_playlists")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextSortOrder = ((maxRow as { sort_order?: number } | null)?.sort_order ?? 0) + 1;

      const { data: created, error: createError } = await db
        .from("collection_playlists")
        .insert({
          name: playlist.playlist_name,
          icon: "🎲",
          color: "#451a7d",
          is_smart: false,
          smart_rules: null,
          match_rules: "all",
          live_update: false,
          sort_order: nextSortOrder,
        })
        .select("id")
        .single();

      if (createError || !created) return;
      collectionPlaylistId = (created as { id: number }).id;
    }

    const trackKeys = playlist.call_order
      .map((entry) => entry.track_key)
      .filter((key): key is string => typeof key === "string" && key.length > 0);

    // Always replace items; if no track_keys the playlist entry still exists in the library.
    await db.from("collection_playlist_items").delete().eq("playlist_id", collectionPlaylistId);
    if (trackKeys.length > 0) {
      await db.from("collection_playlist_items").insert(
        trackKeys.map((trackKey, idx) => ({
          playlist_id: collectionPlaylistId,
          track_key: trackKey,
          sort_order: idx + 1,
        }))
      );
    }
  } catch {
    // Non-fatal: collection sync failure should not break game playlist creation
  }
}

/** Sync all game playlists for a session to their collection mirrors. */
export async function syncCollectionPlaylistMirrorsForSession(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<void> {
  // Fetch session source data so we can re-derive call orders for playlists that pre-date
  // the track_key field and therefore have no keys in their stored call_order JSON.
  const sessionRow = await selectSessionPlaylistBackfillRow(db, sessionId);

  const playlists = await getPlaylistsForSession(db, sessionId);
  for (const playlist of playlists) {
    const hasTrackKeys = playlist.call_order.some(
      (e) => typeof e.track_key === "string" && e.track_key.length > 0
    );
    if (!hasTrackKeys && sessionRow) {
      // Re-derive so we pick up playlist_track_key values that weren't stored originally.
      const freshCalls = await deriveRoundCallOrder(
        db,
        sessionId,
        playlist.round_number,
        sessionRow as SessionPlaylistBackfillRow
      );
      await syncPlaylistToCollection(db, { ...playlist, call_order: freshCalls });
    } else {
      await syncPlaylistToCollection(db, playlist);
    }
  }
}

/** Sync all game playlists across all sessions to their collection mirrors. */
export async function syncCollectionPlaylistMirrorsForAllSessions(
  db: ReturnType<typeof getBingoDb>
): Promise<void> {
  const { data: sessions } = await db.from("bingo_sessions").select("id");
  for (const session of sessions ?? []) {
    await syncCollectionPlaylistMirrorsForSession(db, (session as { id: number }).id);
  }
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

  const data = await withPlaylistTableFallback<{
    id: number;
    session_id: number;
    round_number: number;
    playlist_name: string;
    playlist_letter: string;
    call_order: Record<string, unknown>[];
    created_at: string;
  }>(async (tableName, selectClause) => {
    const insertRow =
      tableName === GAME_PLAYLISTS_TABLE
        ? {
            session_id: sessionId,
            round_number: roundNumber,
            playlist_name: playlistName,
            playlist_letter: letter,
            call_order: calls as unknown as Record<string, unknown>[],
          }
        : {
            session_id: sessionId,
            round_number: roundNumber,
            crate_name: playlistName,
            crate_letter: letter,
            call_order: calls as unknown as Record<string, unknown>[],
          };

    const { data: created, error } = await getDynamicTableDb(db)
      .from(tableName)
      .insert(insertRow)
      .select(selectClause)
      .single();

    if (error || !created) throw new Error(error?.message ?? "Failed to save game playlist.");
    return created as {
      id: number;
      session_id: number;
      round_number: number;
      playlist_name: string;
      playlist_letter: string;
      call_order: Record<string, unknown>[];
      created_at: string;
    };
  });

  const saved: BingoSessionGamePlaylist = {
    ...data,
    call_order: data.call_order as unknown as PlaylistCallEntry[],
  };

  // Mirror to collection in the background (non-blocking, non-fatal)
  void syncPlaylistToCollection(db, {
    ...saved,
    call_order: calls, // use the in-memory call_order which already has track_key populated
  });

  return saved;
}

/** Return all game playlists for a session, ordered by letter. */
export async function getPlaylistsForSession(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<BingoSessionGamePlaylist[]> {
  const sessionCode = await getSessionCode(db, sessionId);
  const data = await withPlaylistTableFallback<Array<{
    id: number;
    session_id: number;
    round_number: number;
    playlist_name: string;
    playlist_letter: string;
    call_order: Record<string, unknown>[];
    created_at: string;
  }>>(async (tableName, selectClause, letterColumn) => {
    const { data: rows, error } = await getDynamicTableDb(db)
      .from(tableName)
      .select(selectClause)
      .eq("session_id", sessionId)
      .order(letterColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: number;
      session_id: number;
      round_number: number;
      playlist_name: string;
      playlist_letter: string;
      call_order: Record<string, unknown>[];
      created_at: string;
    }>;
  });

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
  const data = await withPlaylistTableFallback<{
    id: number;
    session_id: number;
    round_number: number;
    playlist_name: string;
    playlist_letter: string;
    call_order: Record<string, unknown>[];
    created_at: string;
  } | null>(async (tableName, selectClause, letterColumn) => {
    const { data: row, error } = await getDynamicTableDb(db)
      .from(tableName)
      .select(selectClause)
      .eq("session_id", sessionId)
      .eq(letterColumn, playlistLetter)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (row as {
      id: number;
      session_id: number;
      round_number: number;
      playlist_name: string;
      playlist_letter: string;
      call_order: Record<string, unknown>[];
      created_at: string;
    } | null) ?? null;
  });

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
  const data = await withPlaylistTableFallback<Array<{
    id: number;
    session_id: number;
    round_number: number;
    playlist_name: string;
    playlist_letter: string;
    call_order: Record<string, unknown>[];
    created_at: string;
  }>>(async (tableName, selectClause, letterColumn) => {
    const { data: rows, error } = await getDynamicTableDb(db)
      .from(tableName)
      .select(selectClause)
      .eq("session_id", sessionId)
      .eq("round_number", roundNumber)
      .order(letterColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: number;
      session_id: number;
      round_number: number;
      playlist_name: string;
      playlist_letter: string;
      call_order: Record<string, unknown>[];
      created_at: string;
    }>;
  });

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
  const session = await selectSessionPlaylistBackfillRow(db, sessionId);
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
  const session = await selectSessionPlaylistBackfillRow(db, sessionId);
  if (!session) return null;

  const typedSession = session as SessionPlaylistBackfillRow;
  const effectiveRound = (roundNumber != null && roundNumber >= 1) ? roundNumber : (typedSession.current_round ?? 1);

  // Count ALL existing game playlists for this session so the new one gets a unique shuffle seed.
  const existingAll = await withPlaylistTableFallback<Array<{ id: number }>>(async (tableName) => {
    const { data, error } = await (getDynamicTableDb(db)
      .from(tableName)
      .select("id")
      .eq("session_id", sessionId) as unknown as Promise<{
        data: unknown;
        error: { message: string } | null;
      }>);

    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: number }>;
  });
  const generation = existingAll?.length ?? 0;

  const callOrder = await deriveRoundCallOrder(db, sessionId, effectiveRound, typedSession, generation);
  if (callOrder.length === 0) return null;

  return savePlaylistForRound(db, sessionId, effectiveRound, callOrder);
}

/**
 * Regenerate the call_order for every game playlist in a session so each has a
 * unique shuffle. Useful when multiple playlists were created with the same seed
 * and therefore ended up with identical call orders.
 *
 * Each playlist is assigned generation = (its alphabetical index + 1), which
 * produces a deterministic but distinct seed per playlist. The existing playlist
 * rows are updated in-place (names and letters are preserved). Collection items
 * are re-synced immediately.
 */
export async function reshuffleAllPlaylists(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number
): Promise<void> {
  const session = await selectSessionPlaylistBackfillRow(db, sessionId);
  if (!session) throw new Error("Session not found");

  const typedSession = session as SessionPlaylistBackfillRow;
  const playlists = await getPlaylistsForSession(db, sessionId);
  if (playlists.length === 0) return;

  const sorted = [...playlists].sort((a, b) => a.playlist_letter.localeCompare(b.playlist_letter));

  for (let i = 0; i < sorted.length; i++) {
    const playlist = sorted[i];
    const generation = i + 1; // unique per-playlist; generation 0 was the broken shared seed
    const newCallOrder = await deriveRoundCallOrder(db, sessionId, playlist.round_number, typedSession, generation);
    if (newCallOrder.length === 0) continue;

    await withPlaylistTableFallback(async (tableName) => {
      const { error } = await getDynamicTableDb(db)
        .from(tableName)
        .update({ call_order: newCallOrder as unknown as Record<string, unknown>[] })
        .eq("id", playlist.id);

      if (error) throw new Error(error.message);
    });

    await syncPlaylistToCollection(db, { ...playlist, call_order: newCallOrder });
  }
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
  const { entries: existing, fieldName } = await selectActivePlaylistLetters(db, sessionId);

  const without = existing.filter((entry) => entry.round !== roundNumber);
  const next =
    playlistLetterOrNull !== null
      ? [...without, { round: roundNumber, letter: playlistLetterOrNull }].sort((a, b) => a.round - b.round)
      : without;

  await updateActivePlaylistLetters(db, sessionId, fieldName, next);
}

/** Return the active playlist letter for a round (null = none selected yet). */
export function getActivePlaylistLetter(
  activeCrateLetterByRound: { round: number; letter: string }[] | null,
  roundNumber: number
): string | null {
  if (!activeCrateLetterByRound) return null;
  return activeCrateLetterByRound.find((e) => e.round === roundNumber)?.letter ?? null;
}

/**
 * Delete a game playlist by its letter, clearing it from the active-playlist map
 * and removing the matching collection playlist mirror if one exists.
 */
export async function deletePlaylistByLetter(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  playlistLetter: string
): Promise<void> {
  const sessionCode = await getSessionCode(db, sessionId);
  const playlistName = formatPlaylistName(sessionCode, sessionId, playlistLetter);

  await withPlaylistTableFallback(async (tableName, _selectClause, letterColumn) => {
    const { error } = await getDynamicTableDb(db)
      .from(tableName)
      .delete()
      .eq("session_id", sessionId)
      .eq(letterColumn, playlistLetter);

    if (error) throw new Error(error.message);
  });

  // Remove from active_playlist_letter_by_round if present
  const { entries: existing, fieldName } = await selectActivePlaylistLetters(db, sessionId);
  const updated = existing.filter((entry) => entry.letter !== playlistLetter);
  await updateActivePlaylistLetters(db, sessionId, fieldName, updated);

  // Delete collection playlist mirror (non-fatal)
  try {
    const { data: collectionPlaylist } = await db
      .from("collection_playlists")
      .select("id")
      .eq("name", playlistName)
      .maybeSingle();

    if (collectionPlaylist) {
      await db.from("collection_playlist_items").delete().eq("playlist_id", (collectionPlaylist as { id: number }).id);
      await db.from("collection_playlists").delete().eq("id", (collectionPlaylist as { id: number }).id);
    }
  } catch {
    // Non-fatal
  }
}
