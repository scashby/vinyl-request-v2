import { NextRequest, NextResponse } from "next/server";
import { getGenreImposterDb } from "src/lib/genreImposterDb";
import { computeGenreImposterRemainingSeconds } from "src/lib/genreImposterEngine";
import { getBingoDb } from "src/lib/bingoDb";
import { computeTransportQueueIds, type TransportQueueEvent } from "src/lib/transportQueue";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  playlist_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  reveal_mode: "after_third_spin" | "immediate";
  reason_mode: "host_judged" | "strict_key";
  imposter_points: number;
  reason_bonus_points: number;
  remove_resleeve_seconds: number;
  find_record_seconds: number;
  cue_seconds: number;
  host_buffer_seconds: number;
  target_gap_seconds: number;
  current_round: number;
  current_call_index: number;
  countdown_started_at: string | null;
  paused_remaining_seconds: number | null;
  paused_at: string | null;
  show_title: boolean;
  show_logo: boolean;
  show_round: boolean;
  show_category: boolean;
  show_scoreboard: boolean;
  welcome_heading_text: string | null;
  welcome_message_text: string | null;
  intermission_heading_text: string | null;
  intermission_message_text: string | null;
  thanks_heading_text: string | null;
  thanks_subheading_text: string | null;
  default_intermission_seconds: number;
  status: "pending" | "running" | "paused" | "completed";
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

type EventRow = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  venue_logo_url: string | null;
};

type PlaylistRow = {
  id: number;
  name: string;
  track_count: number;
};

type SessionEventRow = {
  payload: { call_id?: unknown } | null;
};

type TransportEventRow = {
  event_type: string;
  payload: { call_id?: unknown; after_call_id?: unknown } | null;
};

const DONE_STATUSES = new Set(["played", "revealed", "scored", "skipped"]);

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

  const db = getGenreImposterDb();
  const playlistDb = getBingoDb();
  const { data, error } = await db.from("gi_sessions").select("*").eq("id", sessionId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = data as SessionRow;

  const [{ data: event }, { data: playlist }, { data: teams }, { data: rounds }, { data: calls }, { data: scores }, { data: cueEvent }, { data: pullEvent }, { data: promoteEvents }, { data: transportEvents }, { data: overlayEvent }] = await Promise.all([
    session.event_id
      ? db.from("events").select("id, title, date, time, location, venue_logo_url").eq("id", session.event_id).maybeSingle()
      : Promise.resolve({ data: null }),
    session.playlist_id
      ? playlistDb
          .from("collection_playlists")
          .select("id, name, track_count")
          .eq("id", session.playlist_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("gi_session_teams")
      .select("id, team_name, table_label, active")
      .eq("session_id", sessionId)
      .order("id", { ascending: true }),
    db
      .from("gi_session_rounds")
      .select("id, round_number, category_label, category_card_note, reason_key, imposter_call_index, status, opened_at, closed_at")
      .eq("session_id", sessionId)
      .order("round_number", { ascending: true }),
    db
      .from("gi_session_calls")
      .select("id, round_id, round_number, call_index, play_order, playlist_track_key, source_label, artist, title, record_label, fits_category, is_imposter, host_notes, metadata_locked, metadata_synced_at, status, cued_at, played_at, revealed_at")
      .eq("session_id", sessionId)
      .order("round_number", { ascending: true })
      .order("play_order", { ascending: true }),
    db
      .from("gi_team_scores")
      .select("id, team_id, total_points, imposter_hits, reason_bonus_hits, updated_at")
      .eq("session_id", sessionId),
    db
      .from("gi_session_events")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("event_type", "cue_set")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("gi_session_events")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("event_type", "pull_set")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("gi_session_events")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("event_type", "pull_promote")
      .order("id", { ascending: false })
      .limit(100),
    db
      .from("gi_session_events")
      .select("event_type, payload")
      .eq("session_id", sessionId)
      .in("event_type", ["cue_set", "pull_set", "pull_promote", "call_set"])
      .order("id", { ascending: true })
      .limit(5000),
    db
      .from("gi_session_events")
      .select("payload, created_at")
      .eq("session_id", sessionId)
      .eq("event_type", "overlay_set")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const currentRound = ((rounds ?? []) as Array<{ round_number: number }>).find(
    (round) => round.round_number === session.current_round
  );
  const currentRoundCalls = ((calls ?? []) as Array<{ round_number: number }>).filter(
    (call) => call.round_number === session.current_round
  );

  const typedCueEvent = (cueEvent ?? null) as SessionEventRow | null;
  const typedPullEvent = (pullEvent ?? null) as SessionEventRow | null;
  const cueCallId = parseEventCallId(typedCueEvent?.payload?.call_id);
  const pullCallId = parseEventCallId(typedPullEvent?.payload?.call_id);

  const promotedCallIds: number[] = [];
  const seenPromoted = new Set<number>();
  for (const row of (promoteEvents ?? []) as SessionEventRow[]) {
    const promotedCallId = parseEventCallId(row?.payload?.call_id);
    if (!promotedCallId || seenPromoted.has(promotedCallId)) continue;
    seenPromoted.add(promotedCallId);
    promotedCallIds.push(promotedCallId);
  }

  const currentTransportIndex = Math.max(0, ((session.current_round - 1) * 3) + session.current_call_index);
  const queueIds = computeTransportQueueIds(
    ((calls ?? []) as Array<{ id: number; round_number: number; play_order: number; status: string }>).map((call) => ({
      id: call.id,
      order: ((call.round_number - 1) * 3) + call.play_order,
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
      currentOrder: currentTransportIndex,
      doneStatuses: DONE_STATUSES,
    }
  );

  const overlayPayload = (overlayEvent?.payload ?? null) as
    | { mode?: unknown; duration_seconds?: unknown; started_at?: unknown; ends_at?: unknown }
    | null;
  const overlayMode =
    typeof overlayPayload?.mode === "string" && ["none", "welcome", "countdown", "intermission", "thanks"].includes(overlayPayload.mode)
      ? (overlayPayload.mode as "none" | "welcome" | "countdown" | "intermission" | "thanks")
      : "none";
  const overlayEndsAt = typeof overlayPayload?.ends_at === "string" ? new Date(overlayPayload.ends_at).getTime() : Number.NaN;
  const overlayRemainingSeconds = Number.isFinite(overlayEndsAt) ? Math.max(0, Math.ceil((overlayEndsAt - Date.now()) / 1000)) : 0;

  return NextResponse.json(
    {
      ...session,
      event: (event ?? null) as EventRow | null,
      playlist: (playlist ?? null) as PlaylistRow | null,
      teams: teams ?? [],
      rounds: rounds ?? [],
      calls: calls ?? [],
      scores: scores ?? [],
      remaining_seconds: computeGenreImposterRemainingSeconds(session),
      teams_total: (teams ?? []).length,
      rounds_total: (rounds ?? []).length,
      calls_total: (calls ?? []).length,
      scored_teams_total: (scores ?? []).length,
      current_round_detail: currentRound ?? null,
      current_round_calls: currentRoundCalls,
      cue_call_id: cueCallId,
      pull_call_id: pullCallId,
      promoted_call_ids: promotedCallIds,
      current_transport_index: currentTransportIndex,
      transport_queue_call_ids: queueIds,
      host_overlay: overlayMode,
      host_overlay_remaining_seconds: overlayRemainingSeconds,
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
    "title",
    "event_id",
    "playlist_id",
    "current_round",
    "current_call_index",
    "show_title",
    "show_logo",
    "show_round",
    "show_category",
    "show_scoreboard",
    "welcome_heading_text",
    "welcome_message_text",
    "intermission_heading_text",
    "intermission_message_text",
    "thanks_heading_text",
    "thanks_subheading_text",
    "default_intermission_seconds",
    "reveal_mode",
    "reason_mode",
    "imposter_points",
    "reason_bonus_points",
    "remove_resleeve_seconds",
    "find_record_seconds",
    "cue_seconds",
    "host_buffer_seconds",
    "target_gap_seconds",
    "round_count",
    "status",
    "countdown_started_at",
    "paused_remaining_seconds",
    "paused_at",
    "started_at",
    "ended_at",
  ]);

  type GiSessionPatch = {
    id?: number;
    event_id?: number | null;
    playlist_id?: number | null;
    session_code?: string;
    title?: string;
    round_count?: number;
    reveal_mode?: "after_third_spin" | "immediate";
    reason_mode?: "host_judged" | "strict_key";
    imposter_points?: number;
    reason_bonus_points?: number;
    remove_resleeve_seconds?: number;
    find_record_seconds?: number;
    cue_seconds?: number;
    host_buffer_seconds?: number;
    target_gap_seconds?: number;
    current_round?: number;
    current_call_index?: number;
    countdown_started_at?: string | null;
    paused_remaining_seconds?: number | null;
    paused_at?: string | null;
    show_title?: boolean;
    show_logo?: boolean;
    show_round?: boolean;
    show_category?: boolean;
    show_scoreboard?: boolean;
    welcome_heading_text?: string | null;
    welcome_message_text?: string | null;
    intermission_heading_text?: string | null;
    intermission_message_text?: string | null;
    thanks_heading_text?: string | null;
    thanks_subheading_text?: string | null;
    default_intermission_seconds?: number;
    status?: "pending" | "running" | "paused" | "completed";
    created_at?: string;
    started_at?: string | null;
    ended_at?: string | null;
  };
  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key))) as GiSessionPatch;

  const timerFields = ["remove_resleeve_seconds", "find_record_seconds", "cue_seconds", "host_buffer_seconds"] as const;
  const hasAnyTimerChange = timerFields.some((field) => field in patch);
  const hasExplicitTargetGap = "target_gap_seconds" in patch;

  if (hasAnyTimerChange && !hasExplicitTargetGap) {
    const { data: current } = await getGenreImposterDb()
      .from("gi_sessions")
      .select("remove_resleeve_seconds, find_record_seconds, cue_seconds, host_buffer_seconds")
      .eq("id", sessionId)
      .maybeSingle();

    if (current) {
      const removeResleeveSeconds = Number(patch.remove_resleeve_seconds ?? current.remove_resleeve_seconds ?? 0);
      const findRecordSeconds = Number(patch.find_record_seconds ?? current.find_record_seconds ?? 0);
      const cueSeconds = Number(patch.cue_seconds ?? current.cue_seconds ?? 0);
      const hostBufferSeconds = Number(patch.host_buffer_seconds ?? current.host_buffer_seconds ?? 0);
      patch.target_gap_seconds = Math.max(0, removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds);
    }
  }

  const db = getGenreImposterDb();
  const { error } = await db.from("gi_sessions").update(patch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
