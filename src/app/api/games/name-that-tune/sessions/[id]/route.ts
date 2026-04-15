import { NextRequest, NextResponse } from "next/server";
import { getNameThatTuneDb } from "src/lib/nameThatTuneDb";
import { computeNameThatTuneRemainingSeconds } from "src/lib/nameThatTuneEngine";
import { computeTransportQueueIds, type TransportQueueEvent } from "src/lib/transportQueue";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  playlist_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  lock_in_rule: "time_window" | "first_sheet_wins" | "hand_raise";
  lock_in_window_seconds: number;
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
  show_rounds: boolean;
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
type SessionEventRow = {
  payload: { call_id?: unknown } | null;
};

type OverlayEventRow = {
  payload: { mode?: unknown; ends_at?: unknown } | null;
};

type TransportEventRow = {
  event_type: string;
  payload: { call_id?: unknown; after_call_id?: unknown } | null;
};

const DONE_STATUSES = new Set(["asked", "locked", "answer_revealed", "scored", "skipped"]);
const OVERLAY_MODES = new Set(["none", "welcome", "countdown", "intermission", "thanks"]);

function parseSessionId(id: string) {
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return null;
  return sessionId;
}

function parseEventCallId(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

function parseOverlayMode(raw: unknown): "none" | "welcome" | "countdown" | "intermission" | "thanks" {
  const value = typeof raw === "string" ? raw : "none";
  if (!OVERLAY_MODES.has(value)) return "none";
  return value as "none" | "welcome" | "countdown" | "intermission" | "thanks";
}

function computeOverlayRemainingSeconds(rawEndsAt: unknown): number {
  if (typeof rawEndsAt !== "string" || !rawEndsAt) return 0;
  const endsAtMs = Date.parse(rawEndsAt);
  if (!Number.isFinite(endsAtMs)) return 0;
  return Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = parseSessionId(id);
  if (!sessionId) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getNameThatTuneDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;
  const { data, error } = await db.from("ntt_sessions").select("*").eq("id", sessionId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = data as SessionRow;
  const { data: event } = session.event_id
    ? await db.from("events").select("id, title, date, time, location, venue_logo_url").eq("id", session.event_id).maybeSingle()
    : { data: null };

  const [{ data: calls }, { data: cueEvent }, { data: pullEvent }, { data: promoteEvents }, { data: transportEvents }, { data: overlayEvent }] = await Promise.all([
    db.from("ntt_session_calls").select("id, call_index, status").eq("session_id", sessionId),
    dbAny
      .from("ntt_session_events")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("event_type", "cue_set")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    dbAny
      .from("ntt_session_events")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("event_type", "pull_set")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    dbAny
      .from("ntt_session_events")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("event_type", "pull_promote")
      .order("id", { ascending: false })
      .limit(100),
    dbAny
      .from("ntt_session_events")
      .select("event_type, payload")
      .eq("session_id", sessionId)
      .in("event_type", ["cue_set", "pull_set", "pull_promote", "call_set"])
      .order("id", { ascending: true })
      .limit(5000),
    dbAny
      .from("ntt_session_events")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("event_type", "overlay_set")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

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

  const queueIds = computeTransportQueueIds(
    ((calls ?? []) as Array<{ id: number; call_index: number; status: string }>).map((call) => ({
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

  const typedOverlayEvent = (overlayEvent ?? null) as OverlayEventRow | null;
  const baseOverlayMode = parseOverlayMode(typedOverlayEvent?.payload?.mode);
  const overlayRemainingSeconds = computeOverlayRemainingSeconds(typedOverlayEvent?.payload?.ends_at);
  const hostOverlay =
    (baseOverlayMode === "countdown" || baseOverlayMode === "intermission") && overlayRemainingSeconds <= 0
      ? "none"
      : baseOverlayMode;

  return NextResponse.json(
    {
      ...session,
      event: (event ?? null) as EventRow | null,
      remaining_seconds: computeNameThatTuneRemainingSeconds(session),
      calls_total: (calls ?? []).length,
      cue_call_id: cueCallId,
      pull_call_id: pullCallId,
      promoted_call_ids: promotedCallIds,
      transport_queue_call_ids: queueIds,
      host_overlay: hostOverlay,
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
    "event_id",
    "title",
    "playlist_id",
    "round_count",
    "lock_in_rule",
    "lock_in_window_seconds",
    "remove_resleeve_seconds",
    "find_record_seconds",
    "cue_seconds",
    "host_buffer_seconds",
    "current_round",
    "current_call_index",
    "target_gap_seconds",
    "show_title",
    "show_logo",
    "show_rounds",
    "show_scoreboard",
    "welcome_heading_text",
    "welcome_message_text",
    "intermission_heading_text",
    "intermission_message_text",
    "thanks_heading_text",
    "thanks_subheading_text",
    "default_intermission_seconds",
    "status",
    "countdown_started_at",
    "paused_remaining_seconds",
    "paused_at",
    "started_at",
    "ended_at",
  ]);

  type NttSessionPatch = {
    id?: number;
    event_id?: number | null;
    playlist_id?: number | null;
    session_code?: string;
    title?: string;
    round_count?: number;
    lock_in_rule?: string;
    lock_in_window_seconds?: number;
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
    show_rounds?: boolean;
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
  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key))) as NttSessionPatch;

  const removeResleeveSeconds = Number(
    patch.remove_resleeve_seconds ?? body.remove_resleeve_seconds ?? Number.NaN
  );
  const findRecordSeconds = Number(
    patch.find_record_seconds ?? body.find_record_seconds ?? Number.NaN
  );
  const cueSeconds = Number(
    patch.cue_seconds ?? body.cue_seconds ?? Number.NaN
  );
  const hostBufferSeconds = Number(
    patch.host_buffer_seconds ?? body.host_buffer_seconds ?? Number.NaN
  );

  if (
    Number.isFinite(removeResleeveSeconds) &&
    Number.isFinite(findRecordSeconds) &&
    Number.isFinite(cueSeconds) &&
    Number.isFinite(hostBufferSeconds) &&
    !Object.prototype.hasOwnProperty.call(patch, "target_gap_seconds")
  ) {
    patch.target_gap_seconds =
      Math.max(0, removeResleeveSeconds) +
      Math.max(0, findRecordSeconds) +
      Math.max(0, cueSeconds) +
      Math.max(0, hostBufferSeconds);
  }

  const db = getNameThatTuneDb();
  const { error } = await db.from("ntt_sessions").update(patch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
