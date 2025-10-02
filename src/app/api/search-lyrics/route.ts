// src/app/api/search-lyrics/route.ts - Clean version without duplicates
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
  folder?: string;
  forceRefresh?: boolean;
};

async function fetchLyricsFromGeniusUrl(url: string): Promise<string | null> {
  try {
    console.log(`📥 Fetching lyrics from: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`❌ HTTP ${response.status} for ${url}`);
      return null;
    }
    
    const html = await response.text();
    console.log(`✅ Fetched ${html.length} characters of HTML`);
    
    let lyrics = '';
    
    // Pattern 1: data-lyrics-container
    const containerPattern = /data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi;
    let matches = html.match(containerPattern);
    
    if (matches && matches.length > 0) {
      console.log(`✅ Found ${matches.length} lyrics sections using data-lyrics-container`);
      lyrics = matches
        .map(match => {
          return match
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .trim();
        })
        .join('\n');
    }
    
    // Pattern 2: Lyrics__Container
    if (!lyrics) {
      console.log(`⚠️ Trying alternative pattern: Lyrics__Container`);
      const altPattern = /<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      matches = html.match(altPattern);
      
      if (matches && matches.length > 0) {
        console.log(`✅ Found ${matches.length} sections using Lyrics__Container`);
        lyrics = matches
          .map(match => {
            return match
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<[^>]+>/g, '')
              .trim();
          })
          .join('\n');
      }
    }
    
    // Pattern 3: JSON-LD structured data
    if (!lyrics) {
      console.log(`⚠️ Trying JSON-LD pattern`);
      const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
      const jsonMatches = html.match(jsonLdPattern);
      
      if (jsonMatches) {
        for (const jsonMatch of jsonMatches) {
          try {
            const jsonText = jsonMatch.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
            const data = JSON.parse(jsonText);
            if (data['@type'] === 'MusicRecording' && data.lyrics) {
              lyrics = data.lyrics;
              console.log(`✅ Found lyrics in JSON-LD`);
              break;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
    
    if (!lyrics) {
      console.log(`❌ No lyrics found using any pattern for ${url}`);
      return null;
    }
    
    lyrics = lyrics
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    lyrics = lyrics
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
    
    console.log(`✅ Extracted ${lyrics.length} characters of clean lyrics`);
    console.log(`📝 First 100 chars: "${lyrics.substring(0, 100)}..."`);
    return lyrics;
    
  } catch (error) {
    console.error(`❌ Error fetching lyrics from ${url}:`, error);
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
      console.log(`📋 Checking for cached results...`);
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
        console.log(`✅ Found ${existingTags.length} cached results`);
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
      console.log(`ℹ️ No cached results, starting fresh search...`);
    }

    // Get albums with tracklists
    console.log(`📀 Querying albums with tracklists...`);
    let query = supabase
      .from('collection')
      .select('id, artist, title, image_url, folder, tracklists')
      .not('tracklists', 'is', null);

    if (body.folder) {
      query = query.eq('folder', body.folder);
    }

    const { data: albums, error: albumError } = await query;

    if (albumError) {
      console.error(`❌ Database error:`, albumError);
      return NextResponse.json({ error: albumError.message }, { status: 500 });
    }

    if (!albums || albums.length === 0) {
      console.log(`⚠️ No albums with tracklists found`);
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
    let processedCount = 0;
    let tracksWithLyrics = 0;
    let tracksFetched = 0;
    let tracksMatched = 0;

    for (const album of albums) {
      console.log(`\n📀 Album ${album.id}: ${album.artist} - ${album.title}`);
      try {
        const tracklists: Track[] = typeof album.tracklists === 'string'
          ? JSON.parse(album.tracklists) as Track[]
          : album.tracklists as Track[];

        if (!Array.isArray(tracklists)) {
          console.log(`⚠️ Invalid tracklists format`);
          continue;
        }

        console.log(`📝 Album has ${tracklists.length} tracks`);

        for (const track of tracklists) {
          if (!track.lyrics_url || !track.title) {
            continue;
          }

          tracksWithLyrics++;
          processedCount++;
          
          console.log(`\n  🎵 Track: ${track.title}`);
          console.log(`  🔗 URL: ${track.lyrics_url}`);
          
          const lyrics = await fetchLyricsFromGeniusUrl(track.lyrics_url);
          tracksFetched++;
          
          if (!lyrics) {
            console.log(`  ❌ Failed to fetch lyrics`);
            continue;
          }

          if (containsTerm(lyrics, searchTerm)) {
            console.log(`  ✅ MATCH FOUND!`);
            tracksMatched++;
            results.push({
              collection_id: album.id,
              artist: album.artist,
              album_title: album.title,
              track_title: track.title,
              track_position: track.position || null,
              genius_url: track.lyrics_url,
              image_url: album.image_url
            });

            tagsToInsert.push({
              collection_id: album.id,
              track_title: track.title,
              track_position: track.position || null,
              search_term: searchTerm,
              genius_url: track.lyrics_url
            });
          } else {
            console.log(`  ❌ No match`);
          }

          await sleep(1000);
        }
      } catch (error) {
        console.error(`❌ Error processing album ${album.id}:`, error);
      }
    }

    console.log(`\n📊 SEARCH SUMMARY:`);
    console.log(`   Albums scanned: ${albums.length}`);
    console.log(`   Tracks with lyrics URLs: ${tracksWithLyrics}`);
    console.log(`   Lyrics fetched successfully: ${tracksFetched}`);
    console.log(`   Matches found: ${tracksMatched}`);

    // Cache results
    if (tagsToInsert.length > 0) {
      console.log(`💾 Caching ${tagsToInsert.length} results...`);
      const { error: insertError } = await supabase
        .from('lyric_search_tags')
        .insert(tagsToInsert);

      if (insertError) {
        console.error('⚠️ Error caching results:', insertError);
      } else {
        console.log(`✅ Results cached successfully`);
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
    console.error('❌ Lyric search error:', error);
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