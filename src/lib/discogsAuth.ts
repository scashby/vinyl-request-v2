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
