// src/app/api/dj-tools/sync-single/route.ts
import { NextResponse } from "next/server";
import { syncTracksFromAlbum } from "lib/track-sync";

export async function POST(req: Request) {
  try {
    const { albumId } = await req.json();

    console.log(`🎯 Sync-single API called with albumId: ${albumId}`);

    if (!albumId) {
      console.error('❌ No albumId provided');
      return NextResponse.json({
        success: false,
        error: 'Album ID required'
      }, { status: 400 });
    }

    console.log(`  → Calling syncTracksFromAlbum(${albumId})...`);
    const result = await syncTracksFromAlbum(albumId);

    console.log(`  → Result:`, result);

    return NextResponse.json({
      success: result.success,
      result
    });

  } catch (error) {
    console.error('❌ Sync-single API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}