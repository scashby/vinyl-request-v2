// src/app/api/enrich-sources/discogs-metadata/route.ts
import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";
import { hasValidDiscogsId } from 'lib/discogs-validation';
import { parseDiscogsFormat } from "src/utils/formatUtils";
import type { Database } from "src/types/supabase";

const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN ?? process.env.NEXT_PUBLIC_DISCOGS_TOKEN;

type DiscogsResponse = {
  master_id?: number;
  images?: Array<{ uri: string }>;
  genres?: string[];
  styles?: string[];
  labels?: Array<{ name?: string; catno?: string }>;
  country?: string;
  year?: number;
  released?: string;
  identifiers?: Array<{ type?: string; value?: string }>;
  formats?: Array<{ name?: string; qty?: string | number; descriptions?: string[] }>;
  tracklist?: Array<{
    position?: string;
    type_?: string;
    title?: string;
    duration?: string;
    artists?: Array<{ name: string }>;
  }>;
};

const buildDiscogsFormatString = (formats?: { name?: string; qty?: string | number; descriptions?: string[] }[]) => {
  if (!formats || formats.length === 0) return '';
  const format = formats[0];
  const qty = format.qty ? String(format.qty).trim() : '';
  const name = format.name?.trim() ?? '';
  const details = format.descriptions?.filter(Boolean) ?? [];
  const qtyPrefix = qty ? `${qty}x` : '';
  const base = `${qtyPrefix}${name}`.trim();
  if (details.length === 0) return base;
  return `${base}, ${details.join(', ')}`.trim();
};

const normalizeReleaseDate = (released?: string | null): string | null => {
  if (!released) return null;
  const value = released.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  return null;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const applyAlbumDetailsToReleaseRecordings = async (
  supabase: ReturnType<typeof supabaseServer>,
  releaseId: number,
  albumDetails: Record<string, unknown>
) => {
  if (!releaseId || Object.keys(albumDetails).length === 0) return;

  const { data: tracks, error } = await supabase
    .from('release_tracks')
    .select('recording:recordings ( id, credits )')
    .eq('release_id', releaseId);

  if (error || !tracks) return;

  const updates = tracks
    .map((track) => {
      const recording = Array.isArray(track.recording) ? track.recording[0] : track.recording;
      if (!recording?.id) return null;
      const credits = asRecord(recording.credits);
      const merged = {
        ...credits,
        album_details: {
          ...(asRecord(credits.album_details ?? credits.albumDetails ?? credits.album_metadata)),
          ...albumDetails,
        },
      };
      return supabase
        .from('recordings')
        .update({ credits: merged as Database['public']['Tables']['recordings']['Update']['credits'] })
        .eq('id', recording.id);
    })
    .filter(Boolean);

  if (updates.length > 0) {
    await Promise.all(updates);
  }
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
  const supabase = supabaseServer(getAuthHeader(req));
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
    const needsGenres = !master.genres || master.genres.length === 0;
    const needsStyles = !master.styles || master.styles.length === 0;
    const needsLabel = !release.label;
    const needsCatalog = !release.catalog_number;
    const needsCountry = !release.country;
    const needsYear = !release.release_year;
    const needsBarcode = !release.barcode;
    const needsReleaseDate = !release.release_date;
    const needsMediaType = !release.media_type;
    const needsFormatDetails = !release.format_details || release.format_details.length === 0;
    const needsQty = !release.qty;

    if (!foundReleaseId && !needsMasterId && !needsImage && !needsGenres && !needsStyles && !needsLabel && !needsCatalog && !needsCountry && !needsYear && !needsBarcode && !needsReleaseDate && !needsMediaType && !needsFormatDetails && !needsQty) {
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

    if (needsGenres && discogsData.genres && discogsData.genres.length > 0) {
      const genres = Array.from(new Set(discogsData.genres));
      masterUpdate.genres = genres;
      console.log(`✓ Found ${genres.length} genres`);
    }

    if (needsStyles && discogsData.styles && discogsData.styles.length > 0) {
      const styles = Array.from(new Set(discogsData.styles));
      masterUpdate.styles = styles;
      console.log(`✓ Found ${styles.length} styles`);
    }

    if (needsLabel && discogsData.labels && discogsData.labels[0]?.name) {
      releaseUpdate.label = discogsData.labels[0].name;
      console.log(`✓ Found label: ${discogsData.labels[0].name}`);
    }

    if (needsCatalog && discogsData.labels && discogsData.labels[0]?.catno) {
      releaseUpdate.catalog_number = discogsData.labels[0].catno;
      console.log(`✓ Found catalog number: ${discogsData.labels[0].catno}`);
    }

    if (needsCountry && discogsData.country) {
      releaseUpdate.country = discogsData.country;
      console.log(`✓ Found country: ${discogsData.country}`);
    }

    if (needsYear && discogsData.year) {
      releaseUpdate.release_year = discogsData.year;
      console.log(`✓ Found release year: ${discogsData.year}`);
    }

    if (needsBarcode && discogsData.identifiers && discogsData.identifiers.length > 0) {
      const barcode = discogsData.identifiers.find((id) => id.type === 'Barcode')?.value;
      if (barcode) {
        releaseUpdate.barcode = barcode;
        console.log(`✓ Found barcode: ${barcode}`);
      }
    }

    if (needsReleaseDate) {
      const releaseDate = normalizeReleaseDate(discogsData.released ?? null);
      if (releaseDate) {
        releaseUpdate.release_date = releaseDate;
        console.log(`✓ Found release date: ${releaseDate}`);
      }
    }

    const formatString = buildDiscogsFormatString(discogsData.formats);
    const parsedFormat = formatString ? parseDiscogsFormat(formatString) : null;
    if (parsedFormat) {
      if (needsMediaType && parsedFormat.media_type) {
        releaseUpdate.media_type = parsedFormat.media_type;
        console.log(`✓ Found media type: ${parsedFormat.media_type}`);
      }
      if (needsFormatDetails && parsedFormat.format_details?.length) {
        releaseUpdate.format_details = parsedFormat.format_details;
        console.log(`✓ Found format details: ${parsedFormat.format_details.join(', ')}`);
      }
      if (needsQty && parsedFormat.qty) {
        releaseUpdate.qty = parsedFormat.qty;
        console.log(`✓ Found qty: ${parsedFormat.qty}`);
      }
    }
    
    if (Object.keys(releaseUpdate).length === 0 && Object.keys(masterUpdate).length === 0) {
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

    if (parsedFormat && release.id) {
      const albumDetails = {
        rpm: parsedFormat.rpm ?? null,
        vinyl_weight: parsedFormat.weight ?? null,
        vinyl_color: parsedFormat.color ? [parsedFormat.color] : null,
        extra: parsedFormat.extraText || null,
        packaging: parsedFormat.packaging ?? null,
        is_box_set: parsedFormat.is_box_set ?? false,
        box_set: parsedFormat.box_set ?? null,
      };
      await applyAlbumDetailsToReleaseRecordings(supabase, release.id, albumDetails);
    }

    console.log(`✅ Successfully enriched with Discogs metadata\n`);

    return NextResponse.json({
      success: true,
      data: {
        albumId: inventoryRow.id,
        artist: artistName,
        title: master.title,
        foundReleaseId: foundReleaseId ? releaseId : undefined,
        updates: {
          release: releaseUpdate,
          master: masterUpdate
        }
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
// AUDIT: inspected, no changes.
