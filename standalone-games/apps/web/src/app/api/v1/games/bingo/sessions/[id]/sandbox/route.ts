import { NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getStandaloneBingoCallsRepository } from "@/lib/standaloneBingoCallsRepositoryFactory";
import { getStandaloneBingoCardsRepository } from "@/lib/standaloneBingoCardsRepositoryFactory";
import { getStandaloneBingoSessionsRepository } from "@/lib/standaloneBingoSessionsRepositoryFactory";

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
    const callsRepo = getStandaloneBingoCallsRepository();
    const cardsRepo = getStandaloneBingoCardsRepository();
    const source = await sessionsRepo.getById(ctx.tenantId, id);

    if (!source) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    if (source.isSandbox) {
      return NextResponse.json({ ok: false, error: "Sandbox sessions cannot be cloned again." }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const sandbox = await sessionsRepo.create({
      tenantId: ctx.tenantId,
      createdByUserId: ctx.userId,
      eventId: source.eventId ?? null,
      playlistSnapshotId: source.playlistSnapshotId,
      roundCount: source.roundCount,
      roundModes: source.roundModes ?? [],
      cardCount: source.cardCount,
      gameMode: source.gameMode,
      callIntervalSeconds: source.callIntervalSeconds,
      removeResleeveSeconds: source.removeResleeveSeconds,
      placeVinylSeconds: source.placeVinylSeconds,
      cueSeconds: source.cueSeconds,
      startSlideSeconds: source.startSlideSeconds,
      hostBufferSeconds: source.hostBufferSeconds,
      sonosOutputDelayMs: source.sonosOutputDelayMs,
      callRevealDelaySeconds: source.callRevealDelaySeconds,
      defaultIntermissionSeconds: source.defaultIntermissionSeconds,
      welcomeHeadingText: source.welcomeHeadingText,
      welcomeMessageText: source.welcomeMessageText,
      welcomeRulesText: source.welcomeRulesText,
      welcomeTiebreakText: source.welcomeTiebreakText,
      intermissionHeadingText: source.intermissionHeadingText,
      intermissionMessageText: source.intermissionMessageText,
      intermissionFooterText: source.intermissionFooterText,
      thanksHeadingText: source.thanksHeadingText,
      thanksSubheadingText: source.thanksSubheadingText,
      thanksEventsHeadingText: source.thanksEventsHeadingText,
      isSandbox: true,
      sandboxSourceSessionId: source.id,
      sandboxExpiresAt: expiresAt,
    });

    const calls = await callsRepo.listBySession(source.id);
    await callsRepo.createMany(
      sandbox.id,
      calls.map((call) => ({
        callIndex: call.callIndex,
        canonicalTrackId: call.canonicalTrackId ?? null,
        trackTitle: call.trackTitle,
        artistName: call.artistName,
      }))
    );

    const cards = await cardsRepo.listBySession(source.id);
    await cardsRepo.createMany(
      sandbox.id,
      cards.map((card) => ({
        cardIndex: card.cardIndex,
        cardIdentifier: `${sandbox.sessionCode}-${String(card.cardIndex).padStart(3, "0")}`,
        grid: card.grid,
      }))
    );

    return NextResponse.json({ ok: true, data: sandbox }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}
