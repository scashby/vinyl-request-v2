// src/types/album.ts
export type Album = {
  // ============================================================================
  // CORE IDENTIFICATION
  // ============================================================================
  id: number;
  artist: string;               // Normalized: "John Williams"
  secondary_artists: string[] | null; // ["London Symphony Orchestra"]
  sort_artist: string | null;   // "Williams, John"
  title: string;
  year: string | null;
  year_int: number | null;
  image_url: string | null;
  
  // ============================================================================
  // STATUS & LOCATION
  // ============================================================================
  collection_status: 'in_collection' | 'for_sale' | 'wish_list' | 'on_order' | 'sold' | 'not_in_collection' | null;
  for_sale: boolean;
  location: string | null;      // Physical location (shelf, box)
  date_added: string | null;
  modified_date: string | null;

  // ============================================================================
  // NOTES
  // ============================================================================
  personal_notes: string | null; // From CSV "Collection Notes"
  release_notes: string | null;  // From Discogs "Notes"
  extra: string | null;          // Format details (gatefold, colored)

  // ============================================================================
  // PHYSICAL METADATA
  // ============================================================================
  format: string;
  media_condition: string;
  package_sleeve_condition: string | null;
  barcode: string | null;
  cat_no: string | null;
  
  // Vinyl Specifics
  rpm: string | null;
  vinyl_weight: string | null;
  vinyl_color: string | null;
  discs: number | null;
  sides: number | null;
  
  // ============================================================================
  // TRACKS (The Source of Truth)
  // ============================================================================
  tracks: Array<{
    position: string;
    title: string;
    artist?: string | null;
    duration: string | null;
    type: 'track' | 'header';
    disc_number: number;
    side?: string;
  }> | null;

  // ============================================================================
  // EXTERNAL LINKS
  // ============================================================================
  discogs_release_id: string | null;
  discogs_master_id: string | null;
  spotify_id: string | null;
  apple_music_id: string | null;
  musicbrainz_id: string | null;

  // ============================================================================
  // TAGS & LABELS
  // ============================================================================
  genres: string[] | null; 
  styles: string[] | null; 
  custom_tags: string[] | null; 
  labels: string[] | null; // ADDED: Matches DB array column

  // ============================================================================
  // PEOPLE
  // ============================================================================
  musicians: string[] | null;
  producers: string[] | null;
  engineers: string[] | null;
  songwriters: string[] | null;

  // ============================================================================
  // PERSONAL / TRACKING
  // ============================================================================
  owner: string | null;
  purchase_price: number | null;
  current_value: number | null;
  purchase_date: string | null;
  purchase_store: string | null;
  last_cleaned_date: string | null;
  last_played_date: string | null; // ADDED: Matches DB column
  play_count: number | null;
  my_rating: number | null;
  signed_by: string[] | null;
  
  // ============================================================================
  // LEGACY / OPTIONAL (Keep for compatibility if needed, but prefer above)
  // ============================================================================
  spotify_label?: string | null;
  apple_music_label?: string | null;
  sort_title?: string | null;
  subtitle?: string | null;
  master_release_date?: string | null;
  played_history?: string | null; // Kept as optional string to prevent breakage if accessed

  // ============================================================================
  // EXTRA METADATA (JSONB)
  // ============================================================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  disc_metadata?: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matrix_numbers?: any | null;

  // ============================================================================
  // GENERATED / NORMALIZED (System Columns)
  // ============================================================================
  album_norm?: string | null;
  artist_norm?: string | null;
  title_norm?: string | null;
  artist_album_norm?: string | null;
};

// HELPER FUNCTIONS
export function toSafeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.length > 0);
}

export function toSafeSearchString(value: unknown): string {
  if (typeof value === 'string') return value.toLowerCase();
  if (Array.isArray(value)) return value.join(' ').toLowerCase();
  return '';
}