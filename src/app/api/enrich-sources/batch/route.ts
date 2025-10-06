// src/app/api/enrich-sources/batch/route.ts - Fixed TypeScript errors
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
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/enrich-sources/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId })
    });

    const result = await res.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Service call failed'
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
    const limit = Math.min(body.limit || 20, 50);
    const folder = body.folder;

    let query = supabase
      .from('collection')
      .select('id, artist, title, tracklists, spotify_id, apple_music_id, folder')
      .or('spotify_id.is.null,apple_music_id.is.null,apple_music_id.not.is.null')
      .gt('id', cursor)
      .order('id', { ascending: true })
      .limit(limit * 2);

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

    if (albumsNeedingEnrichment.length === 0) {
      return NextResponse.json({
        success: true,
        processed: albums.length,
        results: [],
        hasMore: albums.length >= limit * 2,
        nextCursor: albums[albums.length - 1].id
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
      if (!album.spotify_id) {
        const spotifyResult = await callService('spotify', album.id);
        albumResult.spotify = {
          success: spotifyResult.success,
          data: spotifyResult.data as ServiceData,
          error: spotifyResult.error,
          skipped: spotifyResult.skipped
        };
        await sleep(500);
      } else {
        albumResult.spotify = {
          success: true,
          skipped: true
        };
      }

      // Enrich Apple Music
      if (!album.apple_music_id) {
        const appleResult = await callService('apple-music', album.id);
        albumResult.appleMusic = {
          success: appleResult.success,
          data: appleResult.data as ServiceData,
          error: appleResult.error,
          skipped: appleResult.skipped
        };
        await sleep(500);
      } else {
        albumResult.appleMusic = {
          success: true,
          skipped: true
        };
      }

      // Enrich Genius lyrics
      if (album.tracklists) {
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

      // Enrich Apple Music lyrics - get the newly added ID or use existing
      const newlyAddedAppleMusicId = albumResult.appleMusic?.data?.apple_music_id;
      const finalAppleMusicId = (typeof newlyAddedAppleMusicId === 'string' ? newlyAddedAppleMusicId : null) || album.apple_music_id;
      
      if (finalAppleMusicId && needsAppleMusicLyrics(album.tracklists, finalAppleMusicId)) {
        const appleLyricsResult = await callService('apple-lyrics', album.id);
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
    }

    const hasMore = albums.length >= limit * 2;
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