import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getStandaloneBingoCallsRepository } from "@/lib/standaloneBingoCallsRepositoryFactory";
import { getStandaloneBingoSessionsRepository } from "@/lib/standaloneBingoSessionsRepositoryFactory";

type ControlAction = "pause" | "resume" | "advance" | "skip" | "replace_next" | "next_round";

function coerceAction(value: unknown): ControlAction | null {
  if (
    value === "pause" ||
    value === "resume" ||
    value === "advance" ||
    value === "skip" ||
    value === "replace_next" ||
    value === "next_round"
  ) {
    return value;
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { action?: unknown };
    const action = coerceAction(body.action);

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "action must be one of pause,resume,advance,skip,replace_next." },
        { status: 400 }
      );
    }

    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);

    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json(
        { ok: false, error: "Missing entitlement: game:bingo" },
        { status: 403 }
      );
    }

    const sessionsRepo = getStandaloneBingoSessionsRepository();
    const callsRepo = getStandaloneBingoCallsRepository();
    const session = await sessionsRepo.getById(ctx.tenantId, id);

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    if (action === "pause") {
      const updated = await sessionsRepo.update(ctx.tenantId, id, { status: "paused" });
      return NextResponse.json({ ok: true, data: { session: updated } });
    }

    if (action === "resume") {
      const updated = await sessionsRepo.update(ctx.tenantId, id, { status: "running" });
      return NextResponse.json({ ok: true, data: { session: updated } });
    }

    if (action === "next_round") {
      if ((session.currentRound ?? 1) >= session.roundCount) {
        return NextResponse.json(
          { ok: false, error: "No additional rounds remain for this session." },
          { status: 400 }
        );
      }

      await callsRepo.resetSession(id);
      const updated = await sessionsRepo.update(ctx.tenantId, id, {
        currentRound: (session.currentRound ?? 1) + 1,
        status: "paused",
        startedAt: session.startedAt ?? new Date().toISOString(),
        endedAt: null,
      });
      return NextResponse.json({ ok: true, data: { session: updated } });
    }

    const currentCall = await callsRepo.getCurrentCalled(id);
    if (currentCall) {
      if (action === "skip" || action === "replace_next") {
        await callsRepo.markSkipped(currentCall.id);
      } else {
        await callsRepo.markCompleted(currentCall.id);
      }
    }

    const nextCall = await callsRepo.getNextPending(id);
    if (!nextCall) {
      const completedSession = await sessionsRepo.update(ctx.tenantId, id, {
        status: "completed",
        endedAt: new Date().toISOString(),
      });

      return NextResponse.json(
        { ok: false, error: "No more calls available.", data: { session: completedSession } },
        { status: 409 }
      );
    }

    const calledAt = new Date().toISOString();
    const calledCall = await callsRepo.markCalled(nextCall.id, calledAt);
    const updatedSession = await sessionsRepo.update(ctx.tenantId, id, {
      status: "running",
      startedAt: session.startedAt ?? calledAt,
      endedAt: null,
    });

    return NextResponse.json({
      ok: true,
      data: {
        session: updatedSession,
        call: calledCall,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}
