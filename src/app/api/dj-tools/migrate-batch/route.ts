// src/app/api/dj-tools/migrate-batch/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncTracksFromAlbum } from "lib/track-sync";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { maxToProcess = 100 } = body;

    console.log(`📦 Finding albums that need syncing...`);

    // Get ALL album IDs that already have tracks
    const { data: trackedAlbums } = await supabase
      .from('tracks')
      .select('album_id');

    const trackedIds = new Set((trackedAlbums || []).map(t => t.album_id));
    console.log(`  → ${trackedIds.size} albums already have tracks`);

    // Get Vinyl/45s albums with tracklists, check each to see if it needs syncing
    let processed = 0;
    let successCount = 0;
    let errorCount = 0;
    const results = [];
    const albumsToSync = [];

    // Fetch in batches of 100 until we find enough that need syncing
    let offset = 0;
    const fetchSize = 100;

    while (albumsToSync.length < maxToProcess) {
      const { data: albums, error } = await supabase
        .from('collection')
        .select('id')
        .in('folder', ['Vinyl', '45s'])
        .or('for_sale.is.null,for_sale.eq.false')
        .not('tracklists', 'is', null)
        .order('id')
        .range(offset, offset + fetchSize - 1);

      if (error) {
        console.error('Fetch error:', error);
        return NextResponse.json({
          success: false,
          error: `Failed to fetch albums: ${error.message}`
        }, { status: 500 });
      }

      if (!albums || albums.length === 0) {
        // No more albums to check
        break;
      }

      // Filter to only those that don't have tracks yet
      const needSync = albums.filter(a => !trackedIds.has(a.id));
      albumsToSync.push(...needSync);

      offset += fetchSize;

      // If we found enough, stop looking
      if (albumsToSync.length >= maxToProcess) {
        break;
      }

      // Timeout protection
      if (Date.now() - startTime > 5000) {
        console.log(`  ⏱️ Timeout while searching, found ${albumsToSync.length} so far`);
        break;
      }
    }

    // Trim to max
    const toSync = albumsToSync.slice(0, maxToProcess);

    if (toSync.length === 0) {
      console.log('  ✅ No albums need syncing');
      return NextResponse.json({
        success: true,
        processed: 0,
        complete: true,
        successCount: 0,
        errorCount: 0,
        results: []
      });
    }

    console.log(`  → Syncing ${toSync.length} albums...`);

    // Sync each album
    for (const album of toSync) {
      // Timeout protection
      if (Date.now() - startTime > 8000) {
        console.log(`  ⏱️ Timeout protection triggered at ${processed}/${toSync.length}`);
        break;
      }

      const result = await syncTracksFromAlbum(album.id);
      results.push(result);
      processed++;

      if (result.success) {
        successCount++;
        console.log(`  ✅ Album ${album.id}: +${result.tracksAdded} tracks`);
      } else {
        errorCount++;
        console.error(`  ❌ Album ${album.id}: ${result.error}`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`  ✅ Complete: ${successCount} success, ${errorCount} errors (${elapsed}ms)`);

    return NextResponse.json({
      success: true,
      processed,
      complete: processed < maxToProcess,
      successCount,
      errorCount,
      results,
      processingTime: elapsed
    });

  } catch (error) {
    console.error('Batch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}