import { NextRequest, NextResponse } from "next/server";
import { getGenreImposterDb } from "src/lib/genreImposterDb";
import { computeTransportQueueIds, type TransportQueueEvent } from "src/lib/transportQueue";

export const runtime = "nodejs";

type TransportAction = "pull" | "cue" | "call";

type TransportBody = {
  action?: TransportAction;
  call_id?: number;
};

type SessionRow = {
  id: number;
  current_round: number;
  current_call_index: number;
  started_at: string | null;
};

type CallRow = {
  id: number;
  session_id: number;
  round_number: number;
  call_index: number;
  play_order: number;
  status: string;
};

type EventRow = {
  event_type: string;
  payload: { call_id?: unknown; after_call_id?: unknown } | null;
};

const DONE_STATUSES = new Set(["played", "revealed", "scored", "skipped"]);

function parseEventCallId(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

function toOrderIndex(call: Pick<CallRow, "round_number" | "play_order">): number {
  return ((call.round_number - 1) * 3) + call.play_order;
}

async function insertEvent(sessionId: number, eventType: string, payload: Record<string, unknown>) {
  const db = getGenreImposterDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;
  const { error } = await dbAny.from("gi_session_events").insert({
    session_id: sessionId,
    event_type: eventType,
    payload,
  });
  if (error) throw new Error(error.message);
}

async function getCallById(db: ReturnType<typeof getGenreImposterDb>, sessionId: number, callId: number): Promise<CallRow | null> {
  const { data, error } = await db
    .from("gi_session_calls")
    .select("id, session_id, round_number, call_index, play_order, status")
    .eq("session_id", sessionId)
    .eq("id", callId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CallRow | null) ?? null;
}

async function getQueueCalls(db: ReturnType<typeof getGenreImposterDb>, sessionId: number, currentOrder: number): Promise<CallRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;

  const [{ data: callsData, error: callsError }, { data: eventsData, error: eventsError }] = await Promise.all([
    db
      .from("gi_session_calls")
      .select("id, session_id, round_number, call_index, play_order, status")
      .eq("session_id", sessionId),
    dbAny
      .from("gi_session_events")
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
      order: toOrderIndex(call),
      status: call.status,
    })),
    events,
    {
      currentOrder,
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

  const db = getGenreImposterDb();
  const { data: session, error: sessionError } = await db
    .from("gi_sessions")
    .select("id, current_round, current_call_index, started_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const typedSession = session as SessionRow;
  const currentOrder = Math.max(0, ((typedSession.current_round - 1) * 3) + typedSession.current_call_index);

  const targetCall = await getCallById(db, sessionId, callId);
  if (!targetCall) return NextResponse.json({ error: "Call not found for session" }, { status: 404 });
  const targetOrder = toOrderIndex(targetCall);

  if (["revealed", "scored", "skipped"].includes(targetCall.status)) {
    return NextResponse.json({ error: "Cannot update a completed call" }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (body.action === "pull") {
    if (targetCall.status !== "pending") {
      return NextResponse.json({ error: "Pull can only target a pending future call" }, { status: 409 });
    }

    const queueCalls = await getQueueCalls(db, sessionId, currentOrder);
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
      call_index: targetOrder,
      after_call_id: afterCallId,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (body.action === "cue") {
    if (targetCall.status !== "pending" || targetOrder <= currentOrder) {
      return NextResponse.json({ error: "Cue can only target a pending future call" }, { status: 409 });
    }

    const queueCalls = await getQueueCalls(db, sessionId, currentOrder);
    if (!queueCalls.some((call) => call.id === targetCall.id)) {
      return NextResponse.json({ error: "Cue can only target a pending future call" }, { status: 409 });
    }

    await insertEvent(sessionId, "cue_set", { call_id: targetCall.id, call_index: targetOrder });

    const queueAfterCue = await getQueueCalls(db, sessionId, currentOrder);
    const nextPull = queueAfterCue[1] ?? null;
    if (nextPull?.id) {
      await insertEvent(sessionId, "pull_set", { call_id: nextPull.id, call_index: toOrderIndex(nextPull) });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (targetOrder < currentOrder || targetCall.status !== "pending") {
    return NextResponse.json({ error: "Call can only target a pending current/future row" }, { status: 409 });
  }

  const queueCalls = await getQueueCalls(db, sessionId, currentOrder);
  if (!queueCalls.some((call) => call.id === targetCall.id)) {
    return NextResponse.json({ error: "Call can only target a pending current/future row" }, { status: 409 });
  }

  const { error: callError } = await db
    .from("gi_session_calls")
    .update({ status: "played", played_at: now })
    .eq("id", targetCall.id)
    .eq("session_id", sessionId);
  if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });

  const { error: sessionUpdateError } = await db
    .from("gi_sessions")
    .update({
      current_round: targetCall.round_number,
      current_call_index: targetCall.call_index,
      status: "running",
      countdown_started_at: now,
      paused_at: null,
      paused_remaining_seconds: null,
      ended_at: null,
      started_at: typedSession.started_at ?? now,
    })
    .eq("id", sessionId);
  if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

  await db
    .from("gi_session_rounds")
    .update({ status: "active", opened_at: now })
    .eq("session_id", sessionId)
    .eq("round_number", targetCall.round_number);

  await insertEvent(sessionId, "call_set", { call_id: targetCall.id, call_index: targetOrder });

  const queueAfterCall = await getQueueCalls(db, sessionId, targetOrder);
  const nextCue = queueAfterCall[0] ?? null;
  if (nextCue) {
    await insertEvent(sessionId, "cue_set", { call_id: nextCue.id, call_index: toOrderIndex(nextCue) });

    const queueAfterCue = await getQueueCalls(db, sessionId, targetOrder);
    const nextPull = queueAfterCue[1] ?? null;
    if (nextPull) {
      await insertEvent(sessionId, "pull_set", { call_id: nextPull.id, call_index: toOrderIndex(nextPull) });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      current_round: targetCall.round_number,
      current_call_index: targetCall.call_index,
    },
    { status: 200 }
  );
}
