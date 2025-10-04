// src/app/api/enrich-multi/route.ts - COMPLETE FIXED FILE - Gets artist genres from Spotify
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const APPLE_MUSIC_TOKEN = process.env.APPLE_MUSIC_TOKEN;
const GENIUS_TOKEN = process.env.GENIUS_API_TOKEN;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type Track = {
  position?: string;
  title?: string;
  duration?: string;
  type_?: string;
  lyrics_url?: string;
  lyrics?: string;
  lyrics_source?: 'apple_music' | 'genius';
};

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
    const { albumId } = body;

    if (!albumId) {
      return NextResponse.json(
        { success: false, error: 'albumId required' },
        { status: 400 }
      );
    }

    const { data: album, error: dbError } = await supabase
      .from('collection')
      .select('*')
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      return NextResponse.json(
        { success: false, error: 'Album not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const enriched = {
      spotify: false,
      appleMusic: false,
      appleLyrics: false,
      lyrics: false
    };

    if (!album.spotify_id) {
      const spotifyData = await searchSpotify(album.artist, album.title);
      if (spotifyData) {
        Object.assign(updateData, spotifyData);
        enriched.spotify = true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!album.apple_music_id) {
      const appleMusicData = await searchAppleMusic(album.artist, album.title);
      if (appleMusicData) {
        Object.assign(updateData, appleMusicData);
        enriched.appleMusic = true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (album.tracklists) {
      try {
        const tracks = typeof album.tracklists === 'string' 
          ? JSON.parse(album.tracklists)
          : album.tracklists;

        if (Array.isArray(tracks) && tracks.length > 0) {
          const enrichedTracks = await Promise.all(
            tracks.map(async (track: Track) => {
              if (track.lyrics || track.lyrics_url) {
                return track;
              }

              if (track.title) {
                const lyricsData = await searchLyrics(album.artist, track.title);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return {
                  ...track,
                  lyrics_url: lyricsData?.genius_url
                };
              }
              return track;
            })
          );

          updateData.tracklists = JSON.stringify(enrichedTracks);
          
          if (enrichedTracks.some((t: Track) => t.lyrics_url && !tracks.find((orig: Track) => orig.position === t.position)?.lyrics_url)) {
            enriched.lyrics = true;
          }
        }
      } catch (err) {
        console.error('Tracklist enrichment error:', err);
      }
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('collection')
        .update(updateData)
        .eq('id', albumId);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: `Database update failed: ${updateError.message}` },
          { status: 500 }
        );
      }
    }

    const finalAppleMusicId = updateData.apple_music_id || album.apple_music_id;
    if (finalAppleMusicId && APPLE_MUSIC_TOKEN) {
      try {
        console.log('Attempting to fetch Apple Music lyrics...');
        const lyricsRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/fetch-apple-lyrics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ albumId })
        });

        if (lyricsRes.ok) {
          const lyricsResult = await lyricsRes.json();
          if (lyricsResult.success && lyricsResult.stats.lyricsFound > 0) {
            enriched.appleLyrics = true;
            console.log(`Fetched Apple Music lyrics: ${lyricsResult.stats.lyricsFound} tracks`);
          }
        }
      } catch (error) {
        console.warn('Failed to fetch Apple Music lyrics:', error);
      }
    }

    return NextResponse.json({
      success: true,
      enriched
    });

  } catch (error) {
    console.error('Enrichment error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}