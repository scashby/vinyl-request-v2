// src/app/api/enrich-multi/route.ts - Multi-source enrichment with full lyrics
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const APPLE_MUSIC_TOKEN = process.env.APPLE_MUSIC_TOKEN;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Types
type SpotifyData = {
  spotify_id: string;
  spotify_url?: string;
  spotify_popularity?: number;
  spotify_genres: string[];
  spotify_label?: string;
  spotify_release_date?: string;
  spotify_total_tracks?: number;
  spotify_image_url?: string;
};

type AppleMusicData = {
  apple_music_id: string;
  apple_music_url?: string;
  apple_music_genre?: string;
  apple_music_genres: string[];
  apple_music_label?: string;
  apple_music_release_date?: string;
  apple_music_track_count?: number;
  apple_music_artwork_url?: string;
};

type LyricsData = {
  genius_url?: string;
  genius_id?: number;
};

type Track = {
  position?: string;
  title?: string;
  duration?: string;
  type_?: string;
  lyrics_url?: string;
};

// Spotify Auth
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
  
  const data = await res.json() as { access_token: string; expires_in: number };
  spotifyToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000
  };
  
  return spotifyToken.token;
}

// Spotify Search
async function searchSpotify(artist: string, title: string): Promise<SpotifyData | null> {
  try {
    const token = await getSpotifyToken();
    const query = encodeURIComponent(`artist:${artist} album:${title}`);
    
    const res = await fetch(`https://api.spotify.com/v1/search?type=album&limit=1&q=${query}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) return null;
    
    const data = await res.json() as { albums?: { items?: Array<{
      id: string;
      external_urls?: { spotify?: string };
      popularity?: number;
      genres?: string[];
      label?: string;
      release_date?: string;
      total_tracks?: number;
      images?: Array<{ url?: string }>;
    }> } };
    
    const album = data?.albums?.items?.[0];
    
    if (!album) return null;

    return {
      spotify_id: album.id,
      spotify_url: album.external_urls?.spotify,
      spotify_popularity: album.popularity,
      spotify_genres: album.genres || [],
      spotify_label: album.label,
      spotify_release_date: album.release_date,
      spotify_total_tracks: album.total_tracks,
      spotify_image_url: album.images?.[0]?.url
    };
  } catch (error) {
    console.error('Spotify search error:', error);
    return null;
  }
}

// Apple Music Search
async function searchAppleMusic(artist: string, title: string): Promise<AppleMusicData | null> {
  try {
    if (!APPLE_MUSIC_TOKEN) return null;

    const query = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(`https://api.music.apple.com/v1/catalog/us/search?types=albums&term=${query}&limit=1`, {
      headers: {
        'Authorization': `Bearer ${APPLE_MUSIC_TOKEN}`
      }
    });

    if (!res.ok) return null;

    const data = await res.json() as {
      results?: {
        albums?: {
          data?: Array<{
            id: string;
            attributes?: {
              url?: string;
              genreNames?: string[];
              recordLabel?: string;
              releaseDate?: string;
              trackCount?: number;
              artwork?: { url?: string };
            };
          }>;
        };
      };
    };
    
    const album = data?.results?.albums?.data?.[0];

    if (!album) return null;

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
  } catch (error) {
    console.error('Apple Music search error:', error);
    return null;
  }
}

// Lyrics - using Genius API
async function searchLyrics(artist: string, trackTitle: string): Promise<LyricsData | null> {
  try {
    const GENIUS_TOKEN = process.env.GENIUS_API_TOKEN;
    if (!GENIUS_TOKEN) return null;

    const query = encodeURIComponent(`${artist} ${trackTitle}`);
    const searchRes = await fetch(`https://api.genius.com/search?q=${query}`, {
      headers: { 'Authorization': `Bearer ${GENIUS_TOKEN}` }
    });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json() as {
      response?: {
        hits?: Array<{
          result?: {
            url?: string;
            id?: number;
          };
        }>;
      };
    };
    
    const hit = searchData?.response?.hits?.[0];

    if (!hit) return null;

    return {
      genius_url: hit.result?.url,
      genius_id: hit.result?.id
    };
  } catch (error) {
    console.error('Lyrics search error:', error);
    return null;
  }
}

type Body = {
  albumId: number;
};

type UpdateData = Partial<SpotifyData & AppleMusicData> & {
  tracklists?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    
    if (!body.albumId) {
      return NextResponse.json({ error: 'Missing albumId' }, { status: 400 });
    }

    // Fetch the album
    const { data: album, error } = await supabase
      .from('collection')
      .select('id, artist, title, tracklists')
      .eq('id', body.albumId)
      .single();

    if (error || !album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const albumData = album as { 
      id: number; 
      artist: string; 
      title: string; 
      tracklists: string | Track[] | null;
    };

    // Search Spotify
    const spotifyData = await searchSpotify(albumData.artist, albumData.title);
    await sleep(500);

    // Search Apple Music
    const appleMusicData = await searchAppleMusic(albumData.artist, albumData.title);
    await sleep(500);

    // Enrich tracklist with lyrics
    let enrichedTracklist: string | null = null;
    if (albumData.tracklists) {
      try {
        const tracks: Track[] = typeof albumData.tracklists === 'string' 
          ? JSON.parse(albumData.tracklists) as Track[]
          : albumData.tracklists as Track[];

        if (Array.isArray(tracks) && tracks.length > 0) {
          // Enrich ALL tracks with lyrics
          const enrichedTracks = await Promise.all(
            tracks.map(async (track: Track) => {
              const lyricsData = await searchLyrics(albumData.artist, track.title || '');
              await sleep(1000); // Rate limit between requests
              return {
                ...track,
                lyrics_url: lyricsData?.genius_url
              };
            })
          );

          enrichedTracklist = JSON.stringify(enrichedTracks);
        }
      } catch (err) {
        console.error('Tracklist enrichment error:', err);
      }
    }

    // Update database with new metadata
    const updateData: UpdateData = {};
    
    if (spotifyData) {
      Object.assign(updateData, spotifyData);
    }
    
    if (appleMusicData) {
      Object.assign(updateData, appleMusicData);
    }

    if (enrichedTracklist) {
      updateData.tracklists = enrichedTracklist;
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('collection')
        .update(updateData)
        .eq('id', albumData.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      enriched: {
        spotify: !!spotifyData,
        appleMusic: !!appleMusicData,
        lyrics: !!enrichedTracklist
      },
      data: updateData
    });

  } catch (error) {
    console.error('Enrichment error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}