import { NextRequest, NextResponse } from "next/server";
import { getCrateCategoriesDb } from "src/lib/crateCategoriesDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  current_call_index: number;
  round_count: number;
  started_at: string | null;
};

type CallRow = {
  id: number;
  call_index: number;
  round_number: number;
};

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getCrateCategoriesDb();
  const { data: session, error: sessionError } = await db
    .from("ccat_sessions")
    .select("id, current_call_index, round_count, started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedSession = session as SessionRow;
  const nextIndex = typedSession.current_call_index + 1;

  const { data: nextCall, error: callError } = await db
    .from("ccat_session_calls")
    .select("id, call_index, round_number")
    .eq("session_id", sessionId)
    .eq("call_index", nextIndex)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });

  const now = new Date().toISOString();
  if (!nextCall) {
    await db
      .from("ccat_session_rounds")
      .update({
        status: "closed",
        closed_at: now,
      })
      .eq("session_id", sessionId)
      .eq("status", "active");

    await db
      .from("ccat_sessions")
      .update({
        status: "completed",
        ended_at: now,
        paused_at: null,
        paused_remaining_seconds: null,
      })
      .eq("id", sessionId);

    return NextResponse.json({ ok: true, completed: true }, { status: 200 });
  }

  const typedCall = nextCall as CallRow;
  const nextRound = Math.max(1, Math.min(typedSession.round_count, typedCall.round_number));

  const { error: updateCallError } = await db
    .from("ccat_session_calls")
    .update({
      status: "playing",
      asked_at: now,
    })
    .eq("id", typedCall.id)
    .eq("session_id", sessionId);

  if (updateCallError) return NextResponse.json({ error: updateCallError.message }, { status: 500 });

  const { error: updateRoundError } = await db
    .from("ccat_session_rounds")
    .update({
      status: "active",
      opened_at: now,
    })
    .eq("session_id", sessionId)
    .eq("round_number", typedCall.round_number);

  if (updateRoundError) return NextResponse.json({ error: updateRoundError.message }, { status: 500 });

  const { error: updateSessionError } = await db
    .from("ccat_sessions")
    .update({
      current_call_index: typedCall.call_index,
      current_round: nextRound,
      status: "running",
      countdown_started_at: now,
      paused_at: null,
      paused_remaining_seconds: null,
      ended_at: null,
      started_at: typedSession.started_at ?? now,
    })
    .eq("id", sessionId);

  if (updateSessionError) return NextResponse.json({ error: updateSessionError.message }, { status: 500 });

  return NextResponse.json(
    { ok: true, completed: false, current_call_index: typedCall.call_index, current_round: nextRound },
    { status: 200 }
  );
}
