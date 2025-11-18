// src/app/api/enrich-sources/stats/route.ts - FIXED WITH SHARED VALIDATION
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidDiscogsId } from "lib/discogs-validation";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type Track = {
  lyrics?: string;
  lyrics_source?: 'apple_music' | 'genius';
  lyrics_url?: string;
  artist?: string;
};

type Album = {
  id: number;
  discogs_release_id: string | null;
  image_url: string | null;
  discogs_genres: string[] | null;
  tracklists: unknown;
  apple_music_id: string | null;
  spotify_id: string | null;
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

function hasTrackArtists(tracklists: unknown): boolean {
  try {
    const tracks = typeof tracklists === 'string' 
      ? JSON.parse(tracklists)
      : tracklists;
    
    if (!Array.isArray(tracks)) return false;
    
    return tracks.some((t: Track) => t.artist);
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const { count: total } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true });

    // Streaming Services
    const { count: bothServices } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true })
      .not('spotify_id', 'is', null)
      .not('apple_music_id', 'is', null);

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

    // 1001 Albums
    const { count: albums1001Count } = await supabase
      .from('collection')
      .select('id', { count: 'exact', head: true })
      .eq('is_1001', true);

    // For Discogs data quality, we need to fetch and validate programmatically
    let missingDiscogsId = 0;
    let missingImage = 0;
    let missingGenres = 0;
    let appleLyricsCount = 0;
    let needsAppleLyrics = 0;
    let fullyEnrichedCount = 0;
    let discogsTracklistCount = 0;
    let needsDiscogsTracklist = 0;
    
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: albums } = await supabase
        .from('collection')
        .select('id, discogs_release_id, image_url, discogs_genres, tracklists, apple_music_id, spotify_id')
        .range(offset, offset + pageSize - 1);

      if (!albums || albums.length === 0) {
        hasMore = false;
        break;
      }

      for (const album of albums as Album[]) {
        // Check Discogs ID validity using shared validation
        const hasValidId = hasValidDiscogsId(album.discogs_release_id);
        if (!hasValidId) {
          missingDiscogsId++;
        }
        
        // Check image (only count if they have a valid release ID)
        if (hasValidId && !album.image_url) {
          missingImage++;
        }
        
        // Check genres
        if (!album.discogs_genres || album.discogs_genres.length === 0) {
          missingGenres++;
        }
        
        // Apple Music Lyrics
        if (album.apple_music_id) {
          const hasLyrics = hasAppleMusicLyrics(album.tracklists);
          if (hasLyrics) {
            appleLyricsCount++;
            if (album.spotify_id) {
              fullyEnrichedCount++;
            }
          } else {
            needsAppleLyrics++;
          }
        }
        
        // Discogs Track Artists (only check if they have a valid release ID)
        if (hasValidId) {
          if (album.tracklists && hasTrackArtists(album.tracklists)) {
            discogsTracklistCount++;
          } else if (album.tracklists) {
            needsDiscogsTracklist++;
          }
        }
      }

      hasMore = albums.length === pageSize;
      offset += pageSize;
    }

    // Genius lyrics
    let geniusLyricsCount = 0;
    let anyLyricsCount = 0;
    offset = 0;
    hasMore = true;

    while (hasMore) {
      const { data: withTracklists } = await supabase
        .from('collection')
        .select('tracklists')
        .not('tracklists', 'is', null)
        .range(offset, offset + pageSize - 1);

      if (!withTracklists || withTracklists.length === 0) {
        hasMore = false;
        break;
      }

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

      hasMore = withTracklists.length === pageSize;
      offset += pageSize;
    }

    const needsEnrichment = (total || 0) - fullyEnrichedCount;
    const fullyEnriched = fullyEnrichedCount;

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
        anyLyrics: anyLyricsCount,
        albums1001: albums1001Count || 0,
        discogsTracklist: discogsTracklistCount,
        needsDiscogsTracklist,
        missingDiscogsId,
        missingImage,
        missingGenres
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