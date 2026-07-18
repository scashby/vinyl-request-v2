import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getProviderConnectionsRepository } from "@/lib/providerConnectionsRepositoryFactory";
import type { ProviderName } from "@/lib/providerConnectionsRepo";

interface CreateProviderConnectionBody {
  provider?: ProviderName;
  externalAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
}

function isValidProvider(value: unknown): value is ProviderName {
  return value === "spotify" || value === "apple" || value === "tidal" || value === "csv";
}

function redactConnection<T extends { accessToken?: string | null; refreshToken?: string | null }>(connection: T) {
  const { accessToken: _accessToken, refreshToken: _refreshToken, ...safe } = connection;
  return safe;
}

export async function GET() {
  try {
    const ctx = await getTenantRequestContext();
    const repo = getProviderConnectionsRepository();
    const connections = await repo.listByTenant(ctx.tenantId);
    return NextResponse.json({ ok: true, data: connections.map(redactConnection) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantRequestContext();
    const body = (await request.json()) as CreateProviderConnectionBody;

    if (!isValidProvider(body.provider)) {
      return NextResponse.json(
        { ok: false, error: "provider must be one of spotify, apple, tidal, csv." },
        { status: 400 }
      );
    }

    if (!body.accessToken || body.accessToken.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "accessToken is required." },
        { status: 400 }
      );
    }

    const repo = getProviderConnectionsRepository();
    const connection = await repo.create({
      tenantId: ctx.tenantId,
      provider: body.provider,
      externalAccountId: body.externalAccountId?.trim() || null,
      accessToken: body.accessToken.trim(),
      refreshToken: body.refreshToken?.trim() || null,
      tokenExpiresAt: body.tokenExpiresAt?.trim() || null,
    });

    return NextResponse.json({ ok: true, data: redactConnection(connection) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}
