// src/app/api/dj-tools/migrate-batch/route.ts
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

    // Step 1: Get Vinyl/45s albums with tracklists (limited batch)
    const { data: albumsWithTracklists, error: fetchError } = await supabase
      .from('collection')
      .select('id')
      .in('folder', ['Vinyl', '45s'])
      .or('for_sale.is.null,for_sale.eq.false')
      .not('tracklists', 'is', null)
      .order('id', { ascending: true })
      .limit(500);

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch albums: ${fetchError.message}`
      }, { status: 500 });
    }

    if (!albumsWithTracklists || albumsWithTracklists.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        complete: true,
        successCount: 0,
        errorCount: 0,
        results: []
      });
    }

    // Step 2: Get album IDs that already have tracks
    const { data: albumsWithTracks } = await supabase
      .from('tracks')
      .select('album_id')
      .in('album_id', albumsWithTracklists.map(a => a.id));

    const albumIdsWithTracks = new Set(albumsWithTracks?.map(t => t.album_id) || []);

    // Step 3: Filter to albums needing sync
    const albumsNeedingSync = albumsWithTracklists
      .filter(a => !albumIdsWithTracks.has(a.id))
      .slice(0, safeBatchSize);

    if (albumsNeedingSync.length === 0) {
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

    console.log(`  → Processing ${albumsNeedingSync.length} albums...`);

    // Step 4: Sync albums
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < albumsNeedingSync.length; i++) {
      const album = albumsNeedingSync[i];
      
      // Timeout protection
      const elapsed = Date.now() - startTime;
      if (elapsed > 8000) {
        console.log(`  ⏱️ Timeout protection at ${i}/${albumsNeedingSync.length}`);
        return NextResponse.json({
          success: true,
          processed: i,
          complete: false,
          successCount,
          errorCount,
          results,
          warning: 'Partial batch - timeout'
        });
      }
      
      const result = await syncTracksFromAlbum(album.id);
      results.push(result);

      if (result.success) {
        successCount++;
        console.log(`  ✅ ${album.id}: +${result.tracksAdded}`);
      } else {
        errorCount++;
        console.error(`  ❌ ${album.id}: ${result.error}`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`  ✅ Batch done: ${successCount}/${albumsNeedingSync.length} (${elapsed}ms)`);

    return NextResponse.json({
      success: true,
      processed: albumsNeedingSync.length,
      complete: albumsNeedingSync.length < safeBatchSize,
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