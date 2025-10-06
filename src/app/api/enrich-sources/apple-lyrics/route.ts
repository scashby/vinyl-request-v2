// src/app/api/fetch-apple-lyrics/route.ts - NEW FILE
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

  const res = await fetch(
    `https://api.music.apple.com/v1/catalog/us/albums/${albumId}/tracks`,
    {
      headers: {
        'Authorization': `Bearer ${APPLE_MUSIC_TOKEN}`,
        'Music-User-Token': '' // Optional: for user-specific content
      }
    }
  );

  if (!res.ok) {
    throw new Error(`Apple Music API error: ${res.status}`);
  }

  const data = await res.json();
  return data.data || [];
}

async function fetchTrackLyrics(trackId: string): Promise<string | null> {
  if (!APPLE_MUSIC_TOKEN) {
    return null;
  }

  try {
    const res = await fetch(
      `https://api.music.apple.com/v1/catalog/us/songs/${trackId}/lyrics`,
      {
        headers: {
          'Authorization': `Bearer ${APPLE_MUSIC_TOKEN}`
        }
      }
    );

    if (!res.ok) {
      console.log(`No lyrics for track ${trackId}: ${res.status}`);
      return null;
    }

    const data = await res.json() as AppleLyricsResponse;
    const ttml = data?.data?.[0]?.attributes?.ttml;

    if (!ttml) {
      return null;
    }

    return parseTTML(ttml);
  } catch (error) {
    console.error(`Error fetching lyrics for track ${trackId}:`, error);
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

  // Exact match
  if (existingTitle === appleTitle) return true;

  // Partial match (for cases like "Song Title (Remastered)")
  if (existingTitle.includes(appleTitle) || appleTitle.includes(existingTitle)) {
    return true;
  }

  return false;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { albumId } = body;

    if (!albumId) {
      return NextResponse.json(
        { success: false, error: 'albumId required' },
        { status: 400 }
      );
    }

    if (!APPLE_MUSIC_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Apple Music token not configured' },
        { status: 500 }
      );
    }

    // Get the album from database
    const { data: album, error: dbError } = await supabase
      .from('collection')
      .select('id, apple_music_id, tracklists')
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      return NextResponse.json(
        { success: false, error: 'Album not found' },
        { status: 404 }
      );
    }

    if (!album.apple_music_id) {
      return NextResponse.json(
        { success: false, error: 'Album has no Apple Music ID' },
        { status: 400 }
      );
    }

    // Parse existing tracklist
    let existingTracks: Track[] = [];
    if (album.tracklists) {
      try {
        const parsed = typeof album.tracklists === 'string'
          ? JSON.parse(album.tracklists)
          : album.tracklists;
        existingTracks = Array.isArray(parsed) ? parsed : [];
      } catch {
        existingTracks = [];
      }
    }

    if (existingTracks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No tracklist found to enrich' },
        { status: 400 }
      );
    }

    console.log(`\n🍎 Fetching Apple Music tracks for album ${album.apple_music_id}...`);

    // Fetch Apple Music tracks
    const appleTracks = await fetchAppleAlbumTracks(album.apple_music_id);
    
    if (appleTracks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No tracks found on Apple Music' },
        { status: 404 }
      );
    }

    console.log(`✅ Found ${appleTracks.length} tracks on Apple Music`);

    let lyricsFound = 0;
    let lyricsNotFound = 0;

    // Match and enrich tracks
    const enrichedTracks = await Promise.all(
      existingTracks.map(async (track, index) => {
        // Skip if already has Apple Music lyrics
        if (track.lyrics && track.lyrics_source === 'apple_music') {
          console.log(`⏭️  Track ${index + 1}: Already has Apple Music lyrics`);
          return track;
        }

        // Try to find matching Apple track
        const appleTrack = appleTracks.find(at => matchTrackByTitle(track, at));

        if (!appleTrack) {
          console.log(`⚠️  Track ${index + 1}: No match found for "${track.title}"`);
          lyricsNotFound++;
          return track;
        }

        console.log(`🔍 Track ${index + 1}: Fetching lyrics for "${track.title}"...`);

        // Fetch lyrics for this track
        const lyrics = await fetchTrackLyrics(appleTrack.id);

        // Rate limit: wait 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500));

        if (lyrics) {
          console.log(`✅ Track ${index + 1}: Found lyrics (${lyrics.length} chars)`);
          lyricsFound++;
          return {
            ...track,
            lyrics,
            lyrics_source: 'apple_music' as const
          };
        } else {
          console.log(`❌ Track ${index + 1}: No lyrics available`);
          lyricsNotFound++;
          return track;
        }
      })
    );

    // Update database
    const { error: updateError } = await supabase
      .from('collection')
      .update({
        tracklists: JSON.stringify(enrichedTracks)
      })
      .eq('id', albumId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: `Database update failed: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log(`\n📊 Summary: ${lyricsFound} lyrics found, ${lyricsNotFound} not available`);

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
    console.error('Apple Music lyrics fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}