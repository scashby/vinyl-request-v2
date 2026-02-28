// src/app/api/enrich-sources/spotify/route.ts - WITH COMPREHENSIVE LOGGING
import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";
import { stripDiscogsDisambiguationSuffix } from "src/lib/artistName";
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

let spotifyToken: { token: string; expires: number } | null = null;

async function getSpotifyToken(): Promise<string> {
  if (spotifyToken && Date.now() < spotifyToken.expires) {
    console.log('  → Using cached Spotify token');
    return spotifyToken.token;
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Missing Spotify credentials');
  }

  console.log('  → Fetching new Spotify token...');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  if (!res.ok) {
    console.log(`  → Spotify auth failed: HTTP ${res.status}`);
    throw new Error('Spotify auth failed');
  }
  
  const data = await res.json();
  spotifyToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000
  };
  
  console.log('  → New Spotify token acquired');
  return spotifyToken.token;
}

async function searchSpotify(artist: string, title: string) {
  const token = await getSpotifyToken();
  const searchArtist = stripDiscogsDisambiguationSuffix(artist) || artist;
  const query = encodeURIComponent(`artist:${searchArtist} album:${title}`);
  
  console.log(`  → Searching Spotify: "${searchArtist}" - "${title}"`);
  
  const res = await fetch(`https://api.spotify.com/v1/search?type=album&limit=1&q=${query}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    console.log(`  → Spotify search failed: HTTP ${res.status}`);
    throw new Error(`Spotify API returned ${res.status}`);
  }
  
  const data = await res.json();
  const album = data?.albums?.items?.[0];
  
  if (!album) {
    console.log(`  → No Spotify match found`);
    return null;
  }

  console.log(`  → Found Spotify album: "${album.name}" (ID: ${album.id})`);

  // Get artist genres
  let genres: string[] = [];
  if (album.artists && album.artists.length > 0) {
    const artistId = album.artists[0].id;
    
    try {
      console.log(`  → Fetching artist genres for ${artistId}...`);
      const artistRes = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (artistRes.ok) {
        const artistData = await artistRes.json();
        genres = artistData.genres || [];
        console.log(`  → Got ${genres.length} genres: ${genres.join(', ')}`);
      }
    } catch (err) {
      console.error('  → Failed to fetch artist genres:', err);
    }
  }

  return {
    spotify_id: album.id,
    spotify_url: album.external_urls?.spotify,
    spotify_popularity: album.popularity,
    spotify_genres: genres,
    spotify_label: album.label,
    spotify_release_date: album.release_date,
    spotify_total_tracks: album.total_tracks,
    spotify_image_url: album.images?.[0]?.url
  };
}

export async function POST(req: Request) {
  const supabase = supabaseServer(getAuthHeader(req));
  try {
    const body = await req.json();
    const { albumId } = body;

    console.log(`\n🎵 === SPOTIFY ENRICHMENT for Album ID: ${albumId} ===`);

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
          spotify_album_id,
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

    // Skip if already has Spotify ID
    if (release?.spotify_album_id) {
      console.log(`⏭️ Album already has Spotify ID: ${release.spotify_album_id}`);
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Album already has Spotify ID',
        data: {
          albumId: album.id,
          artist: artistName,
          title: albumTitle,
          spotify_id: release?.spotify_album_id
        }
      });
    }

    // Search Spotify
    try {
      const spotifyData = await searchSpotify(artistName, albumTitle);

      if (!spotifyData) {
        console.log(`❌ No Spotify match found for "${artistName}" - "${albumTitle}"`);
        return NextResponse.json({
          success: false,
          error: 'No match found on Spotify',
          data: {
            albumId: album.id,
            artist: artistName,
            title: albumTitle,
            searchQuery: `${artistName} ${albumTitle}`
          }
        });
      }

      console.log(`💾 Updating database with Spotify data...`);
      
      // Update database
      if (release?.id) {
        const { error: releaseError } = await supabase
          .from('releases')
          .update({
            spotify_album_id: spotifyData.spotify_id,
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
              foundData: spotifyData
            }
          }, { status: 500 });
        }
      }

      if (master?.id) {
        const masterUpdate: Record<string, unknown> = {};
        if (spotifyData.spotify_genres?.length) {
          masterUpdate.genres = spotifyData.spotify_genres;
        }
        if (!master.cover_image_url && spotifyData.spotify_image_url) {
          masterUpdate.cover_image_url = spotifyData.spotify_image_url;
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
                foundData: spotifyData
              }
            }, { status: 500 });
          }
        }
      }

      console.log(`✅ Successfully enriched with Spotify data\n`);

      return NextResponse.json({
        success: true,
        data: {
          albumId: album.id,
          artist: artistName,
          title: albumTitle,
          spotify_id: spotifyData.spotify_id,
          spotify_url: spotifyData.spotify_url,
          genres: spotifyData.spotify_genres,
          popularity: spotifyData.spotify_popularity,
          label: spotifyData.spotify_label,
          release_date: spotifyData.spotify_release_date,
          total_tracks: spotifyData.spotify_total_tracks
        }
      });

    } catch (error) {
      console.error('❌ FATAL ERROR:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Spotify search failed',
        data: {
          albumId: album.id,
          artist: artistName,
          title: albumTitle
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ FATAL ERROR in Spotify enrichment:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
// AUDIT: inspected, no changes.
