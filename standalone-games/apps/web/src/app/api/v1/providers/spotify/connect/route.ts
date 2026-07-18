import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStandaloneSpotifyAuthorizeUrl } from "@/lib/spotifyOAuthStandalone";

const STATE_COOKIE = "standalone_spotify_oauth_state";
const TENANT_COOKIE = "standalone_spotify_oauth_tenant_id";
const USER_COOKIE = "standalone_spotify_oauth_user_id";
const RETURN_TO_COOKIE = "standalone_spotify_oauth_return_to";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantId = String(url.searchParams.get("tenantId") ?? "").trim();
    const userId = String(url.searchParams.get("userId") ?? "").trim();
    const returnTo =
      String(url.searchParams.get("returnTo") ?? "").trim() ||
      "/?spotify=connected";

    if (!tenantId || !userId) {
      return NextResponse.json(
        { ok: false, error: "tenantId and userId are required query params." },
        { status: 400 }
      );
    }

    const state = randomBytes(16).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    cookieStore.set(TENANT_COOKIE, tenantId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    cookieStore.set(USER_COOKIE, userId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    cookieStore.set(RETURN_TO_COOKIE, returnTo, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    return NextResponse.redirect(getStandaloneSpotifyAuthorizeUrl(state));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
