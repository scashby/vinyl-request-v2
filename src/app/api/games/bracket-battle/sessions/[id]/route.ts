import { NextRequest, NextResponse } from "next/server";
import { getBracketBattleDb } from "src/lib/bracketBattleDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  session_code: string;
  title: string;
  bracket_size: number;
  vote_method: "hands" | "slips";
  scoring_model: "round_weighted" | "flat_per_hit";
  remove_resleeve_seconds: number;
  find_record_seconds: number;
  cue_seconds: number;
  host_buffer_seconds: number;
  target_gap_seconds: number;
  current_round: number;
  current_matchup_index: number;
  show_title: boolean;
  show_round: boolean;
  show_bracket: boolean;
  show_scoreboard: boolean;
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

  const db = getBracketBattleDb();
  const { data, error } = await db.from("bb_sessions").select("*").eq("id", sessionId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = data as SessionRow;

  const [{ data: event }, { data: teams }, { data: rounds }, { data: matchups }] = await Promise.all([
    session.event_id
      ? db.from("events").select("id, title, date, time, location").eq("id", session.event_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("bb_session_teams").select("id").eq("session_id", sessionId),
    db.from("bb_session_rounds").select("id").eq("session_id", sessionId),
    db.from("bb_session_matchups").select("id").eq("session_id", sessionId),
  ]);

  return NextResponse.json(
    {
      ...session,
      event: (event ?? null) as EventRow | null,
      teams_total: (teams ?? []).length,
      rounds_total: (rounds ?? []).length,
      matchups_total: (matchups ?? []).length,
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
    "current_round",
    "current_matchup_index",
    "show_title",
    "show_round",
    "show_bracket",
    "show_scoreboard",
    "status",
    "started_at",
    "ended_at",
  ]);

  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key)));

  const db = getBracketBattleDb();
  const { error } = await db.from("bb_sessions").update(patch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
