const SPOTIFY_ACCOUNTS = "https://accounts.spotify.com";

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

type SpotifyMe = {
  id?: string;
};

function getStandaloneAppUrl() {
  const configuredUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  const vercelUrl = (process.env.VERCEL_URL ?? "").trim();
  const appUrl = configuredUrl || (vercelUrl ? `https://${vercelUrl}` : "http://127.0.0.1:3000");
  return appUrl.replace(/\/+$/, "");
}

function getSpotifyClientConfig() {
  const clientId = (process.env.SPOTIFY_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.SPOTIFY_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Spotify OAuth env vars: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET."
    );
  }

  return { clientId, clientSecret };
}

function buildBasicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export function getStandaloneSpotifyCallbackUrl() {
  return `${getStandaloneAppUrl()}/api/v1/providers/spotify/callback`;
}

export function getStandaloneSpotifyAuthorizeUrl(state: string) {
  const { clientId } = getSpotifyClientConfig();
  const url = new URL(`${SPOTIFY_ACCOUNTS}/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", getStandaloneSpotifyCallbackUrl());
  url.searchParams.set(
    "scope",
    "playlist-read-private playlist-read-collaborative user-read-private user-read-email"
  );
  url.searchParams.set("show_dialog", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeStandaloneSpotifyCode(code: string) {
  const { clientId, clientSecret } = getSpotifyClientConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getStandaloneSpotifyCallbackUrl(),
  });

  const response = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${buildBasicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Spotify code exchange failed (${response.status})`);
  }

  return (await response.json()) as SpotifyTokenResponse;
}

export async function fetchSpotifyUserId(accessToken: string) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Spotify /me failed (${response.status})`);
  }

  const data = (await response.json()) as SpotifyMe;
  return String(data.id ?? "").trim();
}
