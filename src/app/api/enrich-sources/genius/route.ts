// src/app/api/enrich-sources/genius/route.ts - FIXED with proper matching validation
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

function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function isGoodMatch(searchArtist: string, searchTrack: string, resultArtist: string, resultTrack: string): boolean {
  const normSearchArtist = normalizeForMatch(searchArtist);
  const normSearchTrack = normalizeForMatch(searchTrack);
  const normResultArtist = normalizeForMatch(resultArtist);
  const normResultTrack = normalizeForMatch(resultTrack);

  // Artist must match (exact or one contains the other)
  const artistMatch = 
    normSearchArtist === normResultArtist ||
    normSearchArtist.includes(normResultArtist) ||
    normResultArtist.includes(normSearchArtist);

  if (!artistMatch) {
    console.log(`    ❌ Artist mismatch: "${searchArtist}" vs "${resultArtist}"`);
    return false;
  }

  // Track title must match (exact or one contains the other)
  const trackMatch = 
    normSearchTrack === normResultTrack ||
    normSearchTrack.includes(normResultTrack) ||
    normResultTrack.includes(normSearchTrack);

  if (!trackMatch) {
    console.log(`    ❌ Track mismatch: "${searchTrack}" vs "${resultTrack}"`);
    return false;
  }

  console.log(`    ✅ Good match: "${resultArtist}" - "${resultTrack}"`);
  return true;
}

async function searchLyrics(albumArtist: string, trackTitle: string): Promise<string | null> {
  if (!GENIUS_TOKEN) {
    throw new Error('Genius token not configured');
  }

  const query = encodeURIComponent(`${albumArtist} ${trackTitle}`);
  console.log(`    → Searching Genius: "${albumArtist}" - "${trackTitle}"`);
  
  const searchRes = await fetch(`https://api.genius.com/search?q=${query}`, {
    headers: { 'Authorization': `Bearer ${GENIUS_TOKEN}` }
  });

  if (!searchRes.ok) {
    console.log(`    → Genius search failed: HTTP ${searchRes.status}`);
    throw new Error(`Genius API returned ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  const hits = searchData?.response?.hits || [];

  if (hits.length === 0) {
    console.log(`    → No Genius results found`);
    return null;
  }

  console.log(`    → Got ${hits.length} search results, validating...`);

  // Check each result until we find a good match
  for (const hit of hits) {
    const result = hit.result;
    if (!result) continue;

    const resultArtist = result.primary_artist?.name || result.artist_names || '';
    const resultTrack = result.title || '';
    const url = result.url;

    console.log(`    🔍 Checking: "${resultArtist}" - "${resultTrack}"`);

    if (isGoodMatch(albumArtist, trackTitle, resultArtist, resultTrack)) {
      console.log(`    ✅ Found validated match: ${url}`);
      return url;
    }
  }

  console.log(`    ❌ No validated matches found among ${hits.length} results`);
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { albumId } = body;

    console.log(`\n📝 === GENIUS LYRICS ENRICHMENT for Album ID: ${albumId} ===`);

    if (!albumId) {
      console.log('❌ ERROR: No albumId provided');
      return NextResponse.json({
        success: false,
        error: 'albumId required'
      }, { status: 400 });
    }

    const { data: album, error: dbError } = await supabase
      .from('collection_v2_archive')
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

    console.log(`✓ Album found: "${album.artist}" - "${album.title}"`);

    let tracks: Track[] = [];
    if (album.tracklists) {
      try {
        tracks = typeof album.tracklists === 'string' 
          ? JSON.parse(album.tracklists)
          : album.tracklists;
        console.log(`✓ Parsed ${tracks.length} tracks from tracklist`);
      } catch (err) {
        console.log('❌ ERROR: Invalid tracklist format', err);
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

    console.log(`\n🔍 Processing ${tracks.length} tracks...`);
    const enrichedTracks: Track[] = [];
    let enrichedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const enrichedTracksList = [];
    const failedTracksList = [];

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      console.log(`\n  Track ${i + 1}/${tracks.length}: "${track.title || 'untitled'}"`);

      if (!track.title) {
        console.log(`    ⏭️ Skipping: No title`);
        enrichedTracks.push(track);
        skippedCount++;
        continue;
      }

      if (track.lyrics_url) {
        console.log(`    ⏭️ Skipping: Already has lyrics URL`);
        enrichedTracks.push(track);
        skippedCount++;
        continue;
      }

      try {
        const lyricsUrl = await searchLyrics(album.artist, track.title);

        if (lyricsUrl) {
          console.log(`    ✅ Found validated lyrics URL`);
          enrichedTracks.push({
            ...track,
            lyrics_url: lyricsUrl
          });
          enrichedCount++;
          enrichedTracksList.push({
            position: track.position || '',
            title: track.title,
            lyrics_url: lyricsUrl
          });
        } else {
          console.log(`    ❌ No validated match found`);
          enrichedTracks.push(track);
          failedCount++;
          failedTracksList.push({
            position: track.position || '',
            title: track.title,
            error: 'No validated match found on Genius'
          });
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Search failed';
        console.log(`    ❌ Error: ${errorMsg}`);
        enrichedTracks.push(track);
        failedCount++;
        failedTracksList.push({
          position: track.position || '',
          title: track.title,
          error: errorMsg
        });
      }
    }

    console.log(`\n📊 SUMMARY: ${enrichedCount} enriched, ${skippedCount} skipped, ${failedCount} failed`);

    if (enrichedCount > 0) {
      console.log(`💾 Updating database...`);
      const { error: updateError } = await supabase
        .from('collection_v2_archive')
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
            enrichedCount
          }
        }, { status: 500 });
      }
      console.log(`✅ Database updated successfully`);
    }

    console.log(`✅ Genius enrichment complete\n`);

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
        failedTracks: failedTracksList
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