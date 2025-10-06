// src/app/api/enrich-sources/spotify/route.ts - Spotify-only enrichment
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

let spotifyToken: { token: string; expires: number } | null = null;

async function getSpotifyToken(): Promise<string> {
  if (spotifyToken && Date.now() < spotifyToken.expires) {
    return spotifyToken.token;
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Missing Spotify credentials');
  }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  if (!res.ok) throw new Error('Spotify auth failed');
  
  const data = await res.json();
  spotifyToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000
  };
  
  return spotifyToken.token;
}

async function searchSpotify(artist: string, title: string) {
  const token = await getSpotifyToken();
  const query = encodeURIComponent(`artist:${artist} album:${title}`);
  
  const res = await fetch(`https://api.spotify.com/v1/search?type=album&limit=1&q=${query}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`Spotify API returned ${res.status}`);
  }
  
  const data = await res.json();
  const album = data?.albums?.items?.[0];
  
  if (!album) {
    return null;
  }

  // Get artist genres
  let genres: string[] = [];
  if (album.artists && album.artists.length > 0) {
    const artistId = album.artists[0].id;
    
    try {
      const artistRes = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (artistRes.ok) {
        const artistData = await artistRes.json();
        genres = artistData.genres || [];
      }
    } catch (err) {
      console.error('Failed to fetch artist genres:', err);
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
      .select('id, artist, title, spotify_id')
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      return NextResponse.json({
        success: false,
        error: 'Album not found'
      }, { status: 404 });
    }

    // Skip if already has Spotify ID
    if (album.spotify_id) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Album already has Spotify ID',
        data: {
          albumId: album.id,
          artist: album.artist,
          title: album.title,
          spotify_id: album.spotify_id
        }
      });
    }

    // Search Spotify
    try {
      const spotifyData = await searchSpotify(album.artist, album.title);

      if (!spotifyData) {
        return NextResponse.json({
          success: false,
          error: 'No match found on Spotify',
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
        .update(spotifyData)
        .eq('id', albumId);

      if (updateError) {
        return NextResponse.json({
          success: false,
          error: `Database update failed: ${updateError.message}`,
          data: {
            albumId: album.id,
            artist: album.artist,
            title: album.title,
            foundData: spotifyData
          }
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: {
          albumId: album.id,
          artist: album.artist,
          title: album.title,
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
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Spotify search failed',
        data: {
          albumId: album.id,
          artist: album.artist,
          title: album.title
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Spotify enrichment error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}