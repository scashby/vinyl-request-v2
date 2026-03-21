import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import {
  computeMinimumPlaylistTracks,
  computeRemainingSeconds,
  getPlaylistTrackCountForPlaylists,
  type GameMode,
} from "src/lib/bingoEngine";
import { computeTransportQueueIds, type TransportQueueEvent } from "src/lib/transportQueue";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  playlist_id: number;
  playlist_ids: number[] | null;
  session_code: string;
  game_mode: string;
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
  call_reveal_delay_seconds: number;
  call_reveal_at: string | null;
  bingo_overlay: string;
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
  venue_logo_url: string | null;
};

type TransportEventRow = {
  event_type: string;
  payload: { call_id?: unknown; after_call_id?: unknown } | null;
};

const DONE_STATUSES = new Set(["called", "completed", "skipped"]);

function parseSessionId(id: string) {
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return null;
  return sessionId;
}

function parseEventCallId(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

function normalizePlaylistIds(input: unknown, fallbackPlaylistId?: number): number[] {
  const fromArray = Array.isArray(input)
    ? input.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
    : [];

  const normalized = fromArray.length > 0
    ? fromArray
    : Number.isFinite(fallbackPlaylistId)
      ? [Number(fallbackPlaylistId)]
      : [];

  return Array.from(new Set(normalized));
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = parseSessionId(id);
  if (!sessionId) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getBingoDb();
  const sessionQuery = (db
    .from("bingo_sessions")
    .select("id, event_id, playlist_id, playlist_ids, session_code, game_mode, card_count, card_layout, card_label_mode, round_count, current_round, round_end_policy, tie_break_policy, pool_exhaustion_policy, remove_resleeve_seconds, place_vinyl_seconds, cue_seconds, start_slide_seconds, host_buffer_seconds, seconds_to_next_call, sonos_output_delay_ms, countdown_started_at, paused_remaining_seconds, paused_at, current_call_index, recent_calls_limit, show_title, show_logo, show_rounds, show_countdown, status, created_at, started_at, ended_at, next_game_scheduled_at, next_game_rules_text, call_reveal_delay_seconds, call_reveal_at, bingo_overlay") as unknown as {
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
          .select("id, title, venue_logo_url")
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
    "playlist_id",
    "playlist_ids",
    "game_mode",
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
    "call_reveal_delay_seconds",
    "call_reveal_at",
    "bingo_overlay",
  ]);

  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key))) as Record<string, unknown>;

  const db = getBingoDb();

  // Ensure updates that impact call-generation requirements are valid.
  const requiresTrackValidation = ["playlist_id", "playlist_ids", "round_count", "card_count"].some((key) => key in patch);
  if (requiresTrackValidation) {
    const validationQuery = (db
      .from("bingo_sessions")
      .select("playlist_id, playlist_ids, round_count, card_count") as unknown as {
        eq: (column: string, value: number) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      });

    const { data: existing, error: existingError } = await validationQuery.eq("id", sessionId).maybeSingle();

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const existingRow = existing as {
      playlist_id: number;
      playlist_ids: number[] | null;
      round_count: number;
      card_count: number;
    };

    const selectedPlaylistIds = normalizePlaylistIds(
      patch.playlist_ids,
      Number(patch.playlist_id ?? (Array.isArray(existingRow.playlist_ids) && existingRow.playlist_ids.length > 0 ? existingRow.playlist_ids[0] : existingRow.playlist_id))
    );
    const roundCount = Math.max(1, Math.floor(Number(patch.round_count ?? existingRow.round_count)));
    const cardCount = Math.max(1, Math.floor(Number(patch.card_count ?? existingRow.card_count)));

    if (selectedPlaylistIds.length === 0) {
      return NextResponse.json({ error: "At least one playlist is required" }, { status: 400 });
    }

    const requiredTrackCount = computeMinimumPlaylistTracks(roundCount, cardCount);
    const availableTrackCount = await getPlaylistTrackCountForPlaylists(db, selectedPlaylistIds);
    if (availableTrackCount < requiredTrackCount) {
      return NextResponse.json(
        {
          error: `Playlist must contain at least ${requiredTrackCount} tracks for ${roundCount} round(s) and ${cardCount} cards.`,
        },
        { status: 400 }
      );
    }
  }

  if (patch.playlist_id !== undefined) {
    patch.playlist_id = Number(patch.playlist_id);
    if (!("playlist_ids" in patch) && Number.isFinite(Number(patch.playlist_id))) {
      patch.playlist_ids = [Number(patch.playlist_id)];
    }
  }
  if (patch.playlist_ids !== undefined) {
    const primaryPlaylistId = Number(patch.playlist_id);
    const selectedPlaylistIds = normalizePlaylistIds(patch.playlist_ids, Number.isFinite(primaryPlaylistId) ? primaryPlaylistId : undefined);
    patch.playlist_ids = selectedPlaylistIds;
    if (!("playlist_id" in patch) && selectedPlaylistIds.length > 0) {
      patch.playlist_id = selectedPlaylistIds[0];
    }
  }
  if (patch.game_mode !== undefined) {
    patch.game_mode = String(patch.game_mode) as GameMode;
  }
  if (patch.card_count !== undefined) {
    patch.card_count = Math.max(1, Math.floor(Number(patch.card_count)));
  }
  if (patch.round_count !== undefined) {
    patch.round_count = Math.max(1, Math.floor(Number(patch.round_count)));
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
