import { NextResponse } from 'next/server';
import { getAuthHeader, supabaseServer } from 'src/lib/supabaseServer';

const APPLE_MUSIC_TOKEN = process.env.APPLE_MUSIC_TOKEN;

type AppleMusicAlbum = {
  id: string;
  name: string;
  artistName: string;
  url?: string;
  releaseDate?: string;
  trackCount?: number;
  artworkUrl?: string | null;
};

type AppleMusicTrack = {
  id: string;
  name: string;
  durationMs?: number;
  url?: string;
};

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const getHeaders = () => ({
  Authorization: `Bearer ${APPLE_MUSIC_TOKEN}`,
});

const buildArtworkUrl = (artwork?: { url?: string; width?: number; height?: number }) => {
  if (!artwork?.url) return null;
  return artwork.url
    .replace('{w}', String(artwork.width ?? 600))
    .replace('{h}', String(artwork.height ?? 600));
};

export async function POST(req: Request) {
  if (!APPLE_MUSIC_TOKEN) {
    return NextResponse.json({ success: false, error: 'Apple Music token not configured' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const storefront = (body?.storefront ?? 'us') as string;
  const includeTracks = Boolean(body?.includeTracks);
  const inventoryId = body?.inventoryId as number | undefined;
  const persist = body?.persist !== undefined ? Boolean(body.persist) : Boolean(inventoryId);

  let artist = (body?.artist ?? '') as string;
  let title = (body?.title ?? '') as string;

  if (inventoryId && (!artist || !title)) {
    const supabase = supabaseServer(getAuthHeader(req));
    const { data, error } = await supabase
      .from('inventory')
      .select(`
        id,
        release:releases (
          id,
          master:masters (
            title,
            artist:artists ( name )
          )
        )
      `)
      .eq('id', inventoryId)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Album not found' }, { status: 404 });
    }

    const release = toSingle(data.release);
    const master = toSingle(release?.master);
    const artistRow = toSingle(master?.artist);
    artist = artist || artistRow?.name || '';
    title = title || master?.title || '';
  }

  if (!artist || !title) {
    return NextResponse.json({ success: false, error: 'artist and title required' }, { status: 400 });
  }

  const term = encodeURIComponent(`${artist} ${title}`);
  const searchUrl = `https://api.music.apple.com/v1/catalog/${storefront}/search?types=albums&limit=5&term=${term}`;
  const searchRes = await fetch(searchUrl, { headers: getHeaders() });

  if (!searchRes.ok) {
    const text = await searchRes.text();
    return NextResponse.json({ success: false, error: `Apple Music search failed: ${searchRes.status} ${text}` }, { status: 502 });
  }

  const searchJson = await searchRes.json();
  const albums = (searchJson?.results?.albums?.data ?? []).map((album: { id: string; attributes?: Record<string, unknown> }) => {
    const attrs = album.attributes ?? {};
    return {
      id: album.id,
      name: String(attrs.name ?? ''),
      artistName: String(attrs.artistName ?? ''),
      url: typeof attrs.url === 'string' ? attrs.url : undefined,
      releaseDate: typeof attrs.releaseDate === 'string' ? attrs.releaseDate : undefined,
      trackCount: typeof attrs.trackCount === 'number' ? attrs.trackCount : undefined,
      artworkUrl: buildArtworkUrl(attrs.artwork as { url?: string; width?: number; height?: number } | undefined),
    } satisfies AppleMusicAlbum;
  });

  let tracks: AppleMusicTrack[] | null = null;
  if (includeTracks && albums.length > 0) {
    const albumId = albums[0].id;
    const albumUrl = `https://api.music.apple.com/v1/catalog/${storefront}/albums/${albumId}`;
    const albumRes = await fetch(albumUrl, { headers: getHeaders() });
    if (albumRes.ok) {
      const albumJson = await albumRes.json();
      const trackData = albumJson?.data?.[0]?.relationships?.tracks?.data ?? [];
      tracks = trackData.map((track: { id: string; attributes?: Record<string, unknown> }) => {
        const attrs = track.attributes ?? {};
        return {
          id: track.id,
          name: String(attrs.name ?? ''),
          durationMs: typeof attrs.durationInMillis === 'number' ? attrs.durationInMillis : undefined,
          url: typeof attrs.url === 'string' ? attrs.url : undefined,
        } satisfies AppleMusicTrack;
      });
    }
  }

  const persisted = {
    matched: 0,
    updated: 0,
    unmatched: 0,
  };

  if (persist && inventoryId && albums.length > 0) {
    const supabase = supabaseServer(getAuthHeader(req));
    const { data: inventoryRow, error } = await supabase
      .from('inventory')
      .select(`
        id,
        release:releases (
          id,
          release_tracks:release_tracks (
            id,
            position,
            recording:recordings ( id, title, credits )
          )
        )
      `)
      .eq('id', inventoryId)
      .single();

    if (error || !inventoryRow) {
      return NextResponse.json({ success: false, error: 'Album not found for persistence' }, { status: 404 });
    }

    const release = toSingle(inventoryRow.release);
    const releaseTracks = release?.release_tracks ?? [];
    const albumMeta = albums[0];
    const normalized = (value: string) =>
      value.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

    const trackIndex = new Map<string, AppleMusicTrack>();
    (tracks ?? []).forEach((track) => {
      trackIndex.set(normalized(track.name), track);
    });

    for (const track of releaseTracks) {
      const recording = toSingle(track.recording);
      const title = recording?.title ?? '';
      if (!title) continue;

      const match = trackIndex.get(normalized(title));
      if (!match || !recording?.id) {
        persisted.unmatched += 1;
        continue;
      }

      persisted.matched += 1;
      const currentCredits = (recording.credits && typeof recording.credits === 'object' && !Array.isArray(recording.credits))
        ? (recording.credits as Record<string, unknown>)
        : {};

      const nextCredits = {
        ...currentCredits,
        apple_music_album_id: albumMeta.id,
        apple_music_album_url: albumMeta.url ?? null,
        apple_music_song_id: match.id,
        apple_music_track_url: match.url ?? null,
        apple_music_last_synced_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('recordings')
        .update({ credits: nextCredits })
        .eq('id', recording.id);

      if (!updateError) {
        persisted.updated += 1;
      }
    }
  }

  return NextResponse.json({
    success: true,
    query: { artist, title, storefront },
    albums,
    tracks,
    persisted,
  });
}
