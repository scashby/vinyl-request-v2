// src/app/api/enrich-sources/apple-music/route.ts - COMPLETE with logging
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
  console.log(`  → Querying Apple Music API: "${artist} ${title}"`);

  const res = await fetch(`https://api.music.apple.com/v1/catalog/us/search?types=albums&term=${query}&limit=1`, {
    headers: { 'Authorization': `Bearer ${APPLE_MUSIC_TOKEN}` }
  });

  if (!res.ok) {
    console.log(`  → Apple Music API error: HTTP ${res.status}`);
    throw new Error(`Apple Music API returned ${res.status}`);
  }

  const data = await res.json();
  const album = data?.results?.albums?.data?.[0];

  if (!album) {
    console.log(`  → No results from Apple Music`);
    return null;
  }

  console.log(`  → Found match: "${album.attributes?.name}" by ${album.attributes?.artistName}`);
  
  const genres = album.attributes?.genreNames || [];
  if (genres.length > 0) {
    console.log(`  → Genres: ${genres.join(', ')}`);
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

    console.log(`\n🍎 === APPLE MUSIC REQUEST for Album ID: ${albumId} ===`);

    if (!albumId) {
      console.log('❌ ERROR: No albumId provided');
      return NextResponse.json({
        success: false,
        error: 'albumId required'
      }, { status: 400 });
    }

    const { data: album, error: dbError } = await supabase
      .from('collection')
      .select('id, artist, title, apple_music_id')
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      console.log('❌ ERROR: Album not found in database', dbError);
      return NextResponse.json({
        success: false,
        error: 'Album not found'
      }, { status: 404 });
    }

    console.log(`✓ Album found: "${album.artist} - ${album.title}"`);

    if (album.apple_music_id) {
      console.log(`⏭️  Album already has Apple Music ID: ${album.apple_music_id}\n`);
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

    console.log(`🔍 Searching Apple Music for: "${album.artist} - ${album.title}"...`);

    try {
      const appleData = await searchAppleMusic(album.artist, album.title);

      if (!appleData) {
        console.log(`❌ No match found on Apple Music\n`);
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

      console.log(`✅ Found Apple Music match: ID=${appleData.apple_music_id}`);

      const { error: updateError } = await supabase
        .from('collection')
        .update(appleData)
        .eq('id', albumId);

      if (updateError) {
        console.log('❌ ERROR: Database update failed', updateError);
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

      console.log(`✅ Database updated successfully\n`);

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
      console.error('❌ FATAL ERROR in Apple Music search:', error);
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
    console.error('❌ FATAL ERROR in Apple Music enrichment:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}