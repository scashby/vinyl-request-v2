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
  folder: string | null;
  location: string | null;
  storage_device_slot: string | null;
  country: string | null;
  studio: string | null;
  date_added: string | null;
  modified_date: string | null;
  decade: number | null;

  // ============================================================================
  // NOTES
  // ============================================================================
  personal_notes: string | null;
  notes?: string | null;         // Alias
  release_notes: string | null;
  master_notes: string | null;
  extra: string | null;
  discogs_notes: string | null;

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
  
  // CONFLICT RESOLUTION: Defined as string[] because DB needs correction to match UI
  vinyl_color: string[] | null;
  
  discs: number | null;
  sides: number | null;
  
  // Audio / Content
  length_seconds: number | null;
  sound: string | null;
  spars_code: string | null;
  is_live: boolean | null;
  is_box_set: boolean | null;
  box_set: string | null; // Name of the box set

  // ============================================================================
  // TRACKS
  // ============================================================================
  // The JSONB source of truth
  tracks: Array<{
    position: string;
    title: string;
    artist?: string | null;
    duration: string | null;
    type: 'track' | 'header';
    disc_number: number;
    side?: string;
  }> | null;
  
  // Legacy text column present in DB
  tracklists: string | null;

  // ============================================================================
  // EXTERNAL LINKS & IDs
  // ============================================================================
  discogs_id: string | null;
  discogs_release_id: string | null;
  discogs_master_id: string | null;
  
  spotify_id: string | null;
  spotify_url: string | null;
  spotify_album_id: string | null;
  spotify_popularity: number | null;
  
  apple_music_id: string | null;
  apple_music_url: string | null;
  
  musicbrainz_id: string | null;
  musicbrainz_url: string | null;
  
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
  genres: string[] | null; 
  styles: string[] | null; 
  custom_tags: string[] | null; 
  labels: string[] | null;

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
  sell_price: string | null; // Legacy text field in DB
  sale_platform: string | null;
  sale_quantity: number | null;
  sale_notes: string | null;
  wholesale_cost: number | null;
  pricing_notes: string | null;

  // ============================================================================
  // LEGACY / OPTIONAL / UI HELPERS
  // ============================================================================
  spotify_label?: string | null;
  apple_music_label?: string | null;
  sort_title?: string | null;
  subtitle?: string | null;
  played_history?: string | null;
  
  spotify_total_tracks?: number | null;
  apple_music_track_count?: number | null;
  
  // Legacy / Backup fields present in backup tables or UI logic
  is_1001?: boolean | null;
  steves_top_200?: boolean | null;
  this_weeks_top_10?: boolean | null;
  blocked?: boolean | null;
  blocked_sides?: string[] | null;
  blocked_tracks?: unknown | null;
  spotify_release_date?: string | null;
  spotify_image_url?: string | null;
  apple_music_release_date?: string | null;
  apple_music_artwork_url?: string | null;
  
  // ============================================================================
  // EXTRA METADATA (JSONB)
  // ============================================================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  disc_metadata?: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matrix_numbers?: any | null;
  
  enrichment_sources?: string[] | null; 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enriched_metadata?: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata_sources?: any | null;

  // ============================================================================
  // DJ DATA
  // ============================================================================
  tempo_bpm?: number | null;
  musical_key?: string | null;
  energy?: number | null;
  danceability?: number | null;
  mood_acoustic?: number | null;
  mood_electronic?: number | null;
  mood_happy?: number | null;
  mood_sad?: number | null;
  mood_aggressive?: number | null;
  mood_relaxed?: number | null;
  mood_party?: number | null;

  // ============================================================================
  // HIERARCHY
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
  
  // Social/Embeds
  lastfm_id: string | null;
  lastfm_url: string | null;
  allmusic_id: string | null;
  allmusic_url: string | null;
  wikipedia_url: string | null;
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
// AUDIT: inspected, no changes.
