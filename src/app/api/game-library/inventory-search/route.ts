import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query) {
    return NextResponse.json({ data: [] });
  }

  const { data: artistRows, error: artistError } = await supabaseAdmin
    .from('artists')
    .select('id')
    .ilike('name', `%${query}%`)
    .limit(25);

  if (artistError) {
    return NextResponse.json({ error: artistError.message }, { status: 500 });
  }

  const artistIds = (artistRows ?? []).map((row) => row.id);

  const { data: mastersByTitle, error: mastersTitleError } = await supabaseAdmin
    .from('masters')
    .select('id, title, cover_image_url, main_artist_id, artists ( name )')
    .ilike('title', `%${query}%`)
    .limit(25);

  if (mastersTitleError) {
    return NextResponse.json({ error: mastersTitleError.message }, { status: 500 });
  }

  let mastersByArtist: typeof mastersByTitle = [];
  if (artistIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('masters')
      .select('id, title, cover_image_url, main_artist_id, artists ( name )')
      .in('main_artist_id', artistIds)
      .limit(25);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    mastersByArtist = data ?? [];
  }

  const masterRows = [...(mastersByTitle ?? []), ...(mastersByArtist ?? [])]
    .filter((row, index, all) => all.findIndex((item) => item.id === row.id) === index);
  const masterIds = masterRows.map((row) => row.id);

  let trackMatches: Array<{
    release_id: number | null;
    position: string;
    side: string | null;
    title_override: string | null;
    recording_id: number | null;
    recordings?: { title: string | null; track_artist: string | null } | { title: string | null; track_artist: string | null }[] | null;
  }> = [];

  const { data: recordingRows } = await supabaseAdmin
    .from('recordings')
    .select('id')
    .ilike('title', `%${query}%`)
    .limit(25);

  const recordingIds = (recordingRows ?? []).map((row) => row.id);
  if (recordingIds.length > 0) {
    const { data: trackRows, error: trackError } = await supabaseAdmin
      .from('release_tracks')
      .select('release_id, position, side, title_override, recording_id, recordings ( title, track_artist )')
      .in('recording_id', recordingIds)
      .limit(50);

    if (trackError) {
      return NextResponse.json({ error: trackError.message }, { status: 500 });
    }

    trackMatches = trackRows ?? [];
  }

  const trackReleaseIds = trackMatches
    .map((row) => row.release_id)
    .filter((value): value is number => typeof value === 'number');

  if (masterIds.length === 0 && trackReleaseIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { data: releases, error: releasesError } = await supabaseAdmin
    .from('releases')
    .select('id, master_id, release_year')
    .in('master_id', masterIds.length > 0 ? masterIds : [0])
    .limit(50);

  if (releasesError) {
    return NextResponse.json({ error: releasesError.message }, { status: 500 });
  }

  const releaseRows = [
    ...(releases ?? []),
  ];

  if (trackReleaseIds.length > 0) {
    const { data: trackReleases, error: trackReleaseError } = await supabaseAdmin
      .from('releases')
      .select('id, master_id, release_year')
      .in('id', trackReleaseIds)
      .limit(50);

    if (trackReleaseError) {
      return NextResponse.json({ error: trackReleaseError.message }, { status: 500 });
    }

    (trackReleases ?? []).forEach((row) => {
      if (!releaseRows.find((existing) => existing.id === row.id)) {
        releaseRows.push(row);
      }
    });
  }
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

  const trackByReleaseId = new Map<number, typeof trackMatches[0]>();
  trackMatches.forEach((track) => {
    if (track.release_id && !trackByReleaseId.has(track.release_id)) {
      trackByReleaseId.set(track.release_id, track);
    }
  });

  const results = (inventory ?? []).map((row) => {
    const release = row.release_id ? releasesById.get(row.release_id) : null;
    const master = release?.master_id ? mastersById.get(release.master_id) : null;
    const artistName =
      master && Array.isArray(master.artists)
        ? master.artists[0]?.name
        : (master as { artists?: { name?: string } | null })?.artists?.name;
    const trackMatch = row.release_id ? trackByReleaseId.get(row.release_id) : null;
    const recording = Array.isArray(trackMatch?.recordings)
      ? trackMatch?.recordings[0]
      : trackMatch?.recordings;
    const trackTitle = trackMatch?.title_override || recording?.title || null;

    return {
      inventoryId: row.id,
      releaseId: row.release_id,
      title: master?.title ?? 'Unknown title',
      artist: artistName ?? 'Unknown artist',
      coverImage: master?.cover_image_url ?? null,
      releaseYear: release?.release_year ?? null,
      location: row.location ?? null,
      trackTitle,
      trackPosition: trackMatch?.position ?? null,
      trackSide: trackMatch?.side ?? null,
      recordingId: trackMatch?.recording_id ?? null,
    };
  });

  return NextResponse.json({ data: results });
}
