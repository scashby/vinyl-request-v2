// src/types/album.ts
export type Album = {
  // ============================================================================
  // CORE IDENTIFICATION
  // ============================================================================
  id: number;
  artist: string;
  secondary_artists: string[] | null; 
  sort_artist: string | null;
  title: string;
  sort_title: string | null;
  year: string | null;
  year_int: number | null;
  image_url: string | null;
  back_image_url: string | null;
  index_number: number | null;
  
  // ============================================================================
  // STATUS & LOCATION
  // ============================================================================
  collection_status: 'in_collection' | 'for_sale' | 'wish_list' | 'on_order' | 'sold' | 'not_in_collection' | null;
  for_sale: boolean;
  
  // Location
  location: string | null;
  storage_device: string | null;
  storage_device_slot: string | null;
  slot: string | null;
  country: string | null;
  studio: string | null;
  recording_location: string | null;

  // Dates
  date_added: string | null;
  modified_date: string | null;
  last_reviewed_at: string | null;
  decade: number | null;

  // ============================================================================
  // NOTES
  // ============================================================================
  personal_notes: string | null;
  notes?: string | null; // UI Alias for personal_notes
  release_notes: string | null;
  extra: string | null;

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
  vinyl_color: string[] | null; 
  
  discs: number | null;
  sides: number | null;
  
  // Audio / Content
  length_seconds: number | null;
  sound: string | null;
  spars_code: string | null;
  is_live: boolean | null;
  is_box_set: boolean | null;
  box_set: string | null;
  time_signature: string | null;

  // ============================================================================
  // TRACKS (JSONB)
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
  discogs_id: string | null;
  discogs_release_id: string | null;
  discogs_master_id: string | null;
  
  spotify_id: string | null;
  spotify_url: string | null;
  spotify_album_id: string | null;
  
  apple_music_id: string | null;
  apple_music_url: string | null;
  
  musicbrainz_id: string | null;
  musicbrainz_url: string | null;
  
  lastfm_id: string | null;
  lastfm_url: string | null;
  allmusic_id: string | null;
  allmusic_url: string | null;
  wikipedia_url: string | null;
  dbpedia_uri: string | null;
  
  // ============================================================================
  // DATES
  // ============================================================================
  original_release_date: string | null;
  original_release_year: number | null;
  recording_date: string | null;
  recording_year: number | null;
  master_release_date: string | null;

  // ============================================================================
  // TAGS & LABELS
  // ============================================================================
  genres: string[] | null; 
  styles: string[] | null; 
  custom_tags: string[] | null; 
  labels: string[] | null;
  enrichment_sources: string[] | null;
  finalized_fields: string[] | null;

  // ============================================================================
  // PEOPLE
  // ============================================================================
  musicians: string[] | null;
  producers: string[] | null;
  engineers: string[] | null;
  songwriters: string[] | null;
  writers: string[] | null;
  
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
  
  for_sale_indicator?: boolean; 
  
  sale_price: number | null;
  sell_price: string | null; // Legacy text field
  sale_platform: string | null;
  sale_quantity: number | null;
  sale_notes: string | null;
  wholesale_cost: number | null;
  pricing_notes: string | null;
  
  discogs_price_min: number | null;
  discogs_price_median: number | null;
  discogs_price_max: number | null;
  discogs_price_updated_at: string | null;

  // ============================================================================
  // UI HELPERS / OPTIONAL
  // ============================================================================
  subtitle?: string | null;
  played_history?: string | null;
  
  blocked?: boolean | null;
  blocked_sides?: string[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocked_tracks?: any | null;

  // ============================================================================
  // LEGACY ENRICHMENT FIELDS (NOT SCHEMA-BACKED)
  // ============================================================================
  // These values may be present in API responses from enrichment jobs but are not
  // persisted as first-class album columns.
  spotify_label?: string | null;
  apple_music_label?: string | null;
  spotify_total_tracks?: number | null;
  apple_music_track_count?: number | null;
  
  // ============================================================================
  // EXTRA METADATA (JSONB)
  // ============================================================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  disc_metadata?: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matrix_numbers?: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inner_sleeve_images?: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enriched_metadata?: any | null;
  cultural_significance?: string | null;

  // ============================================================================
  // DJ DATA (Mapped from collection_dj_data)
  // ============================================================================
  tempo_bpm?: number | null;
  musical_key?: string | null;
  energy?: number | null;
  danceability?: number | null;
  valence?: number | null;

  // ============================================================================
  // HIERARCHY
  // ============================================================================
  parent_id?: string | null;
  child_album_ids?: string[] | null;

  // ============================================================================
  // NORMALIZED
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
