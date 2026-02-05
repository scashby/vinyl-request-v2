import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('discogs_access_token')?.value;
  const secret = cookieStore.get('discogs_access_secret')?.value;

  if (!token || !secret) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const releaseId = searchParams.get('releaseId');

  if (!releaseId) {
      return NextResponse.json({ error: 'Release ID missing' }, { status: 400 });
  }

  const nonce = Math.floor(Math.random() * 1000000000).toString();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = `${process.env.DISCOGS_CONSUMER_SECRET}&${secret}`;

  const authHeader = `OAuth oauth_consumer_key="${process.env.DISCOGS_CONSUMER_KEY}", ` +
    `oauth_nonce="${nonce}", ` +
    `oauth_signature="${signature}", ` +
    `oauth_signature_method="PLAINTEXT", ` +
    `oauth_timestamp="${timestamp}", ` +
    `oauth_token="${token}"`;

  try {
    const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'DeadwaxDialogues/1.0'
      }
    });

    if (!response.ok) {
        return NextResponse.json({ error: response.statusText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
// AUDIT: inspected, no changes.
