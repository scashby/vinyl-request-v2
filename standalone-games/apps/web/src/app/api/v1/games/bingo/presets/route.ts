import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getStandaloneBingoPresetsRepository } from "@/lib/standaloneBingoPresetsRepositoryFactory";

export async function GET() {
  try {
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);
    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json({ ok: false, error: "Missing entitlement: game:bingo" }, { status: 403 });
    }

    const repo = getStandaloneBingoPresetsRepository();
    const presets = await repo.listByTenant(ctx.tenantId);
    return NextResponse.json({ ok: true, data: presets });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);
    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json({ ok: false, error: "Missing entitlement: game:bingo" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      source_playlist_ids?: string[];
      source_playlist_names?: string[];
      pool_size?: number;
      note?: string;
      created_from_session_id?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ ok: false, error: "name is required." }, { status: 400 });
    }

    const sourcePlaylistIds = Array.isArray(body.source_playlist_ids) ? body.source_playlist_ids.map(String) : [];
    const sourcePlaylistNames = Array.isArray(body.source_playlist_names) ? body.source_playlist_names.map(String) : [];
    const poolSize = Number(body.pool_size ?? 0);

    if (sourcePlaylistIds.length === 0 || sourcePlaylistNames.length === 0 || poolSize < 1) {
      return NextResponse.json({ ok: false, error: "preset source playlists and pool size are required." }, { status: 400 });
    }

    const repo = getStandaloneBingoPresetsRepository();
    const preset = await repo.create({
      tenantId: ctx.tenantId,
      name: body.name.trim(),
      sourcePlaylistIds,
      sourcePlaylistNames,
      poolSize,
      note: body.note?.trim() || null,
      createdFromSessionId: body.created_from_session_id?.trim() || null,
    });

    return NextResponse.json({ ok: true, data: preset }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, { status: 400 });
  }
}
