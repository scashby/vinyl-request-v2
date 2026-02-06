// src/app/api/enrich-sources/discogs-tracklist/route.ts
import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";
import { parseDiscogsFormat } from "src/utils/formatUtils";
import type { Json } from "types/supabase";
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN ?? process.env.NEXT_PUBLIC_DISCOGS_TOKEN;

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

type DiscogsTrack = {
  position?: string;
  type_?: string;
  title?: string;
  duration?: string;
  artists?: Array<{ name: string; id?: number; join?: string }>;
  extraartists?: Array<{ name: string; role?: string; id?: number }>;
};

type DiscogsResponse = {
  tracklist?: DiscogsTrack[];
  genres?: string[];
  styles?: string[];
  formats?: { name?: string; qty?: string | number; descriptions?: string[] }[];
  images?: Array<{ uri: string; type?: 'primary' | 'secondary' }>;
};

const parseDurationToSeconds = (duration?: string) => {
  if (!duration) return null;
  const parts = duration.split(':').map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
};

const getSideFromPosition = (position?: string) => {
  if (!position) return null;
  const match = position.trim().match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : null;
};

const buildDiscogsFormatString = (formats?: { name?: string; qty?: string | number; descriptions?: string[] }[]) => {
  if (!formats || formats.length === 0) return '';
  const format = formats[0];
  const qty = format.qty ? String(format.qty).trim() : '';
  const name = format.name?.trim() ?? '';
  const details = format.descriptions?.filter(Boolean) ?? [];
  const qtyPrefix = qty ? `${qty}x` : '';
  const base = `${qtyPrefix}${name}`.trim();
  if (details.length === 0) return base;
  return `${base}, ${details.join(', ')}`.trim();
};

async function fetchDiscogsRelease(releaseId: string): Promise<DiscogsResponse> {
  const url = `https://api.discogs.com/releases/${releaseId}`;
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'DeadwaxDialogues/1.0',
      'Authorization': `Discogs token=${DISCOGS_TOKEN}`
    }
  });
  
  if (!res.ok) {
    throw new Error(`Discogs API returned ${res.status}`);
  }
  
  return await res.json();
}

export async function POST(req: Request) {
  const supabase = supabaseServer(getAuthHeader(req));
  try {
    const body = await req.json();
    const { albumId } = body;

    console.log(`\n💿 === DISCOGS TRACKLIST ENRICHMENT for Album ID: ${albumId} ===`);

    if (!albumId) {
      console.log('❌ ERROR: No albumId provided');
      return NextResponse.json({
        success: false,
        error: 'albumId required'
      }, { status: 400 });
    }

    if (!DISCOGS_TOKEN) {
      console.log('❌ ERROR: DISCOGS_TOKEN not configured');
      return NextResponse.json({
        success: false,
        error: 'Discogs token not configured'
      }, { status: 500 });
    }

    // Get album info
    const { data: album, error: dbError } = await supabase
      .from('inventory')
      .select(`
        id,
        release:releases (
          id,
          discogs_release_id,
          master:masters (
            title,
            artist:artists (name)
          )
        )
      `)
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      console.log('❌ ERROR: Album not found in database', dbError);
      return NextResponse.json({
        success: false,
        error: 'Album not found'
      }, { status: 404 });
    }

    const release = toSingle(album.release);
    const master = toSingle(release?.master);
    const artistName = toSingle(master?.artist)?.name ?? 'Unknown Artist';
    const albumTitle = master?.title ?? 'Untitled';

    console.log(`✓ Album found: "${artistName}" - "${albumTitle}"`);

    if (!release?.discogs_release_id) {
      console.log('❌ ERROR: No Discogs Release ID');
      return NextResponse.json({
        success: false,
        error: 'Album has no Discogs Release ID'
      }, { status: 400 });
    }

    console.log(`🔍 Fetching tracklist from Discogs release ${release.discogs_release_id}...`);
    
    const discogsData = await fetchDiscogsRelease(release.discogs_release_id);
    
    if (!discogsData.tracklist || discogsData.tracklist.length === 0) {
      console.log('❌ No tracklist found on Discogs');
      return NextResponse.json({
        success: false,
        error: 'No tracklist found on Discogs'
      }, { status: 404 });
    }

    console.log(`✓ Found ${discogsData.tracklist.length} tracks`);

    const formatString = buildDiscogsFormatString(discogsData.formats);
    const parsedFormat = formatString ? parseDiscogsFormat(formatString) : null;
    const albumDetails = parsedFormat ? {
      rpm: parsedFormat.rpm ?? null,
      vinyl_weight: parsedFormat.weight ?? null,
      vinyl_color: parsedFormat.color ? [parsedFormat.color] : null,
      extra: parsedFormat.extraText || null,
      packaging: parsedFormat.packaging ?? null,
      is_box_set: parsedFormat.is_box_set ?? false,
      box_set: parsedFormat.box_set ?? null,
    } : {};

    const primaryImage = discogsData.images?.find((img) => img.type === 'primary')?.uri ?? discogsData.images?.[0]?.uri ?? null;
    const secondaryImages = (discogsData.images ?? []).filter((img) => img.type !== 'primary');
    const backImage = secondaryImages[0]?.uri ?? null;
    const galleryImages = secondaryImages.slice(1).map((img) => img.uri).filter(Boolean);
    const artwork = (backImage || galleryImages.length > 0) ? {
      back_image_url: backImage ?? null,
      inner_sleeve_images: galleryImages.length > 0 ? galleryImages : null,
    } : {};

    // Process tracks with per-track artist info
    const enrichedTracks = discogsData.tracklist.map((track: DiscogsTrack) => {
      let trackArtist = undefined;
      
      // Extract artist from track-level artists field
      if (track.artists && track.artists.length > 0) {
        trackArtist = track.artists.map(a => a.name).join(', ');
      }
      
      return {
        position: track.position || '',
        type_: track.type_ || 'track',
        title: track.title || '',
        duration: track.duration || '',
        artist: trackArtist
      };
    });

    const tracksWithArtists = enrichedTracks.filter(t => t.artist).length;
    console.log(`✓ ${tracksWithArtists}/${enrichedTracks.length} tracks have artist info`);

    if (!release?.id) {
      return NextResponse.json({
        success: false,
        error: 'Missing release ID for track update.'
      }, { status: 400 });
    }

    console.log(`💾 Updating release tracks...`);
    const { error: deleteError } = await supabase
      .from('release_tracks')
      .delete()
      .eq('release_id', release.id);

    if (deleteError) {
      console.log('❌ ERROR: Failed to clear existing tracks', deleteError);
      return NextResponse.json({
        success: false,
        error: `Database update failed: ${deleteError.message}`
      }, { status: 500 });
    }

    for (const track of enrichedTracks) {
      const { data: recording, error: recordingError } = await supabase
        .from('recordings')
        .insert({
          title: track.title || null,
          duration_seconds: parseDurationToSeconds(track.duration),
          credits: (() => {
            const baseCredits: Record<string, unknown> = {};
            if (Object.keys(albumDetails).length > 0) baseCredits.album_details = albumDetails;
            if (Object.keys(artwork).length > 0) baseCredits.artwork = artwork;
            if (track.artist) baseCredits.track_artist = track.artist;
            return Object.keys(baseCredits).length > 0 ? (baseCredits as Json) : undefined;
          })(),
        })
        .select('id')
        .single();

      if (recordingError || !recording) {
        console.log('❌ ERROR: Failed to create recording', recordingError);
        return NextResponse.json({
          success: false,
          error: `Database update failed: ${recordingError?.message ?? 'Recording insert failed'}`
        }, { status: 500 });
      }

      const { error: linkError } = await supabase
        .from('release_tracks')
        .insert({
          release_id: release.id,
          recording_id: recording.id,
          position: track.position || '',
          side: getSideFromPosition(track.position),
          title_override: track.title || null,
        });

      if (linkError) {
        console.log('❌ ERROR: Failed to link recording', linkError);
        return NextResponse.json({
          success: false,
          error: `Database update failed: ${linkError.message}`
        }, { status: 500 });
      }
    }

    console.log(`✅ Successfully enriched tracklist\n`);

    return NextResponse.json({
      success: true,
      data: {
        albumId: album.id,
        artist: artistName,
        title: albumTitle,
        totalTracks: enrichedTracks.length,
        tracksWithArtists,
        tracks: enrichedTracks
          .filter((track) => track.type_ !== 'heading')
          .map((track) => ({
            position: track.position || '',
            title: track.title || '',
            artist: track.artist || null,
            duration: track.duration || null,
            type: 'track' as const,
            side: getSideFromPosition(track.position) || undefined
          }))
      }
    });

  } catch (error) {
    console.error('❌ FATAL ERROR in Discogs tracklist enrichment:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
// AUDIT: inspected, no changes.
