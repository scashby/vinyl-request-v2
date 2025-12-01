// src/app/api/dj-tools/migrate-batch/route.ts - Batch track migration (Vinyl/45s only)
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncTracksFromAlbum } from "lib/track-sync";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cursor = 0, batchSize = 100 } = body;

    console.log(`📦 Starting batch migration: cursor=${cursor}, batchSize=${batchSize}`);

    // Fetch ONLY Vinyl and 45s albums (not for sale) with tracklists that need syncing
    const { data: albums, error: fetchError } = await supabase
      .from('collection')
      .select('id')
      .in('folder', ['Vinyl', '45s'])
      .or('for_sale.is.null,for_sale.eq.false')
      .not('tracklists', 'is', null)
      .order('id', { ascending: true })
      .range(cursor, cursor + batchSize - 1);

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch albums: ${fetchError.message}`
      }, { status: 500 });
    }

    if (!albums || albums.length === 0) {
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

    for (const album of albums) {
      const result = await syncTracksFromAlbum(album.id);
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        console.error(`  ❌ Album ${album.id}: ${result.error}`);
      }
    }

    const nextCursor = cursor + albums.length;
    const complete = albums.length < batchSize;

    console.log(`  ✅ Batch complete: ${successCount} success, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      processed: albums.length,
      nextCursor: complete ? null : nextCursor,
      complete,
      successCount,
      errorCount,
      results
    });

  } catch (error) {
    console.error('Batch migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}