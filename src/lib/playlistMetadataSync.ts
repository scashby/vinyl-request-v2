import { getBingoDb } from "src/lib/bingoDb";
import { resolveTrackKeys } from "src/lib/bingoEngine";

export type PlaylistSeededGameSlug = "bingo" | "trivia" | "name-that-tune" | "genre-imposter";

export type PlaylistMetadataUnresolvedItem = {
  call_id: number;
  playlist_track_key: string | null;
  reason: "missing_track_key" | "unresolvable_track_key";
};

export type PlaylistMetadataSyncResult = {
  ok: true;
  updated_count: number;
  skipped_locked_count: number;
  unresolved_count: number;
  unresolved_items: PlaylistMetadataUnresolvedItem[];
};

type SyncOptions = {
  dryRun?: boolean;
};

type GameConfig = {
  callTable: string;
};

type DbJson = string | number | boolean | null | { [key: string]: DbJson | undefined } | DbJson[];

const GAME_CONFIG: Record<PlaylistSeededGameSlug, GameConfig> = {
  bingo: { callTable: "bingo_session_calls" },
  trivia: { callTable: "trivia_session_calls" },
  "name-that-tune": { callTable: "ntt_session_calls" },
  "genre-imposter": { callTable: "gi_session_calls" },
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

function hasDiff(row: Record<string, unknown>, patch: Record<string, unknown>): boolean {
  return Object.entries(patch).some(([key, nextValue]) => {
    if (key === "metadata_synced_at") return true;
    const current = row[key];
    return current !== nextValue;
  });
}

export async function rehydrateBingoCardLabels(sessionId: number): Promise<void> {
  const db = getBingoDb();

  const { data: session } = await db
    .from("bingo_sessions")
    .select("id, card_label_mode")
    .eq("id", sessionId)
    .maybeSingle();
  const labelMode = (session?.card_label_mode ?? "track_artist") as "track_artist" | "track_only";

  const { data: calls } = await db
    .from("bingo_session_calls")
    .select("id, track_title, artist_name")
    .eq("session_id", sessionId);
  const callMap = new Map<number, { track_title: string; artist_name: string }>(
    ((calls ?? []) as Array<{ id: number; track_title: string; artist_name: string }>).map((row) => [row.id, row])
  );

  const { data: cards } = await db
    .from("bingo_cards")
    .select("id, grid")
    .eq("session_id", sessionId);

  for (const card of (cards ?? []) as Array<{ id: number; grid: unknown }>) {
    if (!Array.isArray(card.grid)) continue;
    let changed = false;
    const nextGrid = (card.grid as unknown[]).map((cell) => {
      if (!cell || typeof cell !== "object") return cell;
      const typed = cell as Record<string, unknown>;
      if (typed.free) return cell;
      const callId = typeof typed.call_id === "number" ? typed.call_id : null;
      if (!callId) return cell;
      const call = callMap.get(callId);
      if (!call) return cell;

      const label = labelMode === "track_only" ? call.track_title : `${call.track_title} - ${call.artist_name}`;
      if (typed.track_title === call.track_title && typed.artist_name === call.artist_name && typed.label === label) {
        return cell;
      }

      changed = true;
      return {
        ...typed,
        track_title: call.track_title,
        artist_name: call.artist_name,
        label,
      };
    });

    if (changed) {
      await db.from("bingo_cards").update({ grid: nextGrid as DbJson }).eq("id", card.id);
    }
  }
}

function buildCallPatch(
  game: PlaylistSeededGameSlug,
  resolved: { track_title: string; artist_name: string; album_name: string | null; side: string | null; position: string | null },
  nowIso: string
): Record<string, unknown> {
  if (game === "bingo") {
    return {
      track_title: resolved.track_title,
      artist_name: resolved.artist_name,
      album_name: resolved.album_name,
      side: normalizeSide(resolved.side),
      position: normalizePosition(resolved.position),
      metadata_synced_at: nowIso,
    };
  }

  if (game === "trivia") {
    return {
      source_artist: resolved.artist_name,
      source_title: resolved.track_title,
      source_album: resolved.album_name,
      source_side: normalizeSide(resolved.side),
      source_position: normalizePosition(resolved.position),
      metadata_synced_at: nowIso,
    };
  }

  if (game === "name-that-tune") {
    return {
      artist_answer: resolved.artist_name,
      title_answer: resolved.track_title,
      source_label: buildSourceLabel(resolved.album_name, resolved.side, resolved.position),
      metadata_synced_at: nowIso,
    };
  }

  return {
    artist: resolved.artist_name,
    title: resolved.track_title,
    source_label: buildSourceLabel(resolved.album_name, resolved.side, resolved.position),
    record_label: resolved.album_name,
    metadata_synced_at: nowIso,
  };
}

export async function syncSessionPlaylistMetadata(
  game: PlaylistSeededGameSlug,
  sessionId: number,
  options: SyncOptions = {}
): Promise<PlaylistMetadataSyncResult> {
  const dryRun = options.dryRun === true;
  const config = GAME_CONFIG[game];
  const db = getBingoDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;

  const { data: calls, error: callError } = await dbAny
    .from(config.callTable)
    .select("*")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (callError) throw new Error(callError.message);

  const rows = ((calls ?? []) as Array<Record<string, unknown>>).filter((row) => typeof row.id === "number");
  const unresolved: PlaylistMetadataUnresolvedItem[] = [];
  let updatedCount = 0;
  let skippedLockedCount = 0;

  const keys = Array.from(
    new Set(
      rows
        .filter((row) => row.metadata_locked !== true)
        .map((row) => normalizeText(row.playlist_track_key))
        .filter((value): value is string => Boolean(value))
    )
  );
  const resolvedMap = await resolveTrackKeys(db, keys);
  const nowIso = new Date().toISOString();

  for (const row of rows) {
    const callId = row.id as number;
    if (row.metadata_locked === true) {
      skippedLockedCount += 1;
      continue;
    }

    const trackKey = normalizeText(row.playlist_track_key);
    if (!trackKey) {
      unresolved.push({ call_id: callId, playlist_track_key: null, reason: "missing_track_key" });
      continue;
    }

    const resolved = resolvedMap.get(trackKey);
    if (!resolved) {
      unresolved.push({ call_id: callId, playlist_track_key: trackKey, reason: "unresolvable_track_key" });
      continue;
    }

    const patch = buildCallPatch(game, resolved, nowIso);
    if (!hasDiff(row, patch)) continue;
    updatedCount += 1;

    if (!dryRun) {
      const { error: updateError } = await dbAny.from(config.callTable).update(patch).eq("id", callId);
      if (updateError) throw new Error(updateError.message);
    }
  }

  if (!dryRun && game === "bingo" && updatedCount > 0) {
    await rehydrateBingoCardLabels(sessionId);
  }

  return {
    ok: true,
    updated_count: updatedCount,
    skipped_locked_count: skippedLockedCount,
    unresolved_count: unresolved.length,
    unresolved_items: unresolved,
  };
}

export async function autoSyncSessionPlaylistMetadata(game: PlaylistSeededGameSlug, sessionId: number): Promise<void> {
  const config = GAME_CONFIG[game];
  const db = getBingoDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;
  const { data, error } = await dbAny
    .from(config.callTable)
    .select("id")
    .eq("session_id", sessionId)
    .eq("metadata_locked", false)
    .is("metadata_synced_at", null)
    .not("playlist_track_key", "is", null)
    .limit(1);

  if (error) throw new Error(error.message);
  if (!Array.isArray(data) || data.length === 0) return;

  await syncSessionPlaylistMetadata(game, sessionId, { dryRun: false });
}
