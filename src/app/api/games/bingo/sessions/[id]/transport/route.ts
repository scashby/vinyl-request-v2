import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";

export const runtime = "nodejs";

type TransportAction = "pull" | "cue" | "call";

type TransportBody = {
  action?: TransportAction;
  call_id?: number;
};

type SessionRow = {
  id: number;
  current_call_index: number;
  started_at: string | null;
};

type CallRow = {
  id: number;
  session_id: number;
  call_index: number;
  status: string;
};

async function insertEvent(sessionId: number, eventType: string, payload: Record<string, unknown>) {
  const db = getBingoDb();
  const { error } = await db.from("bingo_session_events").insert({
    session_id: sessionId,
    event_type: eventType,
    payload,
  });
  if (error) throw new Error(error.message);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json()) as TransportBody;
  if (!body.action || !["pull", "cue", "call"].includes(body.action)) {
    return NextResponse.json({ error: "action must be pull, cue, or call" }, { status: 400 });
  }

  const callId = Number(body.call_id);
  if (!Number.isFinite(callId)) return NextResponse.json({ error: "call_id is required" }, { status: 400 });

  const db = getBingoDb();
  const { data: session, error: sessionError } = await db
    .from("bingo_sessions")
    .select("id, current_call_index, started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const typedSession = session as SessionRow;

  const { data: targetCall, error: targetError } = await db
    .from("bingo_session_calls")
    .select("id, session_id, call_index, status")
    .eq("id", callId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
  if (!targetCall) return NextResponse.json({ error: "Call not found for session" }, { status: 404 });
  const typedTarget = targetCall as CallRow;

  if (["completed", "skipped"].includes(typedTarget.status)) {
    return NextResponse.json({ error: "Cannot update a completed call" }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (body.action === "pull") {
    const cueBoundary = typedSession.current_call_index;
    if (typedTarget.call_index <= cueBoundary || typedTarget.status !== "pending") {
      return NextResponse.json({ error: "Pull can only target a pending future call" }, { status: 409 });
    }

    await insertEvent(sessionId, "pull_set", { call_id: typedTarget.id, call_index: typedTarget.call_index });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (body.action === "cue") {
    if (typedTarget.call_index <= typedSession.current_call_index) {
      return NextResponse.json({ error: "Cue can only target a future call" }, { status: 409 });
    }

    const { error: clearPrepError } = await db
      .from("bingo_session_calls")
      .update({ status: "pending" })
      .eq("session_id", sessionId)
      .eq("status", "prep_started")
      .neq("id", typedTarget.id);
    if (clearPrepError) return NextResponse.json({ error: clearPrepError.message }, { status: 500 });

    const { error: cueError } = await db
      .from("bingo_session_calls")
      .update({ status: "prep_started", prep_started_at: now })
      .eq("id", typedTarget.id);
    if (cueError) return NextResponse.json({ error: cueError.message }, { status: 500 });

    await insertEvent(sessionId, "cue_set", { call_id: typedTarget.id, call_index: typedTarget.call_index });

    const { data: nextPull } = await db
      .from("bingo_session_calls")
      .select("id, call_index")
      .eq("session_id", sessionId)
      .eq("status", "pending")
      .gt("call_index", typedTarget.call_index)
      .order("call_index", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextPull?.id) {
      await insertEvent(sessionId, "pull_set", { call_id: nextPull.id, call_index: nextPull.call_index });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (typedTarget.call_index < typedSession.current_call_index) {
    return NextResponse.json({ error: "Call can only target the current or a future call" }, { status: 409 });
  }

  const { data: calledRows, error: calledRowsError } = await db
    .from("bingo_session_calls")
    .select("id")
    .eq("session_id", sessionId)
    .eq("status", "called")
    .neq("id", typedTarget.id);
  if (calledRowsError) return NextResponse.json({ error: calledRowsError.message }, { status: 500 });

  const calledIds = (calledRows ?? []).map((row) => row.id).filter((value): value is number => Number.isFinite(value));
  if (calledIds.length) {
    const { error: completeError } = await db
      .from("bingo_session_calls")
      .update({ status: "completed", completed_at: now })
      .in("id", calledIds);
    if (completeError) return NextResponse.json({ error: completeError.message }, { status: 500 });
  }

  const { error: clearPrepError } = await db
    .from("bingo_session_calls")
    .update({ status: "pending" })
    .eq("session_id", sessionId)
    .eq("status", "prep_started")
    .neq("id", typedTarget.id);
  if (clearPrepError) return NextResponse.json({ error: clearPrepError.message }, { status: 500 });

  const { error: callError } = await db
    .from("bingo_session_calls")
    .update({ status: "called", called_at: now })
    .eq("id", typedTarget.id);
  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });

  const { error: sessionUpdateError } = await db
    .from("bingo_sessions")
    .update({
      current_call_index: typedTarget.call_index,
      status: "running",
      countdown_started_at: now,
      paused_at: null,
      paused_remaining_seconds: null,
      started_at: typedSession.started_at ?? now,
    })
    .eq("id", sessionId);
  if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

  await insertEvent(sessionId, "call_set", { call_id: typedTarget.id, call_index: typedTarget.call_index });

  const { data: nextCue } = await db
    .from("bingo_session_calls")
    .select("id, call_index")
    .eq("session_id", sessionId)
    .eq("status", "pending")
    .gt("call_index", typedTarget.call_index)
    .order("call_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextCue?.id) {
    await db
      .from("bingo_session_calls")
      .update({ status: "prep_started", prep_started_at: now })
      .eq("id", nextCue.id);
    await insertEvent(sessionId, "cue_set", { call_id: nextCue.id, call_index: nextCue.call_index });

    const { data: nextPull } = await db
      .from("bingo_session_calls")
      .select("id, call_index")
      .eq("session_id", sessionId)
      .eq("status", "pending")
      .gt("call_index", nextCue.call_index)
      .order("call_index", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextPull?.id) {
      await insertEvent(sessionId, "pull_set", { call_id: nextPull.id, call_index: nextPull.call_index });
    }
  }

  return NextResponse.json({ ok: true, current_call_index: typedTarget.call_index }, { status: 200 });
}
