import { NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getStandaloneBingoCallsRepository } from "@/lib/standaloneBingoCallsRepositoryFactory";
import { getStandaloneBingoSessionsRepository } from "@/lib/standaloneBingoSessionsRepositoryFactory";
import { getStandaloneBingoSessionEventsRepository } from "@/lib/standaloneBingoSessionEventsRepositoryFactory";

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
    await callsRepo.resetSession(id);
    await eventsRepo.deleteBySession(id);
    const updated = await sessionsRepo.update(ctx.tenantId, id, {
      status: "pending",
      bingoOverlay: "welcome",
      nextGameScheduledAt: null,
      countdownStartedAt: null,
      pausedAt: null,
      pausedRemainingSeconds: null,
      startedAt: null,
      endedAt: null,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}