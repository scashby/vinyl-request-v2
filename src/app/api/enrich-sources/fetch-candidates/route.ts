import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

type Candidate = {
  inventory_id: number;
  release_id: number | null;
  master_id: number | null;
  artist: string;
  title: string;
  discogs_release_id: string | null;
  discogs_master_id: string | null;
  spotify_album_id: string | null;
  musicbrainz_release_group_id: string | null;
  cover_image_url: string | null;
  genres: string[] | null;
  styles: string[] | null;
  track_count: number;
  tag_count: number;
  missing: string[];
};

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const buildMissing = (candidate: Candidate): string[] => {
  const missing: string[] = [];
  if (!candidate.discogs_release_id) missing.push("discogs_release_id");
  if (!candidate.discogs_master_id) missing.push("discogs_master_id");
  if (!candidate.spotify_album_id) missing.push("spotify_album_id");
  if (!candidate.musicbrainz_release_group_id) missing.push("musicbrainz_release_group_id");
  if (!candidate.cover_image_url) missing.push("cover_image");
  if (!candidate.genres || candidate.genres.length === 0) missing.push("genres");
  if (!candidate.styles || candidate.styles.length === 0) missing.push("styles");
  if (!candidate.track_count) missing.push("tracks");
  if (!candidate.tag_count) missing.push("tags");
  return missing;
};

export async function POST(req: Request) {
  const supabase = supabaseServer(getAuthHeader(req));
  const body = await req.json().catch(() => ({}));
  const limit = Number(body?.limit ?? 100);
  const offset = Number(body?.offset ?? 0);
  const missingFilter = Array.isArray(body?.missing) ? (body.missing as string[]) : null;

  const { data, error } = await supabase
    .from("inventory")
    .select(
      `
      id,
      release:releases (
        id,
        discogs_release_id,
        spotify_album_id,
        release_tracks:release_tracks ( id ),
        master:masters (
          id,
          title,
          discogs_master_id,
          cover_image_url,
          genres,
          styles,
          musicbrainz_release_group_id,
          artist:artists ( name ),
          master_tag_links:master_tag_links ( tag_id )
        )
      )
    `
    )
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const candidates = (data ?? []).map((row) => {
    const release = toSingle(row.release);
    const master = toSingle(release?.master);
    const artist = toSingle(master?.artist);
    const trackCount = release?.release_tracks?.length ?? 0;
    const tagCount = master?.master_tag_links?.length ?? 0;

    const candidate: Candidate = {
      inventory_id: row.id,
      release_id: release?.id ?? null,
      master_id: master?.id ?? null,
      artist: artist?.name ?? "Unknown Artist",
      title: master?.title ?? "Untitled",
      discogs_release_id: release?.discogs_release_id ?? null,
      discogs_master_id: master?.discogs_master_id ?? null,
      spotify_album_id: release?.spotify_album_id ?? null,
      musicbrainz_release_group_id: master?.musicbrainz_release_group_id ?? null,
      cover_image_url: master?.cover_image_url ?? null,
      genres: master?.genres ?? null,
      styles: master?.styles ?? null,
      track_count: trackCount,
      tag_count: tagCount,
      missing: [],
    };

    candidate.missing = buildMissing(candidate);
    return candidate;
  });

  const filtered = missingFilter
    ? candidates.filter((row) => row.missing.some((field) => missingFilter.includes(field)))
    : candidates;

  return NextResponse.json({
    success: true,
    count: filtered.length,
    items: filtered,
  });
}
