import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getTenantPlaylistsRepository } from "@/lib/tenantPlaylistsRepositoryFactory";
import type { TenantPlaylistProvider } from "@/lib/tenantPlaylistsRepo";

interface CreatePlaylistBody {
  provider?: TenantPlaylistProvider;
  providerPlaylistId?: string;
  name?: string;
  description?: string;
}

function isValidProvider(value: unknown): value is TenantPlaylistProvider {
  return value === "spotify" || value === "apple" || value === "tidal" || value === "csv" || value === "manual";
}

export async function GET() {
  try {
    const ctx = await getTenantRequestContext();
    const repo = getTenantPlaylistsRepository();
    const playlists = await repo.listByTenant(ctx.tenantId);
    return NextResponse.json({ ok: true, data: playlists });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantRequestContext();
    const body = (await request.json()) as CreatePlaylistBody;

    if (!isValidProvider(body.provider)) {
      return NextResponse.json({ ok: false, error: "provider must be one of spotify, apple, tidal, csv, manual." }, { status: 400 });
    }

    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "name is required." }, { status: 400 });
    }

    const repo = getTenantPlaylistsRepository();
    const playlist = await repo.create({
      tenantId: ctx.tenantId,
      provider: body.provider,
      providerPlaylistId: body.providerPlaylistId ?? null,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      createdByUserId: ctx.userId,
    });

    return NextResponse.json({ ok: true, data: playlist }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, { status: 400 });
  }
}
