import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getTenantPlaylistsRepository } from "@/lib/tenantPlaylistsRepositoryFactory";
import { getTenantPlaylistSnapshotsRepository } from "@/lib/tenantPlaylistSnapshotsRepositoryFactory";

interface CreateSnapshotBody {
  tenantPlaylistId?: string;
  snapshotName?: string;
}

export async function GET() {
  try {
    const ctx = await getTenantRequestContext();
    const repo = getTenantPlaylistSnapshotsRepository();
    const snapshots = await repo.listByTenant(ctx.tenantId);
    return NextResponse.json({ ok: true, data: snapshots });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantRequestContext();
    const body = (await request.json()) as CreateSnapshotBody;

    if (!body.tenantPlaylistId) {
      return NextResponse.json({ ok: false, error: "tenantPlaylistId is required." }, { status: 400 });
    }

    const playlistRepo = getTenantPlaylistsRepository();
    const playlist = await playlistRepo.getById(ctx.tenantId, body.tenantPlaylistId);
    if (!playlist) {
      return NextResponse.json({ ok: false, error: "tenantPlaylistId not found for this tenant." }, { status: 404 });
    }

    const snapshotRepo = getTenantPlaylistSnapshotsRepository();
    const snapshot = await snapshotRepo.create({
      tenantId: ctx.tenantId,
      tenantPlaylistId: playlist.id,
      snapshotName: body.snapshotName?.trim() || `Snapshot for ${playlist.name}`,
      snapshotPayload: {
        playlistName: playlist.name,
        provider: playlist.provider,
        providerPlaylistId: playlist.providerPlaylistId,
        itemCount: 0,
        items: [],
      },
      createdByUserId: ctx.userId,
    });

    return NextResponse.json({ ok: true, data: snapshot }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, { status: 400 });
  }
}
