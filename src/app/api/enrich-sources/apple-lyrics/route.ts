// src/app/api/enrich-sources/apple-lyrics/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APPLE_MUSIC_TOKEN = process.env.APPLE_MUSIC_TOKEN;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type Track = {
  position?: string;
  title?: string;
  duration?: string;
  type_?: string;
  lyrics_url?: string;
  lyrics?: string;
  lyrics_source?: 'apple_music' | 'genius';
};

type AppleTrack = {
  id: string;
  attributes: {
    name: string;
    trackNumber?: number;
    discNumber?: number;
    durationInMillis?: number;
  };
};

type AppleLyricsResponse = {
  data: [{
    attributes: {
      ttml?: string;
    };
  }];
};

function parseTTML(ttml: string): string {
  // Apple Music lyrics are in TTML (Timed Text Markup Language) format
  // Extract just the text content, removing timestamps and XML tags
  
  // Remove XML declaration and TTML wrapper
  let text = ttml.replace(/<\?xml[^?]*\?>/g, '');
  text = text.replace(/<tt[^>]*>/g, '').replace(/<\/tt>/g, '');
  text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/g, '');
  text = text.replace(/<body[^>]*>/g, '').replace(/<\/body>/g, '');
  text = text.replace(/<div[^>]*>/g, '').replace(/<\/div>/g, '');
  
  // Extract text from <p> tags (each line of lyrics)
  const lines: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  
  while ((match = pRegex.exec(text)) !== null) {
    let line = match[1];
    // Remove <span> tags but keep content
    line = line.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '');
    // Clean up whitespace
    line = line.trim();
    if (line) {
      lines.push(line);
    }
  }
  
  return lines.join('\n');
}

async function fetchAppleAlbumTracks(albumId: string): Promise<AppleTrack[]> {
  if (!APPLE_MUSIC_TOKEN) {
    throw new Error('Missing Apple Music token');
  }

  console.log(`  → Fetching tracks for Apple Music album: ${albumId}`);

  const res = await fetch(
    `https://api.music.apple.com/v1/catalog/us/albums/${albumId}/tracks`,
    {
      headers: {
        'Authorization': `Bearer ${APPLE_MUSIC_TOKEN}`,
        'Music-User-Token': ''
      }
    }
  );

  if (!res.ok) {
    console.log(`  → Apple API error: HTTP ${res.status}`);
    throw new Error(`Apple Music API error: ${res.status}`);
  }

  const data = await res.json();
  console.log(`  → Got ${data.data?.length || 0} tracks from Apple Music API`);
  return data.data || [];
}

async function fetchTrackLyrics(trackId: string): Promise<string | null> {
  if (!APPLE_MUSIC_TOKEN) {
    return null;
  }

  try {
    console.log(`  → Fetching lyrics for track ID: ${trackId}`);
    const res = await fetch(
      `https://api.music.apple.com/v1/catalog/us/songs/${trackId}/lyrics`,
      {
        headers: {
          'Authorization': `Bearer ${APPLE_MUSIC_TOKEN}`
        }
      }
    );

    if (!res.ok) {
      console.log(`  → Apple API returned ${res.status} for track ${trackId}`);
      return null;
    }

    const data = await res.json() as AppleLyricsResponse;
    const ttml = data?.data?.[0]?.attributes?.ttml;

    if (!ttml) {
      console.log(`  → No TTML data in response for track ${trackId}`);
      return null;
    }

    console.log(`  → Got TTML data (${ttml.length} chars), parsing...`);
    const parsed = parseTTML(ttml);
    console.log(`  → Parsed to ${parsed.length} chars of lyrics`);
    return parsed;
  } catch (error) {
    console.error(`  → ERROR fetching lyrics for track ${trackId}:`, error);
    return null;
  }
}

function matchTrackByTitle(
  existingTrack: Track,
  appleTrack: AppleTrack
): boolean {
  const normalize = (str: string) => 
    str.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();

  const existingTitle = normalize(existingTrack.title || '');
  const appleTitle = normalize(appleTrack.attributes.name);

  const exactMatch = existingTitle === appleTitle;
  const partialMatch = existingTitle.includes(appleTitle) || appleTitle.includes(existingTitle);

  if (!exactMatch && !partialMatch) {
    console.log(`  → No match: "${existingTrack.title}" vs "${appleTrack.attributes.name}"`);
  }

  return exactMatch || partialMatch;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { albumId } = body;

    console.log(`\n🍎 === APPLE LYRICS REQUEST for Album ID: ${albumId} ===`);

    if (!albumId) {
      console.log('❌ ERROR: No albumId provided');
      return NextResponse.json(
        { success: false, error: 'albumId required' },
        { status: 400 }
      );
    }

    if (!APPLE_MUSIC_TOKEN) {
      console.log('❌ ERROR: APPLE_MUSIC_TOKEN not configured');
      return NextResponse.json(
        { success: false, error: 'Apple Music token not configured' },
        { status: 500 }
      );
    }

    const { data: album, error: dbError } = await supabase
      .from('collection')
      .select('id, apple_music_id, tracklists')
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      console.log('❌ ERROR: Album not found in database', dbError);
      return NextResponse.json(
        { success: false, error: 'Album not found' },
        { status: 404 }
      );
    }

    console.log(`✓ Album found: ID=${album.id}, Apple Music ID=${album.apple_music_id}`);

    if (!album.apple_music_id) {
      console.log('❌ ERROR: Album has no Apple Music ID');
      return NextResponse.json(
        { success: false, error: 'Album has no Apple Music ID' },
        { status: 400 }
      );
    }

    let existingTracks: Track[] = [];
    if (album.tracklists) {
      try {
        const parsed = typeof album.tracklists === 'string'
          ? JSON.parse(album.tracklists)
          : album.tracklists;
        existingTracks = Array.isArray(parsed) ? parsed : [];
        console.log(`✓ Parsed ${existingTracks.length} existing tracks`);
      } catch (err) {
        console.log('❌ ERROR: Failed to parse tracklists', err);
        existingTracks = [];
      }
    }

    if (existingTracks.length === 0) {
      console.log('❌ ERROR: No tracklist found to enrich');
      return NextResponse.json(
        { success: false, error: 'No tracklist found to enrich' },
        { status: 400 }
      );
    }

    console.log(`🔍 Fetching Apple Music tracks for album ${album.apple_music_id}...`);

    const appleTracks = await fetchAppleAlbumTracks(album.apple_music_id);
    
    if (appleTracks.length === 0) {
      console.log('❌ ERROR: No tracks found on Apple Music');
      return NextResponse.json(
        { success: false, error: 'No tracks found on Apple Music' },
        { status: 404 }
      );
    }

    console.log(`✓ Found ${appleTracks.length} tracks on Apple Music`);
    console.log(`📋 Sample existing track: "${existingTracks[0]?.title}"`);
    console.log(`📋 Sample Apple track: "${appleTracks[0]?.attributes?.name}"`);

    let lyricsFound = 0;
    let lyricsNotFound = 0;

    const enrichedTracks = await Promise.all(
      existingTracks.map(async (track, index) => {
        if (track.lyrics && track.lyrics_source === 'apple_music') {
          console.log(`⏭️  Track ${index + 1}/${existingTracks.length}: "${track.title}" - Already has Apple Music lyrics`);
          return track;
        }

        const appleTrack = appleTracks.find(at => matchTrackByTitle(track, at));

        if (!appleTrack) {
          console.log(`⚠️  Track ${index + 1}/${existingTracks.length}: "${track.title}" - No Apple Music match found`);
          lyricsNotFound++;
          return track;
        }

        console.log(`🔍 Track ${index + 1}/${existingTracks.length}: "${track.title}" - Fetching lyrics (Apple ID: ${appleTrack.id})...`);

        const lyrics = await fetchTrackLyrics(appleTrack.id);
        await new Promise(resolve => setTimeout(resolve, 500));

        if (lyrics) {
          console.log(`✅ Track ${index + 1}/${existingTracks.length}: Found lyrics (${lyrics.length} chars)`);
          lyricsFound++;
          return {
            ...track,
            lyrics,
            lyrics_source: 'apple_music' as const
          };
        } else {
          console.log(`❌ Track ${index + 1}/${existingTracks.length}: No lyrics available from Apple`);
          lyricsNotFound++;
          return track;
        }
      })
    );

    console.log(`\n📊 SUMMARY: ${lyricsFound} lyrics found, ${lyricsNotFound} not available`);

    const { error: updateError } = await supabase
      .from('collection')
      .update({
        tracklists: JSON.stringify(enrichedTracks)
      })
      .eq('id', albumId);

    if (updateError) {
      console.log('❌ ERROR: Database update failed', updateError);
      return NextResponse.json(
        { success: false, error: `Database update failed: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log(`✅ Database updated successfully\n`);

    return NextResponse.json({
      success: true,
      enriched: true,
      stats: {
        totalTracks: existingTracks.length,
        lyricsFound,
        lyricsNotFound
      },
      message: `Found lyrics for ${lyricsFound} out of ${existingTracks.length} tracks`
    });

  } catch (error) {
    console.error('❌ FATAL ERROR in Apple Music lyrics fetch:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}