// src/app/api/dj-tools/sync-tracks/route.ts - Sync tracks for single album
import { NextResponse } from "next/server";
import { syncTracksFromAlbum } from "lib/track-sync";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { albumId } = body;

    if (!albumId) {
      return NextResponse.json({
        success: false,
        error: 'albumId required'
      }, { status: 400 });
    }

    console.log(`🔄 Syncing tracks for album ${albumId}...`);

    const result = await syncTracksFromAlbum(albumId);

    if (result.success) {
      console.log(`✅ Synced album ${albumId}: +${result.tracksAdded} -${result.tracksDeleted} ~${result.tracksUpdated}`);
    } else {
      console.error(`❌ Failed to sync album ${albumId}:`, result.error);
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Sync tracks error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}