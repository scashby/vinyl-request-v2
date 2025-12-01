// src/app/api/dj-tools/migrate-batch/route.ts - Batch track migration (Vinyl/45s only)
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncTracksFromAlbum } from "lib/track-sync";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// Reduce batch size to avoid timeouts
const DEFAULT_BATCH_SIZE = 20; // Much smaller to stay under timeout limits

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { cursor = 0, batchSize = DEFAULT_BATCH_SIZE } = body;
    
    // Cap batch size to prevent timeouts
    const safeBatchSize = Math.min(batchSize, DEFAULT_BATCH_SIZE);

    console.log(`📦 Starting batch migration: cursor=${cursor}, batchSize=${safeBatchSize}`);

    // Fetch ONLY Vinyl and 45s albums (not for sale) with tracklists that need syncing
    const { data: albums, error: fetchError } = await supabase
      .from('collection')
      .select('id')
      .in('folder', ['Vinyl', '45s'])
      .or('for_sale.is.null,for_sale.eq.false')
      .not('tracklists', 'is', null)
      .order('id', { ascending: true })
      .range(cursor, cursor + safeBatchSize - 1);

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch albums: ${fetchError.message}`
      }, { status: 500 });
    }

    if (!albums || albums.length === 0) {
      console.log('  ✅ No more albums to process');
      return NextResponse.json({
        success: true,
        processed: 0,
        nextCursor: null,
        complete: true,
        results: []
      });
    }

    console.log(`  → Processing ${albums.length} albums...`);

    // Sync each album
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < albums.length; i++) {
      const album = albums[i];
      
      // Check if we're approaching timeout (leave 2 seconds buffer)
      const elapsed = Date.now() - startTime;
      if (elapsed > 8000) { // 8 seconds on a 10 second timeout
        console.log(`  ⏱️ Approaching timeout, stopping at ${i + 1}/${albums.length}`);
        
        // Return partial results
        return NextResponse.json({
          success: true,
          processed: i,
          nextCursor: cursor + i,
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

    const nextCursor = cursor + albums.length;
    const complete = albums.length < safeBatchSize;

    const elapsed = Date.now() - startTime;
    console.log(`  ✅ Batch complete: ${successCount} success, ${errorCount} errors (${elapsed}ms)`);

    return NextResponse.json({
      success: true,
      processed: albums.length,
      nextCursor: complete ? null : nextCursor,
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