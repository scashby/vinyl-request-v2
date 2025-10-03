// src/app/api/enrich-multi-batch/route.ts - COMPLETE FILE
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const APPLE_MUSIC_TOKEN = process.env.APPLE_MUSIC_TOKEN;
const GENIUS_TOKEN = process.env.GENIUS_API_TOKEN;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Types
type Track = {
  position?: string;
  title?: string;
  duration?: string;
  type_?: string;
  lyrics_url?: string;
};

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

type UpdateData = Partial<SpotifyData & AppleMusicData> & {
  tracklists?: string;
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
  
  const data = await res.json();
  spotifyToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000
  };
  
  return spotifyToken.token;
}

async function searchSpotify(artist: string, title: string) {
  try {
    const token = await getSpotifyToken();
    const query = encodeURIComponent(`artist:${artist} album:${title}`);
    
    const res = await fetch(`https://api.spotify.com/v1/search?type=album&limit=1&q=${query}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) return null;
    
    const data = await res.json();
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

async function searchAppleMusic(artist: string, title: string) {
  try {
    if (!APPLE_MUSIC_TOKEN) return null;

    const query = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(`https://api.music.apple.com/v1/catalog/us/search?types=albums&term=${query}&limit=1`, {
      headers: { 'Authorization': `Bearer ${APPLE_MUSIC_TOKEN}` }
    });

    if (!res.ok) return null;

    const data = await res.json();
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

async function searchLyrics(artist: string, trackTitle: string) {
  try {
    if (!GENIUS_TOKEN) return null;

    const query = encodeURIComponent(`${artist} ${trackTitle}`);
    const searchRes = await fetch(`https://api.genius.com/search?q=${query}`, {
      headers: { 'Authorization': `Bearer ${GENIUS_TOKEN}` }
    });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cursor = body.cursor || 0;
    const limit = Math.min(body.limit || 20, 50);

    // FIXED: Get albums missing EITHER Spotify OR Apple Music (or both)
    const { data: albums, error } = await supabase
      .from('collection')
      .select('id, artist, title, tracklists, spotify_id, apple_music_id')
      .or('spotify_id.is.null,apple_music_id.is.null')
      .gt('id', cursor)
      .order('id', { ascending: true })
      .limit(limit);

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    if (!albums || albums.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        enriched: 0,
        hasMore: false
      });
    }

    let processed = 0;
    let enriched = 0;
    let lastAlbum = null;

    for (const album of albums) {
      processed++;
      let hasUpdate = false;
      const updateData: UpdateData = {};

      // Search Spotify if missing
      if (!album.spotify_id) {
        const spotifyData = await searchSpotify(album.artist, album.title);
        if (spotifyData) {
          Object.assign(updateData, spotifyData);
          hasUpdate = true;
        }
        await sleep(500);
      }

      // Search Apple Music if missing
      if (!album.apple_music_id) {
        const appleMusicData = await searchAppleMusic(album.artist, album.title);
        if (appleMusicData) {
          Object.assign(updateData, appleMusicData);
          hasUpdate = true;
        }
        await sleep(500);
      }

      // Enrich tracklist with lyrics
      if (album.tracklists) {
        try {
          const tracks = typeof album.tracklists === 'string' 
            ? JSON.parse(album.tracklists)
            : album.tracklists;

          if (Array.isArray(tracks) && tracks.length > 0) {
            const enrichedTracks = await Promise.all(
              tracks.map(async (track: Track) => {
                if (!track.lyrics_url && track.title) {
                  const lyricsData = await searchLyrics(album.artist, track.title);
                  await sleep(1000);
                  return {
                    ...track,
                    lyrics_url: lyricsData?.genius_url
                  };
                }
                return track;
              })
            );

            updateData.tracklists = JSON.stringify(enrichedTracks);
            hasUpdate = true;
          }
        } catch (err) {
          console.error('Tracklist enrichment error:', err);
        }
      }

      // Update if we have new data
      if (hasUpdate) {
        const { error: updateError } = await supabase
          .from('collection')
          .update(updateData)
          .eq('id', album.id);

        if (!updateError) {
          enriched++;
          lastAlbum = {
            artist: album.artist,
            title: album.title,
            spotify: !!updateData.spotify_id,
            appleMusic: !!updateData.apple_music_id,
            lyrics: !!updateData.tracklists
          };
        }
      }
    }

    const hasMore = albums.length === limit;
    const nextCursor = hasMore ? albums[albums.length - 1].id : null;

    return NextResponse.json({
      success: true,
      processed,
      enriched,
      hasMore,
      nextCursor,
      lastAlbum
    });

  } catch (error) {
    console.error('Batch enrichment error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}