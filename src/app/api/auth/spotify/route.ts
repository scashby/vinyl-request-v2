import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSpotifyAuthorizeUrl } from '../../../../lib/spotifyUser';

export async function GET() {
  try {
    const state = randomBytes(16).toString('hex');
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
    return NextResponse.redirect(getSpotifyAuthorizeUrl(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Spotify auth init failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
