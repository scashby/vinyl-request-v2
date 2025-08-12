// src/lib/spotify.ts
interface SpotifyArtist { name: string }
interface SpotifyImage { url: string }
interface SpotifyAlbum { name: string; images?: SpotifyImage[] }
interface SpotifyTrack { name: string; artists?: SpotifyArtist[]; album?: SpotifyAlbum }

let cached: { token: string; expiresAt: number } | null = null;

export async function getSpotifyToken() {
  const now = Date.now();
  if (cached && now < cached.expiresAt) return cached.token;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) throw new Error(`Spotify token: HTTP ${res.status}`);
  const data = await res.json();
  cached = { token: data.access_token, expiresAt: now + (data.expires_in - 60) * 1000 };
  return cached.token;
}

export async function searchSpotifyTrack(artist: string, title: string) {
  const token = await getSpotifyToken();
  const q = encodeURIComponent(`track:${title} artist:${artist}`);
  const res = await fetch(`https://api.spotify.com/v1/search?type=track&limit=5&q=${q}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const t: SpotifyTrack | undefined = data?.tracks?.items?.[0];
  if (!t) return null;
  return {
    artist: (t.artists || []).map(a=>a.name).join(', ') || artist,
    title: t.name || title,
    album: t.album?.name || 'Unknown Album',
    image_url: t.album?.images?.[0]?.url,
    confidence: 0.85,
    source: 'spotify',
    service: 'Spotify',
  };
}
