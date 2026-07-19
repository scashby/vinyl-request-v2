import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getStandaloneBingoCallsRepository } from "@/lib/standaloneBingoCallsRepositoryFactory";
import { generateStandaloneBingoCards } from "@/lib/standaloneBingoCardEngine";
import { getStandaloneBingoCardsRepository } from "@/lib/standaloneBingoCardsRepositoryFactory";
import { getStandaloneBingoSessionsRepository } from "@/lib/standaloneBingoSessionsRepositoryFactory";
import { getTenantPlaylistSnapshotsRepository } from "@/lib/tenantPlaylistSnapshotsRepositoryFactory";
import { getStandaloneBingoSessionEventsRepository } from "@/lib/standaloneBingoSessionEventsRepositoryFactory";

type ControlAction = "pause" | "resume" | "advance" | "skip" | "replace_next" | "next_round" | "welcome" | "live" | "intermission" | "thanks" | "winner" | "tiebreaker" | "pending";

type SnapshotPayloadItem = {
  trackTitle?: string;
  artistName?: string;
  canonicalTrackId?: string | null;
};

type SessionSnapshotPayload = {
  items?: SnapshotPayloadItem[];
  masterItems?: SnapshotPayloadItem[];
  roundItemsByRound?: Array<{ round?: number; items?: SnapshotPayloadItem[] }>;
  cardsPerRoundEnabled?: boolean;
};

function coerceAction(value: unknown): ControlAction | null {
  if (
    value === "pause" ||
    value === "resume" ||
    value === "advance" ||
    value === "skip" ||
    value === "replace_next" ||
    value === "next_round" ||
    value === "welcome" ||
    value === "live" ||
    value === "intermission" ||
    value === "thanks" ||
    value === "winner" ||
    value === "tiebreaker" ||
    value === "pending"
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
        { ok: false, error: "action must be one of pause,resume,advance,skip,replace_next,next_round,welcome,live,intermission,thanks,winner,tiebreaker,pending." },
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
    const cardsRepo = getStandaloneBingoCardsRepository();
    const eventsRepo = getStandaloneBingoSessionEventsRepository();
    const snapshotsRepo = getTenantPlaylistSnapshotsRepository();
    const session = await sessionsRepo.getById(ctx.tenantId, id);

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    if (action === "pause") {
      const currentCall = await callsRepo.getCurrentCalled(id);
      const referenceStartedAt = session.countdownStartedAt ?? currentCall?.calledAt ?? null;
      const elapsed = referenceStartedAt
        ? Math.floor((Date.now() - new Date(referenceStartedAt).getTime()) / 1000)
        : 0;
      const remaining = Math.max(0, session.callIntervalSeconds - elapsed);
      const updated = await sessionsRepo.update(ctx.tenantId, id, {
        status: "paused",
        pausedAt: new Date().toISOString(),
        pausedRemainingSeconds: remaining,
      });
      return NextResponse.json({ ok: true, data: { session: updated } });
    }

    if (action === "resume") {
      const remaining = session.pausedRemainingSeconds ?? session.callIntervalSeconds;
      const offsetMs = Math.max(0, (session.callIntervalSeconds - remaining) * 1000);
      const countdownStartedAt = new Date(Date.now() - offsetMs).toISOString();
      const updated = await sessionsRepo.update(ctx.tenantId, id, {
        status: "running",
        bingoOverlay: "none",
        nextGameScheduledAt: null,
        pausedAt: null,
        pausedRemainingSeconds: null,
        countdownStartedAt,
      });
      return NextResponse.json({ ok: true, data: { session: updated } });
    }

    if (action === "welcome") {
      const updated = await sessionsRepo.update(ctx.tenantId, id, {
        bingoOverlay: session.bingoOverlay === "welcome" ? "none" : "welcome",
        nextGameScheduledAt: null,
      });
      return NextResponse.json({ ok: true, data: { session: updated } });
    }

    if (action === "live") {
      const updated = await sessionsRepo.update(ctx.tenantId, id, {
        bingoOverlay: "none",
        nextGameScheduledAt: null,
      });
      return NextResponse.json({ ok: true, data: { session: updated } });
    }

    if (action === "intermission") {
      const startsAt = new Date(Date.now() + session.defaultIntermissionSeconds * 1000).toISOString();
      const updated = await sessionsRepo.update(ctx.tenantId, id, {
        status: "paused",
        bingoOverlay: "countdown",
        nextGameScheduledAt: startsAt,
      });
      return NextResponse.json({ ok: true, data: { session: updated } });
    }

    if (action === "thanks") {
      const updated = await sessionsRepo.update(ctx.tenantId, id, {
        status: "completed",
        endedAt: new Date().toISOString(),
        bingoOverlay: "thanks",
        nextGameScheduledAt: null,
      });
      return NextResponse.json({ ok: true, data: { session: updated } });
    }

    if (action === "winner" || action === "tiebreaker" || action === "pending") {
      const updated = await sessionsRepo.update(ctx.tenantId, id, {
        bingoOverlay: action,
      });
      return NextResponse.json({ ok: true, data: { session: updated } });
    }

    if (action === "next_round") {
      if ((session.currentRound ?? 1) >= session.roundCount) {
        return NextResponse.json(
          { ok: false, error: "No additional rounds remain for this session." },
          { status: 400 }
        );
      }

      const nextRound = (session.currentRound ?? 1) + 1;
      const snapshot = await snapshotsRepo.getById(ctx.tenantId, session.playlistSnapshotId);
      const payload = (snapshot?.snapshotPayload ?? {}) as SessionSnapshotPayload;
      const roundItems = (payload.roundItemsByRound ?? []).find((entry) => Number(entry.round ?? 0) === nextRound)?.items;
      const sourceItems = Array.isArray(roundItems) && roundItems.length > 0
        ? roundItems
        : (Array.isArray(payload.masterItems) && payload.masterItems.length > 0 ? payload.masterItems : payload.items ?? []);

      const nextCalls = sourceItems
        .map((item, index) => ({
          callIndex: index + 1,
          canonicalTrackId: item.canonicalTrackId ?? null,
          trackTitle: String(item.trackTitle ?? "").trim(),
          artistName: String(item.artistName ?? "").trim(),
        }))
        .filter((item) => item.trackTitle.length > 0 && item.artistName.length > 0);

      await callsRepo.replaceSession(id, nextCalls);
      await eventsRepo.deleteBySession(id);

      if (payload.cardsPerRoundEnabled) {
        const nextCards = generateStandaloneBingoCards(
          session.sessionCode,
          nextCalls.map((call) => ({ trackTitle: call.trackTitle, artistName: call.artistName })),
          session.cardCount
        );
        await cardsRepo.replaceSession(id, nextCards);
      }

      const updated = await sessionsRepo.update(ctx.tenantId, id, {
        currentRound: nextRound,
        status: "paused",
        bingoOverlay: "countdown",
        nextGameScheduledAt: new Date(Date.now() + session.defaultIntermissionSeconds * 1000).toISOString(),
        startedAt: session.startedAt ?? new Date().toISOString(),
        endedAt: null,
        countdownStartedAt: null,
        pausedAt: null,
        pausedRemainingSeconds: null,
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
      bingoOverlay: "none",
      nextGameScheduledAt: null,
      startedAt: session.startedAt ?? calledAt,
      endedAt: null,
      countdownStartedAt: calledAt,
      pausedAt: null,
      pausedRemainingSeconds: null,
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
