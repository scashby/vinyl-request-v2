import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Removed unused 'req' parameter
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('discogs_access_token')?.value;
  const secret = cookieStore.get('discogs_access_secret')?.value;
  const username = cookieStore.get('discogs_username')?.value;

  if (!token || !secret || !username) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const signature = `${process.env.DISCOGS_CONSUMER_SECRET}&${secret}`;
  const nonce = Math.floor(Math.random() * 1000000000).toString();
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const authHeader = `OAuth oauth_consumer_key="${process.env.DISCOGS_CONSUMER_KEY}", ` +
    `oauth_nonce="${nonce}", ` +
    `oauth_signature="${signature}", ` +
    `oauth_signature_method="PLAINTEXT", ` +
    `oauth_timestamp="${timestamp}", ` +
    `oauth_token="${token}"`;

  try {
    const response = await fetch(`https://api.discogs.com/users/${username}/collection/fields`, {
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'DeadwaxDialogues/1.0'
      }
    });

    if (!response.ok) throw new Error(`Discogs API Error: ${response.status}`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
// AUDIT: inspected, no changes.
