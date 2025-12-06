// src/types/album.ts
// Complete Album type with full CLZ Music Web compatibility

export type Album = {
  // ============================================================================
  // CORE IDENTIFICATION
  // ============================================================================
  id: number;
  artist: string;
  title: string;
  sort_title: string | null;
  subtitle: string | null;
  year: string | null;
  year_int: number | null;
  
  // ============================================================================
  // PHYSICAL MEDIA DETAILS
  // ============================================================================
  format: string;
  folder: string;
  discs: number | null;                    // Number of physical discs (NEW)
  sides: number | { count: number } | string[] | null;  // Sides per disc
  barcode: string | null;                  // UPC/EAN barcode (NEW)
  cat_no: string | null;                   // Catalog number (NEW)
  
  // ============================================================================
  // VISUAL & AUDIO
  // ============================================================================
  image_url: string | null;
  length_seconds: number | null;           // Total length in seconds (NEW)
  tracklists: string | null;               // JSON string of track data
  
  // ============================================================================
  // CONDITION & GRADING
  // ============================================================================
  media_condition: string;
  package_sleeve_condition: string | null; // Sleeve/packaging condition (NEW)
  
  // ============================================================================
  // VINYL-SPECIFIC FIELDS
  // ============================================================================
  vinyl_color: string | null;              // Color of vinyl (NEW)
  vinyl_weight: string | null;             // Weight (e.g., "180g") (NEW)
  rpm: string | null;                      // Speed (33⅓, 45, 78) (NEW)
  
  // ============================================================================
  // TECHNICAL SPECIFICATIONS
  // ============================================================================
  sound: string | null;                    // Mono/Stereo/Quadrophonic (NEW)
  spars_code: string | null;               // Digital/Analog indicator (NEW)
  packaging: string | null;                // Gatefold, jewel case, etc. (NEW)
  
  // ============================================================================
  // RELEASE INFORMATION
  // ============================================================================
  original_release_date: string | null;   // Original first release (NEW)
  original_release_year: number | null;   // Original year (NEW)
  recording_date: string | null;          // When recorded (NEW)
  recording_year: number | null;          // Recording year (NEW)
  master_release_date: string | null;
  country: string | null;                  // Country of pressing (NEW)
  studio: string | null;                   // Recording studio (NEW)
  
  // ============================================================================
  // COLLECTION MANAGEMENT
  // ============================================================================
  collection_status: 'in_collection' | 'for_sale' | 'wish_list' | 'on_order' | 'sold' | 'not_in_collection' | null; // (NEW)
  for_sale: boolean;
  is_box_set: boolean;
  is_live: boolean | null;                 // Live album flag (NEW)
  parent_id: string | null;
  child_album_ids: number[] | null;
  
  // ============================================================================
  // SPECIAL FLAGS (DWD CUSTOM)
  // ============================================================================
  is_1001: boolean;
  steves_top_200: boolean;
  this_weeks_top_10: boolean;
  inner_circle_preferred: boolean;
  blocked: boolean;
  blocked_sides: string[] | null;
  blocked_tracks: Record<string, string[]> | null;  // Map of side -> track numbers
  
  // ============================================================================
  // SALES & PRICING
  // ============================================================================
  sale_price: number | null;
  sale_platform: string | null;
  sale_quantity: number | null;
  sale_notes: string | null;
  sell_price: string | null;
  wholesale_cost: number | null;
  
  // Discogs pricing intelligence
  discogs_price_min: number | null;
  discogs_price_median: number | null;
  discogs_price_max: number | null;
  discogs_price_updated_at: string | null;
  pricing_notes: string | null;
  
  // ============================================================================
  // PURCHASE & VALUE
  // ============================================================================
  purchase_date: string | null;
  purchase_store: string | null;
  purchase_price: number | null;
  current_value: number | null;
  
  // ============================================================================
  // PERSONAL TRACKING
  // ============================================================================
  owner: string | null;
  my_rating: number | null;                // 1-5 star rating (NEW)
  play_count: number | null;
  last_played_date: string | null;         // Last played date (NEW)
  last_cleaned_date: string | null;
  signed_by: string[] | null;
  location: string | null;                 // Physical storage location (NEW)
  storage_device_slot: string | null;      // Specific slot/position (NEW)
  index_number: number | null;             // CLZ index for ordering (NEW)
  
  // ============================================================================
  // DATES & METADATA
  // ============================================================================
  date_added: string | null;
  modified_date: string | null;            // Auto-updated on changes (NEW)
  decade: number | null;
  
  // ============================================================================
  // GENRES & STYLES
  // ============================================================================
  discogs_genres: string[] | null;
  discogs_styles: string[] | null;
  spotify_genres: string[] | null;
  apple_music_genres: string[] | null;
  apple_music_genre: string | null;
  
  // ============================================================================
  // LABELS
  // ============================================================================
  spotify_label: string | null;
  apple_music_label: string | null;
  
  // ============================================================================
  // EXTERNAL SERVICE INTEGRATION
  // ============================================================================
  // Discogs
  discogs_master_id: string | null;
  discogs_release_id: string | null;
  master_release_id: string | null;
  discogs_source: string | null;
  discogs_notes: string | null;
  
  // Spotify
  spotify_id: string | null;
  spotify_url: string | null;
  spotify_popularity: number | null;
  spotify_release_date: string | null;
  spotify_total_tracks: number | null;
  spotify_image_url: string | null;
  
  // Apple Music
  apple_music_id: string | null;
  apple_music_url: string | null;
  apple_music_release_date: string | null;
  apple_music_track_count: number | null;
  apple_music_artwork_url: string | null;
  
  // Enrichment tracking
  last_enriched_at: string | null;
  enrichment_sources: string[] | null;
  
  // ============================================================================
  // TAGS & NOTES
  // ============================================================================
  custom_tags: string[] | null;
  notes: string | null;
  extra: string | null;                    // Miscellaneous info (NEW)
  
  // ============================================================================
  // PEOPLE & CREDITS
  // ============================================================================
  engineers: string[] | null;              // Recording engineers (NEW)
  musicians: string[] | null;              // Session musicians (NEW)
  producers: string[] | null;              // Producers (NEW)
  songwriters: string[] | null;            // Songwriters (NEW)
  
  // ============================================================================
  // CLASSICAL MUSIC FIELDS
  // ============================================================================
  chorus: string | null;                   // Chorus/choir (NEW)
  composer: string | null;                 // Composer (NEW)
  composition: string | null;              // Composition name (NEW)
  conductor: string | null;                // Conductor (NEW)
  orchestra: string | null;                // Orchestra (NEW)
  
  // ============================================================================
  // LOAN TRACKING
  // ============================================================================
  due_date: string | null;                 // When loan is due (NEW)
  loan_date: string | null;                // When loaned out (NEW)
  loaned_to: string | null;                // Who borrowed it (NEW)
  
  // ============================================================================
  // NORMALIZED FIELDS (SEARCH OPTIMIZATION)
  // ============================================================================
  artist_norm: string | null;
  album_norm: string | null;
  title_norm: string | null;
  artist_album_norm: string | null;
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isValidRating(rating: number | null): rating is 1 | 2 | 3 | 4 | 5 | null {
  return rating === null || (rating >= 1 && rating <= 5);
}

export function isValidCollectionStatus(
  status: string | null
): status is Album['collection_status'] {
  return (
    status === null ||
    ['in_collection', 'for_sale', 'wish_list', 'on_order', 'sold', 'not_in_collection'].includes(
      status
    )
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatLength(seconds: number | null): string {
  if (!seconds) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function parseLength(lengthString: string | null): number | null {
  if (!lengthString) return null;
  
  // Parse formats like "1:23:45" or "45:30"
  const parts = lengthString.split(':').map(Number);
  
  if (parts.length === 3) {
    // H:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  }
  
  return null;
}

export function getSidesCount(sides: Album['sides']): number {
  if (!sides) return 0;
  if (typeof sides === 'number') return sides;
  if (typeof sides === 'object' && !Array.isArray(sides) && 'count' in sides) {
    return sides.count;
  }
  if (Array.isArray(sides)) return sides.length;
  return 0;
}

export function getDiscsCount(album: Album): number {
  return album.discs || 1;
}

// ============================================================================
// HELPER FUNCTIONS FOR SAFE DATA ACCESS
// ============================================================================

export function toSafeSearchString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.toLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).toLowerCase();
  if (Array.isArray(value))
    return value
      .filter((item) => typeof item === 'string')
      .join(' ')
      .toLowerCase();
  try {
    return String(value).toLowerCase();
  } catch {
    return '';
  }
}

export function toSafeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.length > 0);
}

export function toSafeNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function toSafeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}