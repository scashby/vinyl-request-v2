// src/app/api/enrich-sources/stats/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidDiscogsId, hasValidDiscogsMasterId } from "lib/discogs-validation";

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
  discogs_master_id: string | null;
  image_url: string | null;
  discogs_genres: string[] | null;
  discogs_styles: string[] | null;
  discogs_source: string | null;
  year: string | null;
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

    // For comprehensive Discogs tracking, fetch all albums and count programmatically
    let missingDiscogsId = 0;
    let missingMasterId = 0;
    let missingImage = 0;
    let missingGenres = 0;
    let missingStyles = 0;
    let missingTracklists = 0;
    let missingSource = 0;
    let missingYear = 0;
    let appleLyricsCount = 0;
    let needsAppleLyrics = 0;
    let fullyEnrichedCount = 0;
    let discogsTracklistCount = 0;
    let needsDiscogsTracklist = 0;
    let copiedData = 0;
    
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;

    console.log('📊 Starting comprehensive stats calculation...');

    while (hasMore) {
      const { data: albums } = await supabase
        .from('collection')
        .select('id, discogs_release_id, discogs_master_id, image_url, discogs_genres, discogs_styles, discogs_source, year, tracklists, apple_music_id, spotify_id')
        .range(offset, offset + pageSize - 1);

      if (!albums || albums.length === 0) {
        hasMore = false;
        break;
      }

      for (const album of albums as Album[]) {
        // Check if we need to copy genres/styles between columns
        const hasGenres = album.discogs_genres && album.discogs_genres.length > 0;
        const hasStyles = album.discogs_styles && album.discogs_styles.length > 0;
        
        if (hasGenres && !hasStyles) {
          // Copy genres to styles
          await supabase
            .from('collection')
            .update({ discogs_styles: album.discogs_genres })
            .eq('id', album.id);
          copiedData++;
        } else if (hasStyles && !hasGenres) {
          // Copy styles to genres
          await supabase
            .from('collection')
            .update({ discogs_genres: album.discogs_styles })
            .eq('id', album.id);
          copiedData++;
        }
        
        // Check Discogs Release ID validity
        const hasValidReleaseId = hasValidDiscogsId(album.discogs_release_id);
        if (!hasValidReleaseId) {
          missingDiscogsId++;
        }
        
        // Check Master ID validity using shared function
        const hasValidMasterId = hasValidDiscogsMasterId(album.discogs_master_id);
        if (!hasValidMasterId) {
          missingMasterId++;
        }
        
        // Count missing images for ALL albums
        if (!album.image_url) {
          missingImage++;
        }
        
        // Count missing genres/styles (after potential copying)
        const finalGenres = hasGenres ? album.discogs_genres : (hasStyles ? album.discogs_styles : null);
        const finalStyles = hasStyles ? album.discogs_styles : (hasGenres ? album.discogs_genres : null);
        
        if (!finalGenres || finalGenres.length === 0) {
          missingGenres++;
        }
        
        if (!finalStyles || finalStyles.length === 0) {
          missingStyles++;
        }
        
        // Count missing tracklists
        if (!album.tracklists) {
          missingTracklists++;
        }
        
        // Count missing source
        if (!album.discogs_source) {
          missingSource++;
        }
        
        // Count missing year
        if (!album.year || album.year === '' || album.year === '0') {
          missingYear++;
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
        
        // Discogs Track Artists
        if (hasValidReleaseId) {
          if (album.tracklists && hasTrackArtists(album.tracklists)) {
            discogsTracklistCount++;
          } else if (album.tracklists) {
            needsDiscogsTracklist++;
          }
        }
      }

      hasMore = albums.length === pageSize;
      offset += pageSize;
      
      console.log(`📊 Processed ${offset} albums...`);
    }

    console.log('📊 Discogs data quality results:');
    console.log(`   Missing Release IDs: ${missingDiscogsId}`);
    console.log(`   Missing Master IDs: ${missingMasterId}`);
    console.log(`   Missing Images: ${missingImage}`);
    console.log(`   Missing Genres: ${missingGenres}`);
    console.log(`   Missing Styles: ${missingStyles}`);
    console.log(`   Missing Tracklists: ${missingTracklists}`);
    console.log(`   Missing Source: ${missingSource}`);
    console.log(`   Missing Year: ${missingYear}`);
    console.log(`   Copied data between columns: ${copiedData}`);

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
        // Comprehensive Discogs data quality stats
        missingDiscogsId,
        missingMasterId,
        missingImage,
        missingGenres,
        missingStyles,
        missingTracklists,
        missingSource,
        missingYear
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