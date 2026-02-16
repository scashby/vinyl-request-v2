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

export const hasDiscogsCredentials = (): boolean =>
  HAS_CONSUMER_AUTH || HAS_TOKEN_AUTH;

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

const buildDiscogsAttempts = (url: string, userAgent?: string): DiscogsAttempt[] => {
  const ua = userAgent || process.env.APP_USER_AGENT || DEFAULT_USER_AGENT;
  const baseHeaders: HeadersInit = {
    'User-Agent': ua,
    Accept: 'application/vnd.discogs.v2.discogs+json, application/json',
  };
  const attempts: DiscogsAttempt[] = [];

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

export async function fetchDiscogsJson<T>(url: string, userAgent?: string): Promise<T> {
  const attempts = buildDiscogsAttempts(url, userAgent);
  if (attempts.length === 0) {
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
