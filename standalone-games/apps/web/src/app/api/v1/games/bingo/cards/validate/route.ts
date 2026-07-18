import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { validateStandaloneBingoCard } from "@/lib/standaloneBingoCardEngine";
import { getStandaloneBingoCallsRepository } from "@/lib/standaloneBingoCallsRepositoryFactory";
import { getStandaloneBingoCardsRepository } from "@/lib/standaloneBingoCardsRepositoryFactory";
import { getStandaloneBingoSessionsRepository } from "@/lib/standaloneBingoSessionsRepositoryFactory";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);

    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json(
        { ok: false, error: "Missing entitlement: game:bingo" },
        { status: 403 }
      );
    }

    const sessionId = String(request.nextUrl.searchParams.get("sessionId") ?? "").trim();
    const cardIdentifier = String(
      request.nextUrl.searchParams.get("cardIdentifier") ?? ""
    )
      .trim()
      .toUpperCase();

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "sessionId is required." },
        { status: 400 }
      );
    }

    if (!cardIdentifier) {
      return NextResponse.json(
        { ok: false, error: "cardIdentifier is required." },
        { status: 400 }
      );
    }

    const sessionsRepo = getStandaloneBingoSessionsRepository();
    const session = await sessionsRepo.getById(ctx.tenantId, sessionId);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    const cardsRepo = getStandaloneBingoCardsRepository();
    const card = await cardsRepo.getByIdentifier(sessionId, cardIdentifier);
    if (!card) {
      return NextResponse.json(
        { ok: false, error: "Card not found for this session." },
        { status: 404 }
      );
    }

    const callsRepo = getStandaloneBingoCallsRepository();
    const calls = await callsRepo.listBySession(sessionId);
    const result = validateStandaloneBingoCard(session, card, calls);

    return NextResponse.json({ ok: true, data: result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}
