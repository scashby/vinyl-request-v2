import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";
import { getSpotifyToken } from "src/lib/spotify";

type SpotifyAlbumResult = {
  id: string;
  name: string;
  artists: string[];
  release_date?: string;
  image_url?: string;
  external_url?: string;
};

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

async function searchSpotifyAlbum(artist: string, album: string): Promise<SpotifyAlbumResult | null> {
  const token = await getSpotifyToken();
  const q = encodeURIComponent(`album:"${album}" artist:"${artist}"`);
  const res = await fetch(`https://api.spotify.com/v1/search?type=album&limit=1&q=${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Spotify search failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const item = data?.albums?.items?.[0];
  if (!item?.id) return null;

  return {
    id: item.id,
    name: item.name ?? album,
    artists: (item.artists ?? []).map((a: { name: string }) => a.name).filter(Boolean),
    release_date: item.release_date ?? undefined,
    image_url: item.images?.[0]?.url ?? undefined,
    external_url: item.external_urls?.spotify ?? undefined,
  };
}

export async function POST(req: Request) {
  const supabase = supabaseServer(getAuthHeader(req));
  try {
    const body = await req.json().catch(() => ({}));
    const albumId = body?.albumId ? Number(body.albumId) : null;
    const force = Boolean(body?.force);

    let artist = typeof body?.artist === "string" ? body.artist.trim() : "";
    let album = typeof body?.album === "string" ? body.album.trim() : "";
    let releaseId: number | null = null;
    let existingSpotifyId: string | null = null;

    if (albumId) {
      const { data: inventoryRow, error: inventoryError } = await supabase
        .from("inventory")
        .select(
          `
          id,
          release:releases (
            id,
            spotify_album_id,
            master:masters (
              id,
              title,
              artist:artists ( name )
            )
          )
        `
        )
        .eq("id", albumId)
        .single();

      if (inventoryError || !inventoryRow) {
        return NextResponse.json({ success: false, error: "Album not found" }, { status: 404 });
      }

      const release = toSingle(inventoryRow.release);
      const master = toSingle(release?.master);
      const artistRow = toSingle(master?.artist);

      releaseId = release?.id ?? null;
      existingSpotifyId = release?.spotify_album_id ?? null;
      artist = artist || artistRow?.name || "";
      album = album || master?.title || "";

      if (existingSpotifyId && !force) {
        return NextResponse.json({
          success: true,
          skipped: true,
          message: "Spotify album ID already set.",
          data: {
            albumId: inventoryRow.id,
            spotify_album_id: existingSpotifyId,
          },
        });
      }
    }

    if (!artist || !album) {
      return NextResponse.json(
        { success: false, error: "artist and album are required (or provide albumId)." },
        { status: 400 }
      );
    }

    const result = await searchSpotifyAlbum(artist, album);
    if (!result) {
      return NextResponse.json({ success: false, error: "No Spotify album match found." }, { status: 404 });
    }

    let updated = false;
    if (releaseId) {
      const { error: updateError } = await supabase
        .from("releases")
        .update({ spotify_album_id: result.id })
        .eq("id", releaseId);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: `Release update failed: ${updateError.message}` },
          { status: 500 }
        );
      }
      updated = true;
    }

    return NextResponse.json({
      success: true,
      data: {
        albumId: albumId ?? null,
        artist,
        album,
        spotify: result,
        updated,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
