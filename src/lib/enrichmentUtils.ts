// src/lib/enrichmentUtils.ts
// Utilities for enriching album data from Discogs API

import { RateLimiter } from './importUtils';

// Rate limiter for Discogs API (60 requests/minute)
const discogsRateLimiter = new RateLimiter(60, 1000);

export interface DiscogsEnrichmentData {
  images?: {
    front?: string;
    back?: string;
  };
  tracks?: Array<{
    position: string;
    title: string;
    duration?: string;
    artists?: string[];
    type?: string;
  }>;
  genres?: string[];
  styles?: string[];
  releaseDate?: string;
  label?: string;
  catNo?: string;
  country?: string;
  notes?: string;
  credits?: Array<{
    name: string;
    role: string;
  }>;
}

/**
 * Fetch album data from Discogs API
 */
async function fetchFromDiscogs(releaseId: string): Promise<unknown> {
  const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
    headers: {
      'User-Agent': 'DeadWaxDialogues/1.0',
      'Authorization': `Discogs token=${process.env.NEXT_PUBLIC_DISCOGS_TOKEN || ''}`,
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limit exceeded - please wait');
    }
    throw new Error(`Discogs API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Enrich album from Discogs release ID
 * Returns only the fields that are missing in the album
 */
export async function enrichFromDiscogs(
  album: Record<string, unknown>,
  fields?: string[]
): Promise<Partial<DiscogsEnrichmentData>> {
  const releaseId = album.discogs_release_id as string | undefined;
  if (!releaseId) {
    throw new Error('No Discogs release ID');
  }

  // Use rate limiter
  const data = await discogsRateLimiter.add(() => fetchFromDiscogs(releaseId));
  const release = data as Record<string, unknown>;

  const enrichment: Partial<DiscogsEnrichmentData> = {};

  // Only add fields that are requested and missing
  const needsField = (field: string) => {
    if (fields && !fields.includes(field)) return false;
    return !album[field] || (Array.isArray(album[field]) && album[field].length === 0);
  };

  // Images
  if (needsField('image_url') || needsField('back_image_url')) {
    const images = release.images as Array<{ type: string; uri: string }> | undefined;
    if (images && images.length > 0) {
      enrichment.images = {};
      
      // Find primary/front image
      const primary = images.find(img => img.type === 'primary') || images[0];
      if (primary && needsField('image_url')) {
        enrichment.images.front = primary.uri;
      }
      
      // Find secondary/back image
      const secondary = images.find(img => img.type === 'secondary') || images[1];
      if (secondary && needsField('back_image_url')) {
        enrichment.images.back = secondary.uri;
      }
    }
  }

  // Tracklist
  if (needsField('tracks')) {
    const tracklist = release.tracklist as Array<Record<string, unknown>> | undefined;
    if (tracklist && tracklist.length > 0) {
      enrichment.tracks = tracklist.map(track => ({
        position: track.position as string || '',
        title: track.title as string || '',
        duration: track.duration as string || undefined,
        artists: (track.artists as Array<{ name: string }> | undefined)?.map(a => a.name),
        type: track.type_ as string || undefined,
      }));
    }
  }

  // Genres
  if (needsField('discogs_genres')) {
    const genres = release.genres as string[] | undefined;
    if (genres && genres.length > 0) {
      enrichment.genres = genres;
    }
  }

  // Styles
  if (needsField('discogs_styles')) {
    const styles = release.styles as string[] | undefined;
    if (styles && styles.length > 0) {
      enrichment.styles = styles;
    }
  }

  // Release date
  if (needsField('year')) {
    const releaseDate = release.released as string | undefined;
    if (releaseDate) {
      enrichment.releaseDate = releaseDate;
    }
  }

  // Label
  if (needsField('spotify_label')) {
    const labels = release.labels as Array<{ name: string }> | undefined;
    if (labels && labels.length > 0) {
      enrichment.label = labels[0].name;
    }
  }

  // Catalog number
  if (needsField('cat_no')) {
    const labels = release.labels as Array<{ catno: string }> | undefined;
    if (labels && labels.length > 0 && labels[0].catno) {
      enrichment.catNo = labels[0].catno;
    }
  }

  // Country
  if (needsField('country')) {
    const country = release.country as string | undefined;
    if (country) {
      enrichment.country = country;
    }
  }

  // Notes
  if (needsField('notes')) {
    const notes = release.notes as string | undefined;
    if (notes) {
      enrichment.notes = notes;
    }
  }

  // Credits (musicians, producers, etc.)
  if (needsField('musicians') || needsField('producers') || needsField('engineers')) {
    const extraartists = release.extraartists as Array<{ name: string; role: string }> | undefined;
    if (extraartists && extraartists.length > 0) {
      enrichment.credits = extraartists.map(artist => ({
        name: artist.name,
        role: artist.role,
      }));
    }
  }

  return enrichment;
}

/**
 * Batch enrich multiple albums with rate limiting
 */
export async function batchEnrichFromDiscogs(
  albums: Array<Record<string, unknown>>,
  fields?: string[],
  onProgress?: (current: number, total: number) => void
): Promise<Array<{ album: Record<string, unknown>; enrichment: Partial<DiscogsEnrichmentData> | null; error?: string }>> {
  const results: Array<{ album: Record<string, unknown>; enrichment: Partial<DiscogsEnrichmentData> | null; error?: string }> = [];

  for (let i = 0; i < albums.length; i++) {
    const album = albums[i];
    
    try {
      const enrichment = await enrichFromDiscogs(album, fields);
      results.push({ album, enrichment });
    } catch (error) {
      console.error(`Error enriching album ${album.artist} - ${album.title}:`, error);
      results.push({
        album,
        enrichment: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    if (onProgress) {
      onProgress(i + 1, albums.length);
    }
  }

  return results;
}

/**
 * Extract credits by role from enrichment data
 */
export function extractCreditsByRole(
  credits: Array<{ name: string; role: string }> | undefined,
  role: string
): string[] {
  if (!credits) return [];
  
  return credits
    .filter(credit => credit.role.toLowerCase().includes(role.toLowerCase()))
    .map(credit => credit.name);
}

/**
 * Categorize credits into musicians, producers, engineers, etc.
 */
export interface CategorizedCredits {
  musicians: string[];
  producers: string[];
  engineers: string[];
  songwriters: string[];
  other: Array<{ name: string; role: string }>;
}

export function categorizeCredits(
  credits: Array<{ name: string; role: string }> | undefined
): CategorizedCredits {
  const categorized: CategorizedCredits = {
    musicians: [],
    producers: [],
    engineers: [],
    songwriters: [],
    other: [],
  };

  if (!credits) return categorized;

  for (const credit of credits) {
    const role = credit.role.toLowerCase();
    
    if (role.includes('produce')) {
      categorized.producers.push(credit.name);
    } else if (role.includes('engineer') || role.includes('recording') || role.includes('mix')) {
      categorized.engineers.push(credit.name);
    } else if (role.includes('write') || role.includes('composer') || role.includes('lyrics')) {
      categorized.songwriters.push(credit.name);
    } else if (
      role.includes('guitar') ||
      role.includes('bass') ||
      role.includes('drums') ||
      role.includes('piano') ||
      role.includes('keyboards') ||
      role.includes('vocals') ||
      role.includes('saxophone') ||
      role.includes('trumpet') ||
      role.includes('violin')
    ) {
      categorized.musicians.push(credit.name);
    } else {
      categorized.other.push(credit);
    }
  }

  return categorized;
}

/**
 * Search Discogs for an album by artist and title
 * Returns release ID if found
 */
export async function searchDiscogs(
  artist: string,
  title: string,
  format?: string
): Promise<string | null> {
  const query = `${artist} ${title}${format ? ` ${format}` : ''}`;
  
  const response = await discogsRateLimiter.add(() =>
    fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release`, {
      headers: {
        'User-Agent': 'DeadWaxDialogues/1.0',
        'Authorization': `Discogs token=${process.env.NEXT_PUBLIC_DISCOGS_TOKEN || ''}`,
      },
    })
  );

  if (!response.ok) {
    throw new Error(`Discogs search error: ${response.status}`);
  }

  const data = await response.json() as { results?: Array<{ id: number }> };
  
  if (data.results && data.results.length > 0) {
    return data.results[0].id.toString();
  }

  return null;
}

/**
 * Check if we should scrape an album based on sync mode
 */
export function shouldScrapeAlbum(
  status: 'NEW' | 'CHANGED' | 'UNCHANGED',
  syncMode: 'full_replacement' | 'full_sync' | 'partial_sync' | 'new_only'
): boolean {
  switch (syncMode) {
    case 'full_replacement':
    case 'full_sync':
      return true; // Always scrape
    case 'partial_sync':
      return status === 'NEW' || status === 'CHANGED'; // Only new or changed
    case 'new_only':
      return status === 'NEW'; // Only new
    default:
      return false;
  }
}