// src/app/api/spotify-token/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Spotify credentials not configured in environment variables' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Spotify auth failed:', errorData);
      return NextResponse.json(
        { error: `Spotify authentication failed: ${errorData.error_description || errorData.error || 'Unknown error'}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ access_token: data.access_token });
  } catch (error) {
    console.error('Spotify token error:', error);
    return NextResponse.json(
      { error: 'Failed to get Spotify access token' },
      { status: 500 }
    );
  }
}