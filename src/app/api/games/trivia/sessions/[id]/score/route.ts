import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { getDefaultAwardedPoints, type TriviaDifficulty, type TriviaScoreMode } from "src/lib/triviaEngine";

export const runtime = "nodejs";

type ScoreBody = {
  call_id?: number;
  awards?: Array<{
    team_id: number;
    correct: boolean;
    awarded_points?: number;
    notes?: string;
  }>;
  scored_by?: string;
};

type SessionRow = {
  id: number;
  score_mode: TriviaScoreMode;
};

type CallRow = {
  id: number;
  session_id: number;
  difficulty: TriviaDifficulty;
  base_points: number;
  bonus_points: number;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json()) as ScoreBody;
  const callId = Number(body.call_id);
  if (!Number.isFinite(callId)) return NextResponse.json({ error: "call_id is required" }, { status: 400 });

  const awards = Array.isArray(body.awards) ? body.awards : [];
  if (awards.length === 0) return NextResponse.json({ error: "awards are required" }, { status: 400 });

  const db = getTriviaDb();
  const { data: session, error: sessionError } = await db
    .from("trivia_sessions")
    .select("id, score_mode")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: call, error: callError } = await db
    .from("trivia_session_calls")
    .select("id, session_id, difficulty, base_points, bonus_points")
    .eq("id", callId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found for session" }, { status: 404 });

  const typedSession = session as SessionRow;
  const typedCall = call as CallRow;
  const now = new Date().toISOString();

  const rows = awards.map((award) => {
    const defaultPoints = getDefaultAwardedPoints({
      scoreMode: typedSession.score_mode,
      difficulty: typedCall.difficulty,
      basePoints: typedCall.base_points,
      bonusPoints: typedCall.bonus_points,
      correct: Boolean(award.correct),
    });

    return {
      session_id: sessionId,
      team_id: Number(award.team_id),
      call_id: callId,
      awarded_points: Number.isFinite(Number(award.awarded_points)) ? Number(award.awarded_points) : defaultPoints,
      correct: Boolean(award.correct),
      scored_by: body.scored_by ?? "host",
      notes: award.notes ?? null,
      scored_at: now,
    };
  });

  if (rows.some((row) => !Number.isFinite(row.team_id))) {
    return NextResponse.json({ error: "Invalid team_id in awards" }, { status: 400 });
  }

  const { error: upsertError } = await db
    .from("trivia_team_scores")
    .upsert(rows, { onConflict: "session_id,team_id,call_id" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  await db
    .from("trivia_session_calls")
    .update({
      status: "scored",
      scored_at: now,
      answer_revealed_at: now,
    })
    .eq("id", callId)
    .eq("session_id", sessionId);

  return NextResponse.json({ ok: true }, { status: 200 });
}
