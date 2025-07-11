// src/app/api/manual-recognition/route.ts - Manual search by artist/album
import { NextRequest, NextResponse } from 'next/server';

interface ManualSearchRequest {
  artist: string;
  album?: string;
}

interface RecognitionTrack {
  artist: string;
  title: string;
  album?: string;
  image_url?: string;
  confidence?: number;
  service?: string;
}

interface ManualSearchResult {
  success: boolean;
  track?: RecognitionTrack;
  candidates?: RecognitionTrack[];
  error?: string;
}

// Spotify API response types
interface SpotifyImage {
  url?: string;
}

interface SpotifyArtist {
  name?: string;
}

interface SpotifyAlbum {
  name: string;
  artists: SpotifyArtist[];
  images: SpotifyImage[];
}

interface SpotifySearchResponse {
  albums?: {
    items?: SpotifyAlbum[];
  };
}

// Last.fm API response types
interface LastFmImage {
  '#text'?: string;
  size?: string;
}

interface LastFmArtist {
  name?: string;
}

interface LastFmAlbum {
  name: string;
  artist?: LastFmArtist | string;
  image?: LastFmImage[];
}

interface LastFmAlbumResponse {
  album?: LastFmAlbum;
  error?: number;
}

interface LastFmTopAlbumsResponse {
  topalbums?: {
    album?: LastFmAlbum | LastFmAlbum[];
  };
}

// MusicBrainz API response types
interface MusicBrainzArtistCredit {
  name?: string;
}

interface MusicBrainzReleaseGroup {
  title: string;
  'artist-credit'?: MusicBrainzArtistCredit[];
}

interface MusicBrainzResponse {
  'release-groups'?: MusicBrainzReleaseGroup[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ManualSearchRequest = await request.json();
    
    if (!body.artist?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Artist name is required' },
        { status: 400 }
      );
    }

    console.log(`Manual search for: ${body.artist}${body.album ? ` - ${body.album}` : ''}`);

    // Try different search services in order
    const searchServices = [
      { name: 'Spotify', enabled: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) },
      { name: 'LastFM', enabled: !!process.env.LASTFM_API_KEY },
      { name: 'MusicBrainz', enabled: true } // No API key required
    ];

    const enabledServices = searchServices.filter(s => s.enabled);
    
    console.log(`Trying manual search with: ${enabledServices.map(s => s.name).join(', ')}`);

    for (const service of enabledServices) {
      try {
        let result: ManualSearchResult;
        
        switch (service.name) {
          case 'Spotify':
            result = await searchWithSpotify(body.artist, body.album);
            break;
          case 'LastFM':
            result = await searchWithLastFM(body.artist, body.album);
            break;
          case 'MusicBrainz':
            result = await searchWithMusicBrainz(body.artist, body.album);
            break;
          default:
            continue;
        }

        if (result.success && result.track) {
          console.log(`✅ Manual search success with ${service.name}:`, result.track);
          return NextResponse.json(result);
        }
      } catch (error) {
        console.error(`Manual search error with ${service.name}:`, error);
        // Continue to next service
      }
    }

    // If no services succeeded
    return NextResponse.json({
      success: false,
      error: `No results found for "${body.artist}"${body.album ? ` - "${body.album}"` : ''}`
    });

  } catch (error) {
    console.error('Manual search error:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

// Spotify Web API search
async function searchWithSpotify(artist: string, album?: string): Promise<ManualSearchResult> {
  try {
    // Get Spotify access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get Spotify token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Search for albums by artist
    const query = album ? `artist:"${artist}" album:"${album}"` : `artist:"${artist}"`;
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=10`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!searchResponse.ok) {
      throw new Error('Spotify search failed');
    }

    const data: SpotifySearchResponse = await searchResponse.json();
    
    if (data.albums?.items && data.albums.items.length > 0) {
      const albums = data.albums.items;
      
      // Convert to our format - use first album as primary
      const primaryAlbum = albums[0];
      if (!primaryAlbum) return { success: false, error: 'No primary album found' };
      
      const primaryTrack: RecognitionTrack = {
        artist: primaryAlbum.artists[0]?.name || artist,
        title: 'Album', // We're searching albums, not tracks
        album: primaryAlbum.name,
        image_url: primaryAlbum.images[0]?.url,
        confidence: 0.9,
        service: 'Spotify Search'
      };

      // Additional albums as candidates
      const candidates: RecognitionTrack[] = albums.slice(1, 6).map((album: SpotifyAlbum) => ({
        artist: album.artists[0]?.name || artist,
        title: 'Album',
        album: album.name,
        image_url: album.images[0]?.url,
        confidence: 0.8,
        service: 'Spotify Search'
      }));

      return {
        success: true,
        track: primaryTrack,
        candidates: candidates
      };
    }

    return { success: false, error: 'No Spotify results found' };
  } catch (error) {
    console.error('Spotify search error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Spotify search failed: ${message}` };
  }
}

// Last.fm API search (updated to use API secret if available)
async function searchWithLastFM(artist: string, album?: string): Promise<ManualSearchResult> {
  try {
    const apiKey = process.env.LASTFM_API_KEY!;
    // Note: API secret available but not needed for read operations
    
    if (album) {
      // Search for specific album
      const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&format=json`;
      
      const response = await fetch(url);
      const data: LastFmAlbumResponse = await response.json();
      
      if (data.album && !data.error) {
        const artistName = typeof data.album.artist === 'string' ? data.album.artist : data.album.artist?.name;
        return {
          success: true,
          track: {
            artist: artistName || artist,
            title: 'Album',
            album: data.album.name,
            image_url: data.album.image?.find((img: LastFmImage) => img.size === 'extralarge')?.['#text'],
            confidence: 0.85,
            service: 'Last.fm'
          },
          candidates: []
        };
      }
    }
    
    // Search for artist's top albums
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettopalbums&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json&limit=10`;
    
    const response = await fetch(url);
    const data: LastFmTopAlbumsResponse = await response.json();
    
    if (data.topalbums?.album) {
      const albums = Array.isArray(data.topalbums.album) ? data.topalbums.album : [data.topalbums.album];
      
      if (albums.length === 0) {
        return { success: false, error: 'No albums found' };
      }
      
      const primaryAlbum = albums[0];
      const artistName = typeof primaryAlbum.artist === 'string' ? primaryAlbum.artist : primaryAlbum.artist?.name;
      const primaryTrack: RecognitionTrack = {
        artist: artistName || artist,
        title: 'Album',
        album: primaryAlbum.name,
        image_url: primaryAlbum.image?.find((img: LastFmImage) => img.size === 'extralarge')?.['#text'],
        confidence: 0.8,
        service: 'Last.fm'
      };

      const candidates: RecognitionTrack[] = albums.slice(1, 6).map((album: LastFmAlbum) => {
        const candidateArtistName = typeof album.artist === 'string' ? album.artist : album.artist?.name;
        return {
          artist: candidateArtistName || artist,
          title: 'Album',
          album: album.name,
          image_url: album.image?.find((img: LastFmImage) => img.size === 'extralarge')?.['#text'],
          confidence: 0.75,
          service: 'Last.fm'
        };
      });

      return {
        success: true,
        track: primaryTrack,
        candidates: candidates
      };
    }

    return { success: false, error: 'No Last.fm results found' };
  } catch (error) {
    console.error('Last.fm search error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Last.fm search failed: ${message}` };
  }
}

// MusicBrainz search (no API key required)
async function searchWithMusicBrainz(artist: string, album?: string): Promise<ManualSearchResult> {
  try {
    let query = `artist:"${artist}"`;
    if (album) {
      query += ` AND release:"${album}"`;
    }
    
    const url = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=10`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DeadWaxDialogues/1.0 (contact@deadwaxdialogues.com)'
      }
    });

    if (!response.ok) {
      throw new Error('MusicBrainz request failed');
    }

    const data: MusicBrainzResponse = await response.json();
    
    if (data['release-groups'] && data['release-groups'].length > 0) {
      const releases = data['release-groups'];
      
      const primaryRelease = releases[0];
      if (!primaryRelease) {
        return { success: false, error: 'No primary release found' };
      }
      
      const primaryTrack: RecognitionTrack = {
        artist: primaryRelease['artist-credit']?.[0]?.name || artist,
        title: 'Album',
        album: primaryRelease.title,
        image_url: undefined, // MusicBrainz doesn't provide cover art directly
        confidence: 0.7,
        service: 'MusicBrainz'
      };

      const candidates: RecognitionTrack[] = releases.slice(1, 6).map((release: MusicBrainzReleaseGroup) => ({
        artist: release['artist-credit']?.[0]?.name || artist,
        title: 'Album',
        album: release.title,
        image_url: undefined,
        confidence: 0.65,
        service: 'MusicBrainz'
      }));

      return {
        success: true,
        track: primaryTrack,
        candidates: candidates
      };
    }

    return { success: false, error: 'No MusicBrainz results found' };
  } catch (error) {
    console.error('MusicBrainz search error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `MusicBrainz search failed: ${message}` };
  }
}

export async function GET(): Promise<NextResponse> {
  const services = [
    { 
      name: 'Spotify', 
      enabled: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
      config: 'SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET'
    },
    { 
      name: 'Last.fm', 
      enabled: !!process.env.LASTFM_API_KEY,
      config: 'LASTFM_API_KEY + LASTFM_API_SECRET (optional)'
    },
    { 
      name: 'MusicBrainz', 
      enabled: true,
      config: 'No API key required'
    }
  ];

  return NextResponse.json({
    message: 'Manual Recognition Search API',
    services: services.map(s => ({
      name: s.name,
      enabled: s.enabled,
      config: s.config
    })),
    usage: {
      method: 'POST',
      body: {
        artist: 'Required - Artist name',
        album: 'Optional - Album name for more specific search'
      }
    },
    envVariables: [
      'SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET (recommended)',
      'LASTFM_API_KEY + LASTFM_API_SECRET (fallback, secret optional)',
      'MusicBrainz requires no keys (final fallback)'
    ]
  });
}