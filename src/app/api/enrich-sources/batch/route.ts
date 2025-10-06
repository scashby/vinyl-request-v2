// src/app/api/enrich-sources/batch/route.ts - COMPLETE FILE
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
};

type Track = {
  position?: string;
  title?: string;
  duration?: string;
  type_?: string;
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

  // Fetch Apple Music tracks
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

  // Update database
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
    // Build the URL - handle both local and production
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    const url = `${baseUrl}/api/enrich-sources/${endpoint}`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'DWD-Internal-Batch'
      },
      body: JSON.stringify({ albumId })
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        success: false,
        error: `HTTP ${res.status}: ${errorText}`,
        details: {
          status: res.status,
          statusText: res.statusText,
          url,
          endpoint,
          albumId,
          responseBody: errorText
        }
      };
    }

    const result = await res.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Service call failed',
      details: {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        endpoint,
        albumId,
        baseUrl: process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'localhost',
        nodeEnv: process.env.NODE_ENV
      }
    };
  }
}

function needsAppleMusicLyrics(tracklists: string | null, appleMusicId: string | null): boolean {
  if (!appleMusicId || !tracklists) return false;

  try {
    const tracks = typeof tracklists === 'string' ? JSON.parse(tracklists) : tracklists;
    if (!Array.isArray(tracks) || tracks.length === 0) return false;

    const hasAppleLyrics = tracks.some((t: { lyrics?: string; lyrics_source?: string }) => 
      t.lyrics && t.lyrics_source === 'apple_music'
    );
    
    return !hasAppleLyrics;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cursor = body.cursor || 0;
    const limit = body.limit || 20;
    const folder = body.folder;
    const services = body.services || {
      spotify: true,
      appleMusic: true,
      genius: true,
      appleLyrics: true
    };

    // Query more albums to account for filtering
    const queryLimit = limit * 3;

    let query = supabase
      .from('collection')
      .select('id, artist, title, tracklists, spotify_id, apple_music_id, folder')
      .gt('id', cursor)
      .order('id', { ascending: true })
      .limit(queryLimit);

    if (folder && folder !== '') {
      query = query.eq('folder', folder);
    }

    const { data: albums, error } = await query;

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    if (!albums || albums.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        results: [],
        hasMore: false
      });
    }

    const albumsNeedingEnrichment = albums.filter(album => 
      !album.spotify_id || 
      !album.apple_music_id || 
      needsAppleMusicLyrics(album.tracklists, album.apple_music_id)
    ).slice(0, limit);

    if (albumsNeedingEnrichment.length === 0 && albums.length > 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        results: [],
        hasMore: true,
        nextCursor: albums[albums.length - 1].id
      });
    }

    if (albumsNeedingEnrichment.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        results: [],
        hasMore: false
      });
    }

    const results: AlbumResult[] = [];

    for (const album of albumsNeedingEnrichment) {
      const albumResult: AlbumResult = {
        albumId: album.id,
        artist: album.artist,
        title: album.title
      };

      // Enrich Spotify
      if (!album.spotify_id && services.spotify) {
        const spotifyResult = await callService('spotify', album.id);
        albumResult.spotify = {
          success: spotifyResult.success,
          data: spotifyResult.data as ServiceData,
          error: spotifyResult.error,
          skipped: spotifyResult.skipped
        };
        await sleep(500);
      } else if (album.spotify_id) {
        albumResult.spotify = {
          success: true,
          skipped: true
        };
      }

      // Enrich Apple Music
      if (!album.apple_music_id && services.appleMusic) {
        const appleResult = await callService('apple-music', album.id);
        albumResult.appleMusic = {
          success: appleResult.success,
          data: appleResult.data as ServiceData,
          error: appleResult.error,
          skipped: appleResult.skipped
        };
        await sleep(500);
      } else if (album.apple_music_id) {
        albumResult.appleMusic = {
          success: true,
          skipped: true
        };
      }

      // Enrich Genius lyrics
      if (album.tracklists && services.genius) {
        const geniusResult = await callService('genius', album.id);
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

      // Enrich Apple Music lyrics - call Apple Music API directly
      const newlyAddedAppleMusicId = albumResult.appleMusic?.data?.apple_music_id;
      const finalAppleMusicId = (typeof newlyAddedAppleMusicId === 'string' ? newlyAddedAppleMusicId : null) || album.apple_music_id;
      
      if (finalAppleMusicId && needsAppleMusicLyrics(album.tracklists, finalAppleMusicId) && services.appleLyrics) {
        const lyricsResult = await enrichAppleLyrics(album.id, finalAppleMusicId, album.tracklists);
        albumResult.appleLyrics = {
          success: lyricsResult.success,
          lyricsFound: lyricsResult.stats?.lyricsFound,
          lyricsMissing: lyricsResult.stats?.lyricsNotFound,
          error: lyricsResult.error
        };
        await sleep(500);
      }

      results.push(albumResult);
    }

    const hasMore = albums.length >= queryLimit;
    const nextCursor = hasMore ? albums[albums.length - 1].id : null;

    return NextResponse.json({
      success: true,
      processed: albumsNeedingEnrichment.length,
      results,
      hasMore,
      nextCursor
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}