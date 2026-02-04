import { NextResponse } from 'next/server';
import { getAuthHeader, supabaseServer } from 'src/lib/supabaseServer';

type StatsCounts = {
  total: number;
  withDiscogsReleaseId: number;
  withDiscogsMasterId: number;
  withCoverImage: number;
  withGenres: number;
  withStyles: number;
  withLabel: number;
  withCatalogNumber: number;
  withCountry: number;
  withReleaseYear: number;
  withTracks: number;
  withTags: number;
  missing: Record<string, number>;
};

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export async function GET(req: Request) {
  const supabase = supabaseServer(getAuthHeader(req));

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
          discogs_master_id,
          cover_image_url,
          genres,
          styles,
          master_tag_links:master_tag_links ( tag_id )
        )
      )
    `);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const stats: StatsCounts = {
    total: data?.length ?? 0,
    withDiscogsReleaseId: 0,
    withDiscogsMasterId: 0,
    withCoverImage: 0,
    withGenres: 0,
    withStyles: 0,
    withLabel: 0,
    withCatalogNumber: 0,
    withCountry: 0,
    withReleaseYear: 0,
    withTracks: 0,
    withTags: 0,
    missing: {},
  };

  const missingKeys = [
    'discogs_release_id',
    'discogs_master_id',
    'cover_image',
    'genres',
    'styles',
    'label',
    'catalog_number',
    'country',
    'release_year',
    'tracks',
    'tags',
  ];
  missingKeys.forEach((key) => {
    stats.missing[key] = 0;
  });

  (data ?? []).forEach((row) => {
    const release = toSingle(row.release);
    const master = toSingle(release?.master);
    const trackCount = release?.release_tracks?.length ?? 0;
    const tagCount = master?.master_tag_links?.length ?? 0;

    if (release?.discogs_release_id) stats.withDiscogsReleaseId += 1;
    else stats.missing.discogs_release_id += 1;

    if (master?.discogs_master_id) stats.withDiscogsMasterId += 1;
    else stats.missing.discogs_master_id += 1;

    if (master?.cover_image_url) stats.withCoverImage += 1;
    else stats.missing.cover_image += 1;

    if (master?.genres && master.genres.length > 0) stats.withGenres += 1;
    else stats.missing.genres += 1;

    if (master?.styles && master.styles.length > 0) stats.withStyles += 1;
    else stats.missing.styles += 1;

    if (release?.label) stats.withLabel += 1;
    else stats.missing.label += 1;

    if (release?.catalog_number) stats.withCatalogNumber += 1;
    else stats.missing.catalog_number += 1;

    if (release?.country) stats.withCountry += 1;
    else stats.missing.country += 1;

    if (release?.release_year) stats.withReleaseYear += 1;
    else stats.missing.release_year += 1;

    if (trackCount > 0) stats.withTracks += 1;
    else stats.missing.tracks += 1;

    if (tagCount > 0) stats.withTags += 1;
    else stats.missing.tags += 1;
  });

  return NextResponse.json({ success: true, stats });
}
