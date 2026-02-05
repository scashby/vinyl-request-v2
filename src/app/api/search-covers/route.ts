// src/app/api/search-covers/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface ImageResult {
  url: string;
  width: number;
  height: number;
  source: 'discogs' | 'google' | 'lastfm';
  type?: 'front' | 'back';
}

interface DiscogsImage {
  type: string;
  uri: string;
  uri150: string;
  uri500?: string;
  width: number;
  height: number;
}

interface DiscogsRelease {
  id: number;
  images?: DiscogsImage[];
  barcode?: string[];
  title: string;
}

interface DiscogsSearchResponse {
  results: DiscogsRelease[];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const barcode = searchParams.get('barcode');
  const artist = searchParams.get('artist');
  const title = searchParams.get('title');
  const coverType = searchParams.get('type') || 'front';
  const source = searchParams.get('source') || 'both'; // 'both', 'discogs', or 'google'
  
  if (!query && !barcode) {
    return NextResponse.json({ error: 'Query or barcode required' }, { status: 400 });
  }

  const results: ImageResult[] = [];

  try {
    // Search Discogs if source is 'both' or 'discogs'
    if (source === 'both' || source === 'discogs') {
      const discogsResults = await searchDiscogs(barcode || '', artist || '', title || '', coverType as 'front' | 'back');
      results.push(...discogsResults);
    }

    // Search Google if source is 'both' or 'google'
    if (source === 'both' || source === 'google') {
      const googleResults = await searchGoogleImages(artist || '', title || '', barcode || '', coverType as 'front' | 'back');
      results.push(...googleResults);
    }

    // Search Last.fm only if source is 'both' or 'discogs' (it's a fallback for Discogs)
    if ((source === 'both' || source === 'discogs') && results.length < 5) {
      const lastfmResults = await searchLastFm(artist || '', title || '');
      results.push(...lastfmResults);
    }

    const uniqueResults = Array.from(
      new Map(results.map(item => [item.url, item])).values()
    );

    return NextResponse.json({ results: uniqueResults });
  } catch (error) {
    console.error('Cover search error:', error);
    return NextResponse.json({ error: 'Search failed', results: [] }, { status: 500 });
  }
}

async function searchDiscogs(barcode: string, artist: string, title: string, coverType: 'front' | 'back'): Promise<ImageResult[]> {
  const token = process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
  
  if (!token) {
    console.warn('NEXT_PUBLIC_DISCOGS_TOKEN not configured');
    return [];
  }

  try {
    let searchUrl = '';
    
    if (barcode) {
      searchUrl = `https://api.discogs.com/database/search?barcode=${encodeURIComponent(barcode)}&token=${token}`;
    } else if (artist && title) {
      searchUrl = `https://api.discogs.com/database/search?artist=${encodeURIComponent(artist)}&release_title=${encodeURIComponent(title)}&type=release&token=${token}`;
    } else {
      return [];
    }

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'DWDCollectionManager/1.0'
      }
    });

    if (!response.ok) return [];

    const data = await response.json() as DiscogsSearchResponse;
    
    if (!data.results || data.results.length === 0) return [];

    const results: ImageResult[] = [];

    for (const release of data.results.slice(0, 3)) {
      try {
        const detailResponse = await fetch(
          `https://api.discogs.com/releases/${release.id}?token=${token}`,
          {
            headers: {
              'User-Agent': 'DWDCollectionManager/1.0'
            }
          }
        );

        if (detailResponse.ok) {
          const detailData = await detailResponse.json() as DiscogsRelease;
          
          if (detailData.images) {
            const filteredImages = detailData.images.filter(img => {
              if (coverType === 'front') {
                return img.type === 'primary' || img.type === 'front';
              } else if (coverType === 'back') {
                return img.type === 'back' || img.type === 'secondary';
              }
              return true;
            });

            results.push(...filteredImages.map(img => ({
              url: img.uri500 || img.uri,
              width: img.width,
              height: img.height,
              source: 'discogs' as const,
              type: img.type === 'back' || img.type === 'secondary' ? 'back' as const : 'front' as const
            })));
          }
        }
      } catch {
        continue;
      }
    }

    return results;
  } catch (error) {
    console.error('Discogs search error:', error);
    return [];
  }
}

async function searchGoogleImages(artist: string, title: string, barcode: string, coverType: 'front' | 'back'): Promise<ImageResult[]> {
  const apiKey = process.env.GOOGLE_CLIENT_ID;
  const cx = process.env.GOOGLE_CX;
  
  if (!apiKey || !cx) {
    console.warn('Google Custom Search not configured - requires GOOGLE_CX environment variable');
    return [];
  }

  try {
    let searchQuery = '';
    if (artist && title) {
      searchQuery = `${artist} ${title} vinyl ${coverType} cover`;
      if (barcode) {
        searchQuery += ` ${barcode}`;
      }
    } else {
      return [];
    }

    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=10&imgSize=large`
    );

    if (!response.ok) return [];

    const data = await response.json() as { items?: Array<{ link: string; image: { width: number; height: number } }> };
    
    if (!data.items) return [];

    return data.items.map(item => ({
      url: item.link,
      width: item.image?.width || 500,
      height: item.image?.height || 500,
      source: 'google' as const,
      type: coverType
    }));
  } catch (error) {
    console.error('Google search error:', error);
    return [];
  }
}

interface LastFmImage {
  '#text': string;
  size: string;
}

interface LastFmSearchResponse {
  album?: {
    image: LastFmImage[];
  };
}

async function searchLastFm(artist: string, title: string): Promise<ImageResult[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  
  if (!apiKey || !artist || !title) {
    return [];
  }

  try {
    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(title)}&api_key=${apiKey}&format=json`
    );
    
    const data = await response.json() as LastFmSearchResponse;
    
    if (!data.album?.image) return [];

    return data.album.image
      .filter((img: LastFmImage) => img['#text'] && img.size !== 'small')
      .map((img: LastFmImage) => ({
        url: img['#text'],
        width: img.size === 'extralarge' ? 300 : img.size === 'large' ? 174 : 64,
        height: img.size === 'extralarge' ? 300 : img.size === 'large' ? 174 : 64,
        source: 'lastfm' as const
      }));
  } catch (error) {
    console.error('Last.fm search error:', error);
    return [];
  }
}
// AUDIT: inspected, no changes.
