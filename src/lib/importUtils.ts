// src/lib/importUtils.ts
// Shared utilities for import system - normalization, sync logic, etc.

export type SyncMode = 'full_replacement' | 'full_sync' | 'partial_sync' | 'new_only';

/**
 * Normalize text for matching - removes special chars, case, etc.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .replace(/\(\d+\)/g, '')        // Remove "(2)", "(3)" etc (Discogs disambiguation)
    .replace(/^the\s+/i, '')        // Remove leading "The"
    .replace(/^a\s+/i, '')          // Remove leading "A"
    .replace(/[^\w\s]/g, '')        // Remove special chars
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .trim();
}

/**
 * Normalize artist name specifically
 */
export function normalizeArtist(artist: string): string {
  return normalizeText(artist);
}

/**
 * Normalize title/album name
 */
export function normalizeTitle(title: string): string {
  return normalizeText(title);
}

/**
 * Generate combined artist+album normalized field for fast duplicate detection
 */
export function normalizeArtistAlbum(artist: string, album: string): string {
  return `${normalizeArtist(artist)} ${normalizeTitle(album)}`;
}

/**
 * Generate sort name - moves articles to end
 * "The Beatles" → "Beatles, The"
 * "A Tribe Called Quest" → "Tribe Called Quest, A"
 */
export function generateSortName(name: string): string {
  if (!name) return '';
  
  if (name.startsWith('The ')) {
    return name.substring(4) + ', The';
  }
  if (name.startsWith('A ')) {
    return name.substring(2) + ', A';
  }
  return name;
}

/**
 * Compare two albums to detect if they're the same
 * Returns true if normalized artist+title match
 */
export function isSameAlbum(
  album1: { artist: string; title: string },
  album2: { artist: string; title: string }
): boolean {
  const norm1 = normalizeArtistAlbum(album1.artist, album1.title);
  const norm2 = normalizeArtistAlbum(album2.artist, album2.title);
  return norm1 === norm2;
}

/**
 * Detect if an album has changed (for partial sync)
 * Compares key fields to determine if re-scraping is needed
 */
export function hasAlbumChanged(
  imported: Record<string, unknown>,
  existing: Record<string, unknown>
): boolean {
  // Fields to compare for change detection
  const compareFields = [
    'year',
    'format',
    'label',
    'cat_no',
    'barcode',
    'discogs_release_id',
  ];
  
  for (const field of compareFields) {
    if (imported[field] !== existing[field]) {
      return true;
    }
  }
  
  return false;
}

/**
 * Sync mode descriptions for UI
 */
export const SYNC_MODE_INFO: Record<SyncMode, {
  title: string;
  description: string;
  warning?: string;
  scrapesBehavior: string;
  apiImpact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}> = {
  full_replacement: {
    title: 'Full Replacement',
    description: 'Delete entire collection and replace with import file',
    warning: '⚠️ This will DELETE your entire collection',
    scrapesBehavior: 'Scrapes ALL albums in import file for missing data',
    apiImpact: 'CRITICAL',
  },
  full_sync: {
    title: 'Full Sync',
    description: 'Add new, update changed, remove missing albums. Scrape everything.',
    scrapesBehavior: 'Scrapes ALL albums (even unchanged) for missing data',
    apiImpact: 'HIGH',
  },
  partial_sync: {
    title: 'Partial Sync (Recommended)',
    description: 'Add new, update changed, remove missing. Only scrape new/changed.',
    scrapesBehavior: 'Only scrapes NEW or CHANGED albums for missing data',
    apiImpact: 'MEDIUM',
  },
  new_only: {
    title: 'New/Additions Only',
    description: 'Only add new albums. Ignore all existing albums.',
    scrapesBehavior: 'Only scrapes the new albums',
    apiImpact: 'LOW',
  },
};

/**
 * Status types for import comparison
 */
export type AlbumStatus = 'NEW' | 'CHANGED' | 'UNCHANGED' | 'REMOVED';

export interface AlbumComparison {
  status: AlbumStatus;
  imported: Record<string, unknown>;
  existing?: Record<string, unknown>;
  shouldScrape: boolean;
}

/**
 * Compare imported albums with existing collection
 * Returns comparison results with status for each album
 */
export function compareImportWithCollection(
  importedAlbums: Array<Record<string, unknown>>,
  existingAlbums: Array<Record<string, unknown>>,
  syncMode: SyncMode
): AlbumComparison[] {
  const comparisons: AlbumComparison[] = [];
  
  // Process each imported album
  for (const imported of importedAlbums) {
    const existing = existingAlbums.find(e => 
      isSameAlbum(
        { artist: imported.artist as string, title: imported.title as string },
        { artist: e.artist as string, title: e.title as string }
      )
    );
    
    if (!existing) {
      // New album
      comparisons.push({
        status: 'NEW',
        imported,
        shouldScrape: true, // Always scrape new albums
      });
    } else {
      // Existing album - check if changed
      const changed = hasAlbumChanged(imported, existing);
      
      comparisons.push({
        status: changed ? 'CHANGED' : 'UNCHANGED',
        imported,
        existing,
        shouldScrape: syncMode === 'full_sync' ? true : changed,
      });
    }
  }
  
  // For sync modes that remove albums, identify removed albums
  if (syncMode === 'full_sync' || syncMode === 'partial_sync') {
    for (const existing of existingAlbums) {
      const inImport = importedAlbums.find(i =>
        isSameAlbum(
          { artist: i.artist as string, title: i.title as string },
          { artist: existing.artist as string, title: existing.title as string }
        )
      );
      
      if (!inImport) {
        comparisons.push({
          status: 'REMOVED',
          imported: existing,
          existing,
          shouldScrape: false,
        });
      }
    }
  }
  
  return comparisons;
}

/**
 * Get summary statistics from comparison
 */
export function getComparisonStats(comparisons: AlbumComparison[]) {
  return {
    total: comparisons.length,
    new: comparisons.filter(c => c.status === 'NEW').length,
    changed: comparisons.filter(c => c.status === 'CHANGED').length,
    unchanged: comparisons.filter(c => c.status === 'UNCHANGED').length,
    removed: comparisons.filter(c => c.status === 'REMOVED').length,
    toScrape: comparisons.filter(c => c.shouldScrape).length,
  };
}

/**
 * Format duration from seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse duration string (MM:SS or HH:MM:SS) to seconds
 */
export function parseDuration(duration: string | null): number | null {
  if (!duration) return null;
  
  const parts = duration.split(':').map(Number);
  
  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  }
  
  return null;
}

/**
 * Validate required fields for an album
 */
export function validateAlbum(album: Record<string, unknown>): string[] {
  const errors: string[] = [];
  
  if (!album.artist) {
    errors.push('Artist is required');
  }
  if (!album.title) {
    errors.push('Title is required');
  }
  if (!album.format) {
    errors.push('Format is required');
  }
  
  return errors;
}

/**
 * Extract Discogs release ID from URL or ID string
 */
export function extractDiscogsId(input: string): string | null {
  if (!input) return null;
  
  // If it's just a number, return it
  if (/^\d+$/.test(input)) {
    return input;
  }
  
  // Try to extract from URL: https://www.discogs.com/release/123456-...
  const match = input.match(/\/release\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private queue: Array<() => Promise<unknown>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private requestCount = 0;
  private resetTime = Date.now();
  
  constructor(
    private requestsPerMinute: number = 60,
    private minDelayMs: number = 1000
  ) {}
  
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result as T);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.process();
      }
    });
  }
  
  private async process() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      // Reset counter every minute
      if (Date.now() - this.resetTime >= 60000) {
        this.requestCount = 0;
        this.resetTime = Date.now();
      }
      
      // Check rate limit
      if (this.requestCount >= this.requestsPerMinute) {
        const waitTime = 60000 - (Date.now() - this.resetTime);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.resetTime = Date.now();
      }
      
      // Ensure minimum delay between requests
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.minDelayMs) {
        await new Promise(resolve => 
          setTimeout(resolve, this.minDelayMs - timeSinceLastRequest)
        );
      }
      
      const fn = this.queue.shift();
      if (fn) {
        this.lastRequestTime = Date.now();
        this.requestCount++;
        await fn();
      }
    }
    
    this.processing = false;
  }
}