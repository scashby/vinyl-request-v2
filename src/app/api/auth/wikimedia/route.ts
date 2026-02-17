import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { buildWikimediaAuthorizeUrl, getWikimediaRedirectUri } from 'src/lib/wikimediaAuth';

export async function GET() {
  try {
    const state = randomUUID();
    const redirectUri = getWikimediaRedirectUri();
    const authorizeUrl = buildWikimediaAuthorizeUrl(state, redirectUri);

    const cookieStore = await cookies();
    cookieStore.set('wikimedia_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10,
    });

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start Wikimedia auth' },
      { status: 500 }
    );
  }
}

