import { NextResponse } from 'next/server';
import { getAuthHeader, supabaseServer } from 'src/lib/supabaseServer';

type EnrichAlbum = {
  inventory_id: number;
  release_id: number | null;
  master_id: number | null;
  artist: string;
  title: string;
  year: number | null;
  discogs_release_id: string | null;
  discogs_master_id: string | null;
  cover_image_url: string | null;
  genres: string[] | null;
  styles: string[] | null;
  label: string | null;
  catalog_number: string | null;
  country: string | null;
  release_year: number | null;
  track_count: number;
  tag_count: number;
  missing: string[];
};

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const buildMissing = (album: EnrichAlbum): string[] => {
  const missing: string[] = [];
  if (!album.discogs_release_id) missing.push('discogs_release_id');
  if (!album.discogs_master_id) missing.push('discogs_master_id');
  if (!album.cover_image_url) missing.push('cover_image');
  if (!album.genres || album.genres.length === 0) missing.push('genres');
  if (!album.styles || album.styles.length === 0) missing.push('styles');
  if (!album.label) missing.push('label');
  if (!album.catalog_number) missing.push('catalog_number');
  if (!album.country) missing.push('country');
  if (!album.release_year) missing.push('release_year');
  if (!album.track_count) missing.push('tracks');
  if (!album.tag_count) missing.push('tags');
  return missing;
};

export async function POST(req: Request) {
  const supabase = supabaseServer(getAuthHeader(req));
  const body = await req.json().catch(() => ({}));
  const limit = Number(body?.limit ?? 100);
  const offset = Number(body?.offset ?? 0);
  const missingFilter = Array.isArray(body?.missing) ? (body.missing as string[]) : null;

  const { data, error } = await supabase
    .from('inventory')
    .select(`
      id,
      release:releases (
        id,
        discogs_release_id,
        label,
        catalog_number,
        country,
        release_year,
        release_tracks:release_tracks ( id ),
        master:masters (
          id,
          title,
          discogs_master_id,
          cover_image_url,
          genres,
          styles,
          original_release_year,
          artist:artists ( id, name ),
          master_tag_links:master_tag_links ( tag_id )
        )
      )
    `)
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row) => {
    const release = toSingle(row.release);
    const master = toSingle(release?.master);
    const artist = toSingle(master?.artist);
    const trackCount = release?.release_tracks?.length ?? 0;
    const tagCount = master?.master_tag_links?.length ?? 0;

    const album: EnrichAlbum = {
      inventory_id: row.id,
      release_id: release?.id ?? null,
      master_id: master?.id ?? null,
      artist: artist?.name ?? 'Unknown Artist',
      title: master?.title ?? 'Untitled',
      year: master?.original_release_year ?? null,
      discogs_release_id: release?.discogs_release_id ?? null,
      discogs_master_id: master?.discogs_master_id ?? null,
      cover_image_url: master?.cover_image_url ?? null,
      genres: master?.genres ?? null,
      styles: master?.styles ?? null,
      label: release?.label ?? null,
      catalog_number: release?.catalog_number ?? null,
      country: release?.country ?? null,
      release_year: release?.release_year ?? null,
      track_count: trackCount,
      tag_count: tagCount,
      missing: [],
    };

    album.missing = buildMissing(album);
    return album;
  });

  const filtered = missingFilter
    ? rows.filter((album) => album.missing.some((field) => missingFilter.includes(field)))
    : rows;

  return NextResponse.json({
    success: true,
    count: filtered.length,
    items: filtered,
  });
}
