// src/lib/lastfm.ts
interface LastFMImage { ['#text']?: string }
interface LastFMTrack { name: string; artist: string; image?: LastFMImage[] }
interface LastFMSearchResp { results?: { trackmatches?: { track?: LastFMTrack[] } } }

export async function searchLastFMTrack(artist: string, title: string) {
  if (!process.env.LASTFM_API_KEY) return null;
  const url = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=5`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data: LastFMSearchResp = await res.json();
  const t = data?.results?.trackmatches?.track?.[0];
  if (!t) return null;
  return {
    artist: t.artist || artist,
    title: t.name || title,
    album: 'Unknown Album',
    image_url: Array.isArray(t.image) ? t.image.at(-1)?.['#text'] : undefined,
    confidence: 0.7,
    source: 'lastfm',
    service: 'Last.fm',
  };
}
