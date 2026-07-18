import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { importTracksToTenantPlaylist, type ImportedTrackInput } from "@/lib/importToTenantPlaylist";
import type { TenantPlaylistProvider } from "@/lib/tenantPlaylistsRepo";

interface ImportPlaylistBody {
  provider?: TenantPlaylistProvider;
  providerPlaylistId?: string;
  playlistName?: string;
  description?: string;
  snapshotName?: string;
  tracks?: ImportedTrackInput[];
}

function isValidProvider(value: unknown): value is TenantPlaylistProvider {
  return value === "spotify" || value === "apple" || value === "tidal" || value === "csv" || value === "manual";
}

function isValidTrack(track: unknown): track is ImportedTrackInput {
  return Boolean(
    track &&
      typeof track === "object" &&
      typeof (track as ImportedTrackInput).trackTitle === "string" &&
      typeof (track as ImportedTrackInput).artistName === "string"
  );
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);

    if (!hasEntitlement(entitlements, "addon:premium-connectors")) {
      return NextResponse.json(
        { ok: false, error: "Missing entitlement: addon:premium-connectors" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as ImportPlaylistBody;

    if (!isValidProvider(body.provider)) {
      return NextResponse.json(
        { ok: false, error: "provider must be one of spotify, apple, tidal, csv, manual." },
        { status: 400 }
      );
    }

    if (!body.playlistName || body.playlistName.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "playlistName is required." },
        { status: 400 }
      );
    }

    const tracks = Array.isArray(body.tracks) ? body.tracks.filter(isValidTrack) : [];
    if (tracks.length === 0) {
      return NextResponse.json(
        { ok: false, error: "tracks must contain at least one valid track object." },
        { status: 400 }
      );
    }

    const result = await importTracksToTenantPlaylist({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      provider: body.provider,
      providerPlaylistId: body.providerPlaylistId ?? null,
      playlistName: body.playlistName.trim(),
      description: body.description?.trim() || null,
      snapshotName: body.snapshotName?.trim() || null,
      tracks,
    });

    return NextResponse.json({ ok: true, data: result }, { status: 201 });
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
