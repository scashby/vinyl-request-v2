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

    // DEBUG: Ensure Env Vars are present (This logs to your server console, not browser)
    if (!process.env.DISCOGS_CONSUMER_KEY || !process.env.DISCOGS_CONSUMER_SECRET) {
        console.error('MISSING DISCOGS KEYS in Environment');
        return NextResponse.json(
            { success: false, error: 'Server Config Error: Missing Discogs Keys' },
            { status: 500 }
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
        // Fix: Return exact error status if possible, otherwise 500
        // This allows the frontend to handle 429 Rate Limits properly
        let status = 500;
        if (result.error) {
            if (result.error.includes('429')) status = 429;
            else if (result.error.includes('403')) status = 403;
            else if (result.error.includes('404')) status = 404;
            else if (result.error.includes('401')) status = 401;
        }
        
        return NextResponse.json({ success: false, error: result.error }, { status });
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