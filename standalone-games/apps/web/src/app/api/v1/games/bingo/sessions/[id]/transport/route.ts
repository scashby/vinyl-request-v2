import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getStandaloneBingoSessionsRepository } from "@/lib/standaloneBingoSessionsRepositoryFactory";
import { getStandaloneBingoCallsRepository } from "@/lib/standaloneBingoCallsRepositoryFactory";
import { getStandaloneBingoSessionEventsRepository } from "@/lib/standaloneBingoSessionEventsRepositoryFactory";
import { computeStandaloneTransportQueueIds } from "@/lib/standaloneTransportQueue";

type TransportAction = "pull" | "cue" | "call";

type TransportBody = {
  action?: TransportAction;
  call_id?: string;
};

const DONE_STATUSES = new Set(["called", "completed", "skipped"]);

function isTransportAction(value: unknown): value is TransportAction {
  return value === "pull" || value === "cue" || value === "call";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as TransportBody;

    if (!isTransportAction(body.action)) {
      return NextResponse.json({ ok: false, error: "action must be pull, cue, or call" }, { status: 400 });
    }

    const callId = String(body.call_id ?? "").trim();
    if (!callId) {
      return NextResponse.json({ ok: false, error: "call_id is required" }, { status: 400 });
    }

    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);
    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json({ ok: false, error: "Missing entitlement: game:bingo" }, { status: 403 });
    }

    const sessionsRepo = getStandaloneBingoSessionsRepository();
    const callsRepo = getStandaloneBingoCallsRepository();
    const eventsRepo = getStandaloneBingoSessionEventsRepository();

    const session = await sessionsRepo.getById(ctx.tenantId, id);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    const calls = await callsRepo.listBySession(id);
    const callById = new Map(calls.map((call) => [call.id, call]));
    const targetCall = callById.get(callId);
    if (!targetCall) {
      return NextResponse.json({ ok: false, error: "Call not found for session." }, { status: 404 });
    }

    const currentOrder = (await callsRepo.getCurrentCalled(id))?.callIndex ?? 0;
    const events = await eventsRepo.listBySession(id);

    const queueIds = computeStandaloneTransportQueueIds(
      calls.map((call) => ({ id: call.id, order: call.callIndex, status: call.status })),
      events.map((event) => ({
        eventType: event.eventType,
        callId: event.payload?.call_id ?? null,
        afterCallId: event.payload?.after_call_id ?? null,
      })),
      { currentOrder, doneStatuses: DONE_STATUSES }
    );

    if (body.action === "cue") {
      if (targetCall.callIndex <= currentOrder || DONE_STATUSES.has(targetCall.status)) {
        return NextResponse.json({ ok: false, error: "Call is not eligible to cue." }, { status: 400 });
      }
      await eventsRepo.create(id, "cue_set", { call_id: targetCall.id });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "pull") {
      if (targetCall.callIndex <= currentOrder || DONE_STATUSES.has(targetCall.status)) {
        return NextResponse.json({ ok: false, error: "Call is not eligible to pull." }, { status: 400 });
      }

      const activeQueue = queueIds.filter((queuedId) => queuedId !== targetCall.id);
      const afterCallId = activeQueue[1] ?? null;

      await eventsRepo.create(id, "pull_set", { call_id: targetCall.id });
      await eventsRepo.create(id, "pull_promote", {
        call_id: targetCall.id,
        after_call_id: afterCallId,
      });
      return NextResponse.json({ ok: true });
    }

    const nextCallId = queueIds[0] ?? null;
    if (!nextCallId || nextCallId !== targetCall.id) {
      return NextResponse.json({ ok: false, error: "Only the cued top queue call can be called." }, { status: 400 });
    }

    const currentCall = await callsRepo.getCurrentCalled(id);
    if (currentCall) {
      await callsRepo.markCompleted(currentCall.id);
    }

    const calledAt = new Date().toISOString();
    const calledCall = await callsRepo.markCalled(targetCall.id, calledAt);
    await eventsRepo.create(id, "call_set", { call_id: targetCall.id });

    const updatedSession = await sessionsRepo.update(ctx.tenantId, id, {
      status: "running",
      bingoOverlay: "none",
      nextGameScheduledAt: null,
      startedAt: session.startedAt ?? calledAt,
      endedAt: null,
      countdownStartedAt: calledAt,
      pausedAt: null,
      pausedRemainingSeconds: null,
    });

    return NextResponse.json({ ok: true, data: { session: updatedSession, call: calledCall } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}
