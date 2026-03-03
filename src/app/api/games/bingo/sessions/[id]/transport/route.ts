import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import type { BingoDatabase } from "src/lib/bingoDb";

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

type TransportAnchorCalls = {
  cueCall: CallRow | null;
  pulledCall: CallRow | null;
  pullingCall: CallRow | null;
  insertAfterIndex: number;
};

type BingoSessionEventPayload = NonNullable<
  BingoDatabase["public"]["Tables"]["bingo_session_events"]["Insert"]["payload"]
>;

async function insertEvent(sessionId: number, eventType: string, payload: BingoSessionEventPayload) {
  const db = getBingoDb();
  const { error } = await db.from("bingo_session_events").insert({
    session_id: sessionId,
    event_type: eventType,
    payload,
  });
  if (error) throw new Error(error.message);
}

async function getCallById(db: ReturnType<typeof getBingoDb>, sessionId: number, callId: number): Promise<CallRow | null> {
  const { data, error } = await db
    .from("bingo_session_calls")
    .select("id, session_id, call_index, status")
    .eq("session_id", sessionId)
    .eq("id", callId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CallRow | null) ?? null;
}

async function getTransportAnchorCalls(db: ReturnType<typeof getBingoDb>, sessionId: number, currentCallIndex: number): Promise<TransportAnchorCalls> {
  const { data: cueData, error: cueError } = await db
    .from("bingo_session_calls")
    .select("id, session_id, call_index, status")
    .eq("session_id", sessionId)
    .eq("status", "prep_started")
    .gt("call_index", currentCallIndex)
    .order("call_index", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (cueError) throw new Error(cueError.message);
  const cueCall = (cueData as CallRow | null) ?? null;

  let pulledCall: CallRow | null = null;
  const pulledBoundary = cueCall?.call_index ?? currentCallIndex;
  const { data: latestPullEvent, error: pullEventError } = await db
    .from("bingo_session_events")
    .select("payload")
    .eq("session_id", sessionId)
    .eq("event_type", "pull_set")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pullEventError) throw new Error(pullEventError.message);

  const pullPayload = latestPullEvent?.payload as { call_id?: unknown } | null;
  const eventCallId = typeof pullPayload?.call_id === "number" ? pullPayload.call_id : Number.NaN;
  if (Number.isFinite(eventCallId)) {
    const eventCall = await getCallById(db, sessionId, eventCallId);
    if (eventCall && eventCall.status === "pending" && eventCall.call_index > pulledBoundary) {
      pulledCall = eventCall;
    }
  }

  if (!pulledCall) {
    const { data: pulledFallback, error: pulledFallbackError } = await db
      .from("bingo_session_calls")
      .select("id, session_id, call_index, status")
      .eq("session_id", sessionId)
      .eq("status", "pending")
      .gt("call_index", pulledBoundary)
      .order("call_index", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (pulledFallbackError) throw new Error(pulledFallbackError.message);
    pulledCall = (pulledFallback as CallRow | null) ?? null;
  }

  const pullingBoundary = pulledCall?.call_index ?? pulledBoundary;
  const { data: pullingData, error: pullingError } = await db
    .from("bingo_session_calls")
    .select("id, session_id, call_index, status")
    .eq("session_id", sessionId)
    .eq("status", "pending")
    .gt("call_index", pullingBoundary)
    .order("call_index", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pullingError) throw new Error(pullingError.message);
  const pullingCall = (pullingData as CallRow | null) ?? null;

  return {
    cueCall,
    pulledCall,
    pullingCall,
    insertAfterIndex: pullingCall?.call_index ?? pulledCall?.call_index ?? cueCall?.call_index ?? currentCallIndex,
  };
}

async function movePendingCallAfterIndex(
  db: ReturnType<typeof getBingoDb>,
  sessionId: number,
  callId: number,
  fromIndex: number,
  insertAfterIndex: number
): Promise<number> {
  if (fromIndex <= insertAfterIndex + 1) return fromIndex;

  const targetIndex = insertAfterIndex + 1;
  const rangeStart = targetIndex;
  const rangeEnd = fromIndex - 1;

  const { error: parkError } = await db
    .from("bingo_session_calls")
    .update({ call_index: -fromIndex })
    .eq("session_id", sessionId)
    .eq("id", callId);
  if (parkError) throw new Error(parkError.message);

  if (rangeStart <= rangeEnd) {
    const { data: shiftRows, error: shiftRowsError } = await db
      .from("bingo_session_calls")
      .select("id, call_index")
      .eq("session_id", sessionId)
      .gte("call_index", rangeStart)
      .lte("call_index", rangeEnd);
    if (shiftRowsError) throw new Error(shiftRowsError.message);

    const ordered = ((shiftRows ?? []) as Array<{ id: number; call_index: number }>).sort(
      (a, b) => b.call_index - a.call_index
    );

    for (const row of ordered) {
      const { error: shiftError } = await db
        .from("bingo_session_calls")
        .update({ call_index: row.call_index + 1 })
        .eq("session_id", sessionId)
        .eq("id", row.id);
      if (shiftError) throw new Error(shiftError.message);
    }
  }

  const { error: placeError } = await db
    .from("bingo_session_calls")
    .update({ call_index: targetIndex })
    .eq("session_id", sessionId)
    .eq("id", callId);
  if (placeError) throw new Error(placeError.message);

  return targetIndex;
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
    if (typedTarget.status !== "pending") {
      return NextResponse.json({ error: "Pull can only target a pending future call" }, { status: 409 });
    }

    const anchors = await getTransportAnchorCalls(db, sessionId, typedSession.current_call_index);
    if (typedTarget.call_index <= anchors.insertAfterIndex) {
      return NextResponse.json(
        { error: "Pull can only target a pending call after the current pulling slot" },
        { status: 409 }
      );
    }

    const nextIndex = await movePendingCallAfterIndex(
      db,
      sessionId,
      typedTarget.id,
      typedTarget.call_index,
      anchors.insertAfterIndex
    );

    await insertEvent(sessionId, "pull_set", { call_id: typedTarget.id, call_index: nextIndex });
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
