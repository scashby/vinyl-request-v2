// src/app/api/enrich-sources/targeted/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enrichDiscogsMetadata, enrichDiscogsTracklist, enrichGenius } from 'lib/enrichment-utils';
import { hasValidDiscogsId } from 'lib/discogs-validation';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APPLE_MUSIC_TOKEN = process.env.APPLE_MUSIC_TOKEN;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type ServiceData = {
  spotify_id?: string;
  apple_music_id?: string;
  genres?: string[];
  [key: string]: unknown;
};

type AlbumResult = {
  albumId: number;
  artist: string;
  title: string;
  discogsMetadata?: {
    success: boolean;
    data?: { foundReleaseId?: string; addedImage?: boolean; addedGenres?: boolean; addedTracklist?: boolean; addedMasterId?: boolean };
    error?: string;
    skipped?: boolean;
  };
  discogsTracklist?: {
    success: boolean;
    data?: { totalTracks?: number; tracksWithArtists?: number };
    error?: string;
    skipped?: boolean;
  };
  spotify?: {
    success: boolean;
    data?: ServiceData;
    error?: string;
    skipped?: boolean;
  };
  appleMusic?: {
    success: boolean;
    data?: ServiceData;
    error?: string;
    skipped?: boolean;
  };
  genius?: {
    success: boolean;
    enrichedCount?: number;
    failedCount?: number;
    enrichedTracks?: Array<{ position: string; title: string; lyrics_url: string }>;
    failedTracks?: Array<{ position: string; title: string; error: string }>;
    error?: string;
    skipped?: boolean;
  };
  appleLyrics?: {
    success: boolean;
    lyricsFound?: number;
    lyricsMissing?: number;
    missingTracks?: string[];
    error?: string;
    skipped?: boolean;
  };
  match1001?: {
    success: boolean;
    matched?: boolean;
    confidence?: number;
    error?: string;
    skipped?: boolean;
  };
};

type Track = {
  position?: string;
  title?: string;
  duration?: string;
  type_?: string;
  artist?: string;
  lyrics_url?: string;
  lyrics?: string;
  lyrics_source?: 'apple_music' | 'genius';
};

type AppleTrack = {
  id: string;
  attributes: {
    name: string;
    trackNumber?: number;
    discNumber?: number;
    durationInMillis?: number;
  };
};

async function enrichAppleLyrics(albumId: number, appleMusicId: string, tracklists: string) {
  if (!APPLE_MUSIC_TOKEN) {
    return { success: false, error: 'Apple Music token not configured' };
  }

  let tracks: Track[] = [];
  try {
    tracks = typeof tracklists === 'string' ? JSON.parse(tracklists) : tracklists;
  } catch {
    return { success: false, error: 'Invalid tracklist' };
  }

  if (!Array.isArray(tracks) || tracks.length === 0) {
    return { success: false, error: 'No tracks found' };
  }

  const tracksRes = await fetch(
    `https://api.music.apple.com/v1/catalog/us/albums/${appleMusicId}/tracks`,
    { headers: { 'Authorization': `Bearer ${APPLE_MUSIC_TOKEN}` }}
  );

  if (!tracksRes.ok) {
    return { 
      success: false, 
      error: `Apple API HTTP ${tracksRes.status}`,
      stats: { lyricsFound: 0, lyricsNotFound: tracks.length }
    };
  }

  const tracksData = await tracksRes.json();
  const appleTracks: AppleTrack[] = tracksData.data || [];

  let lyricsFound = 0;
  let lyricsNotFound = 0;

  const enrichedTracks = await Promise.all(
    tracks.map(async (track) => {
      if (track.lyrics && track.lyrics_source === 'apple_music') {
        return track;
      }

      const appleTrack = appleTracks.find(at => 
        at.attributes.name.toLowerCase().replace(/[^a-z0-9]/g, '') === 
        (track.title || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      );

      if (!appleTrack) {
        lyricsNotFound++;
        return track;
      }

      try {
        const lyricsRes = await fetch(
          `https://api.music.apple.com/v1/catalog/us/songs/${appleTrack.id}/lyrics`,
          { headers: { 'Authorization': `Bearer ${APPLE_MUSIC_TOKEN}` }}
        );

        if (!lyricsRes.ok) {
          lyricsNotFound++;
          return track;
        }

        const lyricsData = await lyricsRes.json();
        const ttml = lyricsData?.data?.[0]?.attributes?.ttml;

        if (ttml) {
          const lyrics = ttml.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
          lyricsFound++;
          return { ...track, lyrics, lyrics_source: 'apple_music' as const };
        }
      } catch {
        // Ignore errors for individual tracks
      }

      lyricsNotFound++;
      return track;
    })
  );

  const { error: updateError } = await supabase
    .from('collection')
    .update({ tracklists: JSON.stringify(enrichedTracks) })
    .eq('id', albumId);

  if (updateError) {
    return { success: false, error: 'Database update failed' };
  }

  return {
    success: true,
    stats: { lyricsFound, lyricsNotFound }
  };
}

async function callService(endpoint: string, albumId: number) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    const url = `${baseUrl}/api/enrich-sources/${endpoint}`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'DWD-Internal-Targeted'
      },
      body: JSON.stringify({ albumId })
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        success: false,
        error: `HTTP ${res.status}: ${errorText.substring(0, 100)}`
      };
    }

    const result = await res.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Service call failed'
    };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { albumIds, services } = body;

    if (!albumIds || !Array.isArray(albumIds) || albumIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'albumIds array required'
      }, { status: 400 });
    }

    if (!services || typeof services !== 'object') {
      return NextResponse.json({
        success: false,
        error: 'services object required'
      }, { status: 400 });
    }

    console.log(`\n🎯 === TARGETED ENRICHMENT ===`);
    console.log(`Albums: ${albumIds.length}`);
    console.log(`Services:`, services);

    // Fetch album data
    const { data: albums, error: fetchError } = await supabase
      .from('collection')
      .select('id, artist, title, tracklists, spotify_id, apple_music_id, discogs_release_id, discogs_master_id, image_url, discogs_genres, is_1001')
      .in('id', albumIds);

    if (fetchError || !albums) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch albums'
      }, { status: 500 });
    }

    const results: AlbumResult[] = [];

    for (const album of albums) {
      const albumResult: AlbumResult = {
        albumId: album.id,
        artist: album.artist,
        title: album.title
      };

      console.log(`\n📀 Processing: ${album.artist} - ${album.title}`);

      // Discogs Metadata
      if (services.discogsMetadata) {
        const discogsMetaResult = await enrichDiscogsMetadata(album.id);
        albumResult.discogsMetadata = {
          success: discogsMetaResult.success,
          data: discogsMetaResult.data,
          error: discogsMetaResult.error,
          skipped: discogsMetaResult.skipped
        };
        await sleep(1000);
      }

      // Discogs Tracklist
      if (services.discogsTracklist && hasValidDiscogsId(album.discogs_release_id)) {
        const discogsResult = await enrichDiscogsTracklist(album.id);
        albumResult.discogsTracklist = {
          success: discogsResult.success,
          data: discogsResult.data as { totalTracks?: number; tracksWithArtists?: number },
          error: discogsResult.error,
          skipped: discogsResult.skipped
        };
        await sleep(500);
      }

      // Spotify
      if (services.spotify && !album.spotify_id) {
        const spotifyResult = await callService('spotify', album.id);
        albumResult.spotify = {
          success: spotifyResult.success,
          data: spotifyResult.data as ServiceData,
          error: spotifyResult.error,
          skipped: spotifyResult.skipped
        };
        await sleep(300);
      }

      // Apple Music
      if (services.appleMusic && !album.apple_music_id) {
        const appleResult = await callService('apple-music', album.id);
        albumResult.appleMusic = {
          success: appleResult.success,
          data: appleResult.data as ServiceData,
          error: appleResult.error,
          skipped: appleResult.skipped
        };
        await sleep(300);
      }

      // Genius
      if (services.genius && album.tracklists) {
        const geniusResult = await enrichGenius(album.id);
        albumResult.genius = {
          success: geniusResult.success,
          enrichedCount: geniusResult.data?.enrichedCount,
          failedCount: geniusResult.data?.failedCount,
          enrichedTracks: geniusResult.data?.enrichedTracks,
          failedTracks: geniusResult.data?.failedTracks,
          error: geniusResult.error,
          skipped: geniusResult.data?.enrichedCount === 0 && geniusResult.data?.skippedCount > 0
        };
      }

      // Apple Lyrics
      const newlyAddedAppleMusicId = albumResult.appleMusic?.data?.apple_music_id;
      const finalAppleMusicId = (typeof newlyAddedAppleMusicId === 'string' ? newlyAddedAppleMusicId : null) || album.apple_music_id;
      
      if (services.appleLyrics && finalAppleMusicId && album.tracklists) {
        const lyricsResult = await enrichAppleLyrics(album.id, finalAppleMusicId, album.tracklists);
        albumResult.appleLyrics = {
          success: lyricsResult.success,
          lyricsFound: lyricsResult.stats?.lyricsFound,
          lyricsMissing: lyricsResult.stats?.lyricsNotFound,
          error: lyricsResult.error
        };
        await sleep(300);
      }

      // 1001 Albums
      if (services.match1001 && !album.is_1001) {
        const matchResult = await callService('1001-match', album.id);
        albumResult.match1001 = {
          success: matchResult.success,
          matched: matchResult.matched,
          confidence: matchResult.data?.confidence,
          error: matchResult.error,
          skipped: matchResult.skipped
        };
        await sleep(300);
      }

      results.push(albumResult);
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });

  } catch (error) {
    console.error('Targeted enrichment error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}