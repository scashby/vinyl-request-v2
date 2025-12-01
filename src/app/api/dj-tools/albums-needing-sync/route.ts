// src/app/api/dj-tools/albums-needing-sync/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

export async function GET() {
  try {
    // Get ALL album IDs that have tracks (paginated to handle large datasets)
    const trackedIds = new Set<number>();
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: trackedAlbums } = await supabase
        .from('tracks')
        .select('album_id')
        .range(offset, offset + pageSize - 1);

      if (trackedAlbums && trackedAlbums.length > 0) {
        trackedAlbums.forEach(t => trackedIds.add(t.album_id));
        offset += pageSize;
        hasMore = trackedAlbums.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    // Get ALL Vinyl/45s albums with tracklists (paginated)
    const allAlbums = [];
    offset = 0;
    hasMore = true;

    while (hasMore) {
      const { data: albums, error } = await supabase
        .from('collection')
        .select('id, artist, title, tracklists')
        .in('folder', ['Vinyl', '45s'])
        .or('for_sale.is.null,for_sale.eq.false')
        .not('tracklists', 'is', null)
        .order('id')
        .range(offset, offset + pageSize - 1);

      if (error) {
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }

      if (albums && albums.length > 0) {
        allAlbums.push(...albums);
        offset += pageSize;
        hasMore = albums.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    // Filter to only albums that don't have tracks
    const needingMigration = allAlbums
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
      albums: needingMigration
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}