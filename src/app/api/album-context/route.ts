// src/app/api/album-context/route.ts - New API for managing album context
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'lib/supabaseClient';

interface AlbumContextRequest {
  artist: string;
  album: string;
  trackListing?: string[];
  collectionId?: number;
  source?: string;
}

interface SpotifyTrack {
  name: string;
  track_number: number;
  disc_number: number;
  duration_ms: number;
}

interface SpotifyAlbum {
  name: string;
  artists: Array<{ name: string }>;
  images: Array<{ url: string }>;
  tracks: {
    items: SpotifyTrack[];
  };
  total_tracks: number;
}

interface LastFmTrack {
  name: string;
  duration?: string;
}

interface LastFmImage {
  '#text': string;
  size: string;
}

// Get Spotify album details including track listing
async function getSpotifyAlbumDetails(artist: string, album: string): Promise<{
  image_url?: string;
  track_listing?: string[];
  track_count?: number;
} | null> {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return null;
  }

  try {
    // Get access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) return null;

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Search for the album
    const query = `artist:"${artist}" album:"${album}"`;
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=1`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json();
    const albums = searchData.albums?.items;
    
    if (!albums || albums.length === 0) return null;

    const albumId = albums[0].id;
    const albumImage = albums[0].images?.[0]?.url;

    // Get full album details including tracks
    const albumUrl = `https://api.spotify.com/v1/albums/${albumId}`;
    const albumResponse = await fetch(albumUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!albumResponse.ok) return null;

    const albumData: SpotifyAlbum = await albumResponse.json();
    
    const trackListing = albumData.tracks.items
      .sort((a, b) => {
        if (a.disc_number !== b.disc_number) {
          return a.disc_number - b.disc_number;
        }
        return a.track_number - b.track_number;
      })
      .map(track => track.name);

    return {
      image_url: albumImage,
      track_listing: trackListing,
      track_count: albumData.total_tracks
    };
  } catch (error) {
    console.error('Spotify album details error:', error);
    return null;
  }
}

// Get Last.fm album details
async function getLastFmAlbumDetails(artist: string, album: string): Promise<{
  image_url?: string;
  track_listing?: string[];
  track_count?: number;
} | null> {
  if (!process.env.LASTFM_API_KEY) {
    return null;
  }

  try {
    const apiKey = process.env.LASTFM_API_KEY;
    const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&format=json`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.album && !data.error) {
      const trackListing = data.album.tracks?.track 
        ? (Array.isArray(data.album.tracks.track) 
           ? data.album.tracks.track.map((t: LastFmTrack) => t.name)
           : [data.album.tracks.track.name])
        : [];

      const imageUrl = data.album.image?.find((img: LastFmImage) => img.size === 'extralarge')?.['#text'];

      return {
        image_url: imageUrl,
        track_listing: trackListing,
        track_count: trackListing.length
      };
    }
  } catch (error) {
    console.error('Last.fm album details error:', error);
  }

  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: AlbumContextRequest = await request.json();
    
    if (!body.artist?.trim() || !body.album?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Artist and album are required' },
        { status: 400 }
      );
    }

    console.log(`Setting album context: ${body.artist} - ${body.album}`);

    // Try to get enhanced details from music services
    let albumDetails = await getSpotifyAlbumDetails(body.artist, body.album);
    
    if (!albumDetails) {
      console.log('Spotify failed, trying Last.fm...');
      albumDetails = await getLastFmAlbumDetails(body.artist, body.album);
    }

    // Check for collection match
    const { data: collectionMatch } = await supabase
      .from('collection')
      .select('*')
      .ilike('artist', body.artist)
      .ilike('title', body.album)
      .limit(1);

    const albumContextData = {
      artist: body.artist,
      title: body.album,
      year: new Date().getFullYear().toString(),
      image_url: albumDetails?.image_url || collectionMatch?.[0]?.image_url || null,
      folder: collectionMatch?.[0]?.folder || null,
      collection_id: body.collectionId || collectionMatch?.[0]?.id || null,
      track_count: albumDetails?.track_count || body.trackListing?.length || 0,
      track_listing: albumDetails?.track_listing || body.trackListing || [],
      source: body.source || 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Clear existing context and set new one
    await supabase.from('album_context').delete().neq('id', 0);
    const { error } = await supabase.from('album_context').insert(albumContextData);

    if (error) {
      throw error;
    }

    console.log(`✅ Album context set: ${body.artist} - ${body.album} (${albumDetails?.track_count || 0} tracks)`);

    return NextResponse.json({
      success: true,
      message: `Album context set: ${body.artist} - ${body.album}`,
      details: {
        track_count: albumDetails?.track_count || 0,
        has_artwork: !!albumDetails?.image_url,
        source: albumDetails ? 'spotify/lastfm' : 'manual',
        collection_match: !!collectionMatch?.[0]
      }
    });

  } catch (error: unknown) {
    console.error('Album context error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Failed to set album context: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const { data, error } = await supabase
      .from('album_context')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({
        success: false,
        context: null,
        message: 'No album context set'
      });
    }

    // Check if context is still valid (less than 2 hours old)
    const contextAge = Date.now() - new Date(data.created_at).getTime();
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours

    if (contextAge > maxAge) {
      // Clear expired context
      await supabase.from('album_context').delete().eq('id', data.id);
      
      return NextResponse.json({
        success: false,
        context: null,
        message: 'Album context expired and cleared'
      });
    }

    return NextResponse.json({
      success: true,
      context: data,
      age_minutes: Math.floor(contextAge / (1000 * 60))
    });

  } catch (error: unknown) {
    console.error('Get album context error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(): Promise<NextResponse> {
  try {
    await supabase.from('album_context').delete().neq('id', 0);
    
    return NextResponse.json({
      success: true,
      message: 'Album context cleared'
    });

  } catch (error: unknown) {
    console.error('Clear album context error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}