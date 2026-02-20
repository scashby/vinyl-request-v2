import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";

type SessionRow = {
  id: number;
  current_call_index: number;
  questions_per_round: number;
  started_at: string | null;
};

type CallRow = {
  id: number;
  call_index: number;
};

export const runtime = "nodejs";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getTriviaDb();
  const { data: session, error: sessionError } = await db
    .from("trivia_sessions")
    .select("id, current_call_index, questions_per_round, started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedSession = session as SessionRow;
  const nextIndex = typedSession.current_call_index + 1;

  const { data: nextCall, error: callError } = await db
    .from("trivia_session_calls")
    .select("id, call_index")
    .eq("session_id", sessionId)
    .eq("call_index", nextIndex)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!nextCall) return NextResponse.json({ error: "No more questions available" }, { status: 409 });

  const typedCall = nextCall as CallRow;
  const now = new Date().toISOString();
  const nextRound = Math.floor((typedCall.call_index - 1) / Math.max(1, typedSession.questions_per_round)) + 1;

  await db.from("trivia_session_calls").update({ status: "asked", asked_at: now }).eq("id", typedCall.id);

  await db
    .from("trivia_sessions")
    .update({
      current_call_index: typedCall.call_index,
      current_round: nextRound,
      status: "running",
      countdown_started_at: now,
      paused_at: null,
      paused_remaining_seconds: null,
      started_at: typedSession.started_at ?? now,
    })
    .eq("id", sessionId);

  return NextResponse.json({ ok: true, current_call_index: typedCall.call_index }, { status: 200 });
}
