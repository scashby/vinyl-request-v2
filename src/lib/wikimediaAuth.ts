type WikimediaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
};

const WM_AUTH_BASE = 'https://meta.wikimedia.org/w/rest.php/oauth2';
const WM_AUTHORIZE_ENDPOINT = `${WM_AUTH_BASE}/authorize`;
const WM_TOKEN_ENDPOINT = `${WM_AUTH_BASE}/access_token`;

const getEnv = (key: string): string | null => {
  const value = process.env[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

export const getWikimediaClientId = () => getEnv('WIKIMEDIA_CLIENT_ID');
export const getWikimediaClientSecret = () => getEnv('WIKIMEDIA_CLIENT_SECRET');

export const getWikimediaRedirectUri = () => {
  const explicit = getEnv('WIKIMEDIA_REDIRECT_URI');
  if (explicit) return explicit;
  if (process.env.NODE_ENV === 'production') {
    return 'https://deadwaxdialogues.com/api/auth/wikimedia/callback';
  }
  return 'http://localhost:3000/api/auth/wikimedia/callback';
};

export const buildWikimediaAuthorizeUrl = (state: string, redirectUri?: string) => {
  const clientId = getWikimediaClientId();
  if (!clientId) throw new Error('Missing WIKIMEDIA_CLIENT_ID');
  const uri = redirectUri ?? getWikimediaRedirectUri();
  const url = new URL(WM_AUTHORIZE_ENDPOINT);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', uri);
  url.searchParams.set('state', state);
  return url.toString();
};

const parseTokenResponse = async (res: Response): Promise<WikimediaTokenResponse> => {
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Wikimedia token endpoint returned non-JSON (${res.status}): ${text.slice(0, 160)}`);
  }
  if (!res.ok || !body || typeof body !== 'object' || !('access_token' in body)) {
    const snippet = text.slice(0, 180).replace(/\s+/g, ' ');
    throw new Error(`Wikimedia token request failed (${res.status}): ${snippet}`);
  }
  return body as WikimediaTokenResponse;
};

export const exchangeWikimediaAuthorizationCode = async (
  code: string,
  redirectUri?: string
): Promise<WikimediaTokenResponse> => {
  const clientId = getWikimediaClientId();
  const clientSecret = getWikimediaClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error('Missing WIKIMEDIA_CLIENT_ID or WIKIMEDIA_CLIENT_SECRET');
  }
  const uri = redirectUri ?? getWikimediaRedirectUri();
  const payload = new URLSearchParams();
  payload.set('grant_type', 'authorization_code');
  payload.set('code', code);
  payload.set('client_id', clientId);
  payload.set('client_secret', clientSecret);
  payload.set('redirect_uri', uri);
  const res = await fetch(WM_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString(),
  });
  return parseTokenResponse(res);
};

export const refreshWikimediaAccessToken = async (refreshToken: string): Promise<WikimediaTokenResponse> => {
  const clientId = getWikimediaClientId();
  const clientSecret = getWikimediaClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error('Missing WIKIMEDIA_CLIENT_ID or WIKIMEDIA_CLIENT_SECRET');
  }
  const payload = new URLSearchParams();
  payload.set('grant_type', 'refresh_token');
  payload.set('refresh_token', refreshToken);
  payload.set('client_id', clientId);
  payload.set('client_secret', clientSecret);
  const res = await fetch(WM_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString(),
  });
  return parseTokenResponse(res);
};

let appTokenCache: { token: string; expMs: number } | null = null;

export const getWikimediaAppAccessToken = async (): Promise<string | null> => {
  const explicitToken = getEnv('WIKIMEDIA_ACCESS_TOKEN');
  if (explicitToken) return explicitToken;

  const clientId = getWikimediaClientId();
  const clientSecret = getWikimediaClientSecret();
  if (!clientId || !clientSecret) return null;

  if (appTokenCache && appTokenCache.expMs > Date.now()) {
    return appTokenCache.token;
  }

  const payload = new URLSearchParams();
  payload.set('grant_type', 'client_credentials');
  payload.set('client_id', clientId);
  payload.set('client_secret', clientSecret);

  const res = await fetch(WM_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString(),
  });

  const tokenData = await parseTokenResponse(res);
  const expiresIn = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600;
  appTokenCache = {
    token: tokenData.access_token,
    expMs: Date.now() + (expiresIn * 1000) - 60_000,
  };
  return tokenData.access_token;
};

