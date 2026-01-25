import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const oauthToken = searchParams.get('oauth_token');
  const oauthVerifier = searchParams.get('oauth_verifier');

  const cookieStore = await cookies();
  const requestSecret = cookieStore.get('discogs_request_secret')?.value;

  if (!oauthToken || !oauthVerifier || !requestSecret) {
    return NextResponse.json({ error: 'Invalid callback parameters' }, { status: 400 });
  }

  const nonce = Math.floor(Math.random() * 1000000000).toString();
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // PLAINTEXT signature: ConsumerSecret&RequestSecret
  const signature = `${process.env.DISCOGS_CONSUMER_SECRET}&${requestSecret}`;

  const authHeader = `OAuth oauth_consumer_key="${process.env.DISCOGS_CONSUMER_KEY}", ` +
    `oauth_nonce="${nonce}", ` +
    `oauth_signature="${signature}", ` +
    `oauth_signature_method="PLAINTEXT", ` +
    `oauth_timestamp="${timestamp}", ` +
    `oauth_token="${oauthToken}", ` +
    `oauth_verifier="${oauthVerifier}"`;

  try {
    const response = await fetch('https://api.discogs.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
        'User-Agent': 'DeadwaxDialogues/1.0'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Discogs Access Token Failed: ${response.status} ${text}`);
    }

    const text = await response.text();
    const params = new URLSearchParams(text);
    const token = params.get('oauth_token');
    const tokenSecret = params.get('oauth_token_secret');
    
    // Sometimes Discogs returns 'screen_name' in the body, but not always documented.
    // If missing, we can fetch identity.
    let username = params.get('screen_name');

    if (!token || !tokenSecret) {
       throw new Error('Failed to retrieve access token from Discogs');
    }

    // Store Tokens
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
    
    // Fetch Identity if username is not in the token response
    if (!username) {
        const idNonce = Math.floor(Math.random() * 1000000000).toString();
        const idTimestamp = Math.floor(Date.now() / 1000).toString();
        const idSignature = `${process.env.DISCOGS_CONSUMER_SECRET}&${tokenSecret}`;
        
        const idHeader = `OAuth oauth_consumer_key="${process.env.DISCOGS_CONSUMER_KEY}", ` +
            `oauth_nonce="${idNonce}", ` +
            `oauth_signature="${idSignature}", ` +
            `oauth_signature_method="PLAINTEXT", ` +
            `oauth_timestamp="${idTimestamp}", ` +
            `oauth_token="${token}"`;
            
        const idRes = await fetch('https://api.discogs.com/oauth/identity', {
            headers: { 'Authorization': idHeader, 'User-Agent': 'DeadwaxDialogues/1.0' }
        });
        
        if (idRes.ok) {
            const idData = await idRes.json();
            username = idData.username;
        }
    }

    if (username) {
        cookieStore.set('discogs_username', username, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            maxAge: 60 * 60 * 24 * 30 
        });
    }

    cookieStore.delete('discogs_request_secret');

    const redirectUrl = new URL('/edit-collection', req.url);
    redirectUrl.searchParams.set('import', 'discogs_success');
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('OAuth Callback Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}