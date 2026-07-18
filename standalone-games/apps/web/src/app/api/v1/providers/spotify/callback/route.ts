import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getProviderConnectionsRepository } from "@/lib/providerConnectionsRepositoryFactory";
import {
  exchangeStandaloneSpotifyCode,
  fetchSpotifyUserId,
} from "@/lib/spotifyOAuthStandalone";

const STATE_COOKIE = "standalone_spotify_oauth_state";
const TENANT_COOKIE = "standalone_spotify_oauth_tenant_id";
const USER_COOKIE = "standalone_spotify_oauth_user_id";
const RETURN_TO_COOKIE = "standalone_spotify_oauth_return_to";

function buildErrorRedirect(req: NextRequest, returnTo: string, code: string) {
  const url = new URL(returnTo, req.url);
  url.searchParams.set("spotify", code);
  return url;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get("code") ?? "").trim();
  const state = String(url.searchParams.get("state") ?? "").trim();

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value ?? "";
  const tenantId = cookieStore.get(TENANT_COOKIE)?.value ?? "";
  const userId = cookieStore.get(USER_COOKIE)?.value ?? "";
  const returnTo = cookieStore.get(RETURN_TO_COOKIE)?.value ?? "/?spotify=error";

  const clearCookie = {
    httpOnly: true as const,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  if (!code || !state || !expectedState || state !== expectedState || !tenantId || !userId) {
    const res = NextResponse.redirect(buildErrorRedirect(request, returnTo, "error"));
    res.cookies.set(STATE_COOKIE, "", clearCookie);
    res.cookies.set(TENANT_COOKIE, "", clearCookie);
    res.cookies.set(USER_COOKIE, "", clearCookie);
    res.cookies.set(RETURN_TO_COOKIE, "", clearCookie);
    return res;
  }

  try {
    const token = await exchangeStandaloneSpotifyCode(code);
    const externalUserId = await fetchSpotifyUserId(token.access_token);

    const repo = getProviderConnectionsRepository();
    const connection = await repo.create({
      tenantId,
      provider: "spotify",
      externalAccountId: externalUserId || null,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    });

    const redirectUrl = new URL(returnTo, request.url);
    redirectUrl.searchParams.set("spotify", "connected");
    redirectUrl.searchParams.set("providerConnectionId", connection.id);

    const res = NextResponse.redirect(redirectUrl);
    res.cookies.set(STATE_COOKIE, "", clearCookie);
    res.cookies.set(TENANT_COOKIE, "", clearCookie);
    res.cookies.set(USER_COOKIE, "", clearCookie);
    res.cookies.set(RETURN_TO_COOKIE, "", clearCookie);
    return res;
  } catch (error) {
    const res = NextResponse.redirect(buildErrorRedirect(request, returnTo, "error"));
    res.cookies.set(STATE_COOKIE, "", clearCookie);
    res.cookies.set(TENANT_COOKIE, "", clearCookie);
    res.cookies.set(USER_COOKIE, "", clearCookie);
    res.cookies.set(RETURN_TO_COOKIE, "", clearCookie);

    console.error("Standalone Spotify callback failed", error);
    return res;
  }
}
