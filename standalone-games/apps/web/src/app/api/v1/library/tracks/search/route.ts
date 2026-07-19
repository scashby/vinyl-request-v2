import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getTenantPlaylistSnapshotsRepository } from "@/lib/tenantPlaylistSnapshotsRepositoryFactory";

type SnapshotItem = {
  trackTitle?: string;
  artistName?: string;
  canonicalTrackId?: string | null;
};

function buildTrackKey(trackTitle: string, artistName: string) {
  return `${trackTitle.trim().toLowerCase()}::${artistName.trim().toLowerCase()}`;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantRequestContext();
    const query = String(request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(25, Number(request.nextUrl.searchParams.get("limit") ?? 12)));

    if (query.length < 2) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const snapshotRepo = getTenantPlaylistSnapshotsRepository();
    const snapshots = await snapshotRepo.listByTenant(ctx.tenantId);
    const deduped = new Map<string, { track_key: string; track_title: string; artist_name: string; canonical_track_id: string | null }>();

    for (const snapshot of snapshots) {
      const items = Array.isArray((snapshot.snapshotPayload as { items?: unknown[] } | null)?.items)
        ? ((snapshot.snapshotPayload as { items?: SnapshotItem[] }).items ?? [])
        : [];

      for (const item of items) {
        const trackTitle = String(item.trackTitle ?? "").trim();
        const artistName = String(item.artistName ?? "").trim();
        if (!trackTitle || !artistName) continue;
        const haystack = `${trackTitle} ${artistName}`.toLowerCase();
        if (!haystack.includes(query)) continue;
        const trackKey = buildTrackKey(trackTitle, artistName);
        if (!deduped.has(trackKey)) {
          deduped.set(trackKey, {
            track_key: trackKey,
            track_title: trackTitle,
            artist_name: artistName,
            canonical_track_id: item.canonicalTrackId ?? null,
          });
        }
        if (deduped.size >= limit) break;
      }
      if (deduped.size >= limit) break;
    }

    return NextResponse.json({ ok: true, data: Array.from(deduped.values()) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}
