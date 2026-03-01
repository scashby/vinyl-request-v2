import { NextRequest, NextResponse } from "next/server";
import { getCoverArtClueChaseDb } from "src/lib/coverArtClueChaseDb";

type SessionRow = {
  id: number;
  current_call_index: number;
  started_at: string | null;
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
    .select("id, current_call_index, started_at, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedSession = session as SessionRow;
  if (typedSession.status === "completed") {
    return NextResponse.json({ error: "Session already completed" }, { status: 409 });
  }

  if (typedSession.current_call_index > 0) {
    return NextResponse.json({ error: "Session already started" }, { status: 409 });
  }

  const { data: firstCall, error: callError } = await db
    .from("cacc_session_calls")
    .select("id, call_index, round_number")
    .eq("session_id", sessionId)
    .eq("call_index", 1)
    .maybeSingle();

  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
  if (!firstCall) return NextResponse.json({ error: "No calls found for session" }, { status: 409 });

  const typedCall = firstCall as CallRow;
  const now = new Date().toISOString();

  const { error: callUpdateError } = await db
    .from("cacc_session_calls")
    .update({
      status: "stage_1",
      stage_revealed: 1,
      asked_at: now,
      revealed_at: now,
    })
    .eq("id", typedCall.id)
    .eq("session_id", sessionId);

  if (callUpdateError) return NextResponse.json({ error: callUpdateError.message }, { status: 500 });

  const { error: sessionUpdateError } = await db
    .from("cacc_sessions")
    .update({
      current_call_index: typedCall.call_index,
      current_round: typedCall.round_number,
      status: "running",
      started_at: typedSession.started_at ?? now,
      ended_at: null,
    })
    .eq("id", sessionId);

  if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

  await db.from("cacc_session_events").insert({
    session_id: sessionId,
    event_type: "session_started",
    payload: { call_id: typedCall.id, call_index: typedCall.call_index },
  });

  return NextResponse.json(
    { ok: true, current_call_index: typedCall.call_index, current_round: typedCall.round_number },
    { status: 200 }
  );
}
