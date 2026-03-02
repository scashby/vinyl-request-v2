import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";

type SessionRow = {
  id: number;
  started_at: string | null;
};

type CallRow = {
  id: number;
  call_index: number;
  round_number: number;
};

export const runtime = "nodejs";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getTriviaDb();
  const { data: session, error: sessionError } = await db
    .from("trivia_sessions")
    .select("id, started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: nextCall, error: callError } = await db
    .from("trivia_session_calls")
    .select("id, call_index, round_number")
    .eq("session_id", sessionId)
    .eq("is_tiebreaker", true)
    .eq("status", "pending")
    .order("call_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!nextCall) return NextResponse.json({ error: "No tie-breaker questions available" }, { status: 409 });

  const typedCall = nextCall as CallRow;
  const typedSession = session as SessionRow;
  const now = new Date().toISOString();

  const { error: callUpdateError } = await db
    .from("trivia_session_calls")
    .update({ status: "asked", asked_at: now })
    .eq("id", typedCall.id);
  if (callUpdateError) return NextResponse.json({ error: callUpdateError.message }, { status: 500 });

  const { error: sessionUpdateError } = await db
    .from("trivia_sessions")
    .update({
      current_call_index: typedCall.call_index,
      current_round: typedCall.round_number,
      status: "running",
      countdown_started_at: now,
      paused_at: null,
      paused_remaining_seconds: null,
      started_at: typedSession.started_at ?? now,
    })
    .eq("id", sessionId);

  if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, current_call_index: typedCall.call_index }, { status: 200 });
}
