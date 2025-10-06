// src/app/api/enrich-sources/batch/route.ts - FIXED: No longer stops early
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

async function callService(endpoint: string, albumId: number) {
  try {
    // Build the URL - handle both local and production
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000';
    
    const url = `${baseUrl}/api/enrich-sources/${endpoint}`;
    
    console.log(`[callService] Calling ${endpoint} for album ${albumId} at ${url}`);
    
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
      console.error(`[callService] HTTP ${res.status} for ${endpoint}:`, errorText);
      return {
        success: false,
        error: `HTTP ${res.status}: ${errorText.substring(0, 100)}`
      };
    }

    const result = await res.json();
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Service call failed';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error(`[callService] Fetch error for ${endpoint}:`, errorMsg, errorStack);
    return {
      success: false,
      error: `Fetch error: ${errorMsg}`
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
    const limit = body.limit || 20; // NO artificial limits - user controls this
    const folder = body.folder;
    const services = body.services || {
      spotify: true,
      appleMusic: true,
      genius: true,
      appleLyrics: true
    };

    // Query more albums to account for filtering
    const queryLimit = limit * 3; // Query 3x the batch size

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

    // If we found NO albums needing enrichment in this batch, but got albums back,
    // we should continue to the next batch
    if (albumsNeedingEnrichment.length === 0 && albums.length > 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        results: [],
        hasMore: true, // Continue to next batch
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
      console.log(`\n🎵 === ENRICHING ALBUM #${album.id}: ${album.artist} - ${album.title} ===`);
      
      const albumResult: AlbumResult = {
        albumId: album.id,
        artist: album.artist,
        title: album.title
      };

      // Enrich Spotify
      if (!album.spotify_id && services.spotify) {
        console.log(`  🎵 Calling Spotify service...`);
        const spotifyResult = await callService('spotify', album.id);
        console.log(`  → Spotify result:`, spotifyResult.success ? '✅ Success' : spotifyResult.skipped ? '⏭️ Skipped' : `❌ Failed: ${spotifyResult.error}`);
        albumResult.spotify = {
          success: spotifyResult.success,
          data: spotifyResult.data as ServiceData,
          error: spotifyResult.error,
          skipped: spotifyResult.skipped
        };
        await sleep(500);
      } else if (album.spotify_id) {
        console.log(`  🎵 Spotify: Already has ID, skipping`);
        albumResult.spotify = {
          success: true,
          skipped: true
        };
      }

      // Enrich Apple Music
      if (!album.apple_music_id && services.appleMusic) {
        console.log(`  🍎 Calling Apple Music service...`);
        const appleResult = await callService('apple-music', album.id);
        console.log(`  → Apple Music result:`, appleResult.success ? '✅ Success' : appleResult.skipped ? '⏭️ Skipped' : `❌ Failed: ${appleResult.error}`);
        albumResult.appleMusic = {
          success: appleResult.success,
          data: appleResult.data as ServiceData,
          error: appleResult.error,
          skipped: appleResult.skipped
        };
        await sleep(500);
      } else if (album.apple_music_id) {
        console.log(`  🍎 Apple Music: Already has ID, skipping`);
        albumResult.appleMusic = {
          success: true,
          skipped: true
        };
      }

      // Enrich Genius lyrics
      if (album.tracklists && services.genius) {
        console.log(`  📝 Calling Genius lyrics service...`);
        const geniusResult = await callService('genius', album.id);
        console.log(`  → Genius result:`, geniusResult.success ? `✅ Enriched ${geniusResult.data?.enrichedCount || 0} tracks` : `❌ Failed: ${geniusResult.error}`);
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

      // Enrich Apple Music lyrics - get the newly added ID or use existing
      const newlyAddedAppleMusicId = albumResult.appleMusic?.data?.apple_music_id;
      const finalAppleMusicId = (typeof newlyAddedAppleMusicId === 'string' ? newlyAddedAppleMusicId : null) || album.apple_music_id;
      
      if (finalAppleMusicId && needsAppleMusicLyrics(album.tracklists, finalAppleMusicId) && services.appleLyrics) {
        console.log(`  🍎📝 Calling Apple Music Lyrics service...`);
        const appleLyricsResult = await callService('apple-lyrics', album.id);
        console.log(`  → Apple Lyrics result:`, appleLyricsResult.success ? `✅ Found ${appleLyricsResult.stats?.lyricsFound || 0} lyrics` : `❌ Failed: ${appleLyricsResult.error}`);
        albumResult.appleLyrics = {
          success: appleLyricsResult.success,
          lyricsFound: appleLyricsResult.stats?.lyricsFound,
          lyricsMissing: appleLyricsResult.stats?.lyricsNotFound,
          missingTracks: appleLyricsResult.stats?.missingTracks,
          error: appleLyricsResult.error
        };
        await sleep(500);
      }

      results.push(albumResult);
      console.log(`✓ Album #${album.id} enrichment complete\n`);
    }

    // Continue if we got the full query limit, meaning there might be more albums to check
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
    console.error('Batch enrichment error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}