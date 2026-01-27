// src/lib/enrichment-service.ts
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
// 1. MUSICBRAINZ SERVICE
// ============================================================================

const MB_BASE = 'https://musicbrainz.org/ws/2';
const APP_USER_AGENT = 'DeadwaxDialogues/2.0 +https://deadwaxdialogues.com'; 
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

  const response = await fetch(url, { headers: { 'User-Agent': APP_USER_AGENT } });
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
  const response = await fetch(url, { headers: { 'User-Agent': APP_USER_AGENT } });
  if (!response.ok) return null;
  return response.json();
}

async function getMusicBrainzRecording(recordingId: string): Promise<MusicBrainzRecording | null> {
  const url = `${MB_BASE}/recording/${recordingId}?inc=artist-rels+work-rels&fmt=json`;
  const response = await fetch(url, { headers: { 'User-Agent': APP_USER_AGENT } });
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
// 2. DISCOGS SERVICE
// ============================================================================

const DISCOGS_TOKEN = process.env.DISCOGS_ACCESS_TOKEN;

async function searchDiscogs(artist: string, title: string): Promise<Record<string, unknown> | null> {
  if (!DISCOGS_TOKEN) return null;
  const query = `${artist} ${title}`;
  const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&token=${DISCOGS_TOKEN}`;
  const response = await fetch(url, { headers: { 'User-Agent': APP_USER_AGENT } });
  if (!response.ok) return null;
  const data = await response.json();
  return data.results?.[0] || null;
}

async function getDiscogsRelease(releaseId: string): Promise<Record<string, unknown> | null> {
  if (!DISCOGS_TOKEN) return null;
  const url = `https://api.discogs.com/releases/${releaseId}?token=${DISCOGS_TOKEN}`;
  const response = await fetch(url, { headers: { 'User-Agent': APP_USER_AGENT } });
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

    const allImages = (release.images as Array<{ uri: string; type?: string }> | undefined) || [];
    const primaryImage = allImages.length > 0 ? allImages[0].uri : existing?.image_url;
    const backImage = allImages.length > 1 ? allImages[1].uri : null;
    const galleryImages = allImages.length > 2 ? allImages.slice(2).map(img => img.uri) : [];

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
      inner_sleeve_images: galleryImages, 
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

// --- Pricing Logic ---

interface DiscogsListing {
  price: { value: string };
  condition: string;
  sleeve_condition: string;
  seller: { username: string };
}

interface PricingResult {
  prices: {
    min: number | null;
    median: number | null;
    max: number | null;
    count: number;
    suggested: number | null;
  };
  sampleListings: DiscogsListing[];
}

export async function enrichDiscogsPricing(albumId: number | null, releaseId: string, userAuthHeader?: string): Promise<{ success: boolean; data?: PricingResult; error?: string }> {
  try {
    if (!isValidDiscogsId(releaseId)) return { success: false, error: 'Invalid Release ID' };

    // 1. DETERMINE AUTH METHOD
    let authHeaderValue = '';
    let authMethod = '';

    if (userAuthHeader) {
        authHeaderValue = userAuthHeader;
        authMethod = 'User OAuth';
    } else if (DISCOGS_TOKEN) {
        authHeaderValue = `Discogs token=${DISCOGS_TOKEN}`;
        authMethod = 'Server Token';
    } else {
        return { success: false, error: 'No Discogs Credentials Available' };
    }

    // 2. CONSTRUCT HEADERS
    const headers: HeadersInit = {
        'User-Agent': APP_USER_AGENT,
        'Authorization': authHeaderValue,
        // REQUIRED: Vendor format to bypass WAF on Marketplace API
        'Accept': 'application/vnd.discogs.v2.plaintext+json'
    };

    console.log(`[Discogs] Fetching pricing for ${releaseId} using ${authMethod}...`);

    // 3. FETCH STATS
    const statsUrl = `https://api.discogs.com/marketplace/stats/${releaseId}?curr=USD`;
    const statsRes = await fetch(statsUrl, { headers });

    if (!statsRes.ok) {
        const errorText = await statsRes.text();
        const status = statsRes.status;
        
        if (status === 404) {
            return { 
                success: true, 
                data: { prices: { min: null, median: null, max: null, count: 0, suggested: null }, sampleListings: [] } 
            };
        }

        if (status === 403) {
            return {
                success: false,
                error: `Discogs marketplace access forbidden (403). ${errorText.substring(0, 200)}`
            };
        }

        console.error(`[Discogs] Error ${status} for ${releaseId}:`, errorText);
        throw new Error(`Discogs API ${status}: ${errorText.substring(0, 200)}`);
    }

    const stats = await statsRes.json();

    // 4. FETCH ACTIVE LISTINGS
    const listingsUrl = `https://api.discogs.com/marketplace/search?release_id=${releaseId}&per_page=5&sort=price&sort_order=asc&currency=USD`;
    const listingsRes = await fetch(listingsUrl, { headers });

    let currentListings: DiscogsListing[] = [];
    if (listingsRes.ok) {
        const listingsData = await listingsRes.json();
        currentListings = listingsData.listings || [];
    }

    // 5. CALCULATE PRICES
    const priceData = {
      min: null as number | null,
      median: null as number | null,
      max: null as number | null,
      count: 0,
      suggested: null as number | null
    };

    if (stats.lowest_price) {
        priceData.min = parseFloat(stats.lowest_price.value);
        priceData.median = parseFloat(stats.median?.value || stats.lowest_price.value);
        priceData.max = parseFloat(stats.highest_price?.value || stats.lowest_price.value);
        priceData.count = stats.num_for_sale || 0;
        priceData.suggested = priceData.median ? priceData.median * 0.95 : priceData.min;
    }

    const prices = currentListings
      .map((l) => parseFloat(l.price?.value || '0'))
      .filter((p) => p > 0)
      .sort((a, b) => a - b);

    if (prices.length > 0) {
      priceData.count = prices.length + (stats.num_for_sale || 0);
      if (!priceData.min || prices[0] < priceData.min) priceData.min = prices[0];
      
      // Calculate suggested based on median stats and lowest active listing
      if (priceData.median) {
          priceData.suggested = (priceData.median + prices[0]) / 2;
      }
    }

    // 6. UPDATE DB
    if (albumId && (priceData.min || priceData.median)) {
      await supabase.from('collection').update({
        discogs_price_min: priceData.min,
        discogs_price_median: priceData.median,
        discogs_price_max: priceData.max,
        discogs_price_updated_at: new Date().toISOString(),
      }).eq('id', albumId);
    }

    return { 
      success: true, 
      data: {
         prices: priceData,
         sampleListings: currentListings
      } 
    };

  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown Pricing Error' };
  }
}

// ============================================================================
// 3. SPOTIFY SERVICE
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
  [key: string]: number; 
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

    // 2. Fetch Audio Features
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
                    updateData.mood_happy = parseFloat(avg('valence').toFixed(2)); 
                    
                    // Estimate Key (Mode + Key)
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
    }

    const { error } = await supabase.from('collection').update(updateData).eq('id', albumId);
    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================================================
// 4. APPLE MUSIC SERVICE
// ============================================================================

const APPLE_MUSIC_TOKEN = process.env.APPLE_MUSIC_TOKEN!;

export async function enrichAppleMusic(albumId: number, artist: string, title: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  try {
    if (!APPLE_MUSIC_TOKEN) return { success: false, error: 'Apple Music Token missing' };

    const query = `${artist} ${title}`;
    const searchUrl = `https://api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(query)}&types=albums&limit=1`;
    
    const response = await fetch(searchUrl, { 
      headers: { 'Authorization': `Bearer ${APPLE_MUSIC_TOKEN}` } 
    });

    if (!response.ok) return { success: false, error: 'Apple Music search failed' };
    
    const data = await response.json();
    const album = data.results?.albums?.data?.[0];

    if (!album) return { success: false, error: 'Not found on Apple Music' };

    const attrs = album.attributes;
    const updateData: Record<string, unknown> = {
      apple_music_id: album.id,
      apple_music_url: attrs.url,
    };

    if (attrs.genreNames && attrs.genreNames.length > 0) {
        // We generally treat these as Styles, as Apple Genres are broad
        updateData.styles = attrs.genreNames;
    }

    const { error } = await supabase.from('collection').update(updateData).eq('id', albumId);
    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================================================
// 5. GENIUS SERVICE
// ============================================================================

const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN!;
const geniusClient = GENIUS_ACCESS_TOKEN ? new Genius.Client(GENIUS_ACCESS_TOKEN) : null;

export async function enrichGenius(albumId: number, artist: string, title: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  try {
    if (!geniusClient) return { success: false, error: 'Genius Token missing' };

    // Search for the album (Genius API is song-focused, but we can search for the "album" context)
    const search = await geniusClient.songs.search(`${artist} ${title}`);
    if (!search || search.length === 0) return { success: false, error: 'Not found on Genius' };

    // Currently, without a specific target column (like genius_url) or logic to parse producers,
    // this service primarily validates existence on Genius.
    // Logic for updating producers or genius_url can be added here when the database columns exist.

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function enrichAppleLyrics(albumId: number) {
   // Placeholder - Apple Lyrics requires a separate, complex scraping logic or private API
   // We will keep this skipped for now as it's non-standard
   void albumId;
   return { success: true, skipped: true };
}

// ============================================================================
// 6. WIKIPEDIA SERVICE (NEW)
// ============================================================================

export async function enrichWikipedia(albumId: number, artist: string, title: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
    try {
        const query = `${artist} ${title} album`;
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`;
        
        const response = await fetch(url);
        if (!response.ok) return { success: false, error: 'Wikipedia search failed' };
        
        const data = await response.json();
        if (!data.query?.search || data.query.search.length === 0) return { success: false, error: 'Not found on Wikipedia' };
        
        const pageId = data.query.search[0].pageid;
        const wikiUrl = `https://en.wikipedia.org/?curid=${pageId}`;
        
        const updateData = {
            wikipedia_url: wikiUrl
        };
        
        const { error } = await supabase.from('collection').update(updateData).eq('id', albumId);
        if (error) return { success: false, error: error.message };

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

// ============================================================================
// 7. COVER ART ARCHIVE SERVICE (NEW)
// ============================================================================

const CAA_BASE = 'https://coverartarchive.org';

export async function enrichCoverArtArchive(albumId: number): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
    try {
        // 1. Get MBID from DB
        const { data: album } = await supabase.from('collection').select('musicbrainz_id').eq('id', albumId).single();
        if (!album?.musicbrainz_id) return { success: false, error: 'No MusicBrainz ID' };

        // 2. Fetch Images
        const url = `${CAA_BASE}/release/${album.musicbrainz_id}`;
        const response = await fetch(url);
        if (!response.ok) return { success: false, error: 'Not found in CAA' };

        const data = await response.json();
        const images = data.images || [];
        
        const updateData: Record<string, unknown> = {};
        const gallery: string[] = [];

        images.forEach((img: { front: boolean, back: boolean, image: string }) => {
            if (img.front && !updateData.image_url) updateData.image_url = img.image;
            else if (img.back && !updateData.back_image_url) updateData.back_image_url = img.image;
            else gallery.push(img.image);
        });

        if (gallery.length > 0) {
            updateData.inner_sleeve_images = gallery;
        }

        if (Object.keys(updateData).length > 0) {
            const { error } = await supabase.from('collection').update(updateData).eq('id', albumId);
            if (error) return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}
