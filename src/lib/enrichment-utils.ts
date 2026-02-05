// src/lib/enrichment-utils.ts
import Genius from 'genius-lyrics';

// Initialize Genius Client if token exists
const GENIUS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;
const geniusClient = GENIUS_TOKEN ? new Genius.Client(GENIUS_TOKEN) : null;

// ============================================================================
// TYPES
// ============================================================================

export type CandidateData = {
  // Linking IDs
  musicbrainz_id?: string;
  spotify_id?: string;
  apple_music_id?: string;
  discogs_release_id?: string;
  discogs_master_id?: string;
  lastfm_url?: string;
  wikipedia_url?: string;
  genius_url?: string;

  // Canonical Metadata
  genres?: string[];
  styles?: string[];
  musicians?: string[];
  producers?: string[];
  engineers?: string[];
  songwriters?: string[];
  original_release_date?: string;
  labels?: string[]; // FIXED: Match schema plural
  cat_no?: string;
  barcode?: string;
  country?: string;
  
  // Images
  image_url?: string;
  back_image_url?: string;
  inner_sleeve_images?: string[]; // Acts as universal gallery (Spine/Inner/Vinyl)
  
  // Audio Features
  tempo_bpm?: number;
  musical_key?: string;
  danceability?: number;
  energy?: number;
  mood_acoustic?: number;
  mood_happy?: number; // Valence
  mood_sad?: number;
  mood_party?: number;
  mood_relaxed?: number;
  mood_aggressive?: number;
  mood_electronic?: number;
  
  // Content
  tracklist?: string;
  
  // Extra
  tags?: string[]; // Generic Bucket (renamed from lastfm_tags)
  lyrics?: string;
  lyrics_url?: string;
  notes?: string; // Wikipedia/Discogs Notes
  enrichment_summary?: Record<string, string>; // Structured External Data (Setlist.fm, WhoSampled, etc)
  companies?: string[]; // Discogs Companies
  
  // Sonic Domain
  is_cover?: boolean;
  original_artist?: string;
  original_year?: number;
  samples?: string[];
  sampled_by?: string[];
  
  // Per-Track Data
  tracks?: Array<{
    position: string;
    title: string;
    duration?: string;
    tempo_bpm?: number;
    musical_key?: string;
    lyrics?: string;
    is_cover?: boolean;
    original_artist?: string;
  }>;
};

export type EnrichmentResult = {
  success: boolean;
  source: string;
  data?: CandidateData;
  error?: string;
};

// --- TYPE DEFINITIONS FOR API RESPONSES ---

interface MBArtistCredit {
  name: string;
  artist?: { name: string };
}

interface MBWorkRelation {
  type: string;
  begin?: string;
  end?: string;
  attributes?: string[];
  recording?: {
    id: string;
    title: string;
    'first-release-date'?: string;
    'artist-credit'?: MBArtistCredit[];
  };
}

interface MBRecordingRelation {
  type: string;
  work?: {
    id: string;
    title: string;
    relations?: MBWorkRelation[];
  };
}

interface MBTrack {
  position: string;
  title: string;
  recording?: {
    id: string;
    title: string;
    relations?: MBRecordingRelation[];
  };
}

interface MBMedia {
  format?: string;
  tracks?: MBTrack[];
}

interface MBRelation {
  type: string;
  direction: string;
  artist?: { name: string };
  attributes?: string[];
}

interface MBArtistCredit {
  name: string;
  artist?: { name: string };
}

interface MBWorkRelation {
  type: string;
  begin?: string; // Relation start date
  end?: string;
  attributes?: string[];
  recording?: {
    id: string;
    title: string;
    'first-release-date'?: string; // The golden nugget
    'artist-credit'?: MBArtistCredit[];
  };
}

interface MBRecordingRelation {
  type: string; // Look for 'performance'
  work?: {
    id: string;
    title: string;
    relations?: MBWorkRelation[]; // Relationships on the Work itself (to find other recordings)
  };
}

interface MBTrack {
  position: string;
  title: string;
  recording?: {
    id: string;
    title: string;
    relations?: MBRecordingRelation[];
  };
}

interface MBMedia {
  format?: string;
  tracks?: MBTrack[];
}

interface MBRelease {
  id: string;
  status?: string;
  date?: string;
  country?: string;
  barcode?: string;
  media?: MBMedia[]; // ADDED: Access to tracks
  'label-info'?: Array<{
    label?: { name: string };
    'catalog-number'?: string;
  }>;
  relations?: MBRelation[];
}
interface MBSearchResponse {
  releases: MBRelease[];
}

interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

interface SpotifyArtist {
  id: string;
  name: string;
  genres?: string[];
}

interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
}

interface SpotifyAlbum {
  release_date: string;
  images: SpotifyImage[];
  label?: string;
  genres?: string[];
  artists: SpotifyArtist[];
  tracks: {
    items: SpotifyTrack[];
  };
  external_ids?: {
    upc?: string;
    ean?: string;
  };
  copyrights?: Array<{
    text: string;
    type?: string;
  }>;
}

interface SpotifyAudioFeature {
  id: string; 
  tempo: number;
  energy: number;
  danceability: number;
  acousticness: number;
  valence: number;
  key: number;
  mode: number;
}

interface DiscogsImage {
  uri: string;
}

interface DiscogsLabel {
  name: string;
}

interface DiscogsTrack {
  position: string;
  title: string;
  duration: string;
}

interface DiscogsIdentifier {
  type: string;
  value: string;
}

interface DiscogsArtist {
  name: string;
  role: string;
}

interface DiscogsCompany {
  name: string;
  entity_type_name?: string;
}

interface DiscogsRelease {
  master_id?: number;
  genres?: string[];
  styles?: string[];
  released?: string;
  year?: string;
  images?: DiscogsImage[];
  labels?: DiscogsLabel[];
  country?: string;
  tracklist?: DiscogsTrack[];
  identifiers?: DiscogsIdentifier[];
  extraartists?: DiscogsArtist[];
  notes?: string;
  companies?: DiscogsCompany[];
}

interface LastFMImage {
  size: string;
  '#text': string;
}

interface LastFMTag {
  name: string;
}

interface CAAImage {
  front: boolean;
  back: boolean;
  types: string[];
  image: string;
}

const USER_AGENT = 'DeadwaxDialogues/1.0 (https://deadwaxdialogues.com)';

// Helper to force HTTPS
const toHttps = (url: string | undefined | null) => {
    if (!url) return undefined;
    return url.replace(/^http:\/\//i, 'https://');
};

// ============================================================================
// 1. MUSICBRAINZ (Dates, Labels, Country, Deep Credits)
// ============================================================================
const MB_BASE = 'https://musicbrainz.org/ws/2';
const isValidDate = (d: string) => /^\d{4}/.test(d);

async function mbSearch(artist: string, title: string): Promise<string | null> {
  try {
    const query = `artist:"${artist}" AND release:"${title}"`;
    const url = `${MB_BASE}/release/?query=${encodeURIComponent(query)}&fmt=json&limit=3`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const data = await res.json() as MBSearchResponse;
    
    // Prefer "Official" releases
    const releases = data.releases;
    const release = releases?.find((r) => r.status === 'Official') || releases?.[0];
    
    return release?.id || null;
  } catch { return null; }
}

async function mbGetRelease(mbid: string): Promise<MBRelease | null> {
  try {
    const url = `${MB_BASE}/release/${mbid}?inc=artists+labels+recordings+release-groups+artist-rels+recording-level-rels+work-rels+work-level-rels&fmt=json`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    return res.ok ? (await res.json() as MBRelease) : null;
  } catch { return null; }
}

export async function fetchMusicBrainzData(album: { artist: string, title: string, musicbrainz_id?: string }): Promise<EnrichmentResult> {
  try {
    const mbid = album.musicbrainz_id || await mbSearch(album.artist, album.title);
    if (!mbid) return { success: false, source: 'musicbrainz', error: 'Not found' };

    const release = await mbGetRelease(mbid);
    if (!release) return { success: false, source: 'musicbrainz', error: 'Fetch failed' };

    const candidate: CandidateData = {
      musicbrainz_id: mbid,
      original_release_date: release.date,
      country: release.country,
      tracks: [] // Initialize array for per-track analysis
    };

    // --- SONIC DOMAIN: Cover Song Analysis ---
    if (release.media) {
       release.media.forEach(medium => {
          medium.tracks?.forEach(track => {
             if (!track.recording?.relations) return;

             // 1. Find link to a "Work"
             const workRel = track.recording.relations.find(r => r.type === 'performance' && r.work);
             if (!workRel || !workRel.work?.relations) return;

             const work = workRel.work;
             
             // 2. Find earliest recording of this work
             let earliestDate = release.date || '9999';
             let originalArtist: string | undefined;
             let isCover = false;

             work.relations.forEach(rel => {
                // We look for other recordings of this work
                if (rel.type === 'performance' && rel.recording) {
                   const recDate = rel.recording['first-release-date'] || rel.begin;
                   
                   // Strict check: Must have a date, and date must be before our album's release
                   if (recDate && isValidDate(recDate) && recDate < earliestDate) {
                      earliestDate = recDate;
                      originalArtist = rel.recording['artist-credit']?.[0]?.name;
                      isCover = true;
                   }
                }
             });

             // 3. Add to candidate track list
             if (isCover && originalArtist) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (candidate.tracks as any[]).push({
                   position: track.position,
                   title: track.title,
                   is_cover: true,
                   original_artist: originalArtist,
                   original_year: parseInt(earliestDate.substring(0, 4)),
                   mb_work_id: work.id
                });
             }
          });
       });
    }

    if (release['label-info']?.[0]) {
      const info = release['label-info'][0];
      if (info.label?.name) candidate.labels = [info.label.name]; // FIXED: labels
      if (info['catalog-number']) candidate.cat_no = info['catalog-number'];
    }
    
    if (release.barcode) candidate.barcode = release.barcode;

    if (release.relations) {
        candidate.producers = release.relations
            .filter(r => r.type === 'producer' && r.artist)
            .map(r => r.artist!.name);
            
        candidate.engineers = release.relations
            .filter(r => r.type === 'engineer' && r.artist)
            .map(r => r.artist!.name);
            
        candidate.musicians = release.relations
            .filter(r => (r.type === 'instrument' || r.type === 'vocal') && r.artist)
            .map(r => `${r.artist!.name} (${r.attributes?.join(', ') || 'Musician'})`);
            
        candidate.songwriters = release.relations
            .filter(r => (r.type === 'composer' || r.type === 'writer' || r.type === 'lyricist') && r.artist)
            .map(r => r.artist!.name);
    }

    return { success: true, source: 'musicbrainz', data: candidate };
  } catch (e) {
    return { success: false, source: 'musicbrainz', error: (e as Error).message };
  }
}

// ============================================================================
// 2. SPOTIFY (Genres, Dates, BPM, Key, Energy, Danceability, Moods)
// ============================================================================
const SP_ID = process.env.SPOTIFY_CLIENT_ID!;
const SP_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
let spToken: { token: string; exp: number } | null = null;

async function spGetToken(): Promise<string> {
  if (spToken && spToken.exp > Date.now()) return spToken.token;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${SP_ID}:${SP_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  spToken = { token: data.access_token, exp: Date.now() + (data.expires_in * 1000) - 60000 };
  return spToken.token;
}

const KEY_MAP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export async function fetchSpotifyData(album: { artist: string, title: string, spotify_id?: string }): Promise<EnrichmentResult> {
  try {
    const token = await spGetToken();
    let spId = album.spotify_id;

    if (!spId) {
      const q = `album:${album.title} artist:${album.artist}`;
      const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=album&limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const searchData = await searchRes.json();
      spId = searchData.albums?.items?.[0]?.id;
    }

    if (!spId) return { success: false, source: 'spotify', error: 'Not found' };

    // UPDATED: Added ?market=US to get copyrights/external_ids
    const albumRes = await fetch(`https://api.spotify.com/v1/albums/${spId}?market=US`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await albumRes.json() as SpotifyAlbum;

    const candidate: CandidateData = {
      spotify_id: spId,
      original_release_date: data.release_date,
      image_url: data.images?.[0]?.url,
      labels: data.label ? [data.label] : undefined,
      genres: data.genres?.length ? data.genres : undefined,
      // NEW: Copyrights
      companies: data.copyrights?.map((c: { text: string }) => c.text), 
      // NEW: External IDs
      barcode: data.external_ids?.upc || data.external_ids?.ean,
      tracklist: data.tracks?.items?.map((t: SpotifyTrack, i: number) => 
        `${i + 1}. ${t.name} (${Math.floor(t.duration_ms / 60000)}:${String(Math.floor((t.duration_ms % 60000) / 1000)).padStart(2, '0')})`
      ).join('\n')
    };

    if (!candidate.genres && data.artists?.[0]?.id) {
       const artistRes = await fetch(`https://api.spotify.com/v1/artists/${data.artists[0].id}`, {
         headers: { 'Authorization': `Bearer ${token}` }
       });
       const artistData = await artistRes.json() as SpotifyArtist;
       if (artistData.genres) candidate.genres = artistData.genres;
    }

    if (data.tracks?.items?.length > 0) {
        const trackIds = data.tracks.items.map((t: SpotifyTrack) => t.id).slice(0, 50).join(',');
        const featRes = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (featRes.ok) {
            const featData = await featRes.json();
            const features = (featData.audio_features as (SpotifyAudioFeature | null)[]).filter((f): f is SpotifyAudioFeature => f !== null);
            
            if (features.length > 0) {
                const avgTempo = features.reduce((sum, f) => sum + f.tempo, 0) / features.length;
                const avgEnergy = features.reduce((sum, f) => sum + f.energy, 0) / features.length;
                const avgDance = features.reduce((sum, f) => sum + f.danceability, 0) / features.length;
                const avgAcoustic = features.reduce((sum, f) => sum + f.acousticness, 0) / features.length;
                const avgValence = features.reduce((sum, f) => sum + f.valence, 0) / features.length;
                
                const firstKey = features[0].key;
                const firstMode = features[0].mode;
                
                candidate.tempo_bpm = Math.round(avgTempo);
                candidate.energy = Number(avgEnergy.toFixed(3));
                candidate.danceability = Number(avgDance.toFixed(3));
                candidate.mood_acoustic = Number(avgAcoustic.toFixed(3));
                candidate.mood_happy = Number(avgValence.toFixed(3));
                candidate.mood_sad = Number((1 - avgValence).toFixed(3));
                candidate.mood_party = Number(avgEnergy.toFixed(3));
                candidate.mood_relaxed = Number((1 - avgEnergy).toFixed(3));
                candidate.mood_aggressive = (avgEnergy > 0.7 && avgValence < 0.4) ? 1.0 : 0.0;
                candidate.mood_electronic = (avgAcoustic < 0.1 && avgEnergy > 0.6) ? 1.0 : 0.0;
                
                if (firstKey >= 0 && firstKey < KEY_MAP.length) {
                    candidate.musical_key = `${KEY_MAP[firstKey]} ${firstMode === 1 ? 'Major' : 'Minor'}`;
                }

                candidate.tracks = data.tracks.items.map((t: SpotifyTrack, i: number) => {
                    const feat = features.find(f => f.id === t.id);
                    let keyStr = undefined;
                    if (feat && feat.key >= 0 && feat.key < KEY_MAP.length) {
                        keyStr = `${KEY_MAP[feat.key]} ${feat.mode === 1 ? 'Major' : 'Minor'}`;
                    }
                    return {
                        position: String(i + 1),
                        title: t.name,
                        duration: t.duration_ms ? `${Math.floor(t.duration_ms / 1000)}s` : undefined,
                        tempo_bpm: feat ? Math.round(feat.tempo) : undefined,
                        musical_key: keyStr
                    };
                });
            }
        }
    }

    return { success: true, source: 'spotify', data: candidate };
  } catch (e) {
    return { success: false, source: 'spotify', error: (e as Error).message };
  }
}

// ============================================================================
// 3. APPLE MUSIC (Genres, Dates, High-Res Images)
// ============================================================================
const AM_TOKEN = process.env.APPLE_MUSIC_TOKEN!;

export async function fetchAppleMusicData(album: { artist: string, title: string, apple_music_id?: string }): Promise<EnrichmentResult> {
  try {
    if (!AM_TOKEN) return { success: false, source: 'appleMusic', error: 'No Token' };
    
    let amId = album.apple_music_id;
    if (!amId) {
        const q = `${album.artist} ${album.title}`;
        const searchRes = await fetch(`https://api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(q)}&types=albums&limit=1`, {
            headers: { 'Authorization': `Bearer ${AM_TOKEN}` }
        });
        const searchData = await searchRes.json();
        amId = searchData.results?.albums?.data?.[0]?.id;
    }

    if (!amId) return { success: false, source: 'appleMusic', error: 'Not found' };

    // UPDATED: Added ?include=tracks,editorial-notes
    const albumRes = await fetch(`https://api.music.apple.com/v1/catalog/us/albums/${amId}?include=tracks,editorial-notes`, {
        headers: { 'Authorization': `Bearer ${AM_TOKEN}` }
    });
    const data = await albumRes.json();
    const attrs = data.data?.[0]?.attributes;

    const candidate: CandidateData = {
        apple_music_id: amId,
        image_url: attrs?.artwork?.url?.replace('{w}', '1000').replace('{h}', '1000'),
        genres: attrs?.genreNames,
        labels: attrs?.recordLabel ? [attrs.recordLabel] : undefined,
        original_release_date: attrs?.releaseDate,
        // NEW: Notes and UPC
        notes: attrs?.editorialNotes?.standard || attrs?.editorialNotes?.short,
        barcode: attrs?.upc,
        // NEW: Tracks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tracks: data.data?.[0]?.relationships?.tracks?.data?.map((t: any) => ({
            position: String(t.attributes?.trackNumber),
            title: t.attributes?.name,
            duration: t.attributes?.durationInMillis ? `${Math.floor(t.attributes.durationInMillis / 1000)}s` : undefined
        }))
    };

    return { success: true, source: 'appleMusic', data: candidate };
  } catch (e) {
    return { success: false, source: 'appleMusic', error: (e as Error).message };
  }
}

// ============================================================================
// 4. DISCOGS (Styles, Genres, Year, Credits, Barcodes, Deep Images)
// ============================================================================
const DISCOGS_TOKEN = process.env.DISCOGS_ACCESS_TOKEN!;

export async function fetchDiscogsData(album: { artist: string, title: string, discogs_release_id?: string }): Promise<EnrichmentResult> {
  try {
    let releaseId = album.discogs_release_id;

    if (!releaseId) {
      const q = `${album.artist} - ${album.title}`;
      const searchRes = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&token=${DISCOGS_TOKEN}`, {
          headers: { 'User-Agent': USER_AGENT }
      });
      const searchData = await searchRes.json();
      releaseId = searchData.results?.[0]?.id;
    }

    if (!releaseId) return { success: false, source: 'discogs', error: 'Not found' };

    // 1. Fetch Specific Release
    const releaseRes = await fetch(`https://api.discogs.com/releases/${releaseId}?token=${DISCOGS_TOKEN}`, {
        headers: { 'User-Agent': USER_AGENT }
    });

    const data = await releaseRes.json() as DiscogsRelease;

    // 2. Fetch Master Release (Definitive Original Date)
    let masterData: { year?: number } | null = null;
    if (data.master_id) {
        const masterRes = await fetch(`https://api.discogs.com/masters/${data.master_id}?token=${DISCOGS_TOKEN}`, {
            headers: { 'User-Agent': USER_AGENT }
        });
        if (masterRes.ok) masterData = await masterRes.json();
    }

    // Capture all images
    const allImages = data.images || [];
    const galleryImages: string[] = [];
    let primaryImage: string | undefined = undefined;
    let backImage: string | undefined = undefined;

    if (allImages.length > 0) primaryImage = toHttps(allImages[0].uri);
    if (allImages.length > 1) backImage = toHttps(allImages[1].uri);
    if (allImages.length > 2) {
       galleryImages.push(...allImages.slice(2).map((i: DiscogsImage) => toHttps(i.uri)!));
    }

    const candidate: CandidateData = {
      discogs_release_id: String(releaseId),
      discogs_master_id: data.master_id ? String(data.master_id) : undefined,
      genres: data.genres,
      styles: data.styles,
      // PRIORITY: Use Master Year if available, else Release Year
      original_release_date: masterData?.year ? String(masterData.year) : (data.released || data.year),
      image_url: primaryImage,
      back_image_url: backImage,
      inner_sleeve_images: galleryImages.length > 0 ? galleryImages : undefined,
      labels: data.labels?.map((l: DiscogsLabel) => l.name),
      country: data.country,
      notes: data.notes, 
      companies: data.companies?.map((c: DiscogsCompany) => c.name),
      tracklist: data.tracklist?.map((t: DiscogsTrack) => `${t.position} - ${t.title} (${t.duration})`).join('\n'),
      tracks: data.tracklist
        ?.filter((t: DiscogsTrack) => t.type_ !== 'heading')
        .map((t: DiscogsTrack) => ({
          position: t.position || '',
          title: t.title || '',
          duration: t.duration || undefined
        }))
    };

    if (data.identifiers) {
        const barcode = data.identifiers.find((id: DiscogsIdentifier) => id.type === 'Barcode');
        if (barcode) candidate.barcode = barcode.value;
    }

    if (data.extraartists) {
        candidate.producers = data.extraartists
            .filter((a: DiscogsArtist) => a.role.toLowerCase().includes('producer'))
            .map((a: DiscogsArtist) => a.name);
            
        candidate.engineers = data.extraartists
            .filter((a: DiscogsArtist) => a.role.toLowerCase().includes('engineer') || a.role.toLowerCase().includes('mixed'))
            .map((a: DiscogsArtist) => a.name);
            
        candidate.musicians = data.extraartists
            .filter((a: DiscogsArtist) => !a.role.toLowerCase().includes('producer') && !a.role.toLowerCase().includes('engineer'))
            .map((a: DiscogsArtist) => `${a.name} (${a.role})`);
            
        candidate.songwriters = data.extraartists
            .filter((a: DiscogsArtist) => a.role.toLowerCase().includes('written') || a.role.toLowerCase().includes('lyrics'))
            .map((a: DiscogsArtist) => a.name);
    }

    return { success: true, source: 'discogs', data: candidate };
  } catch (e) {
    return { success: false, source: 'discogs', error: (e as Error).message };
  }
}

// ============================================================================
// 5. LAST.FM (Tags/Genres/Moods)
// ============================================================================
const LFM_KEY = process.env.LASTFM_API_KEY!;
const LFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

function mapTagsToMoods(tags: string[], candidate: CandidateData) {
    const MOOD_KEYWORDS: Record<string, keyof CandidateData> = {
        'sad': 'mood_sad', 'melancholy': 'mood_sad', 'depressive': 'mood_sad',
        'happy': 'mood_happy', 'upbeat': 'mood_happy', 'cheerful': 'mood_happy',
        'aggressive': 'mood_aggressive', 'angry': 'mood_aggressive', 'heavy': 'mood_aggressive',
        'relaxed': 'mood_relaxed', 'chill': 'mood_relaxed', 'calm': 'mood_relaxed',
        'party': 'mood_party', 'dance': 'mood_party',
        'electronic': 'mood_electronic', 'synth': 'mood_electronic'
    };

    tags.forEach(tag => {
        const lower = tag.toLowerCase();
        for (const [keyword, field] of Object.entries(MOOD_KEYWORDS)) {
            if (lower.includes(keyword)) {
                if (typeof candidate[field] !== 'number') {
                    (candidate as Record<string, unknown>)[field] = 0.8; 
                }
            }
        }
    });
}

export async function fetchLastFmData(album: { artist: string, title: string }): Promise<EnrichmentResult> {
  try {
    const url = `${LFM_BASE}?method=album.getinfo&artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.title)}&api_key=${LFM_KEY}&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data.album) return { success: false, source: 'lastfm', error: 'Not found' };

    const tags = data.album.tags?.tag?.map((t: LastFMTag) => t.name) || [];
    const images = data.album.image;
    const largeImg = images?.find((i: LastFMImage) => i.size === 'extralarge' || i.size === 'large')?.['#text'];

    const candidate: CandidateData = {
      lastfm_url: data.album.url,
      tags: tags, // RENAMED: Match generic bucket in CandidateData
      image_url: toHttps(largeImg)
    };

    mapTagsToMoods(tags, candidate);

    return { success: true, source: 'lastfm', data: candidate };
  } catch (e) {
    return { success: false, source: 'lastfm', error: (e as Error).message };
  }
}

// ============================================================================
// 6. COVER ART ARCHIVE (Images from MBID)
// ============================================================================
const CAA_BASE = 'https://coverartarchive.org';

export async function fetchCoverArtData(album: { musicbrainz_id?: string }): Promise<EnrichmentResult> {
    try {
        if (!album.musicbrainz_id) return { success: false, source: 'coverArt', error: 'No MBID' };
        
        const res = await fetch(`${CAA_BASE}/release/${album.musicbrainz_id}`);
        if (!res.ok) return { success: false, source: 'coverArt', error: 'Not Found' };
        
        const data = await res.json();
        const images = data.images || [];

        const front = images.find((i: CAAImage) => i.front)?.image || images[0]?.image;
        const back = images.find((i: CAAImage) => i.back)?.image;
        
        // --- FIX: CONSOLIDATE INTO GALLERY ---
        const gallery: string[] = [];
        
        images.forEach((img: CAAImage) => {
            // If it's not the chosen front or back, put it in the gallery
            if (img.image !== front && img.image !== back) {
                const secureUrl = toHttps(img.image);
                if (secureUrl) gallery.push(secureUrl);
            }
        });

        const resultData: CandidateData = { 
            image_url: toHttps(front), 
            back_image_url: toHttps(back) 
        };

        if (gallery.length > 0) {
            resultData.inner_sleeve_images = gallery;
        }

        return { 
            success: true, 
            source: 'coverArt', 
            data: resultData
        };
    } catch (e) {
        return { success: false, source: 'coverArt', error: (e as Error).message };
    }
}

// ============================================================================
// 7. GENIUS (Album Link & Cleaned)
// ============================================================================
export async function fetchGeniusData(album: { artist: string, title: string }): Promise<EnrichmentResult> {
    try {
        if (!geniusClient) return { success: false, source: 'genius', error: 'No Token' };
        
        const search = await geniusClient.songs.search(`${album.artist} ${album.title}`);
        
        const songMatch = search.find(s => 
            s.album?.name?.toLowerCase().includes(album.title.toLowerCase()) ||
            s.title.toLowerCase().includes(album.title.toLowerCase())
        );

        if (!songMatch) return { success: false, source: 'genius', error: 'Not Found' };

        // --- FIX: REMOVED INVALID PROPERTY ACCESS ---
        return { 
            success: true, 
            source: 'genius', 
            data: { 
                genius_url: songMatch.url,
                image_url: songMatch.image
            } 
        };
    } catch (e) {
        return { success: false, source: 'genius', error: (e as Error).message };
    }
}

// ============================================================================
// 8. WIKIPEDIA (Links & Summary)
// ============================================================================
export async function fetchWikipediaData(album: { artist: string, title: string }): Promise<EnrichmentResult> {
    try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(album.artist + ' ' + album.title + ' album')}&format=json`;
        const res = await fetch(searchUrl);
        const data = await res.json();
        
        if (!data.query?.search?.length) return { success: false, source: 'wikipedia', error: 'Not found' };
        
        const pageId = data.query.search[0].pageid;
        
        // Step 2: Fetch the actual summary
        const summaryUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&pageids=${pageId}&format=json`;
        const summaryRes = await fetch(summaryUrl);
        const summaryData = await summaryRes.json();
        const extract = summaryData.query?.pages?.[pageId]?.extract;

        return { 
            success: true, 
            source: 'wikipedia', 
            data: { 
                wikipedia_url: `https://en.wikipedia.org/?curid=${pageId}`,
                notes: extract // Map summary to 'notes' field
            } 
        };
    } catch (e) {
        return { success: false, source: 'wikipedia', error: (e as Error).message };
    }
}
// ============================================================================
// 9. WHOSAMPLED (Samples & Covers)
// ============================================================================
export async function fetchWhoSampledData(album: { artist: string, title: string }): Promise<EnrichmentResult> {
    // TODO: Spotify acquired WhoSampled (Nov 2025). 
    // When "SongDNA" or equivalent endpoints become available in the Spotify Web API, 
    // replace this link generator with a real API call to fetch sample/cover data directly.
    const query = `${album.artist} ${album.title}`;
    const searchUrl = `https://www.whosampled.com/search/?q=${encodeURIComponent(query)}`;
    
    return {
        success: true,
        source: 'whosampled',
        data: {
            enrichment_summary: { whosampled: `Search WhoSampled: ${searchUrl}` }
        }
    };
}

// ============================================================================
// 10. SECONDHANDSONGS (Originals & Adaptations)
// ============================================================================
export async function fetchSecondHandSongsData(album: { artist: string, title: string }): Promise<EnrichmentResult> {
    const apiKey = process.env.SHS_API_KEY;
    if (!apiKey) return { success: false, source: 'secondhandsongs', error: 'No API Key' };

    try {
        // 1. Search for the Work (Song/Album)
        const url = `https://secondhandsongs.com/search/object?q=${encodeURIComponent(album.title)}&performer=${encodeURIComponent(album.artist)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        const data = await res.json();
        
        if (data.length === 0) return { success: false, source: 'secondhandsongs', error: 'Not Found' };

        const match = data[0];
        const uri = match.uri; // e.g., /release/12345
        
        // 2. Summarize the match
        let summary = `SecondHandSongs: Found "${match.title}" (${match.entityType})`;
        if (match.entityType === 'release') {
            summary += `. View covers and originals: https://secondhandsongs.com${uri}`;
        }

        return {
            success: true,
            source: 'secondhandsongs',
            data: {
                enrichment_summary: { secondhandsongs: summary },
                // Use is_cover flag if the entity type suggests it
                is_cover: match.entityType === 'performance' // A performance is often a cover in their DB context
            }
        };
    } catch (e) {
        return { success: false, source: 'secondhandsongs', error: (e as Error).message };
    }
}

// ============================================================================
// 11. THEAUDIODB (Art, Genres, Moods)
// ============================================================================
export async function fetchTheAudioDBData(album: { artist: string, title: string }): Promise<EnrichmentResult> {
    try {
        // Use '1' for test API key or env variable
        const apiKey = process.env.THEAUDIODB_API_KEY || '1'; 
        const url = `https://www.theaudiodb.com/api/v1/json/${apiKey}/searchalbum.php?s=${encodeURIComponent(album.artist)}&a=${encodeURIComponent(album.title)}`;
        
        const res = await fetch(url);
        const data = await res.json();
        const info = data.album?.[0];

        if (!info) return { success: false, source: 'theaudiodb', error: 'Not Found' };

        const candidate: CandidateData = {
            image_url: toHttps(info.strAlbumThumb),
            back_image_url: toHttps(info.strAlbumThumbBack),
            genres: info.strGenre ? [info.strGenre] : undefined,
            styles: info.strStyle ? [info.strStyle] : undefined,
            mood_happy: info.strMood === 'Happy' ? 1 : undefined,
            mood_sad: info.strMood === 'Sad' ? 1 : undefined,
            original_release_date: info.intYearReleased,
            notes: info.strDescriptionEN,
            country: info.strLocation,
            labels: info.strLabel ? [info.strLabel] : undefined
        };

        // Add CD/Vinyl art to gallery if available
        if (info.strAlbumCDart) {
            candidate.inner_sleeve_images = [toHttps(info.strAlbumCDart)!];
        }

        return { success: true, source: 'theaudiodb', data: candidate };
    } catch (e) {
        return { success: false, source: 'theaudiodb', error: (e as Error).message };
    }
}

// ============================================================================
// 12. WIKIDATA (Canonical Facts & IDs)
// ============================================================================
export async function fetchWikidataData(album: { artist: string, title: string }): Promise<EnrichmentResult> {
    try {
        // SPARQL Query to find album by Title AND Artist Label
        const sparql = `
            SELECT ?item ?itemLabel ?date ?producerLabel WHERE {
              ?item wdt:P31/wdt:P279* wd:Q482994; # Instance of Album
                    rdfs:label ?itemLabel.
              FILTER(REGEX(?itemLabel, "^${album.title}$", "i"))
              
              ?item wdt:P175 ?artist. # Performer
              ?artist rdfs:label ?artistLabel.
              FILTER(REGEX(?artistLabel, "^${album.artist}$", "i"))
              
              OPTIONAL { ?item wdt:P577 ?date. }
              OPTIONAL { ?item wdt:P162 ?producer. }
              
              SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
            } LIMIT 1
        `;

        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        const data = await res.json();
        
        if (!data.results?.bindings?.length) return { success: false, source: 'wikidata', error: 'Not Found' };

        const result = data.results.bindings[0];
        const date = result.date?.value; // ISO Date

        return {
            success: true,
            source: 'wikidata',
            data: {
                wikipedia_url: result.item.value, // Wikidata URL
                original_release_date: date ? date.split('T')[0] : undefined,
                producers: result.producerLabel ? [result.producerLabel.value] : undefined
            }
        };
    } catch (e) {
        return { success: false, source: 'wikidata', error: (e as Error).message };
    }
}

// ============================================================================
// 13. SETLIST.FM (Live Context)
// ============================================================================
export async function fetchSetlistFmData(album: { artist: string, musicbrainz_id?: string }): Promise<EnrichmentResult> {
    const apiKey = process.env.SETLIST_FM_API_KEY;
    
    // Fallback if no key
    if (!apiKey) {
        return {
            success: true,
            source: 'setlistfm',
            data: { notes: `Setlist.fm Search: https://www.setlist.fm/search?query=${encodeURIComponent(album.artist)}` }
        };
    }

    try {
        // Perform a quick search for the Artist to get their stats and URL
        const artistSearchUrl = `https://api.setlist.fm/rest/1.0/search/artists?artistName=${encodeURIComponent(album.artist)}&sort=relevance`;
        const res = await fetch(artistSearchUrl, { 
            headers: { 'x-api-key': apiKey, 'Accept': 'application/json' } 
        });
        
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        
        if (data.artist && data.artist.length > 0) {
            const artist = data.artist[0]; // Best match
            return {
                success: true,
                source: 'setlistfm',
                data: {
                    enrichment_summary: { setlistfm: `Setlist.fm: ${artist.name} has linked setlists. View tour history: ${artist.url}` }
                }
            };
        }
        
        return { success: false, source: 'setlistfm', error: 'Artist Not Found' };
    } catch {
        // Fallback to link on error
        return {
            success: true,
            source: 'setlistfm',
            data: { enrichment_summary: { setlistfm: `Setlist.fm Search: https://www.setlist.fm/search?query=${encodeURIComponent(album.artist)}` } }
        };
    }
}

// ============================================================================
// 14. RATE YOUR MUSIC (Community Meta)
// ============================================================================
export async function fetchRateYourMusicData(album: { artist: string, title: string }): Promise<EnrichmentResult> {
    // Scraping is blocked by Cloudflare. Provide Smart Search Link.
    const url = `https://rateyourmusic.com/search?searchtype=l&searchterm=${encodeURIComponent(album.artist + ' ' + album.title)}`;
    return {
        success: true,
        source: 'rateyourmusic',
        data: {
            enrichment_summary: { rateyourmusic: `RYM Search: ${url}` }
        }
    };
}

// ============================================================================
// 15. FANART.TV (High Res Logos/Backgrounds/CDArt)
// ============================================================================
export async function fetchFanartTvData(album: { musicbrainz_id?: string }): Promise<EnrichmentResult> {
    if (!album.musicbrainz_id) return { success: false, source: 'fanarttv', error: 'No MBID' };
    const apiKey = process.env.FANART_TV_API_KEY;
    if (!apiKey) return { success: false, source: 'fanarttv', error: 'No API Key' };

    try {
        const res = await fetch(`https://webservice.fanart.tv/v3/music/albums/${album.musicbrainz_id}?api_key=${apiKey}`);
        if (!res.ok) return { success: false, source: 'fanarttv', error: 'Not Found' };
        
        const data = await res.json();
        const images: string[] = [];
        let cover: string | undefined;

        if (data.albums?.[album.musicbrainz_id]) {
            const alb = data.albums[album.musicbrainz_id];
            if (alb.albumcover?.[0]) cover = toHttps(alb.albumcover[0].url);
            if (alb.cdart) images.push(...alb.cdart.map((i: { url: string }) => toHttps(i.url)!));
            if (alb.albumcover) images.push(...alb.albumcover.slice(1).map((i: { url: string }) => toHttps(i.url)!));
        }

        return {
            success: true,
            source: 'fanarttv',
            data: {
                image_url: cover,
                inner_sleeve_images: images.length > 0 ? images : undefined
            }
        };
    } catch (e) {
        return { success: false, source: 'fanarttv', error: (e as Error).message };
    }
}

// ============================================================================
// 16. DEEZER (Metadata, Genres, Covers)
// ============================================================================
export async function fetchDeezerData(album: { artist: string, title: string }): Promise<EnrichmentResult> {
    try {
        const query = `artist:"${album.artist}" album:"${album.title}"`;
        const res = await fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&limit=1`);
        const data = await res.json();
        
        const info = data.data?.[0];
        if (!info) return { success: false, source: 'deezer', error: 'Not Found' };

        // Fetch detailed album info for genres
        const detailRes = await fetch(`https://api.deezer.com/album/${info.id}`);
        const detail = await detailRes.json();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const genres = detail.genres?.data?.map((g: any) => g.name);

        return {
            success: true,
            source: 'deezer',
            data: {
                image_url: toHttps(info.cover_xl || info.cover_big),
                genres: genres,
                original_release_date: detail.release_date,
                labels: detail.label ? [detail.label] : undefined,
                barcode: detail.upc
            }
        };
    } catch (e) {
        return { success: false, source: 'deezer', error: (e as Error).message };
    }
}

// ============================================================================
// 17. MUSIXMATCH (Lyrics Link)
// ============================================================================
export async function fetchMusixmatchData(album: { artist: string, title: string }): Promise<EnrichmentResult> {
    // Smart Search Link
    const url = `https://www.musixmatch.com/search/${encodeURIComponent(album.artist + ' ' + album.title)}`;
    return {
        success: true,
        source: 'musixmatch',
        data: {
            enrichment_summary: { musixmatch: `Musixmatch Lyrics: ${url}` }
        }
    };
}

// ============================================================================
// 18. POPSIKE (Vinyl Valuation)
// ============================================================================
export async function fetchPopsikeData(album: { artist: string, title: string }): Promise<EnrichmentResult> {
    const url = `https://www.popsike.com/php/quicksearch.php?searchtext=${encodeURIComponent(album.artist + ' ' + album.title)}&sortord=dprice&category=25`;
    return {
        success: true,
        source: 'popsike',
        data: {
            enrichment_summary: { popsike: `Check Vinyl Value: ${url}` }
        }
    };
}

// ============================================================================
// 19. PITCHFORK (Reviews)
// ============================================================================
export async function fetchPitchforkData(album: { artist: string, title: string }): Promise<EnrichmentResult> {
    const url = `https://pitchfork.com/search/?query=${encodeURIComponent(album.artist + ' ' + album.title)}`;
    return {
        success: true,
        source: 'pitchfork',
        data: {
            enrichment_summary: { pitchfork: `Pitchfork Reviews: ${url}` }
        }
    };
}
