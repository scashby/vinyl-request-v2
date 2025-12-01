// src/app/api/dj-tools/migrate-batch/route.ts - Batch track migration (Vinyl/45s only)
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncTracksFromAlbum } from "lib/track-sync";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const DEFAULT_BATCH_SIZE = 20;

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { batchSize = DEFAULT_BATCH_SIZE } = body;
    
    const safeBatchSize = Math.min(batchSize, DEFAULT_BATCH_SIZE);

    console.log(`📦 Starting batch migration: batchSize=${safeBatchSize}`);

    // Step 1: Get all Vinyl/45s albums with tracklists
    const { data: albumsWithTracklists, error: fetchError } = await supabase
      .from('collection')
      .select('id')
      .in('folder', ['Vinyl', '45s'])
      .or('for_sale.is.null,for_sale.eq.false')
      .not('tracklists', 'is', null)
      .order('id', { ascending: true })
      .limit(1000); // Get a reasonable chunk to check

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch albums: ${fetchError.message}`
      }, { status: 500 });
    }

    if (!albumsWithTracklists || albumsWithTracklists.length === 0) {
      console.log('  ✅ No albums with tracklists found');
      return NextResponse.json({
        success: true,
        processed: 0,
        complete: true,
        results: []
      });
    }

    // Step 2: Get all album IDs that already have tracks
    const { data: albumsWithTracks, error: tracksError } = await supabase
      .from('tracks')
      .select('album_id')
      .in('album_id', albumsWithTracklists.map(a => a.id));

    if (tracksError) {
      console.error('Tracks fetch error:', tracksError);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch existing tracks: ${tracksError.message}`
      }, { status: 500 });
    }

    const albumIdsWithTracks = new Set(albumsWithTracks?.map(t => t.album_id) || []);

    // Step 3: Filter to only albums that need syncing
    const albumsNeedingSync = albumsWithTracklists
      .filter(a => !albumIdsWithTracks.has(a.id))
      .slice(0, safeBatchSize);

    if (albumsNeedingSync.length === 0) {
      console.log('  ✅ No more albums need syncing');
      return NextResponse.json({
        success: true,
        processed: 0,
        complete: true,
        results: []
      });
    }

    console.log(`  → Processing ${albumsNeedingSync.length} albums that need syncing...`);

    // Step 4: Sync each album
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < albumsNeedingSync.length; i++) {
      const album = albumsNeedingSync[i];
      
      // Check if we're approaching timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > 8000) {
        console.log(`  ⏱️ Approaching timeout, stopping at ${i + 1}/${albumsNeedingSync.length}`);
        
        return NextResponse.json({
          success: true,
          processed: i,
          complete: false,
          successCount,
          errorCount,
          results,
          warning: 'Partial batch - timeout protection triggered'
        });
      }
      
      const result = await syncTracksFromAlbum(album.id);
      results.push(result);

      if (result.success) {
        successCount++;
        console.log(`  ✅ Album ${album.id}: +${result.tracksAdded} added, ~${result.tracksUpdated} updated, -${result.tracksDeleted} deleted`);
      } else {
        errorCount++;
        console.error(`  ❌ Album ${album.id}: ${result.error}`);
      }
    }

    const complete = albumsNeedingSync.length < safeBatchSize;
    const elapsed = Date.now() - startTime;
    
    console.log(`  ✅ Batch complete: ${successCount} success, ${errorCount} errors (${elapsed}ms)`);

    return NextResponse.json({
      success: true,
      processed: albumsNeedingSync.length,
      complete,
      successCount,
      errorCount,
      results,
      processingTime: elapsed
    });

  } catch (error) {
    console.error('Batch migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}