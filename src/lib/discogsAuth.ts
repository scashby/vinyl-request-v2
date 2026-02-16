const DEFAULT_USER_AGENT = 'DeadwaxDialogues/1.0 (https://deadwaxdialogues.com)';

const DISCOGS_TOKEN =
  process.env.DISCOGS_TOKEN ??
  process.env.DISCOGS_ACCESS_TOKEN ??
  process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
const DISCOGS_CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY;
const DISCOGS_CONSUMER_SECRET =
  process.env.DISCOGS_CONSUMER_SECRET ?? process.env.DISCOGS_SECRET_KEY;

export const hasDiscogsCredentials = (): boolean =>
  Boolean(DISCOGS_TOKEN) ||
  Boolean(DISCOGS_CONSUMER_KEY && DISCOGS_CONSUMER_SECRET);

export const discogsHeaders = (userAgent?: string): HeadersInit => {
  const headers: HeadersInit = {
    'User-Agent': userAgent || process.env.APP_USER_AGENT || DEFAULT_USER_AGENT,
  };

  if (DISCOGS_TOKEN) {
    return {
      ...headers,
      Authorization: `Discogs token=${DISCOGS_TOKEN}`,
    };
  }

  return headers;
};

export const discogsUrl = (url: string): string => {
  if (DISCOGS_TOKEN) return url;
  if (!(DISCOGS_CONSUMER_KEY && DISCOGS_CONSUMER_SECRET)) return url;

  const withAuth = new URL(url);
  withAuth.searchParams.set('key', DISCOGS_CONSUMER_KEY);
  withAuth.searchParams.set('secret', DISCOGS_CONSUMER_SECRET);
  return withAuth.toString();
};
