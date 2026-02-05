import { NextResponse } from "next/server";
import { getSpotifyToken } from "../../../../lib/spotify";

// --- Configuration ---
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN ?? process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
const USER_AGENT = 'DeadwaxDialogues/1.0 (https://deadwaxdialogues.com)';

// --- Types & Interfaces ---

type ImageCandidate = {
  source: 'Spotify' | 'Discogs' | 'MusicBrainz';
  url: string;
  width?: number;
  height?: number;
  type: 'front' | 'back' | 'gallery';
  score?: number; // Internal confidence score
};

// Spotify API Types
interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

interface SpotifyAlbum {
  id: string;
  images: SpotifyImage[];
  name: string;
}

interface SpotifySearchResponse {
  albums?: {
    items: SpotifyAlbum[];
  };
}

// Discogs API Types
interface DiscogsSearchResult {
  id: number;
  title: string;
  cover_image?: string;
}

interface DiscogsSearchResponse {
  results?: DiscogsSearchResult[];
}

interface DiscogsImage {
  uri: string;
  height: number;
  width: number;
  type: 'primary' | 'secondary';
}

interface DiscogsReleaseResponse {
  images?: DiscogsImage[];
}

// MusicBrainz / CAA API Types
interface MusicBrainzRelease {
  id: string;
  status?: string;
}

interface MusicBrainzSearchResponse {
  releases?: MusicBrainzRelease[];
}

interface CAAImage {
  image: string;
  types: string[];
  front: boolean;
  back: boolean;
}

interface CAAResponse {
  images: CAAImage[];
}

// --- Helpers ---

// 1. Spotify Image Fetcher
async function fetchSpotifyImages(artist: string, album: string): Promise<ImageCandidate[]> {
  try {
    const token = await getSpotifyToken();
    const query = encodeURIComponent(`album:${album} artist:${artist}`);
    
    const res = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=album&limit=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return [];
    
    const data = (await res.json()) as SpotifySearchResponse;
    const result = data.albums?.items?.[0];

    if (!result || !result.images) return [];

    return result.images.map((img, index) => ({
      source: 'Spotify',
      url: img.url,
      width: img.width,
      height: img.height,
      type: index === 0 ? 'front' : 'gallery', 
    }));
  } catch (error) {
    console.error("Error fetching Spotify images:", error);
    return [];
  }
}

// 2. Discogs Image Fetcher
async function fetchDiscogsImages(artist: string, album: string): Promise<ImageCandidate[]> {
  try {
    if (!DISCOGS_TOKEN) return [];

    const searchParams = new URLSearchParams({
      artist,
      release_title: album,
      type: 'release',
      per_page: '1'
    });

    const searchRes = await fetch(`https://api.discogs.com/database/search?${searchParams.toString()}`, {
      headers: { 
        'User-Agent': USER_AGENT,
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`
      }
    });

    if (!searchRes.ok) return [];
    const searchData = (await searchRes.json()) as DiscogsSearchResponse;
    const releaseId = searchData.results?.[0]?.id;

    if (!releaseId) return [];

    const releaseRes = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
      headers: { 
        'User-Agent': USER_AGENT,
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`
      }
    });

    if (!releaseRes.ok) return [];
    const releaseData = (await releaseRes.json()) as DiscogsReleaseResponse;

    if (!releaseData.images) return [];

    return releaseData.images.map((img) => ({
      source: 'Discogs',
      url: img.uri,
      width: img.width,
      height: img.height,
      type: img.type === 'primary' ? 'front' : 'gallery' 
    }));

  } catch (error) {
    console.error("Error fetching Discogs images:", error);
    return [];
  }
}

// 3. MusicBrainz / Cover Art Archive Fetcher
async function fetchMusicBrainzImages(artist: string, album: string): Promise<ImageCandidate[]> {
  try {
    // A. Search for Release to get MBID
    const query = `artist:"${artist}" AND release:"${album}"`;
    const searchRes = await fetch(`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=1`, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!searchRes.ok) return [];
    const searchData = (await searchRes.json()) as MusicBrainzSearchResponse;
    
    // Prioritize "Official" releases
    const release = searchData.releases?.find((r) => r.status === 'Official') || searchData.releases?.[0];

    if (!release?.id) return [];

    // B. Query Cover Art Archive
    const caaRes = await fetch(`https://coverartarchive.org/release/${release.id}`, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!caaRes.ok) return [];
    const caaData = (await caaRes.json()) as CAAResponse;

    if (!caaData.images) return [];

    return caaData.images.map((img) => {
      let type: ImageCandidate['type'] = 'gallery';
      if (img.types.includes('Front') || img.front) type = 'front';
      else if (img.types.includes('Back') || img.back) type = 'back';

      return {
        source: 'MusicBrainz',
        url: img.image, 
        width: 1000, // CAA often doesn't return immediate dims in the main list
        height: 1000,
        type: type
      };
    });

  } catch (error) {
    console.error("Error fetching MusicBrainz images:", error);
    return [];
  }
}

// --- Main Handler ---
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { artist, album } = body;

    if (!artist || !album) {
      return NextResponse.json({ success: false, error: "Artist and Album required" }, { status: 400 });
    }

    console.log(`🖼️ Fetching images for: ${artist} - ${album}`);

    const [spotifyImages, discogsImages, mbImages] = await Promise.all([
      fetchSpotifyImages(artist, album),
      fetchDiscogsImages(artist, album),
      fetchMusicBrainzImages(artist, album)
    ]);

    const allImages = [...spotifyImages, ...discogsImages, ...mbImages];

    console.log(`✅ Found ${allImages.length} images total`);

    return NextResponse.json({
      success: true,
      data: allImages
    });

  } catch (error) {
    console.error("Fatal error in image enrichment:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
// AUDIT: inspected, no changes.
