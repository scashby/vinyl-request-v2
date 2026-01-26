// src/app/api/pricing/discogs-prices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { enrichDiscogsPricing } from '../../../../lib/enrichment-service';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { releaseId, albumId } = await request.json();

    if (!releaseId) {
      return NextResponse.json(
        { success: false, error: 'Release ID required' },
        { status: 400 }
      );
    }

    // 1. Get User Cookies for Rate Limit Safety
    const cookieStore = await cookies();
    const token = cookieStore.get('discogs_access_token')?.value;
    const secret = cookieStore.get('discogs_access_secret')?.value;

    let authHeader: string | undefined = undefined;

    if (token && secret) {
        const nonce = Math.floor(Math.random() * 1000000000).toString();
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = `${process.env.DISCOGS_CONSUMER_SECRET}&${secret}`;

        authHeader = `OAuth oauth_consumer_key="${process.env.DISCOGS_CONSUMER_KEY}", ` +
            `oauth_nonce="${nonce}", ` +
            `oauth_signature="${signature}", ` +
            `oauth_signature_method="PLAINTEXT", ` +
            `oauth_timestamp="${timestamp}", ` +
            `oauth_token="${token}"`;
    }

    // 2. Call Service with User Auth
    const result = await enrichDiscogsPricing(albumId || null, releaseId, authHeader);

    if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Error fetching Discogs prices:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch pricing data' 
      },
      { status: 500 }
    );
  }
}