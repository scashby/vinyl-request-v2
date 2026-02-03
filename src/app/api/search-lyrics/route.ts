// src/app/api/search-lyrics/route.ts - Fixed with better Genius scraping
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
  inventory?: {
    release?: {
      master?: {
        title?: string | null;
        cover_image_url?: string | null;
        artist?: {
          name?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

type Body = {
  term: string;
  folder?: string;
  forceRefresh?: boolean;
};

async function fetchLyricsFromGeniusUrl(url: string): Promise<string | null> {
  try {
    console.log(`📥 Fetching: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    console.log(`✅ Fetched ${html.length} bytes`);
    
    let lyrics = '';
    
    // Method 1: Look for any div with lyrics-related data attributes or classes
    const lyricsPatterns = [
      // Current Genius structure (2024+)
      /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi,
      // Alternative container patterns
      /<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // Older structure
      /<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    ];

    for (const pattern of lyricsPatterns) {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        console.log(`✅ Found ${matches.length} sections with pattern ${pattern.source.substring(0, 50)}...`);
        
        lyrics = matches
          .map(match => {
            // Remove HTML tags but preserve line breaks
            const text = match
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>/gi, '\n')
              .replace(/<[^>]+>/g, '')
              .trim();
            return text;
          })
          .filter(text => text.length > 0)
          .join('\n\n');
        
        if (lyrics.length > 100) { // Reasonable lyrics length
          break;
        }
      }
    }
    
    // Method 2: Try to find JSON-LD structured data
    if (!lyrics || lyrics.length < 100) {
      console.log(`⚠️ Trying JSON-LD fallback`);
      const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
      const jsonMatches = html.match(jsonLdPattern);
      
      if (jsonMatches) {
        for (const jsonMatch of jsonMatches) {
          try {
            const jsonText = jsonMatch.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
            const data = JSON.parse(jsonText);
            if (data['@type'] === 'MusicRecording' && data.lyrics) {
              lyrics = data.lyrics;
              console.log(`✅ Found lyrics in JSON-LD`);
              break;
            }
          } catch {
            continue;
          }
        }
      }
    }
    
    if (!lyrics || lyrics.length < 50) {
      console.log(`❌ No valid lyrics found (extracted ${lyrics.length} chars)`);
      console.log(`First 500 chars of HTML: ${html.substring(0, 500)}`);
      return null;
    }
    
    // Clean up
    lyrics = lyrics
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/\n\s+/g, '\n') // Clean line breaks
      .trim();
    
    console.log(`✅ Extracted ${lyrics.length} chars of lyrics`);
    console.log(`Preview: "${lyrics.substring(0, 150)}..."`);
    return lyrics;
    
  } catch (error) {
    console.error(`❌ Error fetching ${url}:`, error);
    return null;
  }
}

function containsTerm(text: string, term: string): boolean {
  return text.toLowerCase().includes(term.toLowerCase());
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    
    if (!body.term || body.term.trim().length === 0) {
      return NextResponse.json({ error: 'Search term is required' }, { status: 400 });
    }

    const searchTerm = body.term.trim().toLowerCase();
    console.log(`\n🔍 LYRICS SEARCH: "${searchTerm}"${body.folder ? ` in folder "${body.folder}"` : ''}`);
    
    // Check cache first
    if (!body.forceRefresh) {
      console.log(`📋 Checking cache...`);
      const { data: existingTags, error: tagError } = await supabase
        .from('lyric_search_tags')
        .select(`
          collection_id,
          track_title,
          track_position,
          genius_url,
          inventory:collection_id (
            id,
            release:releases (
              master:masters (
                title,
                cover_image_url,
                artist:artists (name)
              )
            )
          )
        `)
        .eq('search_term', searchTerm);

      if (!tagError && existingTags && existingTags.length > 0) {
        console.log(`✅ Found ${existingTags.length} cached results`);
        const tagResults = existingTags as unknown as TagQueryResult[];
        const results: SearchResult[] = tagResults.map((tag) => ({
          collection_id: tag.collection_id,
          artist: tag.inventory?.release?.master?.artist?.name || 'Unknown Artist',
          album_title: tag.inventory?.release?.master?.title || 'Unknown Album',
          track_title: tag.track_title,
          track_position: tag.track_position,
          genius_url: tag.genius_url,
          image_url: tag.inventory?.release?.master?.cover_image_url || null
        }));

        return NextResponse.json({
          success: true,
          cached: true,
          term: body.term,
          results,
          count: results.length
        });
      }
      console.log(`ℹ️ No cache, starting fresh search...`);
    }

    // Get albums with tracklists
    console.log(`📀 Querying albums...`);
    let query = supabase
      .from('inventory')
      .select(`
        id,
        location,
        release:releases (
          master:masters (
            title,
            cover_image_url,
            artist:artists (name)
          ),
          release_tracks:release_tracks (
            position,
            recording:recordings (
              title,
              credits
            )
          )
        )
      `);

    if (body.folder) {
      query = query.eq('location', body.folder);
    }

    const { data: albums, error: albumError } = await query;

    if (albumError) {
      console.error(`❌ Database error:`, albumError);
      return NextResponse.json({ error: albumError.message }, { status: 500 });
    }

    if (!albums || albums.length === 0) {
      console.log(`⚠️ No albums found`);
      return NextResponse.json({
        success: true,
        cached: false,
        term: body.term,
        results: [],
        count: 0,
        message: 'No albums with tracklists found'
      });
    }

    console.log(`📀 Found ${albums.length} albums to search`);

    const results: SearchResult[] = [];
    const tagsToInsert: TagInsert[] = [];
    let tracksWithUrls = 0;
    let successfulFetches = 0;
    let failedFetches = 0;
    let tracksMatched = 0;

    for (const album of albums) {
      const release = album.release;
      const master = release?.master;
      const artistName = master?.artist?.name ?? 'Unknown Artist';
      const albumTitle = master?.title ?? 'Unknown Album';

      console.log(`\n📀 Album ${album.id}: ${artistName} - ${albumTitle}`);
      try {
        const tracklists: Track[] = (release?.release_tracks ?? []).map((track) => {
          const credits = (track.recording?.credits && typeof track.recording.credits === 'object' && !Array.isArray(track.recording.credits))
            ? (track.recording.credits as Record<string, unknown>)
            : {};
          return {
            position: track.position || null,
            title: track.recording?.title || '',
            lyrics_url: (credits as Record<string, unknown>).lyrics_url as string | undefined
          };
        });

        for (const track of tracklists) {
          if (!track.lyrics_url || !track.title) {
            continue;
          }

          tracksWithUrls++;
          console.log(`\n  🎵 ${track.title}`);
          
          const lyrics = await fetchLyricsFromGeniusUrl(track.lyrics_url);
          
          if (!lyrics) {
            failedFetches++;
            continue;
          }

          successfulFetches++;

          if (containsTerm(lyrics, searchTerm)) {
            console.log(`  ✅ MATCH!`);
            tracksMatched++;
            results.push({
              collection_id: album.id,
              artist: artistName,
              album_title: albumTitle,
              track_title: track.title,
              track_position: track.position || null,
              genius_url: track.lyrics_url,
              image_url: master?.cover_image_url || null
            });

            tagsToInsert.push({
              collection_id: album.id,
              track_title: track.title,
              track_position: track.position || null,
              search_term: searchTerm,
              genius_url: track.lyrics_url
            });
          }

          await sleep(1000);
        }
      } catch (error) {
        console.error(`❌ Error processing album ${album.id}:`, error);
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Albums: ${albums.length}`);
    console.log(`   Tracks with URLs: ${tracksWithUrls}`);
    console.log(`   Successful fetches: ${successfulFetches}`);
    console.log(`   Failed fetches: ${failedFetches}`);
    console.log(`   Matches: ${tracksMatched}`);

    // Show warning if most fetches failed
    let message = `Scanned ${tracksWithUrls} tracks, found ${tracksMatched} matches.`;
    if (failedFetches > successfulFetches) {
      message = `⚠️ Warning: Failed to fetch lyrics from ${failedFetches}/${tracksWithUrls} tracks. Found ${tracksMatched} matches from ${successfulFetches} successful fetches.`;
    }

    // Cache results
    if (tagsToInsert.length > 0) {
      console.log(`💾 Caching ${tagsToInsert.length} results...`);
      const { error: insertError } = await supabase
        .from('lyric_search_tags')
        .insert(tagsToInsert);

      if (insertError) {
        console.error('⚠️ Cache error:', insertError);
      }
    }

    return NextResponse.json({
      success: true,
      cached: false,
      term: body.term,
      results,
      count: results.length,
      stats: {
        tracksWithUrls,
        successfulFetches,
        failedFetches,
        matches: tracksMatched
      },
      message
    });

  } catch (error) {
    console.error('❌ Search error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const term = searchParams.get('term');

    if (term) {
      const { data, error } = await supabase
        .from('lyric_search_tags')
        .select(`
          collection_id,
          track_title,
          track_position,
          genius_url,
          inventory:collection_id (
            release:releases (
              master:masters (
                title,
                cover_image_url,
                artist:artists (name)
              )
            )
          )
        `)
        .eq('search_term', term.toLowerCase());

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const tagResults = data as unknown as TagQueryResult[] || [];
      const results: SearchResult[] = tagResults.map((tag) => ({
        collection_id: tag.collection_id,
        artist: tag.inventory?.release?.master?.artist?.name || 'Unknown Artist',
        album_title: tag.inventory?.release?.master?.title || 'Unknown Album',
        track_title: tag.track_title,
        track_position: tag.track_position,
        genius_url: tag.genius_url,
        image_url: tag.inventory?.release?.master?.cover_image_url || null
      }));

      return NextResponse.json({
        term,
        results,
        count: results.length
      });
    } else {
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
    console.error('Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
