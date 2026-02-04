import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

type MusicBrainzReleaseGroup = {
  id: string;
  title: string;
  primary_type?: string;
  first_release_date?: string;
};

const USER_AGENT =
  process.env.APP_USER_AGENT || "DeadwaxDialogues/1.0 (https://deadwaxdialogues.com)";

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

async function searchReleaseGroup(artist: string, album: string): Promise<MusicBrainzReleaseGroup | null> {
  const query = `artist:"${artist}" AND releasegroup:"${album}"`;
  const res = await fetch(
    `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=1`,
    { headers: { "User-Agent": USER_AGENT } }
  );

  if (!res.ok) {
    throw new Error(`MusicBrainz search failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const group = data?.["release-groups"]?.[0];
  if (!group?.id) return null;

  return {
    id: group.id,
    title: group.title ?? album,
    primary_type: group["primary-type"] ?? undefined,
    first_release_date: group["first-release-date"] ?? undefined,
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
    let masterId: number | null = null;
    let existingMbId: string | null = null;

    if (albumId) {
      const { data: inventoryRow, error: inventoryError } = await supabase
        .from("inventory")
        .select(
          `
          id,
          release:releases (
            id,
            master:masters (
              id,
              title,
              musicbrainz_release_group_id,
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

      masterId = master?.id ?? null;
      existingMbId = master?.musicbrainz_release_group_id ?? null;
      artist = artist || artistRow?.name || "";
      album = album || master?.title || "";

      if (existingMbId && !force) {
        return NextResponse.json({
          success: true,
          skipped: true,
          message: "MusicBrainz release group ID already set.",
          data: {
            albumId: inventoryRow.id,
            musicbrainz_release_group_id: existingMbId,
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

    const result = await searchReleaseGroup(artist, album);
    if (!result) {
      return NextResponse.json({ success: false, error: "No MusicBrainz match found." }, { status: 404 });
    }

    let updated = false;
    if (masterId) {
      const { error: updateError } = await supabase
        .from("masters")
        .update({ musicbrainz_release_group_id: result.id })
        .eq("id", masterId);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: `Master update failed: ${updateError.message}` },
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
        musicbrainz: result,
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
