import { NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getStandaloneBingoSessionsRepository } from "@/lib/standaloneBingoSessionsRepositoryFactory";

export async function GET(
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

    const repo = getStandaloneBingoSessionsRepository();
    const session = await repo.getById(ctx.tenantId, id);

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: session });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}