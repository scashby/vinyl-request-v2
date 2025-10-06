// src/app/api/enrich-sources/genius/route.ts - COMPLETE with logging
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
  console.log(`  → Searching Genius for: "${artist} - ${trackTitle}"`);

  const searchRes = await fetch(`https://api.genius.com/search?q=${query}`, {
    headers: { 'Authorization': `Bearer ${GENIUS_TOKEN}` }
  });

  if (!searchRes.ok) {
    console.log(`  → Genius API error: HTTP ${searchRes.status}`);
    throw new Error(`Genius API returned ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  const hit = searchData?.response?.hits?.[0];

  if (!hit) {
    console.log(`  → No results from Genius`);
    return null;
  }

  const url = hit.result?.url;
  console.log(`  → Found match: ${url}`);
  return url;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { albumId } = body;

    console.log(`\n📝 === GENIUS LYRICS REQUEST for Album ID: ${albumId} ===`);

    if (!albumId) {
      console.log('❌ ERROR: No albumId provided');
      return NextResponse.json({
        success: false,
        error: 'albumId required'
      }, { status: 400 });
    }

    const { data: album, error: dbError } = await supabase
      .from('collection')
      .select('id, artist, title, tracklists')
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      console.log('❌ ERROR: Album not found in database', dbError);
      return NextResponse.json({
        success: false,
        error: 'Album not found'
      }, { status: 404 });
    }

    console.log(`✓ Album found: "${album.artist} - ${album.title}"`);

    let tracks: Track[] = [];
    if (album.tracklists) {
      try {
        tracks = typeof album.tracklists === 'string' 
          ? JSON.parse(album.tracklists)
          : album.tracklists;
        console.log(`✓ Parsed ${tracks.length} tracks from tracklist`);
      } catch {
        console.log('❌ ERROR: Failed to parse tracklists');
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
      console.log('❌ ERROR: No tracklist found');
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

    const trackResults: TrackResult[] = [];
    const enrichedTracks: Track[] = [];
    let enrichedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    console.log(`🔍 Processing ${tracks.length} tracks...`);

    for (const track of tracks) {
      if (!track.title) {
        console.log(`⏭️  Skipping track with no title`);
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
        console.log(`⏭️  Track "${track.title}" already has lyrics URL`);
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

      try {
        const lyricsUrl = await searchLyrics(album.artist, track.title);

        if (lyricsUrl) {
          console.log(`✅ Found lyrics URL for "${track.title}"`);
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
          console.log(`❌ No lyrics found for "${track.title}"`);
          trackResults.push({
            position: track.position || '',
            title: track.title,
            success: false,
            error: 'No match found on Genius'
          });
          enrichedTracks.push(track);
          failedCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error searching for "${track.title}":`, error);
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

    console.log(`\n📊 SUMMARY: ${enrichedCount} enriched, ${skippedCount} skipped, ${failedCount} failed`);

    if (enrichedCount > 0) {
      console.log(`💾 Updating database with enriched tracklist...`);
      const { error: updateError } = await supabase
        .from('collection')
        .update({ tracklists: JSON.stringify(enrichedTracks) })
        .eq('id', albumId);

      if (updateError) {
        console.log('❌ ERROR: Database update failed', updateError);
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

      console.log(`✅ Database updated successfully\n`);
    } else {
      console.log(`ℹ️  No tracks enriched, skipping database update\n`);
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
    console.error('❌ FATAL ERROR in Genius enrichment:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}