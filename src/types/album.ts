// src/types/album.ts
export type Album = {
  // ============================================================================
  // CORE IDENTIFICATION
  // ============================================================================
  id: number;
  artist: string;               // Normalized: "John Williams"
  secondary_artists: string[] | null; // Matches DB: secondary_artists ARRAY
  sort_artist: string | null;   // "Williams, John"
  title: string;
  year: string | null;
  year_int: number | null;
  image_url: string | null;
  index_number: number | null;  // Matches DB: index_number integer
  
  // ============================================================================
  // STATUS & LOCATION
  // ============================================================================
  collection_status: 'in_collection' | 'for_sale' | 'wish_list' | 'on_order' | 'sold' | 'not_in_collection' | null;
  for_sale: boolean;
  folder: string | null;        // Matches DB: folder text
  location: string | null;      // Matches DB: location text
  storage_device_slot: string | null; // Matches DB: storage_device_slot text
  country: string | null;       // Matches DB: country text
  studio: string | null;        // Matches DB: studio text
  date_added: string | null;
  modified_date: string | null;

  // ============================================================================
  // NOTES
  // ============================================================================
  personal_notes: string | null; // Matches DB: personal_notes text
  notes?: string | null;         // Legacy alias
  release_notes: string | null;  // Matches DB: release_notes text
  extra: string | null;          // Matches DB: extra text
  discogs_notes: string | null;  // Matches DB: pricing_notes text (or implied)

  // ============================================================================
  // PHYSICAL METADATA
  // ============================================================================
  format: string;
  media_condition: string;
  package_sleeve_condition: string | null;
  barcode: string | null;
  cat_no: string | null;
  packaging: string | null;
  
  // Vinyl Specifics
  rpm: string | null;
  vinyl_weight: string | null;
  vinyl_color: string | null;
  discs: number | null;
  sides: number | null;
  
  // Audio / Content
  length_seconds: number | null; // Matches DB: length_seconds integer
  sound: string | null;
  spars_code: string | null;
  is_live: boolean | null;       // Matches DB: is_live boolean
  is_box_set: boolean | null;    // Matches DB: is_box_set boolean

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
  // EXTERNAL LINKS & IDs
  // ============================================================================
  discogs_release_id: string | null;
  discogs_master_id: string | null;
  spotify_id: string | null;
  apple_music_id: string | null;
  musicbrainz_id: string | null;
  
  // ============================================================================
  // DATES
  // ============================================================================
  original_release_date: string | null;
  original_release_year: string | null;
  recording_date: string | null;
  recording_year: string | null;
  master_release_date: string | null;

  // ============================================================================
  // TAGS & LABELS
  // ============================================================================
  genres: string[] | null; // Matches DB: genres ARRAY
  styles: string[] | null; // Matches DB: styles ARRAY
  custom_tags: string[] | null; 
  labels: string[] | null; // Matches DB: labels ARRAY

  // ============================================================================
  // PEOPLE
  // ============================================================================
  musicians: string[] | null;
  producers: string[] | null;
  engineers: string[] | null;
  songwriters: string[] | null;
  chorus: string | null;
  composer: string | null;
  composition: string | null;
  conductor: string | null;
  orchestra: string | null;

  // ============================================================================
  // PERSONAL / TRACKING / LOANS
  // ============================================================================
  owner: string | null;
  due_date: string | null;
  loan_date: string | null;
  loaned_to: string | null;
  
  last_cleaned_date: string | null;
  last_played_date: string | null;
  play_count: number | null;
  my_rating: number | null;
  signed_by: string[] | null;
  
  // ============================================================================
  // VALUE & SALES
  // ============================================================================
  purchase_price: number | null;
  current_value: number | null;
  purchase_date: string | null;
  purchase_store: string | null;
  
  sale_price: number | null;
  sale_platform: string | null;
  sale_quantity: number | null;
  wholesale_cost: number | null;
  pricing_notes: string | null;
  
  discogs_price_min: number | null;
  discogs_price_median: number | null;
  discogs_price_max: number | null;
  discogs_price_updated_at: string | null;

  // ============================================================================
  // SYSTEM / ENRICHMENT
  // ============================================================================
  spotify_popularity: number | null;
  discogs_source: string | null;
  enrichment_sources: string | null;
  last_enriched_at: string | null;
  
  // ============================================================================
  // LEGACY / OPTIONAL
  // ============================================================================
  spotify_label?: string | null;
  apple_music_label?: string | null;
  sort_title?: string | null;
  subtitle?: string | null;
  played_history?: string | null;
  
  spotify_total_tracks?: number | null;
  apple_music_track_count?: number | null;

  // ============================================================================
  // EXTRA METADATA (JSONB)
  // ============================================================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  disc_metadata?: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matrix_numbers?: any | null;

  // ============================================================================
  // HIERARCHY (Box Sets)
  // ============================================================================
  parent_id?: number | null;
  child_album_ids?: string | null;

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