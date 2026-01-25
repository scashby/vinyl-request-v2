import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Client } from 'disconnect';

export async function GET() {
  const dis = new Client({ userAgent: 'DeadwaxDialogues/1.0' });
  const oAuth = dis.oauth();

  const callbackUrl = process.env.NODE_ENV === 'production'
    ? 'https://deadwaxdialogues.com/api/auth/callback/discogs'
    : 'http://localhost:3000/api/auth/callback/discogs';

  try {
    const requestData = await new Promise<{ tokenSecret: string; authorizeUrl: string }>((resolve, reject) => {
      oAuth.getRequestToken(
        process.env.DISCOGS_CONSUMER_KEY!,
        process.env.DISCOGS_CONSUMER_SECRET!,
        callbackUrl,
        (err: unknown, data: unknown) => { // Changed 'any' to 'unknown'
          if (err) return reject(err);
          resolve(data as { tokenSecret: string; authorizeUrl: string });
        }
      );
    });

    const { tokenSecret, authorizeUrl } = requestData;

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