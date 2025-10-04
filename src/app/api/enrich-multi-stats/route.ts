// src/app/api/enrich-multi-stats/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

export async function GET() {
  try {
    const { count: total } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true });

    const { count: needsEnrichment } = await supabase
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

    const { count: fullyEnriched } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true })
      .not('spotify_id', 'is', null)
      .not('apple_music_id', 'is', null);

    const { data: withTracklists } = await supabase
      .from('collection')
      .select('tracklists')
      .not('tracklists', 'is', null);

    let geniusLyricsCount = 0;
    let appleLyricsCount = 0;
    let anyLyricsCount = 0;

    if (withTracklists) {
      withTracklists.forEach(row => {
        try {
          const tracks = typeof row.tracklists === 'string' 
            ? JSON.parse(row.tracklists)
            : row.tracklists;
          
          if (!Array.isArray(tracks)) return;
          
          const hasGeniusLyrics = tracks.some(t => t.lyrics_url);
          const hasAppleLyrics = tracks.some(t => t.lyrics && t.lyrics_source === 'apple_music');
          
          if (hasGeniusLyrics) geniusLyricsCount++;
          if (hasAppleLyrics) appleLyricsCount++;
          if (hasGeniusLyrics || hasAppleLyrics) anyLyricsCount++;
        } catch {
          // Skip invalid JSON
        }
      });
    }

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
        needsEnrichment: needsEnrichment || 0,
        unenriched: unenriched || 0,
        spotifyOnly: spotifyOnly || 0,
        appleOnly: appleOnly || 0,
        fullyEnriched: fullyEnriched || 0,
        geniusLyrics: geniusLyricsCount,
        appleLyrics: appleLyricsCount,
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