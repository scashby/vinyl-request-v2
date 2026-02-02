// src/app/api/enrich-sources/discogs-metadata/route.ts
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

    const { data: inventoryRow, error: dbError } = await supabase
      .from('inventory')
      .select('id, release_id, releases ( id, discogs_release_id, release_year, masters ( id, title, discogs_master_id, cover_image_url, genres, styles, original_release_year, main_artist_id ) )')
      .eq('id', albumId)
      .single();

    if (dbError || !inventoryRow) {
      return NextResponse.json({
        success: false,
        error: 'Album not found'
      }, { status: 404 });
    }

    const release = Array.isArray(inventoryRow.releases) ? inventoryRow.releases[0] : inventoryRow.releases;
    const master = Array.isArray(release?.masters) ? release?.masters[0] : release?.masters;

    if (!release || !master) {
      return NextResponse.json({
        success: false,
        error: 'Release metadata missing for inventory item'
      }, { status: 404 });
    }

    let artistName = 'Unknown Artist';
    if (master.main_artist_id) {
      const { data: artistRow, error: artistError } = await supabase
        .from('artists')
        .select('name')
        .eq('id', master.main_artist_id)
        .single();

      if (artistError) {
        console.warn('Unable to load artist name:', artistError);
      } else if (artistRow?.name) {
        artistName = artistRow.name;
      }
    }

    console.log(`✓ Album found: "${artistName}" - "${master.title}"`);

    let releaseId = release.discogs_release_id;
    let foundReleaseId = false;
    
    const hasValidReleaseId = hasValidDiscogsId(releaseId);

    // If no valid release ID, search for it
    if (!hasValidReleaseId) {
      console.log('🔍 No valid Discogs release ID, searching...');
      const releaseYear = release.release_year ?? master.original_release_year;
      releaseId = await searchDiscogsForRelease(artistName, master.title, releaseYear ? String(releaseYear) : undefined);
      
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
    const needsMasterId = !hasValidDiscogsId(master.discogs_master_id);
    const needsImage = !master.cover_image_url;
    const needsGenres = !master.genres || master.genres.length === 0 || !master.styles || master.styles.length === 0;

    const { data: existingTracks, error: trackError } = await supabase
      .from('release_tracks')
      .select('id')
      .eq('release_id', release.id)
      .limit(1);

    if (trackError) {
      console.warn('Unable to check release tracks:', trackError);
    }

    const needsTracklist = !existingTracks || existingTracks.length === 0;

    if (!foundReleaseId && !needsMasterId && !needsImage && !needsGenres && !needsTracklist) {
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

    const releaseUpdate: Record<string, unknown> = {};
    const masterUpdate: Record<string, unknown> = {};

    if (foundReleaseId) {
      releaseUpdate.discogs_release_id = releaseId;
    }

    if (needsMasterId && discogsData.master_id) {
      masterUpdate.discogs_master_id = String(discogsData.master_id);
      console.log(`✓ Found master ID: ${discogsData.master_id}`);
    }

    if (needsImage && discogsData.images && discogsData.images.length > 0) {
      masterUpdate.cover_image_url = discogsData.images[0].uri;
      console.log('✓ Found image');
    }

    if (needsGenres) {
      const combined = [
        ...(discogsData.genres || []),
        ...(discogsData.styles || [])
      ];
      const unique = Array.from(new Set(combined));
      
      if (unique.length > 0) {
        masterUpdate.genres = unique;
        masterUpdate.styles = unique;
        console.log(`✓ Found ${unique.length} genres/styles: ${unique.join(', ')}`);
      }
    }

    const tracklistEntries = needsTracklist && discogsData.tracklist
      ? discogsData.tracklist
          .filter(track => !track.type_ || track.type_ === 'track')
          .map(track => ({
            release_id: release.id,
            position: track.position || '',
            title_override: track.title || ''
          }))
          .filter(track => track.position || track.title_override)
      : [];

    if (tracklistEntries.length > 0) {
      console.log(`✓ Found ${tracklistEntries.length} tracks`);
    }

    if (Object.keys(releaseUpdate).length === 0 && Object.keys(masterUpdate).length === 0 && tracklistEntries.length === 0) {
      console.log('⚠️ No new data found to update');
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'No new data available from Discogs'
      });
    }

    console.log(`💾 Updating database...`);
    if (Object.keys(releaseUpdate).length > 0) {
      const { error: releaseError } = await supabase
        .from('releases')
        .update(releaseUpdate)
        .eq('id', release.id);

      if (releaseError) {
        return NextResponse.json({
          success: false,
          error: `Release update failed: ${releaseError.message}`
        }, { status: 500 });
      }
    }

    if (Object.keys(masterUpdate).length > 0) {
      const { error: masterError } = await supabase
        .from('masters')
        .update(masterUpdate)
        .eq('id', master.id);

      if (masterError) {
        return NextResponse.json({
          success: false,
          error: `Master update failed: ${masterError.message}`
        }, { status: 500 });
      }
    }

    if (tracklistEntries.length > 0) {
      const { error: trackInsertError } = await supabase
        .from('release_tracks')
        .insert(tracklistEntries);

      if (trackInsertError) {
        return NextResponse.json({
          success: false,
          error: `Tracklist update failed: ${trackInsertError.message}`
        }, { status: 500 });
      }
    }

    console.log(`✅ Successfully enriched with Discogs metadata\n`);

    return NextResponse.json({
      success: true,
      data: {
        albumId: inventoryRow.id,
        artist: artistName,
        title: master.title,
        foundReleaseId: foundReleaseId ? releaseId : undefined,
        addedMasterId: !!masterUpdate.discogs_master_id,
        addedImage: !!masterUpdate.cover_image_url,
        addedGenres: !!masterUpdate.genres,
        addedTracklist: tracklistEntries.length > 0
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
