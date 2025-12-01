// src/app/api/dj-tools/sync-single/route.ts
import { NextResponse } from "next/server";
import { syncTracksFromAlbum } from "lib/track-sync";

export async function POST(req: Request) {
  try {
    const { albumId } = await req.json();

    if (!albumId) {
      return NextResponse.json({
        success: false,
        error: 'Album ID required'
      }, { status: 400 });
    }

    const result = await syncTracksFromAlbum(albumId);

    return NextResponse.json({
      success: result.success,
      result
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}