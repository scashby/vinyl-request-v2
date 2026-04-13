import { NextRequest, NextResponse } from "next/server";
import { getBackToBackConnectionDb } from "src/lib/backToBackConnectionDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  playlist_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  connection_points: number;
  detail_bonus_points: number;
  remove_resleeve_seconds: number;
  find_record_seconds: number;
  cue_seconds: number;
  host_buffer_seconds: number;
  target_gap_seconds: number;
  current_round: number;
  current_call_index: number;
  show_title: boolean;
  show_logo: boolean;
  show_round: boolean;
  show_scoreboard: boolean;
  show_connection_prompt: boolean;
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

type EventRow = { id: number; title: string; date: string; time: string | null; location: string | null; venue_logo_url: string | null };

type OverlayEventRow = {
  payload: { mode: string; duration_seconds: number | null; started_at: string; ends_at: string | null } | null;
};

function parseSessionId(id: string) {
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return null;
  return sessionId;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = parseSessionId(id);
  if (!sessionId) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getBackToBackConnectionDb();
  const { data, error } = await db.from("b2bc_sessions").select("*").eq("id", sessionId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = data as SessionRow;

  const [eventResult, callsResult, overlayResult] = await Promise.all([
    session.event_id
      ? db.from("events").select("id, title, date, time, location, venue_logo_url").eq("id", session.event_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("b2bc_session_calls").select("id").eq("session_id", sessionId),
    db
      .from("b2bc_session_events")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("event_type", "overlay_set")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const overlayEvent = overlayResult.data as OverlayEventRow | null;
  const overlayPayload = overlayEvent?.payload ?? null;
  const overlayMode = overlayPayload?.mode ?? "none";
  const overlayEndsAt = overlayPayload?.ends_at ? new Date(overlayPayload.ends_at) : null;
  const now = new Date();
  const hostOverlay = overlayMode !== "none" && (!overlayEndsAt || overlayEndsAt > now) ? overlayMode : "none";
  const hostOverlayRemainingSeconds =
    hostOverlay !== "none" && overlayEndsAt ? Math.max(0, Math.round((overlayEndsAt.getTime() - now.getTime()) / 1000)) : 0;

  return NextResponse.json(
    {
      ...session,
      event: (eventResult.data ?? null) as EventRow | null,
      calls_total: (callsResult.data ?? []).length,
      host_overlay: hostOverlay,
      host_overlay_remaining_seconds: hostOverlayRemainingSeconds,
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
    "round_count",
    "connection_points",
    "detail_bonus_points",
    "remove_resleeve_seconds",
    "find_record_seconds",
    "cue_seconds",
    "host_buffer_seconds",
    "target_gap_seconds",
    "current_round",
    "current_call_index",
    "show_title",
    "show_logo",
    "show_round",
    "show_scoreboard",
    "show_connection_prompt",
    "welcome_heading_text",
    "welcome_message_text",
    "intermission_heading_text",
    "intermission_message_text",
    "thanks_heading_text",
    "thanks_subheading_text",
    "default_intermission_seconds",
    "status",
    "started_at",
    "ended_at",
  ]);

  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key)));

  const timerFields = ["remove_resleeve_seconds", "find_record_seconds", "cue_seconds", "host_buffer_seconds"] as const;
  const touchesTimer = timerFields.some((f) => f in patch);
  if (touchesTimer && !("target_gap_seconds" in patch)) {
    const db = getBackToBackConnectionDb();
    const { data: current } = await db
      .from("b2bc_sessions")
      .select("remove_resleeve_seconds, find_record_seconds, cue_seconds, host_buffer_seconds")
      .eq("id", sessionId)
      .single();
    if (current) {
      const r = Number(patch.remove_resleeve_seconds ?? current.remove_resleeve_seconds);
      const f = Number(patch.find_record_seconds ?? current.find_record_seconds);
      const c = Number(patch.cue_seconds ?? current.cue_seconds);
      const h = Number(patch.host_buffer_seconds ?? current.host_buffer_seconds);
      patch.target_gap_seconds = r + f + c + h;
    }
  }

  const db = getBackToBackConnectionDb();
  const { error } = await db.from("b2bc_sessions").update(patch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
