// src/app/api/enrich-multi-stats/route.ts - FIXED: Clearer metrics and accurate "needs enrichment" count
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type Track = {
  lyrics?: string;
  lyrics_source?: 'apple_music' | 'genius';
  lyrics_url?: string;
};

function hasAppleMusicLyrics(tracklists: unknown): boolean {
  try {
    const tracks = typeof tracklists === 'string' 
      ? JSON.parse(tracklists)
      : tracklists;
    
    if (!Array.isArray(tracks)) return false;
    
    return tracks.some((t: Track) => t.lyrics && t.lyrics_source === 'apple_music');
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const { count: total } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true });

    // Albums with BOTH Spotify and Apple Music IDs
    const { count: bothServices } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true })
      .not('spotify_id', 'is', null)
      .not('apple_music_id', 'is', null);

    // Albums missing either Spotify OR Apple Music (but not lyrics check yet)
    const { count: missingServices } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true })
      .or('spotify_id.is.null,apple_music_id.is.null');

    const { count: unenriched } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true })
      .is('spotify_id', null)
      .is('apple_music_id', null);

    const { count: spotifyOnly } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true })
      .not('spotify_id', 'is', null)
      .is('apple_music_id', null);

    const { count: appleOnly } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true })
      .is('spotify_id', null)
      .not('apple_music_id', 'is', null);

    // Check all albums with Apple Music IDs for lyrics
    const { data: albumsWithAppleMusic } = await supabase
      .from('collection')
      .select('id, tracklists, apple_music_id')
      .not('apple_music_id', 'is', null);

    let appleLyricsCount = 0;
    let needsAppleLyrics = 0;
    
    if (albumsWithAppleMusic) {
      for (const album of albumsWithAppleMusic) {
        const hasLyrics = hasAppleMusicLyrics(album.tracklists);
        if (hasLyrics) {
          appleLyricsCount++;
        } else {
          needsAppleLyrics++;
        }
      }
    }

    // Count Genius lyrics
    const { data: withTracklists } = await supabase
      .from('collection')
      .select('tracklists')
      .not('tracklists', 'is', null);

    let geniusLyricsCount = 0;
    let anyLyricsCount = 0;

    if (withTracklists) {
      withTracklists.forEach(row => {
        try {
          const tracks = typeof row.tracklists === 'string' 
            ? JSON.parse(row.tracklists)
            : row.tracklists;
          
          if (!Array.isArray(tracks)) return;
          
          const hasGeniusLyrics = tracks.some((t: Track) => t.lyrics_url);
          const hasAppleLyrics = tracks.some((t: Track) => t.lyrics && t.lyrics_source === 'apple_music');
          
          if (hasGeniusLyrics) geniusLyricsCount++;
          if (hasGeniusLyrics || hasAppleLyrics) anyLyricsCount++;
        } catch {
          // Skip invalid JSON
        }
      });
    }

    // FIXED: Calculate actual "needs enrichment" including lyrics
    const needsEnrichment = (missingServices || 0) + needsAppleLyrics;

    // Fully enriched = has both services AND has Apple Music lyrics (or no Apple Music)
    const fullyEnriched = (bothServices || 0) - needsAppleLyrics;

    const { data: folderData } = await supabase
      .from('collection')
      .select('folder')
      .not('folder', 'is', null);

    const folders = Array.from(new Set(
      (folderData || []).map(row => row.folder).filter(Boolean)
    )).sort();

    return NextResponse.json({
      success: true,
      stats: {
        total: total || 0,
        needsEnrichment,
        fullyEnriched,
        bothServices: bothServices || 0,
        unenriched: unenriched || 0,
        spotifyOnly: spotifyOnly || 0,
        appleOnly: appleOnly || 0,
        geniusLyrics: geniusLyricsCount,
        appleLyrics: appleLyricsCount,
        needsAppleLyrics,
        anyLyrics: anyLyricsCount
      },
      folders
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}