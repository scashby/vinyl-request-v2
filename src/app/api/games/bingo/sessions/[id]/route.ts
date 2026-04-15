import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import {
  computeMinimumPlaylistTracks,
  computeRemainingSeconds,
  getPlaylistTrackCountForPlaylists,
  type GameMode,
} from "src/lib/bingoEngine";
import { GAME_MODE_OPTIONS, normalizeRoundModes } from "src/lib/bingoModes";
import {
  collectResolvedPlaylistIdsByRound,
  findPrimaryPlaylistId,
  normalizePlaylistIds,
  normalizeRoundPlaylistIds,
  type RoundPlaylistEntry,
} from "src/lib/bingoRoundPlaylists";
import { computeTransportQueueIds, type TransportQueueEvent } from "src/lib/transportQueue";

export const runtime = "nodejs";

type BingoSessionPatch = {
  id?: number;
  event_id?: number | null;
  game_preset_id?: number | null;
  playlist_ids?: number[] | null;
  master_playlist_ids?: number[] | null;
  default_intermission_seconds?: number;
  playlist_id?: number;
  session_code?: string;
  game_mode?: string;
  card_count?: number;
  card_layout?: string;
  card_label_mode?: string;
  round_count?: number;
  current_round?: number;
  round_end_policy?: string;
  tie_break_policy?: string;
  pool_exhaustion_policy?: string;
  remove_resleeve_seconds?: number;
  place_vinyl_seconds?: number;
  cue_seconds?: number;
  start_slide_seconds?: number;
  host_buffer_seconds?: number;
  seconds_to_next_call?: number;
  sonos_output_delay_ms?: number;
  countdown_started_at?: string | null;
  paused_remaining_seconds?: number | null;
  paused_at?: string | null;
  current_call_index?: number;
  recent_calls_limit?: number;
  show_title?: boolean;
  show_logo?: boolean;
  show_rounds?: boolean;
  show_countdown?: boolean;
  status?: string;
  started_at?: string | null;
  ended_at?: string | null;
  next_game_scheduled_at?: string | null;
  next_game_rules_text?: string | null;
  welcome_heading_text?: string | null;
  welcome_message_text?: string | null;
  welcome_rules_text?: string | null;
  welcome_tiebreak_text?: string | null;
  intermission_heading_text?: string | null;
  intermission_message_text?: string | null;
  intermission_footer_text?: string | null;
  thanks_heading_text?: string | null;
  thanks_subheading_text?: string | null;
  thanks_events_heading_text?: string | null;
  round_modes?: { round: number; modes: string[] }[] | null;
  round_playlist_ids?: { round: number; playlist_ids: number[] }[] | null;
  call_reveal_delay_seconds?: number;
  call_reveal_at?: string | null;
  bingo_overlay?: string;
  is_favorite?: boolean;
  favorite_note?: string | null;
  active_playlist_letter_by_round?: { round: number; letter: string }[] | null;
};

type SessionRow = {
  id: number;
  event_id: number | null;
  game_preset_id: number | null;
  playlist_id: number;
  playlist_ids: number[] | null;
  master_playlist_ids: number[] | null;
  round_playlist_ids: RoundPlaylistEntry[] | null;
  session_code: string;
  game_mode: string;
  round_modes: { round: number; modes: GameMode[] }[] | null;
  card_count: number;
  card_layout: string;
  card_label_mode: string;
  round_count: number;
  current_round: number;
  round_end_policy: string;
  tie_break_policy: string;
  pool_exhaustion_policy: string;
  remove_resleeve_seconds: number;
  place_vinyl_seconds: number;
  cue_seconds: number;
  start_slide_seconds: number;
  host_buffer_seconds: number;
  seconds_to_next_call: number;
  sonos_output_delay_ms: number;
  countdown_started_at: string | null;
  paused_remaining_seconds: number | null;
  paused_at: string | null;
  current_call_index: number;
  recent_calls_limit: number;
  show_title: boolean;
  show_logo: boolean;
  show_rounds: boolean;
  show_countdown: boolean;
  status: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  next_game_scheduled_at: string | null;
  next_game_rules_text: string | null;
  welcome_heading_text: string | null;
  welcome_message_text: string | null;
  welcome_rules_text: string | null;
  welcome_tiebreak_text: string | null;
  intermission_heading_text: string | null;
  intermission_message_text: string | null;
  intermission_footer_text: string | null;
  thanks_heading_text: string | null;
  thanks_subheading_text: string | null;
  thanks_events_heading_text: string | null;
  call_reveal_delay_seconds: number;
  call_reveal_at: string | null;
  bingo_overlay: string;
  default_intermission_seconds: number;
  is_favorite: boolean;
  favorite_note: string | null;
};

type SessionEventRow = {
  payload: { call_id?: unknown } | null;
};

type SessionCallRow = {
  id: number;
  call_index: number;
  status: string;
};

type EventRow = {
  id: number;
  title: string | null;
  date: string;
  venue_logo_url: string | null;
};

type PresetValidationRow = {
  id: number;
  source_playlist_ids: number[] | null;
  pool_size: number;
};

type TransportEventRow = {
  event_type: string;
  payload: { call_id?: unknown; after_call_id?: unknown } | null;
};

const DONE_STATUSES = new Set(["called", "completed", "skipped"]);
const GAME_MODE_SET = new Set<GameMode>(GAME_MODE_OPTIONS.map((option) => option.value));

function parseSessionId(id: string) {
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return null;
  return sessionId;
}

function parseEventCallId(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = parseSessionId(id);
  if (!sessionId) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getBingoDb();
  const sessionQuery = (db
    .from("bingo_sessions")
    .select("id, event_id, game_preset_id, playlist_id, playlist_ids, master_playlist_ids, round_playlist_ids, session_code, game_mode, round_modes, card_count, card_layout, card_label_mode, round_count, current_round, round_end_policy, tie_break_policy, pool_exhaustion_policy, remove_resleeve_seconds, place_vinyl_seconds, cue_seconds, start_slide_seconds, host_buffer_seconds, seconds_to_next_call, sonos_output_delay_ms, countdown_started_at, paused_remaining_seconds, paused_at, current_call_index, recent_calls_limit, show_title, show_logo, show_rounds, show_countdown, status, created_at, started_at, ended_at, next_game_scheduled_at, next_game_rules_text, welcome_heading_text, welcome_message_text, welcome_rules_text, welcome_tiebreak_text, intermission_heading_text, intermission_message_text, intermission_footer_text, thanks_heading_text, thanks_subheading_text, thanks_events_heading_text, call_reveal_delay_seconds, call_reveal_at, bingo_overlay, default_intermission_seconds, is_favorite, favorite_note, active_playlist_letter_by_round") as unknown as {
      eq: (column: string, value: number) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    });

  const { data, error } = await sessionQuery.eq("id", sessionId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = data as SessionRow;
  const [{ data: playlist }, { data: event }] = await Promise.all([
    db
      .from("collection_playlists")
      .select("name")
      .eq("id", session.playlist_id)
      .maybeSingle(),
    session.event_id
      ? db
          .from("events")
          .select("id, title, date, venue_logo_url")
          .eq("id", session.event_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const [{ data: pullEvent }, { data: promoteEvents }, { data: calls }, { data: transportEvents }] = await Promise.all([
    db
      .from("bingo_session_events")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("event_type", "pull_set")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("bingo_session_events")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("event_type", "pull_promote")
      .order("id", { ascending: false })
      .limit(100),
    db
      .from("bingo_session_calls")
      .select("id, call_index, status")
      .eq("session_id", sessionId),
    db
      .from("bingo_session_events")
      .select("event_type, payload")
      .eq("session_id", sessionId)
      .in("event_type", ["cue_set", "pull_set", "pull_promote", "call_set"])
      .order("id", { ascending: true })
      .limit(5000),
  ]);

  const typedPullEvent = (pullEvent ?? null) as SessionEventRow | null;
  const pullCallId = parseEventCallId(typedPullEvent?.payload?.call_id);

  const promotedCallIds: number[] = [];
  const seenPromoted = new Set<number>();
  for (const row of (promoteEvents ?? []) as SessionEventRow[]) {
    const promotedCallId = parseEventCallId(row?.payload?.call_id);
    if (!promotedCallId || seenPromoted.has(promotedCallId)) continue;
    seenPromoted.add(promotedCallId);
    promotedCallIds.push(promotedCallId);
  }

  const queueIds = computeTransportQueueIds(
    ((calls ?? []) as SessionCallRow[]).map((call) => ({
      id: call.id,
      order: call.call_index,
      status: call.status,
    })),
    ((transportEvents ?? []) as TransportEventRow[]).map(
      (row): TransportQueueEvent => ({
        eventType: row.event_type,
        callId: parseEventCallId(row.payload?.call_id) ?? null,
        afterCallId: parseEventCallId(row.payload?.after_call_id),
      })
    ),
    {
      currentOrder: session.current_call_index,
      doneStatuses: DONE_STATUSES,
    }
  );

  return NextResponse.json(
    {
      ...session,
      event: (event ?? null) as EventRow | null,
      playlist_name: playlist?.name ?? "Unknown Playlist",
      seconds_to_next_call: computeRemainingSeconds(session),
      pull_call_id: pullCallId,
      promoted_call_ids: promotedCallIds,
      transport_queue_call_ids: queueIds,
    },
    { status: 200 }
  );
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = parseSessionId(id);
  if (!sessionId) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json()) as Record<string, unknown>;

  const allowedFields = new Set([
    "event_id",
    "game_preset_id",
    "playlist_id",
    "playlist_ids",
    "master_playlist_ids",
    "round_playlist_ids",
    "game_mode",
    "round_modes",
    "card_count",
    "round_count",
    "remove_resleeve_seconds",
    "place_vinyl_seconds",
    "cue_seconds",
    "start_slide_seconds",
    "host_buffer_seconds",
    "sonos_output_delay_ms",
    "current_round",
    "recent_calls_limit",
    "show_title",
    "show_logo",
    "show_rounds",
    "show_countdown",
    "status",
    "paused_at",
    "paused_remaining_seconds",
    "countdown_started_at",
    "seconds_to_next_call",
    "current_call_index",
    "started_at",
    "ended_at",
    "next_game_scheduled_at",
    "next_game_rules_text",
    "welcome_heading_text",
    "welcome_message_text",
    "welcome_rules_text",
    "welcome_tiebreak_text",
    "intermission_heading_text",
    "intermission_message_text",
    "intermission_footer_text",
    "thanks_heading_text",
    "thanks_subheading_text",
    "thanks_events_heading_text",
    "call_reveal_delay_seconds",
    "call_reveal_at",
    "bingo_overlay",
    "default_intermission_seconds",
    "is_favorite",
    "favorite_note",
    "active_playlist_letter_by_round",
  ]);

  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key))) as BingoSessionPatch;

  if (patch.playlist_id !== undefined) {
    patch.playlist_id = Number(patch.playlist_id);
  }
  if (patch.game_preset_id !== undefined) {
    const gamePresetId = Number(patch.game_preset_id);
    patch.game_preset_id = Number.isFinite(gamePresetId) && gamePresetId > 0 ? gamePresetId : null;
  }
  if (patch.master_playlist_ids !== undefined) {
    patch.master_playlist_ids = normalizePlaylistIds(
      patch.master_playlist_ids,
      Number.isFinite(Number(patch.playlist_id)) ? Number(patch.playlist_id) : undefined
    );
  }
  if (patch.playlist_ids !== undefined) {
    patch.playlist_ids = normalizePlaylistIds(
      patch.playlist_ids,
      Number.isFinite(Number(patch.playlist_id)) ? Number(patch.playlist_id) : undefined
    );
  }
  if (patch.card_count !== undefined) {
    patch.card_count = Math.max(1, Math.floor(Number(patch.card_count)));
  }
  if (patch.round_count !== undefined) {
    patch.round_count = Math.max(1, Math.floor(Number(patch.round_count)));
  }

  // Allow crate letter selection to be patched directly
  if ("active_playlist_letter_by_round" in body) {
    patch.active_playlist_letter_by_round = body.active_playlist_letter_by_round as { round: number; letter: string }[] | null;
  }

  const db = getBingoDb();

  // Ensure updates that impact call-generation requirements are valid.
  const requiresTrackValidation = ["playlist_id", "playlist_ids", "master_playlist_ids", "round_playlist_ids", "round_count", "card_count"].some((key) => key in patch);
  if (requiresTrackValidation) {
    const validationQuery = (db
      .from("bingo_sessions")
      .select("game_preset_id, playlist_id, playlist_ids, master_playlist_ids, round_playlist_ids, round_count, card_count") as unknown as {
        eq: (column: string, value: number) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      });

    const { data: existing, error: existingError } = await validationQuery.eq("id", sessionId).maybeSingle();

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const existingRow = existing as {
      game_preset_id: number | null;
      playlist_id: number;
      playlist_ids: number[] | null;
      master_playlist_ids: number[] | null;
      round_playlist_ids: RoundPlaylistEntry[] | null;
      round_count: number;
      card_count: number;
    };

    const roundCount = Math.max(1, Math.floor(Number(patch.round_count ?? existingRow.round_count)));
    const cardCount = Math.max(1, Math.floor(Number(patch.card_count ?? existingRow.card_count)));
    const effectivePresetId = patch.game_preset_id !== undefined
      ? (patch.game_preset_id as number | null)
      : existingRow.game_preset_id ?? null;

    let selectedPlaylistIds: number[];
    if (effectivePresetId) {
      const { data: preset, error: presetError } = await db
        .from("bingo_game_presets")
        .select("id, source_playlist_ids, pool_size")
        .eq("id", effectivePresetId)
        .maybeSingle();

      if (presetError) return NextResponse.json({ error: presetError.message }, { status: 500 });
      if (!preset) return NextResponse.json({ error: "Favorite preset not found" }, { status: 404 });

      const typedPreset = preset as PresetValidationRow;
      selectedPlaylistIds = normalizePlaylistIds(typedPreset.source_playlist_ids);

      if (selectedPlaylistIds.length === 0) {
        return NextResponse.json({ error: "Favorite preset is missing its source playlists" }, { status: 400 });
      }

      const requiredTrackCount = computeMinimumPlaylistTracks(roundCount, cardCount);
      if (typedPreset.pool_size < requiredTrackCount) {
        return NextResponse.json(
          {
            error: `Favorite preset pool must contain at least ${requiredTrackCount} tracks to build one bingo crate.`,
          },
          { status: 400 }
        );
      }
    } else {
      selectedPlaylistIds = patch.master_playlist_ids !== undefined
        ? normalizePlaylistIds(patch.master_playlist_ids)
        : patch.playlist_ids !== undefined
          ? normalizePlaylistIds(patch.playlist_ids)
          : normalizePlaylistIds(existingRow.master_playlist_ids ?? existingRow.playlist_ids, existingRow.playlist_id);
    }

    let normalizedRoundPlaylistIds: RoundPlaylistEntry[];
    try {
      normalizedRoundPlaylistIds = normalizeRoundPlaylistIds(
        effectivePresetId ? [] : (patch.round_playlist_ids ?? existingRow.round_playlist_ids),
        roundCount
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid round_playlist_ids payload" },
        { status: 400 }
      );
    }

    if (!effectivePresetId) {
      const resolvedPlaylistsByRound = collectResolvedPlaylistIdsByRound(
        {
          playlist_id: selectedPlaylistIds[0] ?? existingRow.playlist_id,
          playlist_ids: selectedPlaylistIds,
          round_playlist_ids: normalizedRoundPlaylistIds,
        },
        roundCount
      );

      for (let round = 1; round <= roundCount; round += 1) {
        if ((resolvedPlaylistsByRound.get(round) ?? []).length === 0) {
          return NextResponse.json(
            { error: `Round ${round} needs at least one playlist or a master playlist selection.` },
            { status: 400 }
          );
        }
      }

      const requiredTrackCount = computeMinimumPlaylistTracks(roundCount, cardCount);
      const trackCountCache = new Map<string, number>();
      for (let round = 1; round <= roundCount; round += 1) {
        const playlistIdsForRound = resolvedPlaylistsByRound.get(round) ?? [];
        const cacheKey = playlistIdsForRound.join(",");
        let availableTrackCount = trackCountCache.get(cacheKey);
        if (availableTrackCount === undefined) {
          availableTrackCount = await getPlaylistTrackCountForPlaylists(db, playlistIdsForRound);
          trackCountCache.set(cacheKey, availableTrackCount);
        }

        if (availableTrackCount < requiredTrackCount) {
          return NextResponse.json(
            {
              error: `Round ${round} playlist selection must contain at least ${requiredTrackCount} tracks to build one bingo crate.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const primaryPlaylistId = findPrimaryPlaylistId(selectedPlaylistIds, normalizedRoundPlaylistIds);
    if (!primaryPlaylistId) {
      return NextResponse.json({ error: "At least one playlist is required" }, { status: 400 });
    }

    patch.playlist_id = primaryPlaylistId;
    patch.playlist_ids = selectedPlaylistIds.length > 0 ? selectedPlaylistIds : null;
    patch.master_playlist_ids = selectedPlaylistIds.length > 0 ? selectedPlaylistIds : null;
    patch.round_playlist_ids = normalizedRoundPlaylistIds.length > 0 ? normalizedRoundPlaylistIds : null;
  }
  if (patch.game_mode !== undefined) {
    const gameMode = String(patch.game_mode) as GameMode;
    if (!GAME_MODE_SET.has(gameMode)) {
      return NextResponse.json({ error: "Unsupported game mode" }, { status: 400 });
    }
    patch.game_mode = gameMode;
  }
  if ("round_modes" in patch || "round_count" in patch) {
    const { data: existing, error: existingError } = await db
      .from("bingo_sessions")
      .select("round_count, round_modes")
      .eq("id", sessionId)
      .maybeSingle();

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const nextRoundCount = Math.max(1, Math.floor(Number(patch.round_count ?? existing.round_count)));
    const existingRoundModes = Array.isArray(existing.round_modes) ? existing.round_modes : [];
    const rawRoundModes = patch.round_modes !== undefined
      ? patch.round_modes
      : existingRoundModes.filter((entry) => {
          const round = Number((entry as { round?: unknown }).round);
          return Number.isFinite(round) && round >= 1 && round <= nextRoundCount;
        });

    try {
      const normalizedRoundModes = normalizeRoundModes(rawRoundModes, nextRoundCount);
      patch.round_modes = normalizedRoundModes.length > 0 ? normalizedRoundModes : null;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid round_modes payload" },
        { status: 400 }
      );
    }
  }
  if (patch.remove_resleeve_seconds !== undefined) {
    patch.remove_resleeve_seconds = Math.max(0, Math.floor(Number(patch.remove_resleeve_seconds)));
  }
  if (patch.place_vinyl_seconds !== undefined) {
    patch.place_vinyl_seconds = Math.max(0, Math.floor(Number(patch.place_vinyl_seconds)));
  }
  if (patch.cue_seconds !== undefined) {
    patch.cue_seconds = Math.max(0, Math.floor(Number(patch.cue_seconds)));
  }
  if (patch.start_slide_seconds !== undefined) {
    patch.start_slide_seconds = Math.max(0, Math.floor(Number(patch.start_slide_seconds)));
  }
  if (patch.host_buffer_seconds !== undefined) {
    patch.host_buffer_seconds = Math.max(0, Math.floor(Number(patch.host_buffer_seconds)));
  }
  if (patch.sonos_output_delay_ms !== undefined) {
    patch.sonos_output_delay_ms = Math.max(0, Math.floor(Number(patch.sonos_output_delay_ms)));
  }
  if (patch.is_favorite !== undefined) {
    patch.is_favorite = Boolean(patch.is_favorite);
  }
  if (patch.favorite_note !== undefined) {
    patch.favorite_note = String(patch.favorite_note ?? "").trim() || null;
  }

  const timingKeys = [
    "remove_resleeve_seconds",
    "place_vinyl_seconds",
    "cue_seconds",
    "start_slide_seconds",
    "host_buffer_seconds",
    "sonos_output_delay_ms",
  ] as const;

  const hasTimingUpdate = timingKeys.some((key) => key in patch);
  if (hasTimingUpdate && !("seconds_to_next_call" in patch)) {
    const { data: existing, error: existingError } = await db
      .from("bingo_sessions")
      .select("remove_resleeve_seconds, place_vinyl_seconds, cue_seconds, start_slide_seconds, host_buffer_seconds, sonos_output_delay_ms")
      .eq("id", sessionId)
      .maybeSingle();

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const removeResleeveSeconds = Number(patch.remove_resleeve_seconds ?? existing.remove_resleeve_seconds);
    const placeVinylSeconds = Number(patch.place_vinyl_seconds ?? existing.place_vinyl_seconds);
    const cueSeconds = Number(patch.cue_seconds ?? existing.cue_seconds);
    const startSlideSeconds = Number(patch.start_slide_seconds ?? existing.start_slide_seconds);
    const hostBufferSeconds = Number(patch.host_buffer_seconds ?? existing.host_buffer_seconds);
    const sonosDelayMs = Number(patch.sonos_output_delay_ms ?? existing.sonos_output_delay_ms);

    patch.seconds_to_next_call =
      removeResleeveSeconds +
      placeVinylSeconds +
      cueSeconds +
      startSlideSeconds +
      hostBufferSeconds +
      Math.ceil(sonosDelayMs / 1000);
  }

  const { error } = await db.from("bingo_sessions").update(patch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
