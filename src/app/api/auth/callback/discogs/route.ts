import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Client } from 'disconnect';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const oauthToken = searchParams.get('oauth_token');
  const oauthVerifier = searchParams.get('oauth_verifier');

  const cookieStore = await cookies();
  const requestSecret = cookieStore.get('discogs_request_secret')?.value;

  if (!oauthToken || !oauthVerifier || !requestSecret) {
    return NextResponse.json({ error: 'Invalid callback parameters' }, { status: 400 });
  }

  const oAuth = new Client({ userAgent: 'DeadwaxDialogues/1.0' }).oauth();

  try {
    const accessData = await new Promise<{ token: string; tokenSecret: string; results: { screen_name: string } }>((resolve, reject) => {
      oAuth.getAccessToken(
        oauthToken,
        requestSecret,
        oauthVerifier,
        (err: unknown, data: unknown) => { // Changed 'any' to 'unknown'
          if (err) return reject(err);
          resolve(data as { token: string; tokenSecret: string; results: { screen_name: string } });
        }
      );
    });

    const { token, tokenSecret, results } = accessData;
    const username = results.screen_name;

    cookieStore.set('discogs_access_token', token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30 
    });
    
    cookieStore.set('discogs_access_secret', tokenSecret, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30 
    });

    cookieStore.set('discogs_username', username, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30 
    });

    cookieStore.delete('discogs_request_secret');

    const redirectUrl = new URL('/edit-collection', req.url);
    redirectUrl.searchParams.set('import', 'discogs_success');
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('OAuth Callback Error:', error);
    return NextResponse.json({ error: 'Failed to complete authentication' }, { status: 500 });
  }
}