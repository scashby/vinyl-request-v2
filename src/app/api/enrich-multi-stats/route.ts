// src/app/api/enrich-multi-stats/route.ts - COMPLETE FILE
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

export async function GET() {
  try {
    // Get total count
    const { count: total } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true });

    // Get albums needing enrichment (missing either Spotify OR Apple Music)
    const { count: needsEnrichment } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true })
      .or('spotify_id.is.null,apple_music_id.is.null');

    // Get completely unenriched count (no spotify AND no apple music)
    const { count: unenriched } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true })
      .is('spotify_id', null)
      .is('apple_music_id', null);

    // Get spotify only
    const { count: spotifyOnly } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true })
      .not('spotify_id', 'is', null)
      .is('apple_music_id', null);

    // Get apple only  
    const { count: appleOnly } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true })
      .is('spotify_id', null)
      .not('apple_music_id', 'is', null);

    // Get fully enriched
    const { count: fullyEnriched } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true })
      .not('spotify_id', 'is', null)
      .not('apple_music_id', 'is', null);

    // Get count with any lyrics (check tracklists for lyrics_url)
    // This is approximate - we'd need to parse JSON to be exact
    const { data: withTracklists } = await supabase
      .from('collection')
      .select('tracklists')
      .not('tracklists', 'is', null)
      .limit(1000); // Sample

    let partialLyrics = 0;
    if (withTracklists) {
      partialLyrics = withTracklists.filter(row => {
        try {
          const tracks = typeof row.tracklists === 'string' 
            ? JSON.parse(row.tracklists)
            : row.tracklists;
          return Array.isArray(tracks) && tracks.some(t => t.lyrics_url);
        } catch {
          return false;
        }
      }).length;
    }

    // Get unique folders
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
        partialLyrics
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