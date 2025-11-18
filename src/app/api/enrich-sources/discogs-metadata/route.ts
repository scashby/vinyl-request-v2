// src/app/api/enrich-sources/discogs-metadata/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidDiscogsId } from 'lib/discogs-validation';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN ?? process.env.NEXT_PUBLIC_DISCOGS_TOKEN;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type DiscogsResponse = {
  images?: Array<{ uri: string }>;
  genres?: string[];
  styles?: string[];
  tracklist?: Array<{
    position?: string;
    type_?: string;
    title?: string;
    duration?: string;
    artists?: Array<{ name: string }>;
  }>;
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

async function searchDiscogsForRelease(artist: string, title: string, year?: string): Promise<string | null> {
  const params = new URLSearchParams({
    artist,
    release_title: title,
    type: 'release',
    per_page: '1'
  });
  
  if (year) {
    params.set('year', year);
  }
  
  const url = `https://api.discogs.com/database/search?${params.toString()}`;
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'DeadwaxDialogues/1.0',
      'Authorization': `Discogs token=${DISCOGS_TOKEN}`
    }
  });
  
  if (!res.ok) {
    throw new Error(`Discogs search returned ${res.status}`);
  }
  
  const data = await res.json();
  const firstResult = data.results?.[0];
  
  if (firstResult?.id) {
    return String(firstResult.id);
  }
  
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { albumId } = body;

    console.log(`\n💿 === DISCOGS METADATA ENRICHMENT for Album ID: ${albumId} ===`);

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
      .select('id, artist, title, year, discogs_release_id, image_url, discogs_genres, discogs_styles, tracklists')
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

    let releaseId = album.discogs_release_id;
    let foundReleaseId = false;

    // Check if release ID is valid using shared validation
    const hasValidId = hasValidDiscogsId(releaseId);

    // If no valid release ID, search for it
    if (!hasValidId) {
      console.log('🔍 No valid Discogs release ID, searching...');
      releaseId = await searchDiscogsForRelease(album.artist, album.title, album.year);
      
      if (!releaseId) {
        console.log('❌ No match found on Discogs');
        return NextResponse.json({
          success: false,
          error: 'No match found on Discogs'
        }, { status: 404 });
      }
      
      console.log(`✓ Found release ID: ${releaseId}`);
      foundReleaseId = true;
    }

    // Check what needs enrichment
    const needsImage = !album.image_url;
    const needsGenres = !album.discogs_genres || album.discogs_genres.length === 0;
    const needsTracklist = !album.tracklists;

    if (!foundReleaseId && !needsImage && !needsGenres && !needsTracklist) {
      console.log('⏭️ Album already has all Discogs metadata');
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Album already has all Discogs metadata'
      });
    }

    // Fetch from Discogs
    console.log(`📀 Fetching metadata from Discogs release ${releaseId}...`);
    const discogsData = await fetchDiscogsRelease(releaseId);

    const updateData: Record<string, unknown> = {};

    if (foundReleaseId) {
      updateData.discogs_release_id = releaseId;
    }

    if (needsImage && discogsData.images && discogsData.images.length > 0) {
      updateData.image_url = discogsData.images[0].uri;
      console.log('✓ Found image');
    }

    if (needsGenres) {
      const combined = [
        ...(discogsData.genres || []),
        ...(discogsData.styles || [])
      ];
      const unique = Array.from(new Set(combined));
      
      if (unique.length > 0) {
        updateData.discogs_genres = unique;
        updateData.discogs_styles = unique;
        console.log(`✓ Found ${unique.length} genres/styles: ${unique.join(', ')}`);
      }
    }

    if (needsTracklist && discogsData.tracklist && discogsData.tracklist.length > 0) {
      const tracks = discogsData.tracklist.map(track => ({
        position: track.position || '',
        type_: track.type_ || 'track',
        title: track.title || '',
        duration: track.duration || '',
        artist: track.artists?.map(a => a.name).join(', ')
      }));
      
      updateData.tracklists = JSON.stringify(tracks);
      console.log(`✓ Found ${tracks.length} tracks`);
    }

    if (Object.keys(updateData).length === 0) {
      console.log('⚠️ No new data found to update');
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'No new data available from Discogs'
      });
    }

    // Update database
    console.log(`💾 Updating database...`);
    const { error: updateError } = await supabase
      .from('collection')
      .update(updateData)
      .eq('id', albumId);

    if (updateError) {
      console.log('❌ ERROR: Database update failed', updateError);
      return NextResponse.json({
        success: false,
        error: `Database update failed: ${updateError.message}`
      }, { status: 500 });
    }

    console.log(`✅ Successfully enriched with Discogs metadata\n`);

    return NextResponse.json({
      success: true,
      data: {
        albumId: album.id,
        artist: album.artist,
        title: album.title,
        foundReleaseId: foundReleaseId ? releaseId : undefined,
        addedImage: !!updateData.image_url,
        addedGenres: !!updateData.discogs_genres,
        addedTracklist: !!updateData.tracklists
      }
    });

  } catch (error) {
    console.error('❌ FATAL ERROR in Discogs metadata enrichment:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}