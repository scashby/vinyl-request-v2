import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import {
  getStandaloneBingoSessionsRepository,
  type BingoGameMode,
} from "@/lib/standaloneBingoSessionsRepo";

interface CreateSessionBody {
  playlistSnapshotId?: string;
  roundCount?: number;
  cardCount?: number;
  gameMode?: BingoGameMode;
  callIntervalSeconds?: number;
}

function isValidGameMode(value: unknown): value is BingoGameMode {
  return (
    value === "single_line" ||
    value === "double_line" ||
    value === "triple_line" ||
    value === "criss_cross" ||
    value === "four_corners" ||
    value === "blackout" ||
    value === "death"
  );
}

export async function GET() {
  try {
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);
    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json(
        { ok: false, error: "Missing entitlement: game:bingo" },
        { status: 403 }
      );
    }

    const repo = getStandaloneBingoSessionsRepository();
    const sessions = await repo.listByTenant(ctx.tenantId);

    return NextResponse.json({ ok: true, data: sessions });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);
    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json(
        { ok: false, error: "Missing entitlement: game:bingo" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as CreateSessionBody;

    if (!body.playlistSnapshotId || body.playlistSnapshotId.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "playlistSnapshotId is required." },
        { status: 400 }
      );
    }

    const roundCount = body.roundCount ?? 3;
    const cardCount = body.cardCount ?? 40;
    const callIntervalSeconds = body.callIntervalSeconds ?? 45;
    const gameMode: BingoGameMode = isValidGameMode(body.gameMode)
      ? body.gameMode
      : "single_line";

    if (!Number.isInteger(roundCount) || roundCount < 1) {
      return NextResponse.json(
        { ok: false, error: "roundCount must be an integer >= 1." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(cardCount) || cardCount < 1) {
      return NextResponse.json(
        { ok: false, error: "cardCount must be an integer >= 1." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(callIntervalSeconds) || callIntervalSeconds < 1) {
      return NextResponse.json(
        { ok: false, error: "callIntervalSeconds must be an integer >= 1." },
        { status: 400 }
      );
    }

    const repo = getStandaloneBingoSessionsRepository();
    const session = await repo.create({
      tenantId: ctx.tenantId,
      createdByUserId: ctx.userId,
      playlistSnapshotId: body.playlistSnapshotId,
      roundCount,
      cardCount,
      gameMode,
      callIntervalSeconds,
    });

    return NextResponse.json({ ok: true, data: session }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 400 }
    );
  }
}
