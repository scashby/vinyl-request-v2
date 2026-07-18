import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { importTracksToTenantPlaylist } from "@/lib/importToTenantPlaylist";

interface SpotifyImportBody {
  playlistName?: string;
  providerPlaylistId?: string;
  tracks?: Array<{
    trackTitle?: string;
    artistName?: string;
    albumName?: string;
    canonicalTrackId?: string;
    externalTrackId?: string;
    displayTitle?: string;
  }>;
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

    const body = (await request.json()) as SpotifyImportBody;

    if (!body.playlistName || body.playlistName.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "playlistName is required." },
        { status: 400 }
      );
    }

    const tracks = Array.isArray(body.tracks)
      ? body.tracks
          .filter(
            (track) =>
              typeof track?.trackTitle === "string" && typeof track?.artistName === "string"
          )
          .map((track) => ({
            trackTitle: String(track.trackTitle).trim(),
            artistName: String(track.artistName).trim(),
            albumName: typeof track.albumName === "string" ? track.albumName.trim() : null,
            canonicalTrackId: typeof track.canonicalTrackId === "string" ? track.canonicalTrackId : null,
            externalTrackId: typeof track.externalTrackId === "string" ? track.externalTrackId : null,
            displayTitle: typeof track.displayTitle === "string" ? track.displayTitle : null,
          }))
      : [];

    if (tracks.length === 0) {
      return NextResponse.json(
        { ok: false, error: "tracks must contain at least one valid item." },
        { status: 400 }
      );
    }

    const result = await importTracksToTenantPlaylist({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      provider: "spotify",
      providerPlaylistId: body.providerPlaylistId ?? null,
      playlistName: body.playlistName.trim(),
      description: "Imported from Spotify",
      snapshotName: `${body.playlistName.trim()} Snapshot`,
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
