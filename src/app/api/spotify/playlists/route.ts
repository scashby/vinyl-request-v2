import { NextResponse } from 'next/server';
import { getSpotifyAccessTokenFromCookies, spotifyApiGet, SpotifyApiError } from '../../../../lib/spotifyUser';

export const runtime = 'nodejs';

type SpotifyPlaylistRow = {
  id: string;
  name: string;
  snapshot_id?: string;
  collaborative?: boolean;
  owner?: { id?: string | null };
  items?: { total?: number; href?: string };
  tracks?: { total?: number; href?: string };
};

type SpotifyPlaylistResponse = {
  items?: SpotifyPlaylistRow[];
  next?: string | null;
};

type SpotifyMe = {
  id?: string;
};

type PlaylistsPayload = {
  scope: string;
  hasMore: boolean;
  cached: boolean;
  playlists: Array<{
    id: string;
    name: string;
    trackCount: number | null;
    snapshotId: string | null;
    canImport: boolean;
    importReason: string | null;
  }>;
};

type CachedEntry = {
  expiresAt: number;
  payload: PlaylistsPayload;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

const cacheStore: Map<string, CachedEntry> =
  (globalThis as { __spotifyPlaylistsCache?: Map<string, CachedEntry> }).__spotifyPlaylistsCache ??
  new Map<string, CachedEntry>();
(globalThis as { __spotifyPlaylistsCache?: Map<string, CachedEntry> }).__spotifyPlaylistsCache = cacheStore;

const inflightStore: Map<string, Promise<PlaylistsPayload>> =
  (globalThis as { __spotifyPlaylistsInflight?: Map<string, Promise<PlaylistsPayload>> }).__spotifyPlaylistsInflight ??
  new Map<string, Promise<PlaylistsPayload>>();
(globalThis as { __spotifyPlaylistsInflight?: Map<string, Promise<PlaylistsPayload>> }).__spotifyPlaylistsInflight =
  inflightStore;

export async function GET() {
  try {
    const tokenData = await getSpotifyAccessTokenFromCookies();
    if (!tokenData.accessToken) {
      return NextResponse.json({ error: 'Not connected to Spotify' }, { status: 401 });
    }
    const cacheKey = tokenData.refreshToken || tokenData.accessToken.slice(0, 24);
    const now = Date.now();
    const cached = cacheStore.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json({ ...cached.payload, cached: true });
    }

    let inFlight = inflightStore.get(cacheKey);
    if (!inFlight) {
      inFlight = (async () => {
        // Keep this endpoint intentionally low-call during Spotify rate-limit windows:
        // one playlists request + one /me request only, no pagination or per-playlist follow-ups.
        const me = await spotifyApiGet<SpotifyMe>(tokenData.accessToken, '/me', { maxAttempts: 1 });
        const spotifyUserId = (me.id ?? '').trim();

        const data = await spotifyApiGet<SpotifyPlaylistResponse>(
          tokenData.accessToken,
          '/me/playlists?limit=50&offset=0&fields=items(id,name,snapshot_id,collaborative,owner(id),items(total),tracks(total)),next',
          { maxAttempts: 1 }
        );
        const items: SpotifyPlaylistRow[] = data.items ?? [];
        const payload: PlaylistsPayload = {
          scope: tokenData.scope ?? '',
          hasMore: Boolean(data.next),
          cached: false,
          playlists: items.map((row) => {
            const ownerId = (row.owner?.id ?? '').trim();
            const collaborative = row.collaborative === true;
            const ownedByMe = !!spotifyUserId && ownerId === spotifyUserId;
            const trackCount =
              typeof row.items?.total === 'number'
                ? row.items.total
                : typeof row.tracks?.total === 'number'
                  ? row.tracks.total
                  : null;

            const canImport = ownedByMe || collaborative || ownerId.length === 0;
            const importReason = canImport
              ? null
              : 'Spotify now restricts playlist-item reads to owned/collaborative playlists.';

            return {
              id: row.id,
              name: row.name,
              trackCount,
              snapshotId: row.snapshot_id ?? null,
              canImport,
              importReason,
            };
          }),
        };
        cacheStore.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
        return payload;
      })().finally(() => {
        inflightStore.delete(cacheKey);
      });
      inflightStore.set(cacheKey, inFlight);
    }

    const payload = await inFlight;
    const response = NextResponse.json(payload);

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
