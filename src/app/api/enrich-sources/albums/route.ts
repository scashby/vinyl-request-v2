// src/app/api/enrich-multi-albums/route.ts - COMPLETE FILE with all clickable categories
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type Track = {
  lyrics_url?: string;
  lyrics?: string;
  lyrics_source?: 'apple_music' | 'genius';
};

function hasAppleMusicLyrics(tracklists: unknown): boolean {
  try {
    const tracks = typeof tracklists === 'string' 
      ? JSON.parse(tracklists)
      : tracklists;
    
    if (!Array.isArray(tracks)) return false;
    
    return tracks.some((t: Track) => t.lyrics && t.lyrics_source === 'apple_music');
  } catch {
    return false;
  }
}

function hasGeniusLinks(tracklists: unknown): boolean {
  try {
    const tracks = typeof tracklists === 'string' 
      ? JSON.parse(tracklists)
      : tracklists;
    
    if (!Array.isArray(tracks)) return false;
    
    return tracks.some((t: Track) => t.lyrics_url);
  } catch {
    return false;
  }
}

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
        // Will filter after fetch to check for Apple Music lyrics
        query = query
          .not('spotify_id', 'is', null)
          .not('apple_music_id', 'is', null)
          .not('tracklists', 'is', null);
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

      case 'needs-apple-lyrics':
        // Albums with Apple Music ID but need to check for lyrics
        query = query
          .not('apple_music_id', 'is', null)
          .not('tracklists', 'is', null);
        break;

      case 'has-apple-lyrics':
        // Albums with Apple Music lyrics - will filter after fetch
        query = query.not('tracklists', 'is', null);
        break;

      case 'has-genius-links':
        // Albums with Genius lyrics URLs - will filter after fetch
        query = query.not('tracklists', 'is', null);
        break;

      case 'both-services':
        query = query
          .not('spotify_id', 'is', null)
          .not('apple_music_id', 'is', null);
        break;

      default:
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const { data: albums, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Post-fetch filtering for categories that need tracklist inspection
    let filteredAlbums = albums || [];

    switch (category) {
      case 'with-lyrics':
        filteredAlbums = filteredAlbums.filter(album => {
          try {
            const tracks = typeof album.tracklists === 'string' 
              ? JSON.parse(album.tracklists)
              : album.tracklists;
            return Array.isArray(tracks) && tracks.some((t: Track) => 
              t.lyrics_url || (t.lyrics && t.lyrics_source === 'apple_music')
            );
          } catch {
            return false;
          }
        });
        break;

      case 'needs-apple-lyrics':
        filteredAlbums = filteredAlbums.filter(album => {
          // Has Apple Music ID but NO Apple Music lyrics
          return album.apple_music_id && !hasAppleMusicLyrics(album.tracklists);
        });
        break;

      case 'has-apple-lyrics':
        filteredAlbums = filteredAlbums.filter(album => {
          return hasAppleMusicLyrics(album.tracklists);
        });
        break;

      case 'has-genius-links':
        filteredAlbums = filteredAlbums.filter(album => {
          return hasGeniusLinks(album.tracklists);
        });
        break;

      case 'fully-enriched':
        // Fully enriched = has both services AND has Apple Music lyrics
        filteredAlbums = filteredAlbums.filter(album => {
          return album.spotify_id && 
                 album.apple_music_id && 
                 hasAppleMusicLyrics(album.tracklists);
        });
        break;
    }

    return NextResponse.json({
      success: true,
      albums: filteredAlbums,
      count: filteredAlbums.length
    });

  } catch (error) {
    console.error('Albums fetch error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}