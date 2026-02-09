import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query) {
    return NextResponse.json({ data: [] });
  }

  const { data: masters, error: mastersError } = await supabaseAdmin
    .from('masters')
    .select('id, title, cover_image_url, main_artist_id, artists ( name )')
    .or(`title.ilike.%${query}%,artists.name.ilike.%${query}%`)
    .limit(25);

  if (mastersError) {
    return NextResponse.json({ error: mastersError.message }, { status: 500 });
  }

  const masterRows = masters ?? [];
  const masterIds = masterRows.map((row) => row.id);

  if (masterIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { data: releases, error: releasesError } = await supabaseAdmin
    .from('releases')
    .select('id, master_id, release_year')
    .in('master_id', masterIds)
    .limit(50);

  if (releasesError) {
    return NextResponse.json({ error: releasesError.message }, { status: 500 });
  }

  const releaseRows = releases ?? [];
  const releaseIds = releaseRows.map((row) => row.id);

  if (releaseIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { data: inventory, error: inventoryError } = await supabaseAdmin
    .from('inventory')
    .select('id, location, release_id')
    .in('release_id', releaseIds)
    .limit(50);

  if (inventoryError) {
    return NextResponse.json({ error: inventoryError.message }, { status: 500 });
  }

  const mastersById = new Map(masterRows.map((row) => [row.id, row]));
  const releasesById = new Map(releaseRows.map((row) => [row.id, row]));

  const results = (inventory ?? []).map((row) => {
    const release = row.release_id ? releasesById.get(row.release_id) : null;
    const master = release?.master_id ? mastersById.get(release.master_id) : null;
    const artistName =
      master && Array.isArray(master.artists)
        ? master.artists[0]?.name
        : (master as { artists?: { name?: string } | null })?.artists?.name;

    return {
      inventoryId: row.id,
      releaseId: row.release_id,
      title: master?.title ?? 'Unknown title',
      artist: artistName ?? 'Unknown artist',
      coverImage: master?.cover_image_url ?? null,
      releaseYear: release?.release_year ?? null,
      location: row.location ?? null,
    };
  });

  return NextResponse.json({ data: results });
}
