// src/app/api/dj-tools/migration-stats/route.ts - Get migration statistics
import { NextResponse } from "next/server";
import { getSyncStats, validateTrackIntegrity } from "lib/track-sync";

export async function GET() {
  try {
    console.log('📊 Fetching migration stats...');

    const stats = await getSyncStats();
    const integrity = await validateTrackIntegrity();

    return NextResponse.json({
      success: true,
      stats,
      integrity
    });

  } catch (error) {
    console.error('Migration stats error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}