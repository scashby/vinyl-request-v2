import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { computeTriviaRemainingSeconds } from "src/lib/triviaEngine";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  questions_per_round: number;
  score_mode: string;
  question_categories: string[];
  difficulty_easy_target: number;
  difficulty_medium_target: number;
  difficulty_hard_target: number;
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
  show_rounds: boolean;
  show_question_counter: boolean;
  show_leaderboard: boolean;
  max_teams: number | null;
  slips_batch_size: number | null;
  status: "pending" | "running" | "paused" | "completed";
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

type EventRow = { id: number; title: string; date: string; time: string | null; location: string | null };

function parseSessionId(id: string) {
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return null;
  return sessionId;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = parseSessionId(id);
  if (!sessionId) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getTriviaDb();
  const { data, error } = await db.from("trivia_sessions").select("*").eq("id", sessionId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = data as SessionRow;
  const { data: event } = session.event_id
    ? await db.from("events").select("id, title, date, time, location").eq("id", session.event_id).maybeSingle()
    : { data: null };

  return NextResponse.json(
    {
      ...session,
      event: (event ?? null) as EventRow | null,
      remaining_seconds: computeTriviaRemainingSeconds(session),
      total_questions: session.round_count * session.questions_per_round,
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
    "current_round",
    "current_call_index",
    "show_title",
    "show_rounds",
    "show_question_counter",
    "show_leaderboard",
    "status",
    "countdown_started_at",
    "paused_remaining_seconds",
    "paused_at",
    "started_at",
    "ended_at",
  ]);

  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.has(key)));

  const db = getTriviaDb();
  const { error } = await db.from("trivia_sessions").update(patch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
