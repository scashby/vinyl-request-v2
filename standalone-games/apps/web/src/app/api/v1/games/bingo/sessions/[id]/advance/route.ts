import { NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getStandaloneBingoCallsRepository } from "@/lib/standaloneBingoCallsRepositoryFactory";
import { getStandaloneBingoSessionsRepository } from "@/lib/standaloneBingoSessionsRepositoryFactory";
import { getStandaloneBingoSessionEventsRepository } from "@/lib/standaloneBingoSessionEventsRepositoryFactory";
import { computeStandaloneTransportQueueIds } from "@/lib/standaloneTransportQueue";

const DONE_STATUSES = new Set(["called", "completed", "skipped"]);

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);

    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json(
        { ok: false, error: "Missing entitlement: game:bingo" },
        { status: 403 }
      );
    }

    const sessionsRepo = getStandaloneBingoSessionsRepository();
    const session = await sessionsRepo.getById(ctx.tenantId, id);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    const callsRepo = getStandaloneBingoCallsRepository();
    const eventsRepo = getStandaloneBingoSessionEventsRepository();
    const currentCall = await callsRepo.getCurrentCalled(id);
    if (currentCall) {
      await callsRepo.markCompleted(currentCall.id);
    }

    const [allCalls, events] = await Promise.all([
      callsRepo.listBySession(id),
      eventsRepo.listBySession(id),
    ]);
    const queueIds = computeStandaloneTransportQueueIds(
      allCalls.map((call) => ({ id: call.id, order: call.callIndex, status: call.status })),
      events.map((event) => ({
        eventType: event.eventType,
        callId: event.payload?.call_id ?? null,
        afterCallId: event.payload?.after_call_id ?? null,
      })),
      {
        currentOrder: currentCall?.callIndex ?? 0,
        doneStatuses: DONE_STATUSES,
      }
    );
    const nextCall = queueIds.length > 0
      ? allCalls.find((call) => call.id === queueIds[0]) ?? null
      : await callsRepo.getNextPending(id);
    if (!nextCall) {
      const completedSession = await sessionsRepo.update(ctx.tenantId, id, {
        status: "completed",
        endedAt: new Date().toISOString(),
      });

      return NextResponse.json(
        { ok: false, error: "No more calls available.", data: completedSession },
        { status: 409 }
      );
    }

    const calledAt = new Date().toISOString();
    const calledCall = await callsRepo.markCalled(nextCall.id, calledAt);
    await eventsRepo.create(id, "call_set", { call_id: nextCall.id });
    const updatedSession = await sessionsRepo.update(ctx.tenantId, id, {
      status: "running",
      startedAt: session.startedAt ?? calledAt,
      endedAt: null,
      countdownStartedAt: calledAt,
      pausedAt: null,
      pausedRemainingSeconds: null,
    });

    return NextResponse.json(
      { ok: true, data: { session: updatedSession, call: calledCall } },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}