import { NextRequest, NextResponse } from "next/server";
import { getCoverArtClueChaseDb } from "src/lib/coverArtClueChaseDb";

type SessionRow = {
  id: number;
  current_call_index: number;
  started_at: string | null;
  round_count: number;
  status: "pending" | "running" | "paused" | "completed";
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

  const db = getCoverArtClueChaseDb();
  const { data: session, error: sessionError } = await db
    .from("cacc_sessions")
    .select("id, current_call_index, started_at, round_count, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedSession = session as SessionRow;
  if (typedSession.status === "completed") {
    return NextResponse.json({ error: "Session already completed" }, { status: 409 });
  }

  const nextIndex = typedSession.current_call_index + 1;
  const { data: nextCall, error: callError } = await db
    .from("cacc_session_calls")
    .select("id, call_index, round_number")
    .eq("session_id", sessionId)
    .eq("call_index", nextIndex)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });

  const now = new Date().toISOString();
  if (!nextCall) {
    const { error: completeError } = await db
      .from("cacc_sessions")
      .update({
        status: "completed",
        ended_at: now,
      })
      .eq("id", sessionId);

    if (completeError) return NextResponse.json({ error: completeError.message }, { status: 500 });

    await db.from("cacc_session_events").insert({
      session_id: sessionId,
      event_type: "session_completed",
      payload: { completed_at_call_index: typedSession.current_call_index },
    });

    return NextResponse.json({ ok: true, completed: true }, { status: 200 });
  }

  const typedCall = nextCall as CallRow;

  const { error: updateCallError } = await db
    .from("cacc_session_calls")
    .update({
      status: "stage_1",
      stage_revealed: 1,
      asked_at: now,
      revealed_at: now,
    })
    .eq("id", typedCall.id)
    .eq("session_id", sessionId);

  if (updateCallError) return NextResponse.json({ error: updateCallError.message }, { status: 500 });

  const { error: updateSessionError } = await db
    .from("cacc_sessions")
    .update({
      current_call_index: typedCall.call_index,
      current_round: Math.max(1, Math.min(typedSession.round_count, typedCall.round_number)),
      status: "running",
      started_at: typedSession.started_at ?? now,
      ended_at: null,
    })
    .eq("id", sessionId);

  if (updateSessionError) return NextResponse.json({ error: updateSessionError.message }, { status: 500 });

  await db.from("cacc_session_events").insert({
    session_id: sessionId,
    event_type: "call_advanced",
    payload: { call_id: typedCall.id, call_index: typedCall.call_index, round_number: typedCall.round_number },
  });

  return NextResponse.json(
    { ok: true, completed: false, current_call_index: typedCall.call_index, current_round: typedCall.round_number },
    { status: 200 }
  );
}
