// src/app/api/search-lyrics/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type Track = {
  position?: string;
  title?: string;
  duration?: string;
  lyrics_url?: string;
};

type SearchResult = {
  collection_id: number;
  artist: string;
  album_title: string;
  track_title: string;
  track_position: string | null;
  genius_url: string | null;
  image_url: string | null;
};

type TagInsert = {
  collection_id: number;
  track_title: string;
  track_position: string | null;
  search_term: string;
  genius_url: string;
};

type TagQueryResult = {
  collection_id: number;
  track_title: string;
  track_position: string | null;
  genius_url: string | null;
  collection?: {
    artist: string;
    title: string;
    image_url: string | null;
  } | null;
};

type Body = {
  term: string;
  folder?: string; // Optional: filter by folder (e.g., "vinyl")
  forceRefresh?: boolean; // Force re-scan even if tags exist
};

// Extract lyrics from Genius HTML page
async function fetchLyricsFromGeniusUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Genius stores lyrics in div with data-lyrics-container attribute
    // This is a simple regex extraction - may need adjustment if Genius changes their HTML
    const lyricsMatch = html.match(/data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g);
    
    if (!lyricsMatch) return null;
    
    // Combine all lyrics containers and strip HTML tags
    const lyrics = lyricsMatch
      .map(match => match.replace(/<[^>]*>/g, ' '))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return lyrics;
  } catch (error) {
    console.error(`Error fetching lyrics from ${url}:`, error);
    return null;
  }
}

// Check if term exists in text (case-insensitive)
function containsTerm(text: string, term: string): boolean {
  return text.toLowerCase().includes(term.toLowerCase());
}

// Sleep function for rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    
    if (!body.term || body.term.trim().length === 0) {
      return NextResponse.json({ error: 'Search term is required' }, { status: 400 });
    }

    const searchTerm = body.term.trim().toLowerCase();
    
    // Step 1: Check if we already have tags for this term
    if (!body.forceRefresh) {
      const { data: existingTags, error: tagError } = await supabase
        .from('lyric_search_tags')
        .select(`
          collection_id,
          track_title,
          track_position,
          genius_url,
          collection:collection_id (
            artist,
            title,
            image_url
          )
        `)
        .eq('search_term', searchTerm);

      if (!tagError && existingTags && existingTags.length > 0) {
        // Format existing results
        const tagResults = existingTags as unknown as TagQueryResult[];
        const results: SearchResult[] = tagResults.map((tag) => ({
          collection_id: tag.collection_id,
          artist: tag.collection?.artist || 'Unknown Artist',
          album_title: tag.collection?.title || 'Unknown Album',
          track_title: tag.track_title,
          track_position: tag.track_position,
          genius_url: tag.genius_url,
          image_url: tag.collection?.image_url || null
        }));

        return NextResponse.json({
          success: true,
          cached: true,
          term: body.term,
          results,
          count: results.length
        });
      }
    }

    // Step 2: No cached results - need to scan lyrics
    // Get all albums with tracklists that have lyrics URLs
    let query = supabase
      .from('collection')
      .select('id, artist, title, image_url, folder, tracklists')
      .not('tracklists', 'is', null);

    if (body.folder) {
      query = query.eq('folder', body.folder);
    }

    const { data: albums, error: albumError } = await query;

    if (albumError) {
      return NextResponse.json({ error: albumError.message }, { status: 500 });
    }

    if (!albums || albums.length === 0) {
      return NextResponse.json({
        success: true,
        cached: false,
        term: body.term,
        results: [],
        count: 0,
        message: 'No albums with tracklists found'
      });
    }

    // Step 3: Scan lyrics for the term
    const results: SearchResult[] = [];
    const tagsToInsert: TagInsert[] = [];
    let processedCount = 0;

    for (const album of albums) {
      try {
        const tracklists: Track[] = typeof album.tracklists === 'string'
          ? JSON.parse(album.tracklists) as Track[]
          : album.tracklists as Track[];

        if (!Array.isArray(tracklists)) continue;

        for (const track of tracklists) {
          if (!track.lyrics_url || !track.title) continue;

          processedCount++;
          
          // Fetch lyrics temporarily (not stored)
          const lyrics = await fetchLyricsFromGeniusUrl(track.lyrics_url);
          
          if (!lyrics) {
            console.log(`No lyrics found for: ${album.artist} - ${track.title}`);
            continue;
          }

          // Check if term exists in lyrics
          if (containsTerm(lyrics, searchTerm)) {
            results.push({
              collection_id: album.id,
              artist: album.artist,
              album_title: album.title,
              track_title: track.title,
              track_position: track.position || null,
              genius_url: track.lyrics_url,
              image_url: album.image_url
            });

            // Prepare tag for insertion
            tagsToInsert.push({
              collection_id: album.id,
              track_title: track.title,
              track_position: track.position || null,
              search_term: searchTerm,
              genius_url: track.lyrics_url
            });
          }

          // Rate limit: 1 second between requests to avoid overwhelming Genius
          await sleep(1000);
        }
      } catch (error) {
        console.error(`Error processing album ${album.id}:`, error);
      }
    }

    // Step 4: Insert tags into database for future searches
    if (tagsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('lyric_search_tags')
        .insert(tagsToInsert);

      if (insertError) {
        console.error('Error inserting tags:', insertError);
        // Don't fail the request if tag insertion fails
      }
    }

    return NextResponse.json({
      success: true,
      cached: false,
      term: body.term,
      results,
      count: results.length,
      scanned: processedCount,
      message: `Scanned ${processedCount} tracks, found ${results.length} matches. Results cached for future searches.`
    });

  } catch (error) {
    console.error('Lyric search error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to retrieve cached search stats
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const term = searchParams.get('term');

    if (term) {
      // Get results for specific term
      const { data, error } = await supabase
        .from('lyric_search_tags')
        .select(`
          collection_id,
          track_title,
          track_position,
          genius_url,
          collection:collection_id (
            artist,
            title,
            image_url
          )
        `)
        .eq('search_term', term.toLowerCase());

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const tagResults = data as unknown as TagQueryResult[] || [];
      const results: SearchResult[] = tagResults.map((tag) => ({
        collection_id: tag.collection_id,
        artist: tag.collection?.artist || 'Unknown Artist',
        album_title: tag.collection?.title || 'Unknown Album',
        track_title: tag.track_title,
        track_position: tag.track_position,
        genius_url: tag.genius_url,
        image_url: tag.collection?.image_url || null
      }));

      return NextResponse.json({
        term,
        results,
        count: results.length
      });
    } else {
      // Get all search stats
      const { data, error } = await supabase
        .from('lyric_search_stats')
        .select('*')
        .order('track_count', { ascending: false })
        .limit(50);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        stats: data || [],
        count: (data || []).length
      });
    }
  } catch (error) {
    console.error('Error fetching search stats:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}