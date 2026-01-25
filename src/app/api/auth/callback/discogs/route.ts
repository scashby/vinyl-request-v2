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

  const oAuth = new Client().oauth();

  try {
    const accessData = await oAuth.getAccessToken(
      oauthToken,
      requestSecret,
      oauthVerifier
    );

    const { token, tokenSecret, results } = accessData;
    const username = results.screen_name;

    // Save Access Tokens in HttpOnly cookies (persistent login for 30 days)
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

    // Cleanup temp cookie
    cookieStore.delete('discogs_request_secret');

    // Redirect back to the import modal in the edit-collection page
    const redirectUrl = new URL('/edit-collection', req.url);
    redirectUrl.searchParams.set('import', 'discogs_success');
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('OAuth Callback Error:', error);
    return NextResponse.json({ error: 'Failed to complete authentication' }, { status: 500 });
  }
}