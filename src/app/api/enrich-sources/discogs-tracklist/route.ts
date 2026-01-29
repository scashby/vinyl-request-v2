// src/app/api/enrich-sources/discogs-tracklist/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN ?? process.env.NEXT_PUBLIC_DISCOGS_TOKEN;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type DiscogsTrack = {
  position?: string;
  type_?: string;
  title?: string;
  duration?: string;
  artists?: Array<{ name: string; id?: number; join?: string }>;
  extraartists?: Array<{ name: string; role?: string; id?: number }>;
};

type DiscogsResponse = {
  tracklist?: DiscogsTrack[];
  genres?: string[];
  styles?: string[];
};

async function fetchDiscogsRelease(releaseId: string): Promise<DiscogsResponse> {
  const url = `https://api.discogs.com/releases/${releaseId}`;
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'DeadwaxDialogues/1.0',
      'Authorization': `Discogs token=${DISCOGS_TOKEN}`
    }
  });
  
  if (!res.ok) {
    throw new Error(`Discogs API returned ${res.status}`);
  }
  
  return await res.json();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { albumId } = body;

    console.log(`\n💿 === DISCOGS TRACKLIST ENRICHMENT for Album ID: ${albumId} ===`);

    if (!albumId) {
      console.log('❌ ERROR: No albumId provided');
      return NextResponse.json({
        success: false,
        error: 'albumId required'
      }, { status: 400 });
    }

    if (!DISCOGS_TOKEN) {
      console.log('❌ ERROR: DISCOGS_TOKEN not configured');
      return NextResponse.json({
        success: false,
        error: 'Discogs token not configured'
      }, { status: 500 });
    }

    // Get album info
    const { data: album, error: dbError } = await supabase
      .from('collection')
      .select('id, artist, title, discogs_release_id, tracks')
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

    if (!album.discogs_release_id) {
      console.log('❌ ERROR: No Discogs Release ID');
      return NextResponse.json({
        success: false,
        error: 'Album has no Discogs Release ID'
      }, { status: 400 });
    }

    // Check if already has tracks with artist info
    if (album.tracks) {
      try {
        const existingTracks = JSON.parse(album.tracks);
        if (Array.isArray(existingTracks) && existingTracks.length > 0) {
          const hasArtistData = existingTracks.some(t => t.artist && t.artist !== album.artist);
          if (hasArtistData) {
            console.log('⏭️ Album already has per-track artist data');
            return NextResponse.json({
              success: true,
              skipped: true,
              message: 'Album already has per-track artist data'
            });
          }
        }
      } catch {
        // Continue if parse fails
      }
    }

    // Fetch from Discogs
    console.log(`🔍 Fetching tracklist from Discogs release ${album.discogs_release_id}...`);
    
    const discogsData = await fetchDiscogsRelease(album.discogs_release_id);
    
    if (!discogsData.tracklist || discogsData.tracklist.length === 0) {
      console.log('❌ No tracklist found on Discogs');
      return NextResponse.json({
        success: false,
        error: 'No tracklist found on Discogs'
      }, { status: 404 });
    }

    console.log(`✓ Found ${discogsData.tracklist.length} tracks`);

    // Process tracks with per-track artist info
    const enrichedTracks = discogsData.tracklist.map((track: DiscogsTrack) => {
      let trackArtist = undefined;
      
      // Extract artist from track-level artists field
      if (track.artists && track.artists.length > 0) {
        trackArtist = track.artists.map(a => a.name).join(', ');
      }
      
      return {
        position: track.position || '',
        type_: track.type_ || 'track',
        title: track.title || '',
        duration: track.duration || '',
        artist: trackArtist
      };
    });

    const tracksWithArtists = enrichedTracks.filter(t => t.artist).length;
    console.log(`✓ ${tracksWithArtists}/${enrichedTracks.length} tracks have artist info`);

    // Update database
    console.log(`💾 Updating database...`);
    const { error: updateError } = await supabase
      .from('collection')
      .update({
        tracks: JSON.stringify(enrichedTracks)
      })
      .eq('id', albumId);

    if (updateError) {
      console.log('❌ ERROR: Database update failed', updateError);
      return NextResponse.json({
        success: false,
        error: `Database update failed: ${updateError.message}`
      }, { status: 500 });
    }

    console.log(`✅ Successfully enriched tracklist\n`);

    return NextResponse.json({
      success: true,
      data: {
        albumId: album.id,
        artist: album.artist,
        title: album.title,
        totalTracks: enrichedTracks.length,
        tracksWithArtists
      }
    });

  } catch (error) {
    console.error('❌ FATAL ERROR in Discogs tracklist enrichment:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
