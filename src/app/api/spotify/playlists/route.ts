import { NextResponse } from 'next/server';
import { getSpotifyAccessTokenFromCookies, spotifyApiGet, SpotifyApiError } from '../../../../lib/spotifyUser';

type SpotifyPlaylistRow = {
  id: string;
  name: string;
  collaborative?: boolean;
  owner?: { id?: string | null };
  tracks?: { total?: number; href?: string };
};

type SpotifyPlaylistResponse = {
  items?: SpotifyPlaylistRow[];
  next?: string | null;
};

type SpotifyMe = {
  id?: string;
};

export async function GET() {
  try {
    const tokenData = await getSpotifyAccessTokenFromCookies();
    if (!tokenData.accessToken) {
      return NextResponse.json({ error: 'Not connected to Spotify' }, { status: 401 });
    }
    const me = await spotifyApiGet<SpotifyMe>(tokenData.accessToken, '/me');
    const currentUserId = me.id ?? '';

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
      scope: tokenData.scope ?? '',
      playlists: await Promise.all(
        items.map(async (row) => {
          let trackCount: number | null =
            typeof row.tracks?.total === 'number' ? row.tracks.total : null;
          if (trackCount === null) {
            const fallbackPaths = [
              `/playlists/${row.id}?market=from_token`,
              `/playlists/${row.id}?fields=tracks(total)&market=from_token`,
              `/playlists/${row.id}?fields=tracks(total)`,
              `/playlists/${row.id}/items?limit=1&market=from_token`,
              `/playlists/${row.id}/items?limit=1`,
            ];
            for (const path of fallbackPaths) {
              try {
                const payload = await spotifyApiGet<{ tracks?: { total?: number }; total?: number }>(
                  tokenData.accessToken,
                  path
                );
                trackCount =
                  typeof payload.tracks?.total === 'number'
                    ? payload.tracks.total
                    : typeof payload.total === 'number'
                      ? payload.total
                      : null;
                if (trackCount !== null) break;
              } catch {
                // Try next fallback shape.
              }
            }
          }
          return {
            id: row.id,
            name: row.name,
            trackCount,
            canImport:
              !!row.collaborative ||
              (!!currentUserId && (row.owner?.id ?? '') === currentUserId),
            importReason:
              !!row.collaborative ||
              (!!currentUserId && (row.owner?.id ?? '') === currentUserId)
                ? null
                : 'Spotify only allows track-item API access for owner/collaborator playlists.',
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
      response.cookies.set('spotify_scope', tokenData.refreshed.scope ?? tokenData.scope ?? '', {
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
    if (error instanceof SpotifyApiError && error.status === 429) {
      return NextResponse.json(
        { error: message, retryAfterSeconds: error.retryAfterSeconds ?? 3 },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
