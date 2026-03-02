import { NextRequest, NextResponse } from "next/server";
import { getLyricGapRelayDb } from "src/lib/lyricGapRelayDb";
import { computeLyricGapRelayRemainingSeconds } from "src/lib/lyricGapRelayEngine";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  playlist_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  judge_mode: "official_key" | "crowd_check";
  close_match_policy: "host_discretion" | "strict_key";
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
  show_round: boolean;
  show_scoreboard: boolean;
  show_answer_mode: boolean;
  status: "pending" | "running" | "paused" | "completed";
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

type EventRow = { id: number; title: string; date: string; time: string | null; location: string | null };
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

  const db = getLyricGapRelayDb();
  const { data, error } = await db.from("lgr_sessions").select("*").eq("id", sessionId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = data as SessionRow;
  const { data: event } = session.event_id
    ? await db.from("events").select("id, title, date, time, location").eq("id", session.event_id).maybeSingle()
    : { data: null };
  const { data: playlist } = session.playlist_id
    ? await db.from("collection_playlists").select("id, name").eq("id", session.playlist_id).maybeSingle()
    : { data: null };

  const { data: calls } = await db.from("lgr_session_calls").select("id").eq("session_id", sessionId);

  return NextResponse.json(
    {
      ...session,
      event: (event ?? null) as EventRow | null,
      playlist: (playlist ?? null) as PlaylistRow | null,
      remaining_seconds: computeLyricGapRelayRemainingSeconds(session),
      calls_total: (calls ?? []).length,
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
    "show_round",
    "show_scoreboard",
    "show_answer_mode",
    "status",
    "countdown_started_at",
    "paused_remaining_seconds",
    "paused_at",
    "started_at",
    "ended_at",
  ]);

  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key)));

  const db = getLyricGapRelayDb();
  const { error } = await db.from("lgr_sessions").update(patch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
