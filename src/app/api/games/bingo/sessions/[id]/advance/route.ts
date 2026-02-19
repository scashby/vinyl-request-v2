import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  current_call_index: number;
  started_at: string | null;
};

type CallRow = {
  id: number;
  call_index: number;
};

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getBingoDb();
  const { data: session, error: sessionError } = await db
    .from("bingo_sessions")
    .select("id, current_call_index, started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedSession = session as SessionRow;
  const nextIndex = typedSession.current_call_index + 1;

  const { data: nextCall, error: callError } = await db
    .from("bingo_session_calls")
    .select("id, call_index")
    .eq("session_id", sessionId)
    .eq("call_index", nextIndex)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!nextCall) return NextResponse.json({ error: "No more calls available" }, { status: 409 });

  const typedCall = nextCall as CallRow;
  const now = new Date().toISOString();

  await db
    .from("bingo_session_calls")
    .update({ status: "called", called_at: now })
    .eq("id", typedCall.id);

  await db
    .from("bingo_sessions")
    .update({
      current_call_index: typedCall.call_index,
      status: "running",
      countdown_started_at: now,
      paused_at: null,
      paused_remaining_seconds: null,
      started_at: typedSession.started_at ?? now,
    })
    .eq("id", sessionId);

  return NextResponse.json({ ok: true, current_call_index: typedCall.call_index }, { status: 200 });
}
