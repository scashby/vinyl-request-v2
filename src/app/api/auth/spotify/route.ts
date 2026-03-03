import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSpotifyAuthorizeUrl } from '../../../../lib/spotifyUser';

export async function GET(req: Request) {
  try {
    const state = randomBytes(16).toString('hex');
    const reqUrl = new URL(req.url);
    const returnToRaw = reqUrl.searchParams.get('returnTo') || req.headers.get('referer');
    const returnToPath = (() => {
      if (!returnToRaw) return '/edit-collection';
      try {
        const parsed = new URL(returnToRaw, reqUrl.origin);
        const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        return path.startsWith('/') ? path : '/edit-collection';
      } catch {
        return '/edit-collection';
      }
    })();
    const cookieStore = await cookies();
    cookieStore.set('spotify_access_token', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    cookieStore.set('spotify_refresh_token', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    cookieStore.set('spotify_expires_at', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    cookieStore.set('spotify_scope', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    cookieStore.set('spotify_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10,
    });
    cookieStore.set('spotify_post_auth_return_to', returnToPath, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10,
    });
    return NextResponse.redirect(getSpotifyAuthorizeUrl(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Spotify auth init failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
