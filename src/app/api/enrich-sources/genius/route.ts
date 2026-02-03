// src/app/api/enrich-sources/genius/route.ts - FIXED with proper matching validation
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GENIUS_TOKEN = process.env.GENIUS_API_TOKEN;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

type Track = {
  position?: string;
  title?: string;
  recording_id?: number | null;
  credits?: Record<string, unknown> | null;
};

const normalizeCredits = (credits: unknown) => {
  if (!credits || typeof credits !== 'object' || Array.isArray(credits)) return {};
  return credits as Record<string, unknown>;
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
      .from('inventory')
      .select(`
        id,
        release:releases (
          id,
          master:masters (
            title,
            artist:artists (name)
          ),
          release_tracks:release_tracks (
            position,
            recording_id,
            title_override,
            recording:recordings (
              id,
              title,
              credits
            )
          )
        )
      `)
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      console.log('❌ ERROR: Album not found in database', dbError);
      return NextResponse.json({
        success: false,
        error: 'Album not found'
      }, { status: 404 });
    }

    const release = toSingle(album.release);
    const master = toSingle(release?.master);
    const artistName = toSingle(master?.artist)?.name ?? 'Unknown Artist';
    const albumTitle = master?.title ?? 'Untitled';

    console.log(`✓ Album found: "${artistName}" - "${albumTitle}"`);

    const tracks: Track[] = (release?.release_tracks ?? []).map((track) => {
      const recording = toSingle(track.recording);
      return {
        position: track.position,
        title: track.title_override || recording?.title || '',
        recording_id: track.recording_id ?? recording?.id ?? null,
        credits: normalizeCredits(recording?.credits ?? null)
      };
    });

    if (!Array.isArray(tracks) || tracks.length === 0) {
      console.log('❌ ERROR: No tracklist found');
      return NextResponse.json({
        success: false,
        error: 'No tracklist found',
        data: {
          albumId: album.id,
          artist: artistName,
          title: albumTitle
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

      if (track.credits?.lyrics_url) {
        console.log(`    ⏭️ Skipping: Already has lyrics URL`);
        enrichedTracks.push(track);
        skippedCount++;
        continue;
      }

      try {
        const lyricsUrl = await searchLyrics(artistName, track.title);

        if (lyricsUrl) {
          console.log(`    ✅ Found validated lyrics URL`);
          enrichedTracks.push({
            ...track,
            credits: {
              ...track.credits,
              lyrics_url: lyricsUrl,
              lyrics_source: 'genius'
            }
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
      for (const track of enrichedTracks) {
        if (!track.recording_id || !track.credits?.lyrics_url) continue;
        const { error: updateError } = await supabase
          .from('recordings')
          .update({ credits: track.credits })
          .eq('id', track.recording_id);

        if (updateError) {
          console.log('❌ ERROR: Database update failed', updateError);
          return NextResponse.json({
            success: false,
            error: `Database update failed: ${updateError.message}`,
            data: {
              albumId: album.id,
              artist: artistName,
              title: albumTitle,
              enrichedCount
            }
          }, { status: 500 });
        }
      }
      console.log(`✅ Database updated successfully`);
    }

    console.log(`✅ Genius enrichment complete\n`);

    return NextResponse.json({
      success: enrichedCount > 0 || skippedCount === tracks.length,
      data: {
        albumId: album.id,
        artist: artistName,
        title: albumTitle,
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
