// src/app/api/enrich-sources/apple-music/route.ts - Apple Music-only enrichment
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APPLE_MUSIC_TOKEN = process.env.APPLE_MUSIC_TOKEN;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function searchAppleMusic(artist: string, title: string) {
  if (!APPLE_MUSIC_TOKEN) {
    throw new Error('Apple Music token not configured');
  }

  const query = encodeURIComponent(`${artist} ${title}`);
  const res = await fetch(`https://api.music.apple.com/v1/catalog/us/search?types=albums&term=${query}&limit=1`, {
    headers: { 'Authorization': `Bearer ${APPLE_MUSIC_TOKEN}` }
  });

  if (!res.ok) {
    throw new Error(`Apple Music API returned ${res.status}`);
  }

  const data = await res.json();
  const album = data?.results?.albums?.data?.[0];

  if (!album) {
    return null;
  }

  return {
    apple_music_id: album.id,
    apple_music_url: album.attributes?.url,
    apple_music_genre: album.attributes?.genreNames?.[0],
    apple_music_genres: album.attributes?.genreNames || [],
    apple_music_label: album.attributes?.recordLabel,
    apple_music_release_date: album.attributes?.releaseDate,
    apple_music_track_count: album.attributes?.trackCount,
    apple_music_artwork_url: album.attributes?.artwork?.url?.replace('{w}x{h}', '600x600')
  };
}

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

    // Get album info
    const { data: album, error: dbError } = await supabase
      .from('collection')
      .select('id, artist, title, apple_music_id')
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      return NextResponse.json({
        success: false,
        error: 'Album not found'
      }, { status: 404 });
    }

    // Skip if already has Apple Music ID
    if (album.apple_music_id) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Album already has Apple Music ID',
        data: {
          albumId: album.id,
          artist: album.artist,
          title: album.title,
          apple_music_id: album.apple_music_id
        }
      });
    }

    // Search Apple Music
    try {
      const appleData = await searchAppleMusic(album.artist, album.title);

      if (!appleData) {
        return NextResponse.json({
          success: false,
          error: 'No match found on Apple Music',
          data: {
            albumId: album.id,
            artist: album.artist,
            title: album.title,
            searchQuery: `${album.artist} ${album.title}`
          }
        });
      }

      // Update database
      const { error: updateError } = await supabase
        .from('collection')
        .update(appleData)
        .eq('id', albumId);

      if (updateError) {
        return NextResponse.json({
          success: false,
          error: `Database update failed: ${updateError.message}`,
          data: {
            albumId: album.id,
            artist: album.artist,
            title: album.title,
            foundData: appleData
          }
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: {
          albumId: album.id,
          artist: album.artist,
          title: album.title,
          apple_music_id: appleData.apple_music_id,
          apple_music_url: appleData.apple_music_url,
          genres: appleData.apple_music_genres,
          label: appleData.apple_music_label,
          release_date: appleData.apple_music_release_date,
          track_count: appleData.apple_music_track_count
        }
      });

    } catch (error) {
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Apple Music search failed',
        data: {
          albumId: album.id,
          artist: album.artist,
          title: album.title
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Apple Music enrichment error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}