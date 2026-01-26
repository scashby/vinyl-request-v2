import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('discogs_access_token')?.value;
  const secret = cookieStore.get('discogs_access_secret')?.value;
  const username = cookieStore.get('discogs_username')?.value;

  if (!token || !secret || !username) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = searchParams.get('page') || '1';
  
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
    // 0 is the default "All" folder
    const response = await fetch(`https://api.discogs.com/users/${username}/collection/folders/0/releases?page=${page}&per_page=50&sort=added&sort_order=desc`, {
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'DeadwaxDialogues/1.0'
      }
    });

    if (!response.ok) {
        // Return the actual error from Discogs (e.g. 429 Rate Limit) instead of crashing with 500
        return NextResponse.json({ error: response.statusText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}