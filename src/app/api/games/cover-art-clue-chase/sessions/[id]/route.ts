import { NextRequest, NextResponse } from "next/server";
import { getCoverArtClueChaseDb } from "src/lib/coverArtClueChaseDb";

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
  show_round: boolean;
  show_scoreboard: boolean;
  show_stage_hint: boolean;
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

  const db = getCoverArtClueChaseDb();
  const { data, error } = await db.from("cacc_sessions").select("*").eq("id", sessionId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = data as SessionRow;
  const { data: event } = session.event_id
    ? await db.from("events").select("id, title, date, time, location").eq("id", session.event_id).maybeSingle()
    : { data: null };
  const { data: playlist } = session.playlist_id
    ? await db.from("collection_playlists").select("id, name").eq("id", session.playlist_id).maybeSingle()
    : { data: null };

  const [{ data: calls }, { data: teams }] = await Promise.all([
    db.from("cacc_session_calls").select("id").eq("session_id", sessionId),
    db.from("cacc_session_teams").select("id, team_name, table_label, active").eq("session_id", sessionId).order("id", { ascending: true }),
  ]);

  return NextResponse.json(
    {
      ...session,
      event: (event ?? null) as EventRow | null,
      playlist: (playlist ?? null) as PlaylistRow | null,
      teams: teams ?? [],
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
    "show_stage_hint",
    "status",
    "started_at",
    "ended_at",
  ]);

  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key)));

  const db = getCoverArtClueChaseDb();
  const { error } = await db.from("cacc_sessions").update(patch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
