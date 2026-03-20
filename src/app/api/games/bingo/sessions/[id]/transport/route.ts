import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import type { BingoDatabase } from "src/lib/bingoDb";
import { computeTransportQueueIds, type TransportQueueEvent } from "src/lib/transportQueue";

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
  call_reveal_delay_seconds: number;
};

type CallRow = {
  id: number;
  session_id: number;
  call_index: number;
  status: string;
};

type EventRow = {
  event_type: string;
  payload: { call_id?: unknown; after_call_id?: unknown } | null;
};

type BingoSessionEventPayload = NonNullable<
  BingoDatabase["public"]["Tables"]["bingo_session_events"]["Insert"]["payload"]
>;

const DONE_STATUSES = new Set(["called", "completed", "skipped"]);

function parseEventCallId(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

async function insertEvent(sessionId: number, eventType: string, payload: BingoSessionEventPayload) {
  const db = getBingoDb();
  const { error } = await db.from("bingo_session_events").insert({
    session_id: sessionId,
    event_type: eventType,
    payload,
  });
  if (error) throw new Error(error.message);
}

async function getQueueCalls(db: ReturnType<typeof getBingoDb>, sessionId: number, currentCallIndex: number): Promise<CallRow[]> {
  const [{ data: callsData, error: callsError }, { data: eventsData, error: eventsError }] = await Promise.all([
    db
      .from("bingo_session_calls")
      .select("id, session_id, call_index, status")
      .eq("session_id", sessionId),
    db
      .from("bingo_session_events")
      .select("event_type, payload")
      .eq("session_id", sessionId)
      .in("event_type", ["cue_set", "pull_set", "pull_promote", "call_set"])
      .order("id", { ascending: true })
      .limit(5000),
  ]);

  if (callsError) throw new Error(callsError.message);
  if (eventsError) throw new Error(eventsError.message);

  const calls = (callsData ?? []) as CallRow[];
  const events = ((eventsData ?? []) as EventRow[]).map(
    (row): TransportQueueEvent => ({
      eventType: row.event_type,
      callId: parseEventCallId(row.payload?.call_id),
      afterCallId: parseEventCallId(row.payload?.after_call_id),
    })
  );

  const queueIds = computeTransportQueueIds(
    calls.map((call) => ({
      id: call.id,
      order: call.call_index,
      status: call.status,
    })),
    events,
    {
      currentOrder: currentCallIndex,
      doneStatuses: DONE_STATUSES,
    }
  );

  const byId = new Map(calls.map((call) => [call.id, call]));
  return queueIds.map((id) => byId.get(id)).filter((call): call is CallRow => Boolean(call));
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
    .select("id, current_call_index, started_at, call_reveal_delay_seconds")
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

    const queueCalls = await getQueueCalls(db, sessionId, typedSession.current_call_index);
    const queueRank = queueCalls.findIndex((call) => call.id === typedTarget.id);
    if (queueRank < 0) {
      return NextResponse.json({ error: "Pull can only target a pending future call" }, { status: 409 });
    }
    if (queueRank < 3) {
      return NextResponse.json(
        { error: "Pull can only target a pending call after the current pulling slot" },
        { status: 409 }
      );
    }

    const afterCallId = queueCalls[2]?.id ?? queueCalls[1]?.id ?? queueCalls[0]?.id ?? null;
    await insertEvent(sessionId, "pull_promote", {
      call_id: typedTarget.id,
      call_index: typedTarget.call_index,
      after_call_id: afterCallId,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (body.action === "cue") {
    if (typedTarget.call_index <= typedSession.current_call_index) {
      return NextResponse.json({ error: "Cue can only target a future call" }, { status: 409 });
    }

    const queueCalls = await getQueueCalls(db, sessionId, typedSession.current_call_index);
    const queueRank = queueCalls.findIndex((call) => call.id === typedTarget.id);
    if (queueRank < 0) {
      return NextResponse.json({ error: "Cue can only target a pending future call" }, { status: 409 });
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

    const queueAfterCue = await getQueueCalls(db, sessionId, typedSession.current_call_index);
    const nextPull = queueAfterCue[1] ?? null;
    if (nextPull?.id) {
      await insertEvent(sessionId, "pull_set", { call_id: nextPull.id, call_index: nextPull.call_index });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (typedTarget.call_index < typedSession.current_call_index) {
    return NextResponse.json({ error: "Call can only target the current or a future call" }, { status: 409 });
  }

  const queueCalls = await getQueueCalls(db, sessionId, typedSession.current_call_index);
  if (!queueCalls.some((call) => call.id === typedTarget.id)) {
    return NextResponse.json({ error: "Call can only target a pending current/future row" }, { status: 409 });
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

  const revealDelay = typedSession.call_reveal_delay_seconds ?? 0;
  const revealAt = revealDelay > 0
    ? new Date(Date.now() + revealDelay * 1000).toISOString()
    : now;

  const { error: sessionUpdateError } = await db
    .from("bingo_sessions")
    .update({
      current_call_index: typedTarget.call_index,
      status: "running",
      countdown_started_at: now,
      paused_at: null,
      paused_remaining_seconds: null,
      started_at: typedSession.started_at ?? now,
      call_reveal_at: revealAt,
    })
    .eq("id", sessionId);
  if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

  await insertEvent(sessionId, "call_set", { call_id: typedTarget.id, call_index: typedTarget.call_index });

  const queueAfterCall = await getQueueCalls(db, sessionId, typedTarget.call_index);
  const nextCue = queueAfterCall[0] ?? null;

  if (nextCue?.id) {
    await db
      .from("bingo_session_calls")
      .update({ status: "prep_started", prep_started_at: now })
      .eq("id", nextCue.id);
    await insertEvent(sessionId, "cue_set", { call_id: nextCue.id, call_index: nextCue.call_index });

    const queueAfterCue = await getQueueCalls(db, sessionId, typedTarget.call_index);
    const nextPull = queueAfterCue[1] ?? null;
    if (nextPull?.id) {
      await insertEvent(sessionId, "pull_set", { call_id: nextPull.id, call_index: nextPull.call_index });
    }
  }

  return NextResponse.json({ ok: true, current_call_index: typedTarget.call_index }, { status: 200 });
}
