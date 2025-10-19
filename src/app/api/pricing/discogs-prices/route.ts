// src/app/api/pricing/discogs-prices/route.ts
import { NextRequest, NextResponse } from 'next/server';

const DISCOGS_TOKEN = process.env.NEXT_PUBLIC_DISCOGS_TOKEN;

type DiscogsListing = {
  price: { value: string };
  condition: string;
  sleeve_condition: string;
  seller: { username: string };
};

type DiscogsListingsResponse = {
  listings: DiscogsListing[];
};

export async function POST(request: NextRequest) {
  try {
    const { releaseId } = await request.json();

    if (!releaseId) {
      return NextResponse.json(
        { success: false, error: 'Release ID required' },
        { status: 400 }
      );
    }

    if (!DISCOGS_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Discogs token not configured' },
        { status: 500 }
      );
    }

    // Fetch marketplace statistics from Discogs
    const statsUrl = `https://api.discogs.com/marketplace/stats/${releaseId}?curr=USD`;
    const statsResponse = await fetch(statsUrl, {
      headers: {
        'User-Agent': 'DeadwaxDialogues/1.0',
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`
      }
    });

    if (!statsResponse.ok) {
      if (statsResponse.status === 404) {
        return NextResponse.json({
          success: false,
          error: 'No marketplace data available for this release'
        });
      }
      throw new Error(`Discogs API error: ${statsResponse.status}`);
    }

    const stats = await statsResponse.json();

    // Also fetch current marketplace listings for more accurate pricing
    const listingsUrl = `https://api.discogs.com/marketplace/search?release_id=${releaseId}&per_page=100&sort=price&sort_order=asc&currency=USD`;
    const listingsResponse = await fetch(listingsUrl, {
      headers: {
        'User-Agent': 'DeadwaxDialogues/1.0',
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`
      }
    });

    let currentListings: DiscogsListing[] = [];
    const priceData = {
      min: null as number | null,
      median: null as number | null,
      max: null as number | null,
      count: 0,
      suggested: null as number | null
    };

    if (listingsResponse.ok) {
      const listingsData = await listingsResponse.json() as DiscogsListingsResponse;
      currentListings = listingsData.listings || [];

      // Extract prices from listings
      const prices = currentListings
        .map((listing: DiscogsListing) => parseFloat(listing.price?.value || '0'))
        .filter((price: number) => price > 0)
        .sort((a: number, b: number) => a - b);

      if (prices.length > 0) {
        priceData.count = prices.length;
        priceData.min = prices[0];
        priceData.max = prices[prices.length - 1];
        
        // Calculate median
        const mid = Math.floor(prices.length / 2);
        priceData.median = prices.length % 2 === 0
          ? (prices[mid - 1] + prices[mid]) / 2
          : prices[mid];

        // Suggested price: slightly below median for competitive pricing
        // Or use the 40th percentile for aggressive pricing
        const suggestedIndex = Math.floor(prices.length * 0.4);
        priceData.suggested = prices[suggestedIndex];
      }
    }

    // If we didn't get listing data, fall back to stats API
    if (!priceData.median && stats.lowest_price) {
      priceData.min = parseFloat(stats.lowest_price.value);
      priceData.median = parseFloat(stats.median?.value || stats.lowest_price.value);
      priceData.max = parseFloat(stats.highest_price?.value || stats.lowest_price.value);
      priceData.count = stats.num_for_sale || 0;
      
      // Suggested: median or slightly below
      priceData.suggested = priceData.median ? priceData.median * 0.95 : priceData.min;
    }

    return NextResponse.json({
      success: true,
      data: {
        releaseId,
        prices: priceData,
        currency: 'USD',
        updatedAt: new Date().toISOString(),
        // Include sample listings for reference
        sampleListings: currentListings.slice(0, 10).map((listing: DiscogsListing) => ({
          condition: listing.condition,
          price: listing.price?.value,
          seller: listing.seller?.username,
          sleeveCondition: listing.sleeve_condition
        }))
      }
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