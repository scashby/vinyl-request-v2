// src/app/api/dj-tools/albums-needing-sync/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

export async function GET() {
  try {
    // Get all album IDs that have tracks
    const { data: trackedAlbums } = await supabase
      .from('tracks')
      .select('album_id');

    const trackedIds = new Set((trackedAlbums || []).map(t => t.album_id));

    // Get Vinyl/45s albums with tracklists
    const { data: albums, error } = await supabase
      .from('collection')
      .select('id, artist, title, tracklists')
      .in('folder', ['Vinyl', '45s'])
      .or('for_sale.is.null,for_sale.eq.false')
      .not('tracklists', 'is', null)
      .order('id')
      .limit(100); // First 100 to check

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    // Filter to only albums that don't have tracks
    const needingSync = (albums || [])
      .filter(a => !trackedIds.has(a.id))
      .map(a => {
        // Count tracks in JSON
        let trackCount = 0;
        try {
          const tracklists = typeof a.tracklists === 'string' 
            ? JSON.parse(a.tracklists)
            : a.tracklists;
          trackCount = Array.isArray(tracklists) ? tracklists.length : 0;
        } catch {
          trackCount = -1; // Invalid JSON
        }

        return {
          id: a.id,
          artist: a.artist,
          title: a.title,
          trackCount
        };
      });

    return NextResponse.json({
      success: true,
      albums: needingSync
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}