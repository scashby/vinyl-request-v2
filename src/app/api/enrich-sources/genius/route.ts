// src/app/api/enrich-sources/genius/route.ts - Genius lyrics URLs-only enrichment
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GENIUS_TOKEN = process.env.GENIUS_API_TOKEN;

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

type TrackResult = {
  position: string;
  title: string;
  success: boolean;
  lyrics_url?: string;
  error?: string;
};

async function searchLyrics(artist: string, trackTitle: string): Promise<string | null> {
  if (!GENIUS_TOKEN) {
    throw new Error('Genius token not configured');
  }

  const query = encodeURIComponent(`${artist} ${trackTitle}`);
  const searchRes = await fetch(`https://api.genius.com/search?q=${query}`, {
    headers: { 'Authorization': `Bearer ${GENIUS_TOKEN}` }
  });

  if (!searchRes.ok) {
    throw new Error(`Genius API returned ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  const hit = searchData?.response?.hits?.[0];

  if (!hit) {
    return null;
  }

  return hit.result?.url || null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { albumId } = body;

    if (!albumId) {
      return NextResponse.json({
        success: false,
        error: 'albumId required'
      }, { status: 400 });
    }

    // Get album info
    const { data: album, error: dbError } = await supabase
      .from('collection')
      .select('id, artist, title, tracklists')
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      return NextResponse.json({
        success: false,
        error: 'Album not found'
      }, { status: 404 });
    }

    // Parse tracklist
    let tracks: Track[] = [];
    if (album.tracklists) {
      try {
        tracks = typeof album.tracklists === 'string' 
          ? JSON.parse(album.tracklists)
          : album.tracklists;
      } catch {
        return NextResponse.json({
          success: false,
          error: 'Invalid tracklist format',
          data: {
            albumId: album.id,
            artist: album.artist,
            title: album.title
          }
        });
      }
    }

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No tracklist found',
        data: {
          albumId: album.id,
          artist: album.artist,
          title: album.title
        }
      });
    }

    // Enrich each track
    const trackResults: TrackResult[] = [];
    const enrichedTracks: Track[] = [];
    let enrichedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const track of tracks) {
      // Skip if no title or already has lyrics URL
      if (!track.title) {
        trackResults.push({
          position: track.position || '',
          title: '(no title)',
          success: false,
          error: 'Track has no title'
        });
        enrichedTracks.push(track);
        skippedCount++;
        continue;
      }

      if (track.lyrics_url) {
        trackResults.push({
          position: track.position || '',
          title: track.title,
          success: true,
          lyrics_url: track.lyrics_url
        });
        enrichedTracks.push(track);
        skippedCount++;
        continue;
      }

      // Search Genius
      try {
        const lyricsUrl = await searchLyrics(album.artist, track.title);

        if (lyricsUrl) {
          trackResults.push({
            position: track.position || '',
            title: track.title,
            success: true,
            lyrics_url: lyricsUrl
          });
          enrichedTracks.push({
            ...track,
            lyrics_url: lyricsUrl
          });
          enrichedCount++;
        } else {
          trackResults.push({
            position: track.position || '',
            title: track.title,
            success: false,
            error: 'No match found on Genius'
          });
          enrichedTracks.push(track);
          failedCount++;
        }

        // Rate limit: wait 1s between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        trackResults.push({
          position: track.position || '',
          title: track.title,
          success: false,
          error: error instanceof Error ? error.message : 'Search failed'
        });
        enrichedTracks.push(track);
        failedCount++;
      }
    }

    // Update database if any tracks were enriched
    if (enrichedCount > 0) {
      const { error: updateError } = await supabase
        .from('collection')
        .update({ tracklists: JSON.stringify(enrichedTracks) })
        .eq('id', albumId);

      if (updateError) {
        return NextResponse.json({
          success: false,
          error: `Database update failed: ${updateError.message}`,
          data: {
            albumId: album.id,
            artist: album.artist,
            title: album.title,
            enrichedCount,
            trackResults
          }
        }, { status: 500 });
      }
    }

    const enrichedTracksList = trackResults.filter(t => t.success && !t.error?.includes('already has'));
    const failedTracksList = trackResults.filter(t => !t.success);

    return NextResponse.json({
      success: enrichedCount > 0 || skippedCount === tracks.length,
      data: {
        albumId: album.id,
        artist: album.artist,
        title: album.title,
        totalTracks: tracks.length,
        enrichedCount,
        skippedCount,
        failedCount,
        enrichedTracks: enrichedTracksList,
        failedTracks: failedTracksList,
        allTrackResults: trackResults
      }
    });

  } catch (error) {
    console.error('Genius enrichment error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}