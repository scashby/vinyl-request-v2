import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { generateStandaloneBingoCards } from "@/lib/standaloneBingoCardEngine";
import { getStandaloneBingoCallsRepository } from "@/lib/standaloneBingoCallsRepositoryFactory";
import { getStandaloneBingoCardsRepository } from "@/lib/standaloneBingoCardsRepositoryFactory";
import { getStandaloneBingoSessionsRepository } from "@/lib/standaloneBingoSessionsRepositoryFactory";

type CreateCardsBody = {
  count?: number;
};

export async function GET(
  _request: NextRequest,
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

    const cardsRepo = getStandaloneBingoCardsRepository();
    const cards = await cardsRepo.listBySession(id);

    return NextResponse.json({ ok: true, data: cards });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}

export async function POST(
  request: NextRequest,
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

    const body = (await request.json().catch(() => ({}))) as CreateCardsBody;
    const requestedCount = body.count ?? session.cardCount;
    if (!Number.isInteger(requestedCount) || requestedCount < 1) {
      return NextResponse.json(
        { ok: false, error: "count must be an integer >= 1." },
        { status: 400 }
      );
    }

    const callsRepo = getStandaloneBingoCallsRepository();
    const calls = await callsRepo.listBySession(id);

    const cardsRepo = getStandaloneBingoCardsRepository();
    const existingCards = await cardsRepo.listBySession(id);
    const generatedCards = generateStandaloneBingoCards(
      session.sessionCode,
      calls.map((call) => ({
        trackTitle: call.trackTitle,
        artistName: call.artistName,
      })),
      requestedCount,
      existingCards.length
    );

    await cardsRepo.createMany(id, generatedCards);
    const cards = await cardsRepo.listBySession(id);

    return NextResponse.json({ ok: true, data: cards }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}
