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
  label?: string[];
  cat_no?: string;
  country?: string;
  
  // Images
  image_url?: string;
  back_image_url?: string;
  
  // Audio Features
  tempo_bpm?: number;
  
  // Extra
  lastfm_tags?: string[];
  lyrics?: string;
  lyrics_url?: string;
};

export type EnrichmentResult = {
  success: boolean;
  source: string;
  data?: CandidateData;
  error?: string;
};

// Helper interface to avoid 'any' in MusicBrainz response
interface MusicBrainzRelease {
  id: string;
  status?: string;
  date?: string;
  country?: string;
  'label-info'?: Array<{
    label?: { name: string };
    'catalog-number'?: string;
  }>;
}

const USER_AGENT = 'DeadwaxDialogues/1.0 (https://deadwaxdialogues.com)';

// ============================================================================
// 1. MUSICBRAINZ (Dates, Labels, Country)
// ============================================================================
const MB_BASE = 'https://musicbrainz.org/ws/2';

async function mbSearch(artist: string, title: string): Promise<string | null> {
  try {
    const query = `artist:"${artist}" AND release:"${title}"`;
    const url = `${MB_BASE}/release/?query=${encodeURIComponent(query)}&fmt=json&limit=3`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const data = await res.json();
    
    // Prefer "Official" releases
    const releases = data.releases as MusicBrainzRelease[];
    const release = releases?.find((r) => r.status === 'Official') || releases?.[0];
    
    return release?.id || null;
  } catch { return null; }
}

async function mbGetRelease(mbid: string): Promise<MusicBrainzRelease | null> {
  try {
    const url = `${MB_BASE}/release/${mbid}?inc=artists+labels+recordings+release-groups&fmt=json`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    return res.ok ? res.json() : null;
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
      original_release_date: release.date, // Format: YYYY-MM-DD
      country: release.country,
    };

    if (release['label-info']?.[0]) {
      const info = release['label-info'][0];
      if (info.label?.name) candidate.label = [info.label.name];
      if (info['catalog-number']) candidate.cat_no = info['catalog-number'];
    }
    
    return { success: true, source: 'musicbrainz', data: candidate };
  } catch (e) {
    return { success: false, source: 'musicbrainz', error: (e as Error).message };
  }
}

// ============================================================================
// 2. SPOTIFY (Genres, Dates, BPM, Images)
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

    const albumRes = await fetch(`https://api.spotify.com/v1/albums/${spId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await albumRes.json();

    const candidate: CandidateData = {
      spotify_id: spId,
      original_release_date: data.release_date,
      image_url: data.images?.[0]?.url,
      label: data.label ? [data.label] : undefined,
      genres: data.genres?.length ? data.genres : undefined 
    };

    if (!candidate.genres && data.artists?.[0]?.id) {
       const artistRes = await fetch(`https://api.spotify.com/v1/artists/${data.artists[0].id}`, {
         headers: { 'Authorization': `Bearer ${token}` }
       });
       const artistData = await artistRes.json();
       if (artistData.genres) candidate.genres = artistData.genres;
    }

    if (data.tracks?.items?.[0]?.id) {
        const featRes = await fetch(`https://api.spotify.com/v1/audio-features/${data.tracks.items[0].id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (featRes.ok) {
            const feat = await featRes.json();
            if (feat.tempo) candidate.tempo_bpm = Math.round(feat.tempo);
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

    const albumRes = await fetch(`https://api.music.apple.com/v1/catalog/us/albums/${amId}`, {
        headers: { 'Authorization': `Bearer ${AM_TOKEN}` }
    });
    const data = await albumRes.json();
    const attrs = data.data?.[0]?.attributes;

    const candidate: CandidateData = {
        apple_music_id: amId,
        image_url: attrs?.artwork?.url?.replace('{w}', '1000').replace('{h}', '1000'),
        genres: attrs?.genreNames,
        label: attrs?.recordLabel ? [attrs.recordLabel] : undefined,
        original_release_date: attrs?.releaseDate
    };

    return { success: true, source: 'appleMusic', data: candidate };
  } catch (e) {
    return { success: false, source: 'appleMusic', error: (e as Error).message };
  }
}

// ============================================================================
// 4. DISCOGS (Styles, Genres, Year)
// ============================================================================
const DISCOGS_TOKEN = process.env.DISCOGS_ACCESS_TOKEN!;

export async function fetchDiscogsData(album: { artist: string, title: string, discogs_release_id?: string }): Promise<EnrichmentResult> {
  try {
    let releaseId = album.discogs_release_id;

    if (!releaseId) {
      const q = `${album.artist} - ${album.title}`;
      const searchRes = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&token=${DISCOGS_TOKEN}`);
      const searchData = await searchRes.json();
      releaseId = searchData.results?.[0]?.id;
    }

    if (!releaseId) return { success: false, source: 'discogs', error: 'Not found' };

    const releaseRes = await fetch(`https://api.discogs.com/releases/${releaseId}?token=${DISCOGS_TOKEN}`);
    const data = await releaseRes.json();

    const candidate: CandidateData = {
      discogs_release_id: String(releaseId),
      discogs_master_id: data.master_id ? String(data.master_id) : undefined,
      genres: data.genres,
      styles: data.styles,
      original_release_date: data.released,
      image_url: data.images?.[0]?.uri,
      label: data.labels?.[0]?.name ? [data.labels[0].name] : undefined,
      country: data.country
    };

    return { success: true, source: 'discogs', data: candidate };
  } catch (e) {
    return { success: false, source: 'discogs', error: (e as Error).message };
  }
}

// ============================================================================
// 5. LAST.FM (Tags/Genres)
// ============================================================================
const LFM_KEY = process.env.LASTFM_API_KEY!;
const LFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

export async function fetchLastFmData(album: { artist: string, title: string }): Promise<EnrichmentResult> {
  try {
    const url = `${LFM_BASE}?method=album.getinfo&artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.title)}&api_key=${LFM_KEY}&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data.album) return { success: false, source: 'lastfm', error: 'Not found' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tags = data.album.tags?.tag?.map((t: any) => t.name) || [];
    const images = data.album.image;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const largeImg = images?.find((i: any) => i.size === 'extralarge' || i.size === 'large')?.['#text'];

    const candidate: CandidateData = {
      lastfm_url: data.album.url,
      lastfm_tags: tags,
      image_url: largeImg || undefined
    };

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const front = data.images?.find((i: any) => i.front)?.image;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const back = data.images?.find((i: any) => i.back)?.image;

        return { 
            success: true, 
            source: 'coverArt', 
            data: { image_url: front, back_image_url: back } 
        };
    } catch (e) {
        return { success: false, source: 'coverArt', error: (e as Error).message };
    }
}

// ============================================================================
// 7. GENIUS (Album Link)
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
        
        return { 
            success: true, 
            source: 'wikipedia', 
            data: { wikipedia_url: `https://en.wikipedia.org/?curid=${pageId}` } 
        };
    } catch (e) {
        return { success: false, source: 'wikipedia', error: (e as Error).message };
    }
}