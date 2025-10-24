// src/app/api/cd-only-finder/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN ?? process.env.NEXT_PUBLIC_DISCOGS_TOKEN;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type Album = {
  id: number;
  artist: string;
  title: string;
  year: string | null;
  format: string | null;
  image_url: string | null;
  discogs_release_id: string | null;
  discogs_genres: string[] | null;
  folder: string | null;
  notes: string | null;
};

type DiscogsSearchResult = {
  results?: Array<{
    format?: string[];
    type?: string;
  }>;
};

async function checkVinylAvailability(artist: string, title: string): Promise<boolean> {
  if (!DISCOGS_TOKEN) {
    throw new Error('Discogs token not configured');
  }

  try {
    // Search Discogs for this album with vinyl format
    const params = new URLSearchParams({
      artist,
      release_title: title,
      format: 'vinyl',
      type: 'release',
      per_page: '5'
    });

    const response = await fetch(
      `https://api.discogs.com/database/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'DeadwaxDialogues/1.0',
          'Authorization': `Discogs token=${DISCOGS_TOKEN}`
        }
      }
    );

    if (!response.ok) {
      console.warn(`Discogs search failed for ${artist} - ${title}: HTTP ${response.status}`);
      return false;
    }

    const data = await response.json() as DiscogsSearchResult;
    
    // Check if any results have vinyl in their format
    if (data.results && data.results.length > 0) {
      const hasVinyl = data.results.some(result => {
        if (!result.format) return false;
        return result.format.some(fmt => 
          fmt.toLowerCase().includes('vinyl') || 
          fmt.toLowerCase().includes('lp') ||
          fmt.toLowerCase().includes('12"')
        );
      });
      
      return hasVinyl;
    }

    return false;
  } catch (error) {
    console.error(`Error checking vinyl for ${artist} - ${title}:`, error);
    return false;
  }
}

async function tagAlbumsAsCDOnly(albumIds: number[]): Promise<{ success: boolean; updated: number }> {
  try {
    let updated = 0;
    
    for (const id of albumIds) {
      // Get current notes
      const { data: album } = await supabase
        .from('collection')
        .select('notes')
        .eq('id', id)
        .single();

      if (!album) continue;

      // Add CD-Only tag to notes
      const currentNotes = album.notes || '';
      const cdOnlyTag = '[CD-ONLY]';
      
      // Don't add if already tagged
      if (currentNotes.includes(cdOnlyTag)) {
        updated++;
        continue;
      }

      const newNotes = currentNotes 
        ? `${cdOnlyTag} ${currentNotes}`
        : cdOnlyTag;

      // Update album
      const { error } = await supabase
        .from('collection')
        .update({ notes: newNotes })
        .eq('id', id);

      if (!error) {
        updated++;
      }
    }

    return { success: true, updated };
  } catch (error) {
    console.error('Error tagging albums:', error);
    return { success: false, updated: 0 };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action;

    // Handle tagging action
    if (action === 'tag') {
      const albumIds = body.albumIds as number[];
      if (!albumIds || !Array.isArray(albumIds) || albumIds.length === 0) {
        return NextResponse.json({ error: 'Invalid album IDs' }, { status: 400 });
      }

      const result = await tagAlbumsAsCDOnly(albumIds);
      return NextResponse.json({
        success: result.success,
        updated: result.updated
      });
    }

    // Handle scan action
    if (action !== 'scan') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    console.log('\n💿 === CD-ONLY FINDER SCAN ===');

    // Get all CD releases from collection
    const { data: albums, error } = await supabase
      .from('collection')
      .select('id, artist, title, year, format, image_url, discogs_release_id, discogs_genres, folder, notes')
      .or('format.ilike.%CD%,format.ilike.%Compact Disc%')
      .order('artist', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!albums || albums.length === 0) {
      console.log('No CD releases found in collection');
      return NextResponse.json({
        results: [],
        stats: { total: 0, scanned: 0, cdOnly: 0 }
      });
    }

    console.log(`Found ${albums.length} CD releases to check`);

    const cdOnlyAlbums: Array<Album & { has_vinyl: boolean; cd_only_tagged: boolean }> = [];
    let scanned = 0;
    let cdOnlyCount = 0;

    // Check each CD release for vinyl availability
    for (const album of albums as Album[]) {
      scanned++;
      console.log(`\n[${scanned}/${albums.length}] Checking: ${album.artist} - ${album.title}`);

      const hasVinyl = await checkVinylAvailability(album.artist, album.title);
      const isTagged = album.notes?.includes('[CD-ONLY]') || false;
      
      if (!hasVinyl) {
        console.log(`  ✅ CD-ONLY: No vinyl release found`);
        cdOnlyCount++;
        cdOnlyAlbums.push({
          ...album,
          has_vinyl: false,
          cd_only_tagged: isTagged
        });
      } else {
        console.log(`  ⏭️ Has vinyl release available`);
      }

      // Rate limiting: wait 1 second between requests
      if (scanned < albums.length) {
        await sleep(1000);
      }
    }

    console.log(`\n📊 SCAN COMPLETE:`);
    console.log(`   Total CDs: ${albums.length}`);
    console.log(`   Scanned: ${scanned}`);
    console.log(`   CD-Only: ${cdOnlyCount}`);

    return NextResponse.json({
      results: cdOnlyAlbums,
      stats: {
        total: albums.length,
        scanned,
        cdOnly: cdOnlyCount
      }
    });

  } catch (error) {
    console.error('CD-Only Finder error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}