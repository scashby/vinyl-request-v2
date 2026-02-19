import { cookies } from 'next/headers';

const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';
const SPOTIFY_API = 'https://api.spotify.com/v1';

type TokenPayload = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

function getSpotifyEnv() {
  const clientId = (process.env.SPOTIFY_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.SPOTIFY_CLIENT_SECRET ?? '').trim();
  const configuredUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();
  const vercelUrl = (process.env.VERCEL_URL ?? '').trim();
  const appUrl = configuredUrl || (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000');
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error('Missing Spotify OAuth env: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, NEXT_PUBLIC_APP_URL');
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl.replace(/\/+$/, '')}/api/auth/callback/spotify`,
  };
}

function buildBasicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

export function getSpotifyAuthorizeUrl(state: string) {
  const { clientId, redirectUri } = getSpotifyEnv();
  const url = new URL(`${SPOTIFY_ACCOUNTS}/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set(
    'scope',
    'playlist-read-private playlist-read-collaborative user-read-private user-read-email'
  );
  // Force consent so stale tokens/scopes do not linger between reconnects.
  url.searchParams.set('show_dialog', 'true');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeSpotifyCode(code: string): Promise<TokenPayload> {
  const { clientId, clientSecret, redirectUri } = getSpotifyEnv();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${buildBasicAuth(clientId, clientSecret)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Spotify code exchange failed (${res.status})`);
  }
  return (await res.json()) as TokenPayload;
}

export async function refreshSpotifyAccessToken(refreshToken: string): Promise<TokenPayload> {
  const { clientId, clientSecret } = getSpotifyEnv();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${buildBasicAuth(clientId, clientSecret)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Spotify token refresh failed (${res.status})`);
  }
  return (await res.json()) as TokenPayload;
}

export async function getSpotifyAccessTokenFromCookies() {
  const cookieStore = await cookies();
  const access = cookieStore.get('spotify_access_token')?.value ?? '';
  const refresh = cookieStore.get('spotify_refresh_token')?.value ?? '';
  const expiresAt = Number(cookieStore.get('spotify_expires_at')?.value ?? '0');
  const scope = cookieStore.get('spotify_scope')?.value ?? '';

  if (access && Date.now() < expiresAt - 30_000) {
    return { accessToken: access, refreshToken: refresh, scope, refreshed: null as TokenPayload | null };
  }

  if (!refresh) {
    return { accessToken: '', refreshToken: '', scope, refreshed: null as TokenPayload | null };
  }

  const refreshed = await refreshSpotifyAccessToken(refresh);
  const nextRefresh = refreshed.refresh_token ?? refresh;
  return {
    accessToken: refreshed.access_token,
    refreshToken: nextRefresh,
    scope: refreshed.scope ?? scope,
    refreshed,
  };
}

export async function spotifyApiGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null) as {
      error?: { status?: number; message?: string } | string;
    } | null;
    const details =
      typeof payload?.error === 'string'
        ? payload.error
        : payload?.error?.message;
    throw new Error(`Spotify API ${path} failed (${res.status})${details ? `: ${details}` : ''}`);
  }
  return (await res.json()) as T;
}
