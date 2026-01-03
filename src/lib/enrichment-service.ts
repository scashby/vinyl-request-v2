// src/lib/enrichment-service.ts
/**
 * Complete Multi-Source Enrichment Service
 * Matches exact database schema for public.collection table
 */

import { createClient } from '@supabase/supabase-js';
import Genius from 'genius-lyrics';

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function isValidDiscogsId(value: unknown): boolean {
  if (!value) return false;
  const str = String(value);
  return str !== 'null' && str !== 'undefined' && str !== '0' && str.trim() !== '';
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// MUSICBRAINZ SERVICE (FREE, NO API KEY)
// ============================================================================

const MB_BASE = 'https://musicbrainz.org/ws/2';
const MB_USER_AGENT = 'DeadwaxDialogues/1.0 (https://deadwaxdialogues.com)';
const MB_RATE_LIMIT = 1000; // 1 request per second

interface MusicBrainzRelease {
  id: string;
  title: string;
  'artist-credit'?: Array<{ name: string }>;
  media?: Array<{
    tracks?: Array<{
      position: number;
      title: string;
      length?: number;
      recording?: { id: string };
    }>;
  }>;
  'label-info'?: Array<{
    label?: { name: string };
    'catalog-number'?: string;
  }>;
  date?: string;
  country?: string;
}

interface MusicBrainzRecording {
  relations?: Array<{
    type: string;
    artist?: { name: string; id: string };
    attributes?: string[];
  }>;
}

async function searchMusicBrainz(artist: string, title: string): Promise<string | null> {
  const query = `artist:"${artist}" AND release:"${title}"`;
  const url = `${MB_BASE}/release/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

  const response = await fetch(url, {
    headers: { 'User-Agent': MB_USER_AGENT }
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (data.releases && data.releases.length > 0) {
    // Prefer official releases
    const official = data.releases.find((r: Record<string, unknown>) => 
      r.status === 'Official' && 
      (r['release-group'] as Record<string, unknown>)?.['primary-type'] === 'Album'
    );
    return official?.id || data.releases[0].id;
  }

  return null;
}

async function getMusicBrainzRelease(mbid: string): Promise<MusicBrainzRelease | null> {
  const url = `${MB_BASE}/release/${mbid}?inc=artists+labels+recordings+release-groups+media&fmt=json`;

  const response = await fetch(url, {
    headers: { 'User-Agent': MB_USER_AGENT }
  });

  if (!response.ok) return null;
  return response.json();
}

async function getMusicBrainzRecording(recordingId: string): Promise<MusicBrainzRecording | null> {
  const url = `${MB_BASE}/recording/${recordingId}?inc=artist-rels+work-rels&fmt=json`;

  const response = await fetch(url, {
    headers: { 'User-Agent': MB_USER_AGENT }
  });

  if (!response.ok) return null;
  return response.json();
}

export async function enrichMusicBrainz(albumId: number, artist: string, title: string): Promise<{ 
  success: boolean; 
  error?: string; 
  skipped?: boolean;
}> {
  try {
    // Check if already enriched
    const { data: existing } = await supabase
      .from('collection')
      .select('musicians, producers, engineers, songwriters, studio, musicbrainz_id')
      .eq('id', albumId)
      .single();

    if (existing?.musicians?.length > 0 && existing?.producers?.length > 0) {
      return { success: true, skipped: true };
    }

    // Search MusicBrainz
    const mbid = existing?.musicbrainz_id || await searchMusicBrainz(artist, title);
    if (!mbid) {
      return { success: false, error: 'Not found in MusicBrainz' };
    }

    // Get release details
    const release = await getMusicBrainzRelease(mbid);
    if (!release) {
      return { success: false, error: 'Failed to fetch release' };
    }

    // Collect credits from recordings
    const musiciansSet = new Set<string>();
    const producersSet = new Set<string>();
    const engineersSet = new Set<string>();
    const songwritersSet = new Set<string>();

    if (release.media) {
      for (const medium of release.media) {
        if (medium.tracks) {
          for (const track of medium.tracks) {
            if (track.recording?.id) {
              const recording = await getMusicBrainzRecording(track.recording.id);
              if (recording?.relations) {
                for (const rel of recording.relations) {
                  const name = rel.artist?.name;
                  if (!name) continue;

                  if (rel.type === 'instrument' || rel.type === 'vocal' || rel.type === 'performer') {
                    musiciansSet.add(name);
                  } else if (rel.type === 'producer') {
                    producersSet.add(name);
                  } else if (rel.type === 'engineer' || rel.type === 'mix' || rel.type === 'mastering') {
                    engineersSet.add(name);
                  } else if (rel.type === 'composer' || rel.type === 'writer' || rel.type === 'lyricist') {
                    songwritersSet.add(name);
                  }
                }
              }
              // Rate limit
              await new Promise(resolve => setTimeout(resolve, MB_RATE_LIMIT));
            }
          }
        }
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      musicbrainz_id: mbid,
      musicbrainz_url: `https://musicbrainz.org/release/${mbid}`,
    };

    if (musiciansSet.size > 0) updateData.musicians = Array.from(musiciansSet);
    if (producersSet.size > 0) updateData.producers = Array.from(producersSet);
    if (engineersSet.size > 0) updateData.engineers = Array.from(engineersSet);
    if (songwritersSet.size > 0) updateData.songwriters = Array.from(songwritersSet);

    // Extract label and catalog number
    const labelInfo = release['label-info']?.[0];
    if (labelInfo?.label?.name) {
      updateData.labels = [labelInfo.label.name];
    }
    if (labelInfo?.['catalog-number']) {
      updateData.cat_no = labelInfo['catalog-number'];
    }

    // Recording date and country
    if (release.date) updateData.recording_date = release.date;
    if (release.country) updateData.country = release.country;

    // Update database
    const { error } = await supabase
      .from('collection')
      .update(updateData)
      .eq('id', albumId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ============================================================================
// DISCOGS SERVICE
// ============================================================================

const DISCOGS_TOKEN = process.env.DISCOGS_ACCESS_TOKEN!;

async function searchDiscogs(artist: string, title: string): Promise<Record<string, unknown>> {
  const query = `${artist} ${title}`;
  const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&token=${DISCOGS_TOKEN}`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  return data.results?.[0] || null;
}

async function getDiscogsRelease(releaseId: string): Promise<Record<string, unknown> | null> {
  const url = `https://api.discogs.com/releases/${releaseId}?token=${DISCOGS_TOKEN}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json();
}

export async function enrichDiscogsMetadata(albumId: number, artist: string, title: string): Promise<{
  success: boolean;
  error?: string;
  skipped?: boolean;
}> {
  try {
    // Check what's already there
    const { data: existing } = await supabase
      .from('collection')
      .select('discogs_release_id, discogs_master_id, image_url, discogs_genres, discogs_styles, tracks')
      .eq('id', albumId)
      .single();

    // Skip if fully enriched
    if (
      isValidDiscogsId(existing?.discogs_release_id) &&
      isValidDiscogsId(existing?.discogs_master_id) &&
      existing?.image_url &&
      existing?.discogs_genres?.length > 0 &&
      existing?.tracks
    ) {
      return { success: true, skipped: true };
    }

    let releaseId = existing?.discogs_release_id;

    // Search if needed
    if (!isValidDiscogsId(releaseId)) {
      const searchResult = await searchDiscogs(artist, title);
      if (!searchResult) {
        return { success: false, error: 'Not found on Discogs' };
      }
      releaseId = searchResult.id;
    }

    // Get full release data
    const release = await getDiscogsRelease(releaseId);
    if (!release) {
      return { success: false, error: 'Failed to fetch release' };
    }

    // Build tracks array
    const tracks = (release.tracklist as Array<Record<string, unknown>> | undefined)?.map((track: Record<string, unknown>, index: number) => ({
      position: (track.position as string) || String(index + 1),
      title: track.title as string,
      duration: (track.duration as string) || '',
      artist: ((track.artists as Array<{ name: string }>)?.[0]?.name) || artist,
      type_: (track.type_ as string) || 'track',
    })) || [];

    // Build update
    const updateData: Record<string, unknown> = {
      discogs_release_id: String(releaseId),
      discogs_master_id: release.master_id ? String(release.master_id) : null,
      image_url: ((release.images as Array<{ uri: string }> | undefined)?.[0]?.uri) || existing?.image_url,
      back_image_url: ((release.images as Array<{ uri: string }> | undefined)?.[1]?.uri) || null,
      discogs_genres: (release.genres as string[] | undefined) || [],
      discogs_styles: (release.styles as string[] | undefined) || [],
      tracks: tracks,
    };

    // Update database
    const { error } = await supabase
      .from('collection')
      .update(updateData)
      .eq('id', albumId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function enrichDiscogsTracklist(albumId: number): Promise<{
  success: boolean;
  error?: string;
  skipped?: boolean;
}> {
  try {
    // Get current tracks
    const { data: album } = await supabase
      .from('collection')
      .select('discogs_release_id, tracks, artist')
      .eq('id', albumId)
      .single();

    if (!album?.tracks || album.tracks.length === 0) {
      return { success: false, error: 'No tracks to enrich' };
    }

    // Check if already has artist info
    const hasArtists = album.tracks.every((t: Record<string, unknown>) => t.artist);
    if (hasArtists) {
      return { success: true, skipped: true };
    }

    if (!isValidDiscogsId(album.discogs_release_id)) {
      return { success: false, error: 'No Discogs release ID' };
    }

    // Get release with credits
    const release = await getDiscogsRelease(album.discogs_release_id);
    if (!release) {
      return { success: false, error: 'Failed to fetch release' };
    }

    // Update tracks with artist info
    const updatedTracks = album.tracks.map((track: Record<string, unknown>, index: number) => {
      const discogsTrack = (release.tracklist as Array<Record<string, unknown>> | undefined)?.[index];
      return {
        ...track,
        artist: ((discogsTrack?.artists as Array<{ name: string }>)?.[0]?.name) || (track.artist as string) || album.artist,
      };
    });

    // Update database
    const { error } = await supabase
      .from('collection')
      .update({ tracks: updatedTracks })
      .eq('id', albumId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// SPOTIFY SERVICE
// ============================================================================

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

let spotifyToken: { token: string; expires: number } | null = null;

async function getSpotifyToken(): Promise<string> {
  if (spotifyToken && spotifyToken.expires > Date.now()) {
    return spotifyToken.token;
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  spotifyToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in * 1000) - 60000
  };

  return spotifyToken.token;
}

export async function enrichSpotify(albumId: number, artist: string, title: string): Promise<{
  success: boolean;
  error?: string;
  skipped?: boolean;
}> {
  try {
    // Check if already has Spotify
    const { data: existing } = await supabase
      .from('collection')
      .select('spotify_id, spotify_url')
      .eq('id', albumId)
      .single();

    if (existing?.spotify_id) {
      return { success: true, skipped: true };
    }

    // Search Spotify
    const token = await getSpotifyToken();
    const query = `album:${title} artist:${artist}`;
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=1`;

    const response = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      return { success: false, error: 'Spotify search failed' };
    }

    const data = await response.json();
    const album = data.albums?.items?.[0];

    if (!album) {
      return { success: false, error: 'Not found on Spotify' };
    }

    // Update database
    const { error } = await supabase
      .from('collection')
      .update({
        spotify_id: album.id,
        spotify_url: album.external_urls.spotify,
      })
      .eq('id', albumId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// APPLE MUSIC SERVICE
// ============================================================================

const APPLE_MUSIC_KEY = process.env.APPLE_MUSIC_KEY!;
const APPLE_MUSIC_KEY_ID = process.env.APPLE_MUSIC_KEY_ID!;
const APPLE_MUSIC_TEAM_ID = process.env.APPLE_MUSIC_TEAM_ID!;
const APPLE_MUSIC_RATE_LIMIT = 300;

let appleMusicToken: { token: string; expires: number } | null = null;

async function getAppleMusicToken(): Promise<string> {
  if (appleMusicToken && appleMusicToken.expires > Date.now()) {
    return appleMusicToken.token;
  }

  // Use dynamic import for jsonwebtoken
  const jwt = await import('jsonwebtoken');
  const token = jwt.sign({}, APPLE_MUSIC_KEY, {
    algorithm: 'ES256',
    expiresIn: '180d',
    issuer: APPLE_MUSIC_TEAM_ID,
    header: {
      alg: 'ES256',
      kid: APPLE_MUSIC_KEY_ID
    }
  });

  appleMusicToken = {
    token,
    expires: Date.now() + (180 * 24 * 60 * 60 * 1000)
  };

  return token;
}

export async function enrichAppleMusic(albumId: number, artist: string, title: string): Promise<{
  success: boolean;
  error?: string;
  skipped?: boolean;
}> {
  try {
    // Check if already has Apple Music
    const { data: existing } = await supabase
      .from('collection')
      .select('apple_music_id, apple_music_url')
      .eq('id', albumId)
      .single();

    if (existing?.apple_music_id) {
      return { success: true, skipped: true };
    }

    // Search Apple Music
    const token = await getAppleMusicToken();
    const query = `${artist} ${title}`;
    const searchUrl = `https://api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(query)}&types=albums&limit=1`;

    const response = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      return { success: false, error: 'Apple Music search failed' };
    }

    const data = await response.json();
    const album = data.results?.albums?.data?.[0];

    if (!album) {
      return { success: false, error: 'Not found on Apple Music' };
    }

    // Update database
    const { error } = await supabase
      .from('collection')
      .update({
        apple_music_id: album.id,
        apple_music_url: album.attributes.url,
      })
      .eq('id', albumId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// GENIUS LYRICS SERVICE
// ============================================================================

const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN!;
const GENIUS_RATE_LIMIT = 500;

const geniusClient = new Genius.Client(GENIUS_ACCESS_TOKEN);

export async function enrichGenius(albumId: number, artist: string): Promise<{
  success: boolean;
  error?: string;
  skipped?: boolean;
}> {
  try {
    // Get tracks
    const { data: album } = await supabase
      .from('collection')
      .select('tracks')
      .eq('id', albumId)
      .single();

    if (!album?.tracks || album.tracks.length === 0) {
      return { success: false, error: 'No tracks' };
    }

    // Check if already has lyrics URLs
    const hasLyricsUrls = album.tracks.every((t: Record<string, unknown>) => 
      t.lyrics_url || t.type_ !== 'track'
    );

    if (hasLyricsUrls) {
      return { success: true, skipped: true };
    }

    // Search for each track
    const updatedTracks = await Promise.all(
      album.tracks.map(async (track: Record<string, unknown>) => {
        if (track.lyrics_url || track.type_ !== 'track') {
          return track;
        }

        try {
          const searches = await geniusClient.songs.search(`${artist} ${track.title as string}`);
          if (searches.length > 0) {
            return {
              ...track,
              lyrics_url: searches[0].url,
            };
          }
        } catch (error) {
          console.error(`Genius search failed for ${track.title as string}:`, error);
        }

        await new Promise(resolve => setTimeout(resolve, GENIUS_RATE_LIMIT));
        return track;
      })
    );

    // Update database
    const { error } = await supabase
      .from('collection')
      .update({ tracks: updatedTracks })
      .eq('id', albumId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// APPLE LYRICS SERVICE
// ============================================================================

export async function enrichAppleLyrics(albumId: number): Promise<{
  success: boolean;
  error?: string;
  skipped?: boolean;
}> {
  try {
    // Get album data
    const { data: album } = await supabase
      .from('collection')
      .select('apple_music_id, tracks')
      .eq('id', albumId)
      .single();

    if (!album?.apple_music_id) {
      return { success: false, error: 'No Apple Music ID' };
    }

    if (!album.tracks || album.tracks.length === 0) {
      return { success: false, error: 'No tracks' };
    }

    // Check if already has lyrics
    const hasLyrics = album.tracks.every((t: Record<string, unknown>) =>
      (t.lyrics && t.lyrics_source === 'apple_music') || t.type_ !== 'track'
    );

    if (hasLyrics) {
      return { success: true, skipped: true };
    }

    // Get Apple Music tracks
    const token = await getAppleMusicToken();
    const tracksUrl = `https://api.music.apple.com/v1/catalog/us/albums/${album.apple_music_id}/tracks`;

    const response = await fetch(tracksUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to fetch Apple Music tracks' };
    }

    const data = await response.json();
    const appleTracks = data.data || [];

    // Match and fetch lyrics
    const updatedTracks = await Promise.all(
      album.tracks.map(async (track: Record<string, unknown>) => {
        if ((track.lyrics && track.lyrics_source === 'apple_music') || track.type_ !== 'track') {
          return track;
        }

        // Find matching Apple track
        const normalizedTitle = normalizeTitle(track.title as string);
        const appleTrack = appleTracks.find((at: Record<string, unknown>) =>
          normalizeTitle((at.attributes as Record<string, unknown>).name as string) === normalizedTitle
        );

        if (!appleTrack?.attributes?.hasLyrics) {
          return track;
        }

        // Fetch lyrics
        try {
          const lyricsUrl = `https://api.music.apple.com/v1/catalog/us/songs/${appleTrack.id}/lyrics`;
          const lyricsResponse = await fetch(lyricsUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (lyricsResponse.ok) {
            const lyricsData = await lyricsResponse.json();
            const ttml = lyricsData.data?.[0]?.attributes?.ttml;

            if (ttml) {
              // Strip TTML tags
              const plainLyrics = ttml
                .replace(/<[^>]*>/g, '')
                .replace(/&apos;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .trim();

              return {
                ...track,
                lyrics: plainLyrics,
                lyrics_source: 'apple_music',
              };
            }
          }
        } catch (error) {
          console.error(`Failed to fetch lyrics for ${track.title}:`, error);
        }

        await new Promise(resolve => setTimeout(resolve, APPLE_MUSIC_RATE_LIMIT));
        return track;
      })
    );

    // Update database
    const { error } = await supabase
      .from('collection')
      .update({ tracks: updatedTracks })
      .eq('id', albumId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}