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
  discs: number | null;
  sides: number | { count: number } | string[] | null;
  barcode: string | null;
  cat_no: string | null;
  
  // ============================================================================
  // VISUAL & AUDIO
  // ============================================================================
  image_url: string | null;
  back_image_url: string | null;
  length_seconds: number | null;
  tracklists: string | null; // Legacy text field
  
  // ============================================================================
  // TRACKS & DISC DATA (JSONB fields)
  // ============================================================================
  tracks: Array<{
    position: string;
    title: string;
    artist: string | null;
    duration: string | null;
    type: 'track' | 'header';
    disc_number: number;
    side?: string;
  }> | null;
  disc_metadata: Array<{
    disc_number: number;
    title: string;
    storage_device: string | null;
    slot: string | null;
  }> | null;
  matrix_numbers: {
    [disc_number: string]: {
      side_a: string;
      side_b: string;
    };
  } | null;
  storage_device: string | null; // Single storage device
  slot: string | null; // Single slot
  
  // ============================================================================
  // CONDITION & GRADING
  // ============================================================================
  media_condition: string;
  package_sleeve_condition: string | null;
  
  // ============================================================================
  // VINYL-SPECIFIC FIELDS
  // ============================================================================
  vinyl_color: string[] | null;
  vinyl_weight: string | null;
  rpm: string | null;
  
  // ============================================================================
  // TECHNICAL SPECIFICATIONS
  // ============================================================================
  sound: string | null;
  spars_code: string | null;
  packaging: string | null;
  
  // ============================================================================
  // RELEASE INFORMATION
  // ============================================================================
  original_release_date: string | null;
  original_release_year: number | null;
  recording_date: string | null;
  recording_year: number | null;
  master_release_date: string | null;
  country: string | null;
  studio: string | null;
  
  // ============================================================================
  // COLLECTION MANAGEMENT
  // ============================================================================
  collection_status: 'in_collection' | 'for_sale' | 'wish_list' | 'on_order' | 'sold' | 'not_in_collection' | null;
  for_sale: boolean;
  is_box_set: boolean;
  box_set: string | null;
  is_live: boolean | null;
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
  blocked_tracks: Record<string, string[]> | null;
  
  // ============================================================================
  // SALES & PRICING
  // ============================================================================
  sale_price: number | null;
  sale_platform: string | null;
  sale_quantity: number | null;
  sale_notes: string | null;
  sell_price: string | null;
  wholesale_cost: number | null;
  
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
  my_rating: number | null;
  play_count: number | null;
  last_played_date: string | null;
  last_cleaned_date: string | null;
  signed_by: string[] | null;
  played_history: string | null; // JSON string of PlayedHistoryEntry[]
  location: string | null;
  storage_device_slot: string | null;
  index_number: number | null;
  
  // ============================================================================
  // DATES & METADATA
  // ============================================================================
  date_added: string | null;
  modified_date: string | null;
  decade: number | null;
  
  // ============================================================================
  // GENRES & STYLES
  // ============================================================================
  // UPDATED: Canonical columns
  genres: string[] | null;
  styles: string[] | null;
  
  // Legacy/Other source genres
  spotify_genres: string[] | null;
  apple_music_genres: string[] | null;
  apple_music_genre: string | null;
  
  // ============================================================================
  // LABELS
  // ============================================================================
  labels: string[] | null;  // CLZ primary label data
  spotify_label: string | null;
  apple_music_label: string | null;
  
  // ============================================================================
  // EXTERNAL SERVICE INTEGRATION
  // ============================================================================
  // Discogs
  discogs_master_id: string | null;
  discogs_release_id: string | null;
  discogs_id: string | null;              // Alias for compatibility
  master_release_id: string | null;
  discogs_source: string | null;
  discogs_notes: string | null;
  
  // Spotify
  spotify_id: string | null;
  spotify_album_id: string | null;       // Alias for compatibility
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
  
  enrichment_sources: string[] | null;
  last_enriched_at: string | null;
  
  // ============================================================================
  // TAGS & NOTES
  // ============================================================================
  custom_tags: string[] | null;
  notes: string | null;
  extra: string | null;
  
  // ============================================================================
  // PEOPLE & CREDITS
  // ============================================================================
  engineers: string[] | null;
  musicians: string[] | null;
  producers: string[] | null;
  songwriters: string[] | null;
  
  // ============================================================================
  // CLASSICAL MUSIC FIELDS
  // ============================================================================
  chorus: string | null;
  composer: string | null;
  composition: string | null;
  conductor: string | null;
  orchestra: string | null;
  
  // ============================================================================
  // LOAN TRACKING
  // ============================================================================
  due_date: string | null;
  loan_date: string | null;
  loaned_to: string | null;
  
  // ============================================================================
  // NORMALIZED FIELDS (SEARCH OPTIMIZATION)
  // ============================================================================
  artist_norm: string | null;
  album_norm: string | null;
  title_norm: string | null;
  artist_album_norm: string | null;
};

// TYPE GUARDS
export function isValidRating(rating: number | null): rating is 1 | 2 | 3 | 4 | 5 | null {
  return rating === null || (rating >= 1 && rating <= 5);
}

export function isValidCollectionStatus(
  status: string | null
): status is Album['collection_status'] {
  return (
    status === null ||
    ['in_collection', 'for_sale', 'wish_list', 'on_order', 'sold', 'not_in_collection'].includes(status)
  );
}

// UTILITY FUNCTIONS
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
  const parts = lengthString.split(':').map(Number);
  
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
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