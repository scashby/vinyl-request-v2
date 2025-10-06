// src/app/api/enrich-granular/route.ts - NEW API for targeted enrichment
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

type Track = {
  position?: string;
  title?: string;
  duration?: string;
  lyrics_url?: string;
  lyrics?: string;
  lyrics_source?: 'apple_music' | 'genius';
};

type EnrichmentResult = {
  albumId: number;
  artist: string;
  title: string;
  spotify: boolean | null;
  appleMusic: boolean | null;
  appleLyrics: boolean | null;
  geniusLyrics: boolean | null;
  timestamp: string;
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

async function fetchAppleMusicLyrics(albumId: number): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/fetch-apple-lyrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId })
    });

    if (!res.ok) return false;

    const result = await res.json();
    return result.success && result.stats?.lyricsFound > 0;
  } catch (error) {
    console.error('Apple Music lyrics fetch error:', error);
    return false;
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

function needsAppleMusicLyrics(tracklists: string | null, appleMusicId: string | null): boolean {
  if (!appleMusicId || !tracklists) return false;

  try {
    const tracks = typeof tracklists === 'string' ? JSON.parse(tracklists) : tracklists;
    if (!Array.isArray(tracks) || tracks.length === 0) return false;

    const hasAppleLyrics = tracks.some((t: Track) => t.lyrics && t.lyrics_source === 'apple_music');
    return !hasAppleLyrics;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cursor = body.cursor || 0;
    const limit = Math.min(body.limit || 20, 50);
    const enrichmentType = body.enrichmentType || 'all';
    const folder = body.folder;

    // Build query based on enrichment type
    let query = supabase
      .from('collection')
      .select('id, artist, title, tracklists, spotify_id, apple_music_id')
      .gt('id', cursor)
      .order('id', { ascending: true })
      .limit(limit);

    // Apply folder filter if specified
    if (folder) {
      query = query.eq('folder', folder);
    }

    // Filter based on what needs enrichment
    switch (enrichmentType) {
      case 'spotify':
        query = query.is('spotify_id', null);
        break;
      case 'apple-music':
        query = query.is('apple_music_id', null);
        break;
      case 'apple-lyrics':
        // Will filter in code after fetch
        query = query.not('apple_music_id', 'is', null);
        break;
      case 'genius':
        // Will filter in code after fetch
        query = query.not('tracklists', 'is', null);
        break;
      case 'all':
        query = query.or('spotify_id.is.null,apple_music_id.is.null');
        break;
    }

    const { data: albums, error } = await query;

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
        results: [],
        hasMore: false
      });
    }

    // Filter for apple-lyrics and genius types
    let albumsToProcess = albums;
    if (enrichmentType === 'apple-lyrics') {
      albumsToProcess = albums.filter(album => 
        needsAppleMusicLyrics(album.tracklists, album.apple_music_id)
      );
    } else if (enrichmentType === 'genius') {
      albumsToProcess = albums.filter(album => {
        try {
          const tracks = typeof album.tracklists === 'string' 
            ? JSON.parse(album.tracklists)
            : album.tracklists;
          if (!Array.isArray(tracks)) return false;
          return tracks.some((t: Track) => !t.lyrics_url && t.title);
        } catch {
          return false;
        }
      });
    }

    const results: EnrichmentResult[] = [];

    for (const album of albumsToProcess) {
      const result: EnrichmentResult = {
        albumId: album.id,
        artist: album.artist,
        title: album.title,
        spotify: null,
        appleMusic: null,
        appleLyrics: null,
        geniusLyrics: null,
        timestamp: new Date().toISOString()
      };

      const updateData: Record<string, unknown> = {};
      let hasUpdate = false;

      // Enrich based on type
      if (enrichmentType === 'spotify' || enrichmentType === 'all') {
        if (!album.spotify_id) {
          const spotifyData = await searchSpotify(album.artist, album.title);
          if (spotifyData) {
            Object.assign(updateData, spotifyData);
            result.spotify = true;
            hasUpdate = true;
          } else {
            result.spotify = false;
          }
          await sleep(500);
        }
      }

      if (enrichmentType === 'apple-music' || enrichmentType === 'all') {
        if (!album.apple_music_id) {
          const appleMusicData = await searchAppleMusic(album.artist, album.title);
          if (appleMusicData) {
            Object.assign(updateData, appleMusicData);
            result.appleMusic = true;
            hasUpdate = true;
          } else {
            result.appleMusic = false;
          }
          await sleep(500);
        }
      }

      if (enrichmentType === 'genius' || enrichmentType === 'all') {
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

              const foundAny = enrichedTracks.some((t: Track) => 
                t.lyrics_url && !tracks.find((orig: Track) => orig.position === t.position)?.lyrics_url
              );

              if (foundAny) {
                updateData.tracklists = JSON.stringify(enrichedTracks);
                result.geniusLyrics = true;
                hasUpdate = true;
              } else {
                result.geniusLyrics = false;
              }
            }
          } catch (err) {
            result.geniusLyrics = false;
            console.error('Tracklist enrichment error:', err);
          }
        }
      }

      // Update database
      if (hasUpdate) {
        await supabase
          .from('collection')
          .update(updateData)
          .eq('id', album.id);
      }

      // Fetch Apple Music lyrics if needed
      if (enrichmentType === 'apple-lyrics' || enrichmentType === 'all') {
        const finalAppleMusicId = updateData.apple_music_id || album.apple_music_id;
        if (finalAppleMusicId && needsAppleMusicLyrics(album.tracklists, finalAppleMusicId)) {
          const lyricsSuccess = await fetchAppleMusicLyrics(album.id);
          result.appleLyrics = lyricsSuccess;
          if (lyricsSuccess) {
            hasUpdate = true;
          }
        }
      }

      results.push(result);
    }

    const hasMore = albums.length === limit;
    const nextCursor = hasMore ? albums[albums.length - 1].id : null;

    return NextResponse.json({
      success: true,
      processed: albumsToProcess.length,
      results,
      hasMore,
      nextCursor
    });

  } catch (error) {
    console.error('Granular enrichment error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}