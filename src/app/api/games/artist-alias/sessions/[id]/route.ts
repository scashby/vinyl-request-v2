import { NextRequest, NextResponse } from "next/server";
import { getArtistAliasDb } from "src/lib/artistAliasDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  playlist_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  stage_one_points: number;
  stage_two_points: number;
  final_reveal_points: number;
  audio_clue_enabled: boolean;
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
  show_stage_hint: boolean;
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

type SessionPatch = {
  title?: string;
  event_id?: number | null;
  playlist_id?: number | null;
  current_round?: number;
  current_call_index?: number;
  show_title?: boolean;
  show_logo?: boolean;
  show_round?: boolean;
  show_scoreboard?: boolean;
  show_stage_hint?: boolean;
  welcome_heading_text?: string | null;
  welcome_message_text?: string | null;
  intermission_heading_text?: string | null;
  intermission_message_text?: string | null;
  thanks_heading_text?: string | null;
  thanks_subheading_text?: string | null;
  default_intermission_seconds?: number;
  round_count?: number;
  stage_one_points?: number;
  stage_two_points?: number;
  final_reveal_points?: number;
  audio_clue_enabled?: boolean;
  remove_resleeve_seconds?: number;
  find_record_seconds?: number;
  cue_seconds?: number;
  host_buffer_seconds?: number;
  target_gap_seconds?: number;
  status?: "pending" | "running" | "paused" | "completed";
  started_at?: string | null;
  ended_at?: string | null;
};

type EventRow = { id: number; title: string; date: string; time: string | null; location: string | null; venue_logo_url: string | null };
type PlaylistRow = { id: number; name: string };

function parseSessionId(id: string) {
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return null;
  return sessionId;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = parseSessionId(id);
  if (!sessionId) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getArtistAliasDb();
  const { data, error } = await db.from("aa_sessions").select("*").eq("id", sessionId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = data as SessionRow;
  const [{ data: event }, { data: playlist }, { data: calls }, { data: overlayEvent }] = await Promise.all([
    session.event_id
      ? db.from("events").select("id, title, date, time, location, venue_logo_url").eq("id", session.event_id).maybeSingle()
      : Promise.resolve({ data: null }),
    session.playlist_id
      ? db.from("collection_playlists").select("id, name").eq("id", session.playlist_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("aa_session_calls").select("id").eq("session_id", sessionId),
    db
      .from("aa_session_events")
      .select("payload, created_at")
      .eq("session_id", sessionId)
      .eq("event_type", "overlay_set")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

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
      calls_total: (calls ?? []).length,
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
    "show_scoreboard",
    "show_stage_hint",
    "welcome_heading_text",
    "welcome_message_text",
    "intermission_heading_text",
    "intermission_message_text",
    "thanks_heading_text",
    "thanks_subheading_text",
    "default_intermission_seconds",
    "round_count",
    "stage_one_points",
    "stage_two_points",
    "final_reveal_points",
    "audio_clue_enabled",
    "remove_resleeve_seconds",
    "find_record_seconds",
    "cue_seconds",
    "host_buffer_seconds",
    "target_gap_seconds",
    "status",
    "started_at",
    "ended_at",
  ]);

  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key)));

  const timerFields = ["remove_resleeve_seconds", "find_record_seconds", "cue_seconds", "host_buffer_seconds"] as const;
  const hasAnyTimerChange = timerFields.some((field) => field in patch);
  const hasExplicitTargetGap = "target_gap_seconds" in patch;

  if (hasAnyTimerChange && !hasExplicitTargetGap) {
    const { data: current } = await getArtistAliasDb()
      .from("aa_sessions")
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

  const db = getArtistAliasDb();
  const { error } = await db.from("aa_sessions").update(patch as SessionPatch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
