// src/app/api/enrich-sources/discogs-metadata/route.ts - FIXED TO FETCH MASTER IDS
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidDiscogsId } from 'lib/discogs-validation';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN ?? process.env.NEXT_PUBLIC_DISCOGS_TOKEN;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type DiscogsResponse = {
  master_id?: number;
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { albumId } = body;

    console.log(`\n💿 === DISCOGS METADATA ENRICHMENT for Album ID: ${albumId} ===`);

    if (!albumId) {
      return NextResponse.json({
        success: false,
        error: 'albumId required'
      }, { status: 400 });
    }

    if (!DISCOGS_TOKEN) {
      return NextResponse.json({
        success: false,
        error: 'Discogs token not configured'
      }, { status: 500 });
    }

    const { data: album, error: dbError } = await supabase
      .from('collection')
      .select('id, artist, title, discogs_release_id, discogs_master_id, image_url, discogs_genres, discogs_styles, tracklists')
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      return NextResponse.json({
        success: false,
        error: 'Album not found'
      }, { status: 404 });
    }

    console.log(`✓ Album found: "${album.artist}" - "${album.title}"`);

    const hasValidReleaseId = hasValidDiscogsId(album.discogs_release_id);
    
    if (!hasValidReleaseId) {
      return NextResponse.json({
        success: false,
        error: 'Album has no valid Discogs release ID'
      }, { status: 400 });
    }

    // Check what needs enrichment
    const needsMasterId = !hasValidDiscogsId(album.discogs_master_id);
    const needsImage = !album.image_url;
    const needsGenres = !album.discogs_genres || album.discogs_genres.length === 0;
    const needsTracklist = !album.tracklists;

    if (!needsMasterId && !needsImage && !needsGenres && !needsTracklist) {
      console.log('⏭️ Album already has all Discogs metadata');
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Album already has all Discogs metadata'
      });
    }

    // Fetch from Discogs using existing release ID
    console.log(`📀 Fetching metadata from Discogs release ${album.discogs_release_id}...`);
    const discogsData = await fetchDiscogsRelease(album.discogs_release_id);

    const updateData: Record<string, unknown> = {};

    if (needsMasterId && discogsData.master_id) {
      updateData.discogs_master_id = String(discogsData.master_id);
      console.log(`✓ Found master ID: ${discogsData.master_id}`);
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

    console.log(`💾 Updating database...`);
    const { error: updateError } = await supabase
      .from('collection')
      .update(updateData)
      .eq('id', albumId);

    if (updateError) {
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
        addedMasterId: !!updateData.discogs_master_id,
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