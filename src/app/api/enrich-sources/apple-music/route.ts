// src/app/api/enrich-sources/apple-music/route.ts - WITH COMPREHENSIVE LOGGING
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APPLE_MUSIC_TOKEN = process.env.APPLE_MUSIC_TOKEN;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

async function searchAppleMusic(artist: string, title: string) {
  if (!APPLE_MUSIC_TOKEN) {
    throw new Error('Apple Music token not configured');
  }

  const query = encodeURIComponent(`${artist} ${title}`);
  console.log(`  → Searching Apple Music: "${artist}" - "${title}"`);
  
  const res = await fetch(`https://api.music.apple.com/v1/catalog/us/search?types=albums&term=${query}&limit=1`, {
    headers: { 'Authorization': `Bearer ${APPLE_MUSIC_TOKEN}` }
  });

  if (!res.ok) {
    console.log(`  → Apple Music search failed: HTTP ${res.status}`);
    throw new Error(`Apple Music API returned ${res.status}`);
  }

  const data = await res.json();
  const album = data?.results?.albums?.data?.[0];

  if (!album) {
    console.log(`  → No Apple Music match found`);
    return null;
  }

  console.log(`  → Found Apple Music album: "${album.attributes?.name}" (ID: ${album.id})`);
  console.log(`  → Genres: ${album.attributes?.genreNames?.join(', ') || 'none'}`);

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

    console.log(`\n🍎 === APPLE MUSIC ENRICHMENT for Album ID: ${albumId} ===`);

    if (!albumId) {
      console.log('❌ ERROR: No albumId provided');
      return NextResponse.json({
        success: false,
        error: 'albumId required'
      }, { status: 400 });
    }

    // Get album info
    const { data: album, error: dbError } = await supabase
      .from('inventory')
      .select(`
        id,
        release:releases (
          id,
          apple_music_id,
          master:masters (
            id,
            title,
            cover_image_url,
            genres,
            artist:artists (name)
          )
        )
      `)
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      console.log('❌ ERROR: Album not found in database', dbError);
      return NextResponse.json({
        success: false,
        error: 'Album not found'
      }, { status: 404 });
    }

    const release = toSingle(album.release);
    const master = toSingle(release?.master);
    const artistName = toSingle(master?.artist)?.name ?? 'Unknown Artist';
    const albumTitle = master?.title ?? 'Untitled';

    console.log(`✓ Album found: "${artistName}" - "${albumTitle}"`);

    // Skip if already has Apple Music ID
    if (release?.apple_music_id) {
      console.log(`⏭️ Album already has Apple Music ID: ${release.apple_music_id}`);
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Album already has Apple Music ID',
        data: {
          albumId: album.id,
          artist: artistName,
          title: albumTitle,
          apple_music_id: release?.apple_music_id
        }
      });
    }

    // Search Apple Music
    try {
      const appleData = await searchAppleMusic(artistName, albumTitle);

      if (!appleData) {
        console.log(`❌ No Apple Music match found for "${artistName}" - "${albumTitle}"`);
        return NextResponse.json({
          success: false,
          error: 'No match found on Apple Music',
          data: {
            albumId: album.id,
            artist: artistName,
            title: albumTitle,
            searchQuery: `${artistName} ${albumTitle}`
          }
        });
      }

      console.log(`💾 Updating database with Apple Music data...`);

      // Update database
      if (release?.id) {
        const { error: releaseError } = await supabase
          .from('releases')
          .update({
            apple_music_id: appleData.apple_music_id,
            apple_music_url: appleData.apple_music_url,
            apple_music_label: appleData.apple_music_label,
            apple_music_release_date: appleData.apple_music_release_date,
            apple_music_track_count: appleData.apple_music_track_count
          })
          .eq('id', release.id);

        if (releaseError) {
          console.log('❌ ERROR: Database update failed', releaseError);
          return NextResponse.json({
            success: false,
            error: `Database update failed: ${releaseError.message}`,
            data: {
              albumId: album.id,
              artist: artistName,
              title: albumTitle,
              foundData: appleData
            }
          }, { status: 500 });
        }
      }

      if (master?.id) {
        const masterUpdate: Record<string, unknown> = {};
        if (appleData.apple_music_genres?.length) {
          masterUpdate.genres = appleData.apple_music_genres;
        }
        if (!master.cover_image_url && appleData.apple_music_artwork_url) {
          masterUpdate.cover_image_url = appleData.apple_music_artwork_url;
        }

        if (Object.keys(masterUpdate).length > 0) {
          const { error: masterError } = await supabase
            .from('masters')
            .update(masterUpdate)
            .eq('id', master.id);

          if (masterError) {
            console.log('❌ ERROR: Database update failed', masterError);
            return NextResponse.json({
              success: false,
              error: `Database update failed: ${masterError.message}`,
              data: {
                albumId: album.id,
                artist: artistName,
                title: albumTitle,
                foundData: appleData
              }
            }, { status: 500 });
          }
        }
      }

      console.log(`✅ Successfully enriched with Apple Music data\n`);

      return NextResponse.json({
        success: true,
        data: {
          albumId: album.id,
          artist: artistName,
          title: albumTitle,
          apple_music_id: appleData.apple_music_id,
          apple_music_url: appleData.apple_music_url,
          genres: appleData.apple_music_genres,
          label: appleData.apple_music_label,
          release_date: appleData.apple_music_release_date,
          track_count: appleData.apple_music_track_count
        }
      });

    } catch (error) {
      console.error('❌ FATAL ERROR:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Apple Music search failed',
        data: {
          albumId: album.id,
          artist: artistName,
          title: albumTitle
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
