import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Client } from 'disconnect';

export async function GET() {
  const dis = new Client();
  const oAuth = dis.oauth();

  // Use production URL based on where the app is running
  const callbackUrl = process.env.NODE_ENV === 'production'
    ? 'https://deadwaxdialogues.com/api/auth/callback/discogs'
    : 'http://localhost:3000/api/auth/callback/discogs';

  try {
    const requestData = await oAuth.getRequestToken(
      process.env.DISCOGS_CONSUMER_KEY!,
      process.env.DISCOGS_CONSUMER_SECRET!,
      callbackUrl
    );

    const { token, tokenSecret, authorizeUrl } = requestData;

    // Store secret in cookie to verify callback later
    const cookieStore = await cookies();
    cookieStore.set('discogs_request_secret', tokenSecret, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 10 // 10 minutes
    });

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    console.error('Discogs Auth Error:', error);
    return NextResponse.json({ error: 'Failed to initiate Discogs auth' }, { status: 500 });
  }
}