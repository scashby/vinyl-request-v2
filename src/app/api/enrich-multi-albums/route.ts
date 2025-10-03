// src/app/api/enrich-multi-albums/route.ts - NEW FILE
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!category) {
      return NextResponse.json({ error: 'Category required' }, { status: 400 });
    }

    let query = supabase
      .from('collection')
      .select('id, artist, title, image_url, spotify_id, apple_music_id, tracklists')
      .order('artist', { ascending: true })
      .limit(limit);

    // Apply filters based on category
    switch (category) {
      case 'fully-enriched':
        query = query
          .not('spotify_id', 'is', null)
          .not('apple_music_id', 'is', null);
        break;

      case 'needs-enrichment':
        query = query.or('spotify_id.is.null,apple_music_id.is.null');
        break;

      case 'no-data':
        query = query
          .is('spotify_id', null)
          .is('apple_music_id', null);
        break;

      case 'missing-spotify':
        query = query
          .is('spotify_id', null)
          .not('apple_music_id', 'is', null);
        break;

      case 'missing-apple':
        query = query
          .not('spotify_id', 'is', null)
          .is('apple_music_id', null);
        break;

      case 'with-lyrics':
        query = query.not('tracklists', 'is', null);
        break;

      default:
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const { data: albums, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // For lyrics category, filter to only albums with actual lyrics
    let filteredAlbums = albums;
    if (category === 'with-lyrics') {
      filteredAlbums = albums?.filter(album => {
        try {
          const tracks = typeof album.tracklists === 'string' 
            ? JSON.parse(album.tracklists)
            : album.tracklists;
          return Array.isArray(tracks) && tracks.some(t => t.lyrics_url);
        } catch {
          return false;
        }
      }) || [];
    }

    return NextResponse.json({
      success: true,
      albums: filteredAlbums,
      count: filteredAlbums?.length || 0
    });

  } catch (error) {
    console.error('Albums fetch error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}