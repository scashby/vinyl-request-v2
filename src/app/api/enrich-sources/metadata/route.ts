import { NextResponse } from "next/server";

// --- Types ---
export interface NormalizedMetadata {
  source: 'Discogs' | 'MusicBrainz' | 'TheAudioDB';
  releaseDate?: string;
  label?: string;
  catalogNumber?: string;
  country?: string;
  genres: string[];
  styles: string[];
  credits: {
    role: string;
    name: string;
  }[];
  description?: string; // Bio or album review snippet
  score: number; // Confidence score
}

interface DiscogsArtistCredit {
  name: string;
  role?: string;
}

// --- Configuration ---
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN ?? process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
const TADB_API_KEY = process.env.THEAUDIODB_API_KEY || '1'; // '1' is the free test key
const USER_AGENT = process.env.APP_USER_AGENT || 'DeadwaxDialogues/1.0 (https://deadwaxdialogues.com)';

// --- Helpers ---

// 1. Discogs Fetcher
async function fetchDiscogsMetadata(artist: string, album: string): Promise<NormalizedMetadata | null> {
  try {
    if (!DISCOGS_TOKEN) return null;

    // Search
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

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const releaseId = searchData.results?.[0]?.id;

    if (!releaseId) return null;

    // Details
    const releaseRes = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
      headers: { 
        'User-Agent': USER_AGENT,
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`
      }
    });

    if (!releaseRes.ok) return null;
    const data = await releaseRes.json();

    // Map Credits
    // Fixed: strictly typed 'a' instead of any
    const rawCredits: DiscogsArtistCredit[] = [
        ...(data.extraartists || []),
        ...(data.artists || [])
    ];

    const credits = rawCredits.map((a) => ({
      role: a.role || 'Artist',
      name: a.name
    }));

    return {
      source: 'Discogs',
      releaseDate: data.released,
      label: data.labels?.[0]?.name,
      catalogNumber: data.labels?.[0]?.catno,
      country: data.country,
      genres: data.genres || [],
      styles: data.styles || [],
      credits: credits,
      score: 0.9
    };

  } catch (error) {
    console.error("Discogs Metadata Error:", error);
    return null;
  }
}

// 2. MusicBrainz Fetcher
async function fetchMusicBrainzMetadata(artist: string, album: string): Promise<NormalizedMetadata | null> {
  try {
    const query = `artist:"${artist}" AND release:"${album}"`;
    const searchRes = await fetch(`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=1`, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const release = searchData.releases?.[0];

    if (!release) return null;

    return {
      source: 'MusicBrainz',
      releaseDate: release.date,
      label: release['label-info']?.[0]?.label?.name,
      catalogNumber: release['label-info']?.[0]?.['catalog-number'],
      country: release.country,
      genres: [], 
      styles: [],
      credits: [], 
      score: 0.85
    };

  } catch (error) {
    console.error("MusicBrainz Metadata Error:", error);
    return null;
  }
}

// 3. TheAudioDB Fetcher
async function fetchTheAudioDBMetadata(artist: string, album: string): Promise<NormalizedMetadata | null> {
  try {
    const url = `https://www.theaudiodb.com/api/v1/json/${TADB_API_KEY}/searchalbum.php?s=${encodeURIComponent(artist)}&a=${encodeURIComponent(album)}`;
    
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const data = await res.json();
    const result = data.album?.[0];

    if (!result) return null;

    return {
      source: 'TheAudioDB',
      releaseDate: result.intYearReleased,
      label: result.strLabel,
      catalogNumber: undefined,
      country: undefined,
      genres: result.strGenre ? [result.strGenre] : [],
      styles: result.strStyle ? [result.strStyle] : [],
      credits: [],
      description: result.strDescriptionEN,
      score: 0.7
    };

  } catch (error) {
    console.error("TheAudioDB Metadata Error:", error);
    return null;
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

    console.log(`📝 Fetching metadata for: ${artist} - ${album}`);

    const [discogs, mb, tadb] = await Promise.all([
      fetchDiscogsMetadata(artist, album),
      fetchMusicBrainzMetadata(artist, album),
      fetchTheAudioDBMetadata(artist, album)
    ]);

    const results = [discogs, mb, tadb].filter((r): r is NormalizedMetadata => r !== null);

    console.log(`✅ Found metadata from ${results.length} sources`);

    return NextResponse.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error("Fatal error in metadata enrichment:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}