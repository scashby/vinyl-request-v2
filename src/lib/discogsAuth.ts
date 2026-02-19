const DEFAULT_USER_AGENT = 'DeadwaxDialogues/1.0 (https://deadwaxdialogues.com)';

const DISCOGS_TOKEN =
  process.env.DISCOGS_TOKEN ??
  process.env.DISCOGS_ACCESS_TOKEN ??
  process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
const DISCOGS_CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY;
const DISCOGS_CONSUMER_SECRET =
  process.env.DISCOGS_CONSUMER_SECRET ?? process.env.DISCOGS_SECRET_KEY;
const HAS_CONSUMER_AUTH = Boolean(DISCOGS_CONSUMER_KEY && DISCOGS_CONSUMER_SECRET);
const HAS_TOKEN_AUTH = Boolean(DISCOGS_TOKEN);

export type DiscogsOAuthCredentials = {
  token: string;
  secret: string;
  consumerKey: string;
  consumerSecret: string;
};

export const hasDiscogsCredentials = (): boolean =>
  HAS_CONSUMER_AUTH || HAS_TOKEN_AUTH;

const parseCookieHeader = (cookieHeader: string | null): Record<string, string> => {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, pair) => {
    const [rawKey, ...rest] = pair.split('=');
    const key = rawKey?.trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('=').trim());
    return acc;
  }, {});
};

export const getDiscogsOAuthFromCookieHeader = (
  cookieHeader: string | null
): DiscogsOAuthCredentials | null => {
  if (!HAS_CONSUMER_AUTH) return null;
  const cookies = parseCookieHeader(cookieHeader);
  const token = cookies.discogs_access_token?.trim();
  const secret = cookies.discogs_access_secret?.trim();
  if (!token || !secret) return null;
  return {
    token,
    secret,
    consumerKey: DISCOGS_CONSUMER_KEY as string,
    consumerSecret: DISCOGS_CONSUMER_SECRET as string,
  };
};

export const discogsHeaders = (userAgent?: string): HeadersInit => {
  const headers: HeadersInit = {
    'User-Agent': userAgent || process.env.APP_USER_AGENT || DEFAULT_USER_AGENT,
    Accept: 'application/json',
  };

  // Prefer consumer key/secret when present.
  if (!HAS_CONSUMER_AUTH && HAS_TOKEN_AUTH) {
    return {
      ...headers,
      Authorization: `Discogs token=${DISCOGS_TOKEN}`,
    };
  }

  return headers;
};

export const discogsUrl = (url: string): string => {
  if (HAS_CONSUMER_AUTH) {
    const withAuth = new URL(url);
    withAuth.searchParams.set('key', DISCOGS_CONSUMER_KEY as string);
    withAuth.searchParams.set('secret', DISCOGS_CONSUMER_SECRET as string);
    return withAuth.toString();
  }
  if (HAS_TOKEN_AUTH) return url;
  return url;
};

const jsonLikeContentType = (value: string | null): boolean =>
  typeof value === 'string' && value.toLowerCase().includes('application/json');

const safeSnippet = (text: string): string =>
  text.slice(0, 180).replace(/\s+/g, ' ').trim();

type DiscogsAttempt = {
  name: string;
  url: string;
  headers: HeadersInit;
};

const buildOAuthHeader = (oauth: DiscogsOAuthCredentials): string => {
  const nonce = Math.floor(Math.random() * 1_000_000_000).toString();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = `${oauth.consumerSecret}&${oauth.secret}`;
  return `OAuth oauth_consumer_key="${oauth.consumerKey}", ` +
    `oauth_nonce="${nonce}", ` +
    `oauth_signature="${signature}", ` +
    `oauth_signature_method="PLAINTEXT", ` +
    `oauth_timestamp="${timestamp}", ` +
    `oauth_token="${oauth.token}"`;
};

const buildDiscogsAttempts = (
  url: string,
  userAgent?: string,
  oauth?: DiscogsOAuthCredentials | null,
  opts?: { oauthOnly?: boolean }
): DiscogsAttempt[] => {
  const ua = userAgent || process.env.APP_USER_AGENT || DEFAULT_USER_AGENT;
  const baseHeaders: HeadersInit = {
    'User-Agent': ua,
    Accept: 'application/vnd.discogs.v2.discogs+json, application/json',
  };
  const attempts: DiscogsAttempt[] = [];
  const oauthOnly = Boolean(opts?.oauthOnly);

  if (oauth) {
    attempts.push({
      name: 'oauth cookie',
      url,
      headers: {
        ...baseHeaders,
        Authorization: buildOAuthHeader(oauth),
      },
    });
  }

  if (oauthOnly) return attempts;

  if (HAS_TOKEN_AUTH) {
    attempts.push({
      name: 'token header',
      url,
      headers: { ...baseHeaders, Authorization: `Discogs token=${DISCOGS_TOKEN}` },
    });
    const tokenUrl = new URL(url);
    tokenUrl.searchParams.set('token', DISCOGS_TOKEN as string);
    attempts.push({ name: 'token query', url: tokenUrl.toString(), headers: baseHeaders });
  }

  if (HAS_CONSUMER_AUTH) {
    const keySecretUrl = new URL(url);
    keySecretUrl.searchParams.set('key', DISCOGS_CONSUMER_KEY as string);
    keySecretUrl.searchParams.set('secret', DISCOGS_CONSUMER_SECRET as string);
    attempts.push({ name: 'key/secret query', url: keySecretUrl.toString(), headers: baseHeaders });
    attempts.push({
      name: 'key/secret header',
      url,
      headers: {
        ...baseHeaders,
        Authorization: `Discogs key=${DISCOGS_CONSUMER_KEY}, secret=${DISCOGS_CONSUMER_SECRET}`,
      },
    });
  }

  // Last fallback: unauthenticated request with strong User-Agent.
  // Some endpoints still return limited data without auth; better than hard fail.
  attempts.push({ name: 'anonymous', url, headers: baseHeaders });

  return attempts;
};

export async function fetchDiscogsJson<T>(
  url: string,
  userAgent?: string,
  opts?: { oauth?: DiscogsOAuthCredentials | null; oauthOnly?: boolean }
): Promise<T> {
  const attempts = buildDiscogsAttempts(url, userAgent, opts?.oauth, { oauthOnly: opts?.oauthOnly });
  if (attempts.length === 0) {
    if (opts?.oauthOnly) {
      throw new Error('Discogs OAuth cookie missing');
    }
    throw new Error('Discogs credentials not configured');
  }

  const failures: string[] = [];
  for (const attempt of attempts) {
    const res = await fetch(attempt.url, { headers: attempt.headers });
    const body = await res.text();
    const contentType = res.headers.get('content-type');
    const looksJson = jsonLikeContentType(contentType) || body.trim().startsWith('{') || body.trim().startsWith('[');
    if (!looksJson) {
      failures.push(`${attempt.name}: non-JSON (${res.status}) ${safeSnippet(body)}`);
      continue;
    }
    try {
      const parsed = JSON.parse(body) as T;
      if (res.ok) return parsed;
      failures.push(`${attempt.name}: JSON error (${res.status})`);
    } catch {
      failures.push(`${attempt.name}: invalid JSON (${res.status}) ${safeSnippet(body)}`);
    }
  }

  throw new Error(`Discogs request failed. ${failures.join(' | ')}`);
}
