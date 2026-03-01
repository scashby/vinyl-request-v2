import { NextRequest, NextResponse } from "next/server";
import { getBackToBackConnectionDb } from "src/lib/backToBackConnectionDb";

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

export const runtime = "nodejs";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getBackToBackConnectionDb();
  const { data: session, error: sessionError } = await db
    .from("b2bc_sessions")
    .select("id, current_call_index, round_count, started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedSession = session as SessionRow;
  const nextIndex = typedSession.current_call_index + 1;

  const { data: nextCall, error: callError } = await db
    .from("b2bc_session_calls")
    .select("id, call_index, round_number")
    .eq("session_id", sessionId)
    .eq("call_index", nextIndex)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });

  const now = new Date().toISOString();
  if (!nextCall) {
    const { error: completeError } = await db
      .from("b2bc_sessions")
      .update({
        status: "completed",
        ended_at: now,
      })
      .eq("id", sessionId);

    if (completeError) return NextResponse.json({ error: completeError.message }, { status: 500 });

    const { error: closeRoundsError } = await db
      .from("b2bc_session_rounds")
      .update({ status: "closed", closed_at: now })
      .eq("session_id", sessionId)
      .neq("status", "closed");

    if (closeRoundsError) return NextResponse.json({ error: closeRoundsError.message }, { status: 500 });

    return NextResponse.json({ ok: true, completed: true }, { status: 200 });
  }

  const typedCall = nextCall as CallRow;
  const nextRound = Math.max(1, Math.min(typedSession.round_count, typedCall.round_number));

  const { error: updateCallError } = await db
    .from("b2bc_session_calls")
    .update({
      status: "played_track_a",
      asked_at: now,
    })
    .eq("id", typedCall.id)
    .eq("session_id", sessionId);

  if (updateCallError) return NextResponse.json({ error: updateCallError.message }, { status: 500 });

  const { error: closePreviousRoundsError } = await db
    .from("b2bc_session_rounds")
    .update({
      status: "closed",
      closed_at: now,
    })
    .eq("session_id", sessionId)
    .lt("round_number", nextRound)
    .neq("status", "closed");

  if (closePreviousRoundsError) return NextResponse.json({ error: closePreviousRoundsError.message }, { status: 500 });

  const { error: activateRoundError } = await db
    .from("b2bc_session_rounds")
    .update({
      status: "active",
      opened_at: now,
      closed_at: null,
    })
    .eq("session_id", sessionId)
    .eq("round_number", nextRound);

  if (activateRoundError) return NextResponse.json({ error: activateRoundError.message }, { status: 500 });

  const { error: updateSessionError } = await db
    .from("b2bc_sessions")
    .update({
      current_call_index: typedCall.call_index,
      current_round: nextRound,
      status: "running",
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
