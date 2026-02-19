import { NextResponse } from 'next/server';
import { getSpotifyAccessTokenFromCookies, spotifyApiGet } from '../../../../lib/spotifyUser';

type SpotifyPlaylistRow = {
  id: string;
  name: string;
  tracks?: { total?: number };
};

type SpotifyPlaylistResponse = {
  items?: SpotifyPlaylistRow[];
  next?: string | null;
};

export async function GET() {
  try {
    const tokenData = await getSpotifyAccessTokenFromCookies();
    if (!tokenData.accessToken) {
      return NextResponse.json({ error: 'Not connected to Spotify' }, { status: 401 });
    }

    const items: SpotifyPlaylistRow[] = [];
    let offset = 0;
    const limit = 50;

    while (true) {
      const data = await spotifyApiGet<SpotifyPlaylistResponse>(
        tokenData.accessToken,
        `/me/playlists?limit=${limit}&offset=${offset}`
      );
      const rows = data.items ?? [];
      items.push(...rows);
      if (!data.next || rows.length === 0) break;
      offset += limit;
      if (offset > 1000) break;
    }

    const response = NextResponse.json({
      playlists: await Promise.all(
        items.map(async (row) => {
          let trackCount = row.tracks?.total;
          if (typeof trackCount !== 'number') {
            try {
              const playlist = await spotifyApiGet<{ tracks?: { total?: number } }>(
                tokenData.accessToken,
                `/playlists/${row.id}?fields=tracks(total)`
              );
              trackCount = playlist.tracks?.total;
            } catch {
              trackCount = 0;
            }
          }
          return {
            id: row.id,
            name: row.name,
            trackCount: trackCount ?? 0,
          };
        })
      ),
    });

    if (tokenData.refreshed) {
      response.cookies.set('spotify_access_token', tokenData.refreshed.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: tokenData.refreshed.expires_in,
      });
      if (tokenData.refreshToken) {
        response.cookies.set('spotify_refresh_token', tokenData.refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 90,
        });
      }
      response.cookies.set('spotify_expires_at', String(Date.now() + tokenData.refreshed.expires_in * 1000), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 90,
      });
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch Spotify playlists';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
