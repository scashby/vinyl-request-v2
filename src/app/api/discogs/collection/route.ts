import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Client } from 'disconnect';

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
  
  const dis = new Client({
    userAgent: 'DeadwaxDialogues/1.0',
    consumerKey: process.env.DISCOGS_CONSUMER_KEY,
    consumerSecret: process.env.DISCOGS_CONSUMER_SECRET,
    userToken: token,
    userTokenSecret: secret
  });

  const user = dis.user();
  
  try {
    const data = await new Promise((resolve, reject) => {
      user.collection().getReleases(username, 0, { 
        page: parseInt(page), 
        per_page: 50,
        sort: 'added',
        sort_order: 'desc'
      }, (err: unknown, data: unknown) => {
        if (err) return reject(err);
        resolve(data);
      });
    });
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}