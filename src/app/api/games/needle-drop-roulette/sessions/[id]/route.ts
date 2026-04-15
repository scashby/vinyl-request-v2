import { NextRequest, NextResponse } from "next/server";
import { getNeedleDropRouletteDb } from "src/lib/needleDropRouletteDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  playlist_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  answer_mode: "slips" | "whiteboard" | "mixed";
  snippet_seconds: number;
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
type PlaylistRow = { id: number; name: string };

type OverlayEventRow = {
  payload: { mode?: unknown; ends_at?: unknown } | null;
};

const OVERLAY_MODES = new Set(["none", "welcome", "countdown", "intermission", "thanks"]);

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

function parseSessionId(id: string) {
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return null;
  return sessionId;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = parseSessionId(id);
  if (!sessionId) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getNeedleDropRouletteDb();
  const { data, error } = await db.from("ndr_sessions").select("*").eq("id", sessionId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = data as SessionRow;

  const [{ data: event }, { data: playlist }, { data: teams }, { data: rounds }, { data: calls }, { data: overlayEvent }] = await Promise.all([
    session.event_id
      ? db.from("events").select("id, title, date, time, location, venue_logo_url").eq("id", session.event_id).maybeSingle()
      : Promise.resolve({ data: null }),
    session.playlist_id
      ? db.from("collection_playlists").select("id, name").eq("id", session.playlist_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("ndr_session_teams").select("id").eq("session_id", sessionId),
    db.from("ndr_session_rounds").select("id").eq("session_id", sessionId),
    db.from("ndr_session_calls").select("id").eq("session_id", sessionId),
    db
      .from("ndr_session_events")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("event_type", "overlay_set")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

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
      playlist: (playlist ?? null) as PlaylistRow | null,
      teams_total: (teams ?? []).length,
      rounds_total: (rounds ?? []).length,
      calls_total: (calls ?? []).length,
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
    "title",
    "event_id",
    "playlist_id",
    "round_count",
    "answer_mode",
    "snippet_seconds",
    "remove_resleeve_seconds",
    "find_record_seconds",
    "cue_seconds",
    "host_buffer_seconds",
    "current_round",
    "current_call_index",
    "target_gap_seconds",
    "show_title",
    "show_logo",
    "show_round",
    "show_scoreboard",
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

  type NdrSessionPatch = {
    id?: number;
    event_id?: number | null;
    playlist_id?: number | null;
    session_code?: string;
    title?: string;
    round_count?: number;
    answer_mode?: "slips" | "whiteboard" | "mixed";
    snippet_seconds?: number;
    remove_resleeve_seconds?: number;
    find_record_seconds?: number;
    cue_seconds?: number;
    host_buffer_seconds?: number;
    target_gap_seconds?: number;
    current_round?: number;
    current_call_index?: number;
    show_title?: boolean;
    show_logo?: boolean;
    show_round?: boolean;
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
  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key))) as NdrSessionPatch;

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

  const db = getNeedleDropRouletteDb();
  const { error } = await db.from("ndr_sessions").update(patch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
