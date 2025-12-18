// src/app/api/search-covers/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface ImageResult {
  url: string;
  width: number;
  height: number;
  source: 'spotify' | 'lastfm' | 'musicbrainz';
}

interface SpotifyImage {
  url: string;
  width?: number;
  height?: number;
}

interface SpotifyAlbum {
  images: SpotifyImage[];
}

interface SpotifySearchResponse {
  albums?: {
    items: SpotifyAlbum[];
  };
}

interface LastFmImage {
  '#text': string;
  size: string;
}

interface LastFmAlbum {
  image: LastFmImage[];
}

interface LastFmSearchResponse {
  results?: {
    albummatches?: {
      album: LastFmAlbum[];
    };
  };
  album?: {
    image: LastFmImage[];
  };
}

interface MusicBrainzRelease {
  id: string;
}

interface MusicBrainzSearchResponse {
  releases: MusicBrainzRelease[];
}

interface CoverArtImage {
  image: string;
  thumbnails?: {
    large?: string;
  };
}

interface CoverArtResponse {
  images: CoverArtImage[];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  
  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  const results: ImageResult[] = [];

  try {
    // 1. Search Spotify
    const spotifyToken = await getSpotifyToken();
    if (spotifyToken) {
      const spotifyResults = await searchSpotify(query, spotifyToken);
      results.push(...spotifyResults);
    }

    // 2. Search Last.fm
    const lastfmResults = await searchLastFm(query);
    results.push(...lastfmResults);

    // 3. Search MusicBrainz Cover Art Archive (free, no auth)
    const mbResults = await searchMusicBrainz(query);
    results.push(...mbResults);

    // Deduplicate by URL
    const uniqueResults = Array.from(
      new Map(results.map(item => [item.url, item])).values()
    );

    return NextResponse.json({ results: uniqueResults });
  } catch (error) {
    console.error('Cover search error:', error);
    return NextResponse.json({ error: 'Search failed', results: [] }, { status: 500 });
  }
}

async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('Spotify credentials not configured');
    return null;
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });

    const data = await response.json() as { access_token: string };
    return data.access_token;
  } catch (error) {
    console.error('Spotify auth error:', error);
    return null;
  }
}

async function searchSpotify(query: string, token: string): Promise<ImageResult[]> {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=20`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json() as SpotifySearchResponse;
    
    if (!data.albums?.items) return [];

    return data.albums.items
      .filter((album: SpotifyAlbum) => album.images && album.images.length > 0)
      .flatMap((album: SpotifyAlbum) => 
        album.images.map((img: SpotifyImage) => ({
          url: img.url,
          width: img.width || 640,
          height: img.height || 640,
          source: 'spotify' as const
        }))
      );
  } catch (error) {
    console.error('Spotify search error:', error);
    return [];
  }
}

async function searchLastFm(query: string): Promise<ImageResult[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  
  if (!apiKey) {
    console.warn('Last.fm API key not configured');
    return [];
  }

  try {
    // Parse query for artist and album
    const parts = query.toLowerCase().split(' ');
    let artist = '';
    let album = '';
    
    // Simple parsing - everything before "album" is artist, after is album name
    const albumIndex = parts.indexOf('album');
    if (albumIndex > 0) {
      artist = parts.slice(0, albumIndex).join(' ');
      album = parts.slice(albumIndex + 1).join(' ');
    } else {
      // Try to split by common patterns
      const words = query.split(' ');
      if (words.length > 2) {
        artist = words.slice(0, Math.ceil(words.length / 2)).join(' ');
        album = words.slice(Math.ceil(words.length / 2)).join(' ');
      }
    }

    if (!artist || !album) {
      // Fallback: search for albums
      const response = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(query)}&api_key=${apiKey}&format=json&limit=20`
      );
      const data = await response.json() as LastFmSearchResponse;
      
      if (!data.results?.albummatches?.album) return [];

      return data.results.albummatches.album
        .filter((album: LastFmAlbum) => album.image && album.image.length > 0)
        .flatMap((album: LastFmAlbum) =>
          album.image
            .filter((img: LastFmImage) => img['#text'] && img.size !== 'small')
            .map((img: LastFmImage) => ({
              url: img['#text'],
              width: img.size === 'extralarge' ? 300 : img.size === 'large' ? 174 : 64,
              height: img.size === 'extralarge' ? 300 : img.size === 'large' ? 174 : 64,
              source: 'lastfm' as const
            }))
        );
    }

    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&api_key=${apiKey}&format=json`
    );
    
    const data = await response.json() as LastFmSearchResponse;
    
    if (!data.album?.image) return [];

    return data.album.image
      .filter((img: LastFmImage) => img['#text'] && img.size !== 'small')
      .map((img: LastFmImage) => ({
        url: img['#text'],
        width: img.size === 'extralarge' ? 300 : img.size === 'large' ? 174 : 64,
        height: img.size === 'extralarge' ? 300 : img.size === 'large' ? 174 : 64,
        source: 'lastfm' as const
      }));
  } catch (error) {
    console.error('Last.fm search error:', error);
    return [];
  }
}

async function searchMusicBrainz(query: string): Promise<ImageResult[]> {
  try {
    // Search MusicBrainz for releases
    const searchResponse = await fetch(
      `https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(query)}&fmt=json&limit=10`,
      {
        headers: {
          'User-Agent': 'DWDCollectionManager/1.0 (https://deadwaxdialogues.com)'
        }
      }
    );

    const searchData = await searchResponse.json() as MusicBrainzSearchResponse;
    
    if (!searchData.releases) return [];

    const results: ImageResult[] = [];

    // Get cover art for each release
    for (const release of searchData.releases.slice(0, 5)) {
      try {
        const coverResponse = await fetch(
          `https://coverartarchive.org/release/${release.id}`,
          {
            headers: {
              'User-Agent': 'DWDCollectionManager/1.0 (https://deadwaxdialogues.com)'
            }
          }
        );

        if (coverResponse.ok) {
          const coverData = await coverResponse.json() as CoverArtResponse;
          
          if (coverData.images) {
            results.push(...coverData.images.map((img: CoverArtImage) => ({
              url: img.thumbnails?.large || img.image,
              width: 500,
              height: 500,
              source: 'musicbrainz' as const
            })));
          }
        }
      } catch {
        // Skip if cover not found
        continue;
      }
    }

    return results;
  } catch (error) {
    console.error('MusicBrainz search error:', error);
    return [];
  }
}