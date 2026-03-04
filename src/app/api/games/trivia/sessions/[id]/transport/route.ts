import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import type { TriviaDatabase } from "src/lib/triviaDb";
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
};

type CallRow = {
  id: number;
  session_id: number;
  call_index: number;
  round_number: number;
  status: string;
};

type EventRow = {
  event_type: string;
  payload: { call_id?: unknown; after_call_id?: unknown } | null;
};

type TriviaSessionEventPayload = NonNullable<
  TriviaDatabase["public"]["Tables"]["trivia_session_events"]["Insert"]["payload"]
>;

const DONE_STATUSES = new Set(["asked", "answer_revealed", "scored", "skipped"]);

function parseEventCallId(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

async function insertEvent(sessionId: number, eventType: string, payload: TriviaSessionEventPayload) {
  const db = getTriviaDb();
  const { error } = await db.from("trivia_session_events").insert({
    session_id: sessionId,
    event_type: eventType,
    payload,
  });
  if (error) throw new Error(error.message);
}

async function getCallById(db: ReturnType<typeof getTriviaDb>, sessionId: number, callId: number): Promise<CallRow | null> {
  const { data, error } = await db
    .from("trivia_session_calls")
    .select("id, session_id, call_index, round_number, status")
    .eq("session_id", sessionId)
    .eq("id", callId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CallRow | null) ?? null;
}

async function getQueueCalls(db: ReturnType<typeof getTriviaDb>, sessionId: number, currentCallIndex: number): Promise<CallRow[]> {
  const [{ data: callsData, error: callsError }, { data: eventsData, error: eventsError }] = await Promise.all([
    db
      .from("trivia_session_calls")
      .select("id, session_id, call_index, round_number, status")
      .eq("session_id", sessionId),
    db
      .from("trivia_session_events")
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

  const db = getTriviaDb();
  const { data: session, error: sessionError } = await db
    .from("trivia_sessions")
    .select("id, current_call_index, started_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const typedSession = session as SessionRow;

  const targetCall = await getCallById(db, sessionId, callId);
  if (!targetCall) return NextResponse.json({ error: "Call not found for session" }, { status: 404 });

  if (["scored", "skipped"].includes(targetCall.status)) {
    return NextResponse.json({ error: "Cannot update a completed call" }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (body.action === "pull") {
    if (targetCall.status !== "pending") {
      return NextResponse.json({ error: "Pull can only target a pending future call" }, { status: 409 });
    }

    const queueCalls = await getQueueCalls(db, sessionId, typedSession.current_call_index);
    const queueRank = queueCalls.findIndex((call) => call.id === targetCall.id);
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
      call_id: targetCall.id,
      call_index: targetCall.call_index,
      after_call_id: afterCallId,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (body.action === "cue") {
    if (targetCall.status !== "pending" || targetCall.call_index <= typedSession.current_call_index) {
      return NextResponse.json({ error: "Cue can only target a pending future call" }, { status: 409 });
    }

    const queueCalls = await getQueueCalls(db, sessionId, typedSession.current_call_index);
    if (!queueCalls.some((call) => call.id === targetCall.id)) {
      return NextResponse.json({ error: "Cue can only target a pending future call" }, { status: 409 });
    }

    await insertEvent(sessionId, "cue_set", { call_id: targetCall.id, call_index: targetCall.call_index });

    const queueAfterCue = await getQueueCalls(db, sessionId, typedSession.current_call_index);
    const nextPull = queueAfterCue[1] ?? null;
    if (nextPull?.id) {
      await insertEvent(sessionId, "pull_set", { call_id: nextPull.id, call_index: nextPull.call_index });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (targetCall.call_index < typedSession.current_call_index || targetCall.status !== "pending") {
    return NextResponse.json({ error: "Call can only target a pending current/future row" }, { status: 409 });
  }

  const queueCalls = await getQueueCalls(db, sessionId, typedSession.current_call_index);
  if (!queueCalls.some((call) => call.id === targetCall.id)) {
    return NextResponse.json({ error: "Call can only target a pending current/future row" }, { status: 409 });
  }

  const { error: callError } = await db
    .from("trivia_session_calls")
    .update({ status: "asked", asked_at: now })
    .eq("id", targetCall.id)
    .eq("session_id", sessionId);
  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });

  const { error: sessionUpdateError } = await db
    .from("trivia_sessions")
    .update({
      current_call_index: targetCall.call_index,
      current_round: targetCall.round_number,
      status: "running",
      countdown_started_at: now,
      paused_at: null,
      paused_remaining_seconds: null,
      started_at: typedSession.started_at ?? now,
    })
    .eq("id", sessionId);
  if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

  await insertEvent(sessionId, "call_set", { call_id: targetCall.id, call_index: targetCall.call_index });

  const queueAfterCall = await getQueueCalls(db, sessionId, targetCall.call_index);
  const nextCue = queueAfterCall[0] ?? null;

  if (nextCue?.id) {
    await insertEvent(sessionId, "cue_set", { call_id: nextCue.id, call_index: nextCue.call_index });

    const queueAfterCue = await getQueueCalls(db, sessionId, targetCall.call_index);
    const nextPull = queueAfterCue[1] ?? null;
    if (nextPull?.id) {
      await insertEvent(sessionId, "pull_set", { call_id: nextPull.id, call_index: nextPull.call_index });
    }
  }

  return NextResponse.json({ ok: true, current_call_index: targetCall.call_index }, { status: 200 });
}
