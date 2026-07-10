import { getBingoDb } from "src/lib/bingoDb";
import { resolveTrackKeys } from "src/lib/bingoEngine";

export type SwappableMusicGameSlug = "trivia" | "name-that-tune" | "genre-imposter";

type GameConfig = {
  sessionTable: string;
  callTable: string;
  callPatch: (resolved: {
    track_title: string;
    artist_name: string;
    album_name: string | null;
    side: string | null;
    position: string | null;
  }) => Record<string, unknown>;
};

type MusicGameSessionRow = {
  id: number;
  session_code: string;
  playlist_id: number | null;
};

type SwapCounts = {
  updated_collection_playlist_items: number;
  updated_session_calls: number;
};

export type MusicGameTrackSwapResult = {
  ok: true;
  game: SwappableMusicGameSlug;
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
  game: SwappableMusicGameSlug;
  sessionId: number;
  fromTrackKey: string;
  toTrackKey: string;
  dryRun?: boolean;
};

const GAME_CONFIG: Record<SwappableMusicGameSlug, GameConfig> = {
  trivia: {
    sessionTable: "trivia_sessions",
    callTable: "trivia_session_calls",
    callPatch: (resolved) => ({
      source_artist: resolved.artist_name,
      source_title: resolved.track_title,
      source_album: resolved.album_name,
      source_side: normalizeSide(resolved.side),
      source_position: normalizePosition(resolved.position),
    }),
  },
  "name-that-tune": {
    sessionTable: "ntt_sessions",
    callTable: "ntt_session_calls",
    callPatch: (resolved) => ({
      artist_answer: resolved.artist_name,
      title_answer: resolved.track_title,
      source_label: buildSourceLabel(resolved.album_name, resolved.side, resolved.position),
    }),
  },
  "genre-imposter": {
    sessionTable: "gi_sessions",
    callTable: "gi_session_calls",
    callPatch: (resolved) => ({
      artist: resolved.artist_name,
      title: resolved.track_title,
      source_label: buildSourceLabel(resolved.album_name, resolved.side, resolved.position),
      record_label: resolved.album_name,
    }),
  },
};

const EMPTY_COUNTS: SwapCounts = {
  updated_collection_playlist_items: 0,
  updated_session_calls: 0,
};

function normalizeSide(value: string | null | undefined): string | null {
  const side = String(value ?? "").trim().toUpperCase();
  return side.length > 0 ? side : null;
}

function normalizePosition(value: string | null | undefined): string | null {
  const position = String(value ?? "").trim();
  return position.length > 0 ? position : null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildSourceLabel(albumName: string | null | undefined, side: string | null | undefined, position: string | null | undefined): string | null {
  const cleanAlbum = normalizeText(albumName);
  const cleanSide = normalizeSide(side);
  const cleanPosition = normalizePosition(position);

  let sideAndPosition: string | null = null;
  if (cleanSide && cleanPosition) {
    sideAndPosition = cleanPosition.toUpperCase().startsWith(cleanSide) ? cleanPosition : `${cleanSide} ${cleanPosition}`;
  } else {
    sideAndPosition = cleanPosition ?? cleanSide;
  }

  const parts = [cleanAlbum, sideAndPosition].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" | ") : null;
}

export async function swapMusicGameSessionTrack(input: SwapInput): Promise<MusicGameTrackSwapResult> {
  const sessionId = Number(input.sessionId);
  const oldTrackKey = String(input.fromTrackKey ?? "").trim();
  const newTrackKey = String(input.toTrackKey ?? "").trim();
  const dryRun = input.dryRun === true;
  const config = GAME_CONFIG[input.game];

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
    .from(config.sessionTable)
    .select("id, session_code, playlist_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Session not found");

  const typedSession = session as MusicGameSessionRow;

  const { data: callConflictRows, error: callConflictError } = await dbAny
    .from(config.callTable)
    .select("playlist_track_key")
    .eq("session_id", sessionId)
    .in("playlist_track_key", [oldTrackKey, newTrackKey]);
  if (callConflictError) throw new Error(callConflictError.message);

  const callKeySet = new Set(
    ((callConflictRows ?? []) as Array<{ playlist_track_key: string | null }>)
      .map((row) => row.playlist_track_key)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );
  if (callKeySet.has(oldTrackKey) && callKeySet.has(newTrackKey)) {
    throw new Error("Swap aborted: destination track already exists in this session");
  }

  if (typedSession.playlist_id && typedSession.playlist_id > 0) {
    const { data: playlistConflictRows, error: playlistConflictError } = await dbAny
      .from("collection_playlist_items")
      .select("track_key")
      .eq("playlist_id", typedSession.playlist_id)
      .in("track_key", [oldTrackKey, newTrackKey]);
    if (playlistConflictError) throw new Error(playlistConflictError.message);

    const playlistKeys = new Set(
      ((playlistConflictRows ?? []) as Array<{ track_key: string }>)
        .map((row) => row.track_key)
        .filter((value) => typeof value === "string" && value.length > 0)
    );

    if (playlistKeys.has(oldTrackKey) && playlistKeys.has(newTrackKey)) {
      throw new Error("Swap aborted: destination track already exists in the source playlist");
    }
  }

  const resolvedMap = await resolveTrackKeys(db, [newTrackKey]);
  const resolved = resolvedMap.get(newTrackKey);
  if (!resolved) {
    throw new Error("Destination track key could not be resolved");
  }

  const counts: SwapCounts = { ...EMPTY_COUNTS };

  if (typedSession.playlist_id && typedSession.playlist_id > 0) {
    const { data: playlistRows, error: playlistSelectError } = await dbAny
      .from("collection_playlist_items")
      .select("id")
      .eq("playlist_id", typedSession.playlist_id)
      .eq("track_key", oldTrackKey);
    if (playlistSelectError) throw new Error(playlistSelectError.message);
    counts.updated_collection_playlist_items = (playlistRows ?? []).length;

    if (!dryRun && counts.updated_collection_playlist_items > 0) {
      const { error: playlistUpdateError } = await dbAny
        .from("collection_playlist_items")
        .update({ track_key: newTrackKey })
        .eq("playlist_id", typedSession.playlist_id)
        .eq("track_key", oldTrackKey);
      if (playlistUpdateError) throw new Error(playlistUpdateError.message);
    }
  }

  const { data: callRows, error: callSelectError } = await dbAny
    .from(config.callTable)
    .select("id")
    .eq("session_id", sessionId)
    .eq("playlist_track_key", oldTrackKey);
  if (callSelectError) throw new Error(callSelectError.message);
  counts.updated_session_calls = (callRows ?? []).length;

  if (!dryRun && counts.updated_session_calls > 0) {
    const { error: callUpdateError } = await dbAny
      .from(config.callTable)
      .update({
        playlist_track_key: newTrackKey,
        ...config.callPatch(resolved),
        metadata_synced_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .eq("playlist_track_key", oldTrackKey);
    if (callUpdateError) throw new Error(callUpdateError.message);
  }

  return {
    ok: true,
    game: input.game,
    session_id: sessionId,
    session_code: typedSession.session_code,
    old_track_key: oldTrackKey,
    new_track_key: newTrackKey,
    new_track_title: resolved.track_title,
    new_artist_name: resolved.artist_name,
    dry_run: dryRun,
    counts,
  };
}