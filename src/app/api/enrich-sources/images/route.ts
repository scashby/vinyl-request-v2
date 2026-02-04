import { NextResponse } from "next/server";

const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN ?? process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
const USER_AGENT = process.env.APP_USER_AGENT || 'DeadwaxDialogues/1.0 (https://deadwaxdialogues.com)';

type ImageCandidate = {
  source: 'Discogs' | 'MusicBrainz';
  url: string;
  width?: number;
  height?: number;
  type: 'front' | 'back' | 'gallery';
};

async function fetchDiscogsImages(artist: string, album: string): Promise<ImageCandidate[]> {
  if (!DISCOGS_TOKEN) return [];
  const searchParams = new URLSearchParams({
    artist,
    release_title: album,
    type: 'release',
    per_page: '1'
  });

  const searchRes = await fetch(`https://api.discogs.com/database/search?${searchParams.toString()}`, {
    headers: { 'User-Agent': USER_AGENT, 'Authorization': `Discogs token=${DISCOGS_TOKEN}` }
  });
  if (!searchRes.ok) return [];
  const searchData = await searchRes.json();
  const releaseId = searchData.results?.[0]?.id;
  if (!releaseId) return [];

  const releaseRes = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
    headers: { 'User-Agent': USER_AGENT, 'Authorization': `Discogs token=${DISCOGS_TOKEN}` }
  });
  if (!releaseRes.ok) return [];
  const releaseData = await releaseRes.json();
  const images = releaseData.images ?? [];

  return images.map((img: { uri: string; width?: number; height?: number; type?: string }) => ({
    source: 'Discogs',
    url: img.uri,
    width: img.width,
    height: img.height,
    type: img.type === 'primary' ? 'front' : 'gallery'
  }));
}

async function fetchMusicBrainzImages(artist: string, album: string): Promise<ImageCandidate[]> {
  const query = `artist:"${artist}" AND release:"${album}"`;
  const searchRes = await fetch(`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=1`, {
    headers: { 'User-Agent': USER_AGENT }
  });
  if (!searchRes.ok) return [];
  const searchData = await searchRes.json();
  const release = searchData.releases?.[0];
  if (!release?.id) return [];

  const caaRes = await fetch(`https://coverartarchive.org/release/${release.id}`, {
    headers: { 'User-Agent': USER_AGENT }
  });
  if (!caaRes.ok) return [];
  const caaData = await caaRes.json();

  return (caaData.images ?? []).map((img: { image: string; types: string[]; front?: boolean; back?: boolean }) => {
    let type: ImageCandidate['type'] = 'gallery';
    if (img.types?.includes('Front') || img.front) type = 'front';
    else if (img.types?.includes('Back') || img.back) type = 'back';
    return {
      source: 'MusicBrainz',
      url: img.image,
      type,
    };
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { artist, album } = body;

    if (!artist || !album) {
      return NextResponse.json({ success: false, error: 'Artist and album required' }, { status: 400 });
    }

    const [discogs, musicbrainz] = await Promise.all([
      fetchDiscogsImages(artist, album),
      fetchMusicBrainzImages(artist, album)
    ]);

    return NextResponse.json({
      success: true,
      data: [...discogs, ...musicbrainz]
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
