import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const resolveCookieDomain = (host: string | null): string | undefined => {
  const normalized = (host || '').toLowerCase().split(':')[0];
  if (normalized === 'deadwaxdialogues.com' || normalized.endsWith('.deadwaxdialogues.com')) {
    return '.deadwaxdialogues.com';
  }
  return undefined;
};

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const host = req.headers.get('host');
  const callbackUrl =
    process.env.DISCOGS_CALLBACK_URL ||
    `${reqUrl.protocol}//${host || reqUrl.host}/api/auth/callback/discogs`;
  const cookieDomain = resolveCookieDomain(host);

  const nonce = Math.floor(Math.random() * 1000000000).toString();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // PLAINTEXT signature: ConsumerSecret&
  const signature = `${process.env.DISCOGS_CONSUMER_SECRET}&`;

  const authHeader = `OAuth oauth_consumer_key="${process.env.DISCOGS_CONSUMER_KEY}", ` +
    `oauth_nonce="${nonce}", ` +
    `oauth_signature="${signature}", ` +
    `oauth_signature_method="PLAINTEXT", ` +
    `oauth_timestamp="${timestamp}", ` +
    `oauth_callback="${callbackUrl}"`;

  try {
    const response = await fetch('https://api.discogs.com/oauth/request_token', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
        'User-Agent': 'DeadwaxDialogues/1.0'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Discogs Request Token Failed: ${response.status} ${text}`);
    }

    const text = await response.text();
    const params = new URLSearchParams(text);
    const token = params.get('oauth_token');
    const tokenSecret = params.get('oauth_token_secret');

    if (!token || !tokenSecret) {
      throw new Error('Missing token or secret in Discogs response');
    }

    const cookieStore = await cookies();
    cookieStore.set('discogs_request_secret', tokenSecret, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
      path: '/',
      maxAge: 60 * 10 // 10 minutes
    });

    return NextResponse.redirect(`https://discogs.com/oauth/authorize?oauth_token=${token}`);
  } catch (error) {
    console.error('Discogs Auth Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
// AUDIT: inspected, no changes.
