// src/lib/enrichment-service.ts
/**
 * Complete Multi-Source Enrichment Service
 * Matches exact database schema for public.collection table
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// VALIDATION & UTILS
// ============================================================================

function isValidDiscogsId(value: unknown): boolean {
  if (!value) return false;
  const str = String(value);
  return str !== 'null' && str !== 'undefined' && str !== '0' && str.trim() !== '';
}

// Map Spotify Pitch Class to Musical Key
const PITCH_CLASS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function formatMusicalKey(key: number, mode: number): string | null {
  if (key < 0 || key > 11) return null;
  const note = PITCH_CLASS[key];
  const scale = mode === 1 ? 'Major' : 'Minor';
  return `${note} ${scale}`;
}

// ============================================================================
// MUSICBRAINZ SERVICE
// ============================================================================

const MB_BASE = 'https://musicbrainz.org/ws/2';
const MB_USER_AGENT = 'DeadwaxDialogues/1.0 (https://deadwaxdialogues.com)';
const MB_RATE_LIMIT = 1000;

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

  const response = await fetch(url, { headers: { 'User-Agent': MB_USER_AGENT } });
  if (!response.ok) return null;

  const data = await response.json();
  if (data.releases && data.releases.length > 0) {
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
  const response = await fetch(url, { headers: { 'User-Agent': MB_USER_AGENT } });
  if (!response.ok) return null;
  return response.json();
}

async function getMusicBrainzRecording(recordingId: string): Promise<MusicBrainzRecording | null> {
  const url = `${MB_BASE}/recording/${recordingId}?inc=artist-rels+work-rels&fmt=json`;
  const response = await fetch(url, { headers: { 'User-Agent': MB_USER_AGENT } });
  if (!response.ok) return null;
  return response.json();
}

export async function enrichMusicBrainz(albumId: number, artist: string, title: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  try {
    const { data: existing } = await supabase
      .from('collection')
      .select('musicians, producers, engineers, songwriters, musicbrainz_id')
      .eq('id', albumId)
      .single();

    if (existing?.musicians?.length > 0 && existing?.producers?.length > 0) {
      return { success: true, skipped: true };
    }

    const mbid = existing?.musicbrainz_id || await searchMusicBrainz(artist, title);
    if (!mbid) return { success: false, error: 'Not found in MusicBrainz' };

    const release = await getMusicBrainzRelease(mbid);
    if (!release) return { success: false, error: 'Failed to fetch release' };

    const credits = {
      musicians: new Set<string>(),
      producers: new Set<string>(),
      engineers: new Set<string>(),
      songwriters: new Set<string>()
    };

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

                  if (['instrument', 'vocal', 'performer'].includes(rel.type)) credits.musicians.add(name);
                  else if (rel.type === 'producer') credits.producers.add(name);
                  else if (['engineer', 'mix', 'mastering'].includes(rel.type)) credits.engineers.add(name);
                  else if (['composer', 'writer', 'lyricist'].includes(rel.type)) credits.songwriters.add(name);
                }
              }
              await new Promise(resolve => setTimeout(resolve, MB_RATE_LIMIT));
            }
          }
        }
      }
    }

    const updateData: Record<string, unknown> = {
      musicbrainz_id: mbid,
      musicbrainz_url: `https://musicbrainz.org/release/${mbid}`,
    };

    if (credits.musicians.size > 0) updateData.musicians = Array.from(credits.musicians);
    if (credits.producers.size > 0) updateData.producers = Array.from(credits.producers);
    if (credits.engineers.size > 0) updateData.engineers = Array.from(credits.engineers);
    if (credits.songwriters.size > 0) updateData.songwriters = Array.from(credits.songwriters);

    const labelInfo = release['label-info']?.[0];
    if (labelInfo?.label?.name) updateData.labels = [labelInfo.label.name];
    if (labelInfo?.['catalog-number']) updateData.cat_no = labelInfo['catalog-number'];
    if (release.date) updateData.recording_date = release.date;
    if (release.country) updateData.country = release.country;

    const { error } = await supabase.from('collection').update(updateData).eq('id', albumId);
    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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

export async function enrichDiscogsMetadata(albumId: number, artist: string, title: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  try {
    const { data: existing } = await supabase
      .from('collection')
      .select('discogs_release_id, image_url, genres, styles, tracks')
      .eq('id', albumId)
      .single();

    let releaseId = existing?.discogs_release_id;
    if (!isValidDiscogsId(releaseId)) {
      const searchResult = await searchDiscogs(artist, title);
      if (!searchResult) return { success: false, error: 'Not found on Discogs' };
      releaseId = searchResult.id;
    }

    const release = await getDiscogsRelease(releaseId);
    if (!release) return { success: false, error: 'Failed to fetch release' };

    // 1. PROCESS IMAGES (Gallery Logic)
    const allImages = (release.images as Array<{ uri: string; type?: string }> | undefined) || [];
    // Primary is strictly the first image
    const primaryImage = allImages.length > 0 ? allImages[0].uri : existing?.image_url;
    // Secondary (Back Cover) is the second image, if it exists
    const backImage = allImages.length > 1 ? allImages[1].uri : null;
    // Gallery (Inner Sleeves/Other) is everything else
    const galleryImages = allImages.length > 2 ? allImages.slice(2).map(img => img.uri) : [];

    // 2. PROCESS EXTENDED CREDITS
    const engineers = new Set<string>();
    const songwriters = new Set<string>();
    const producers = new Set<string>();

    const extraArtists = (release.extraartists as Array<{ name: string; role: string }> | undefined) || [];
    extraArtists.forEach(artist => {
      const role = artist.role.toLowerCase();
      if (role.includes('producer')) producers.add(artist.name);
      if (role.includes('mixed') || role.includes('mastered') || role.includes('engineer') || role.includes('recorded')) engineers.add(artist.name);
      if (role.includes('written') || role.includes('composed') || role.includes('lyrics') || role.includes('songwriter')) songwriters.add(artist.name);
    });

    const tracks = (release.tracklist as Array<Record<string, unknown>> | undefined)?.map((track: Record<string, unknown>, index: number) => ({
      position: (track.position as string) || String(index + 1),
      title: track.title as string,
      duration: (track.duration as string) || '',
      artist: ((track.artists as Array<{ name: string }>)?.[0]?.name) || artist,
      type_: (track.type_ as string) || 'track',
    })) || [];

    const updateData: Record<string, unknown> = {
      discogs_release_id: String(releaseId),
      discogs_master_id: release.master_id ? String(release.master_id) : null,
      image_url: primaryImage,
      back_image_url: backImage,
      inner_sleeve_images: galleryImages, // Storing extras here for gallery
      genres: (release.genres as string[] | undefined) || [],
      styles: (release.styles as string[] | undefined) || [],
      tracks: tracks,
    };

    if (engineers.size > 0) updateData.engineers = Array.from(engineers);
    if (songwriters.size > 0) updateData.songwriters = Array.from(songwriters);
    if (producers.size > 0) updateData.producers = Array.from(producers);

    const { error } = await supabase.from('collection').update(updateData).eq('id', albumId);
    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function enrichDiscogsTracklist(albumId: number): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  try {
    const { data: album } = await supabase.from('collection').select('discogs_release_id, tracks, artist').eq('id', albumId).single();
    if (!album?.tracks || !isValidDiscogsId(album.discogs_release_id)) return { success: false, error: 'Missing data' };

    const release = await getDiscogsRelease(album.discogs_release_id);
    if (!release) return { success: false, error: 'Failed' };

    const updatedTracks = album.tracks.map((track: Record<string, unknown>, index: number) => {
      const discogsTrack = (release.tracklist as Array<Record<string, unknown>> | undefined)?.[index];
      return {
        ...track,
        artist: ((discogsTrack?.artists as Array<{ name: string }>)?.[0]?.name) || track.artist || album.artist,
      };
    });

    const { error } = await supabase.from('collection').update({ tracks: updatedTracks }).eq('id', albumId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================================================
// SPOTIFY SERVICE (UPGRADED)
// ============================================================================

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

let spotifyToken: { token: string; expires: number } | null = null;

// Types for Spotify API interactions
interface SpotifyTrack {
  id: string;
}

interface SpotifyAudioFeature {
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
  key: number;
  mode: number;
  [key: string]: number; // Allow indexing
}

async function getSpotifyToken(): Promise<string> {
  if (spotifyToken && spotifyToken.expires > Date.now()) return spotifyToken.token;

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  spotifyToken = { token: data.access_token, expires: Date.now() + (data.expires_in * 1000) - 60000 };
  return spotifyToken.token;
}

export async function enrichSpotify(albumId: number, artist: string, title: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  try {
    const token = await getSpotifyToken();
    
    // 1. Search for Album
    const query = `album:${title} artist:${artist}`;
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=1`;
    const response = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    
    if (!response.ok) return { success: false, error: 'Spotify search failed' };
    const data = await response.json();
    const album = data.albums?.items?.[0];

    if (!album) return { success: false, error: 'Not found on Spotify' };

    const updateData: Record<string, unknown> = {
      spotify_id: album.id,
      spotify_url: album.external_urls.spotify,
      // Default release date if missing
      original_release_date: (album.release_date && album.release_date.length === 4) ? `${album.release_date}-01-01` : album.release_date,
    };

    // 2. Fetch Audio Features (The "Lazy" Fix)
    // We must fetch tracks first to get IDs
    try {
        const tracksUrl = `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=50`;
        const tracksRes = await fetch(tracksUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        
        if (tracksRes.ok) {
            const tracksData = await tracksRes.json();
            const trackIds = (tracksData.items as SpotifyTrack[]).map(t => t.id).join(',');
            
            // Call Audio Features Endpoint
            const featuresUrl = `https://api.spotify.com/v1/audio-features?ids=${trackIds}`;
            const featuresRes = await fetch(featuresUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            
            if (featuresRes.ok) {
                const featuresData = await featuresRes.json();
                const features = (featuresData.audio_features as (SpotifyAudioFeature | null)[]).filter((f): f is SpotifyAudioFeature => f !== null);

                if (features.length > 0) {
                    // Calculate Averages
                    const avg = (key: keyof SpotifyAudioFeature) => features.reduce((sum, f) => sum + (f[key] as number), 0) / features.length;
                    
                    updateData.tempo_bpm = Math.round(avg('tempo'));
                    updateData.energy = parseFloat(avg('energy').toFixed(2));
                    updateData.danceability = parseFloat(avg('danceability').toFixed(2));
                    updateData.mood_happy = parseFloat(avg('valence').toFixed(2)); // Valence ≈ Happiness
                    
                    // Estimate Key (Mode + Key)
                    // We take the most frequent key
                    const keyCounts = features.reduce((acc: Record<string, number>, f) => {
                         const k = `${f.key}-${f.mode}`;
                         acc[k] = (acc[k] || 0) + 1;
                         return acc;
                    }, {});
                    const dominant = Object.keys(keyCounts).reduce((a, b) => keyCounts[a] > keyCounts[b] ? a : b).split('-');
                    updateData.musical_key = formatMusicalKey(parseInt(dominant[0]), parseInt(dominant[1]));
                }
            } else {
                console.warn('Spotify Audio Features blocked (likely deprecation/quota). Skipping audio analysis.');
            }
        }
    } catch (featError) {
        console.error('Failed to fetch Spotify audio features:', featError);
        // Do not fail the whole enrichment, just skip audio features
    }

    const { error } = await supabase.from('collection').update(updateData).eq('id', albumId);
    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================================================
// APPLE MUSIC & GENIUS (STUBS TO AVOID UNUSED IMPORTS)
// ============================================================================

export async function enrichAppleMusic(albumId: number, artist: string, title: string) {
    // Placeholder - logic can be restored if needed
    void albumId;
    void artist;
    void title;
    return { success: true, skipped: true }; 
}

export async function enrichGenius(albumId: number, artist: string) {
    // Placeholder - logic can be restored if needed
    void albumId;
    void artist;
    return { success: true, skipped: true };
}

export async function enrichAppleLyrics(albumId: number) {
   // Placeholder - logic can be restored if needed
   void albumId;
   return { success: true, skipped: true };
}