import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeSpotifyCode } from '../../../../../lib/spotifyUser';

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const appUrl = getAppUrl();
  const redirectBase = appUrl ? `${appUrl.replace(/\/+$/, '')}/edit-collection` : '/edit-collection';

  if (!code || !state) {
    return NextResponse.redirect(`${redirectBase}?spotify=error`);
  }

  try {
    const cookieStore = await cookies();
    const expectedState = cookieStore.get('spotify_oauth_state')?.value ?? '';
    if (!expectedState || expectedState !== state) {
      return NextResponse.redirect(`${redirectBase}?spotify=state_mismatch`);
    }

    const token = await exchangeSpotifyCode(code);
    const res = NextResponse.redirect(`${redirectBase}?spotify=connected`);
    res.cookies.set('spotify_access_token', token.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: token.expires_in,
    });
    if (token.refresh_token) {
      res.cookies.set('spotify_refresh_token', token.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 90,
      });
    }
    res.cookies.set('spotify_expires_at', String(Date.now() + token.expires_in * 1000), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 90,
    });
    res.cookies.set('spotify_oauth_state', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return res;
  } catch (error) {
    console.error('Spotify callback failed:', error);
    return NextResponse.redirect(`${redirectBase}?spotify=error`);
  }
}
