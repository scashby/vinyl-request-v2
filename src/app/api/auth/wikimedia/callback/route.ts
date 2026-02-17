import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  exchangeWikimediaAuthorizationCode,
  getWikimediaRedirectUri,
} from 'src/lib/wikimediaAuth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const cookieStore = await cookies();
  const expectedState = cookieStore.get('wikimedia_oauth_state')?.value;

  const redirectUrl = new URL('/edit-collection', req.url);
  redirectUrl.searchParams.set('import', 'wikimedia_callback');

  if (state) {
    redirectUrl.searchParams.set('wikimedia_state', state);
  }

  if (error) {
    redirectUrl.searchParams.set('wikimedia_status', 'error');
    redirectUrl.searchParams.set('wikimedia_error', error);
    if (errorDescription) {
      redirectUrl.searchParams.set('wikimedia_error_description', errorDescription);
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    redirectUrl.searchParams.set('wikimedia_status', 'missing_code');
    return NextResponse.redirect(redirectUrl);
  }

  if (!state || !expectedState || state !== expectedState) {
    redirectUrl.searchParams.set('wikimedia_status', 'invalid_state');
    return NextResponse.redirect(redirectUrl);
  }

  if (code) {
    try {
      const token = await exchangeWikimediaAuthorizationCode(code, getWikimediaRedirectUri());
      const isProd = process.env.NODE_ENV === 'production';
      const expiresIn = typeof token.expires_in === 'number' ? token.expires_in : 3600;

      cookieStore.set('wikimedia_access_token', token.access_token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: expiresIn,
      });

      if (token.refresh_token) {
        cookieStore.set('wikimedia_refresh_token', token.refresh_token, {
          httpOnly: true,
          secure: isProd,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
        });
      }

      cookieStore.set('wikimedia_access_expires_at', String(Date.now() + (expiresIn * 1000)), {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: expiresIn,
      });

      cookieStore.delete('wikimedia_oauth_state');
      redirectUrl.searchParams.set('wikimedia_status', 'connected');
      return NextResponse.redirect(redirectUrl);
    } catch (exchangeError) {
      redirectUrl.searchParams.set('wikimedia_status', 'exchange_failed');
      redirectUrl.searchParams.set(
        'wikimedia_error',
        exchangeError instanceof Error ? exchangeError.message : 'Token exchange failed'
      );
      return NextResponse.redirect(redirectUrl);
    }
  }

  redirectUrl.searchParams.set('wikimedia_status', 'ok');
  return NextResponse.redirect(redirectUrl);
}
