// src/types/album.ts
import type { Database } from './database.types';

type InventoryRow = Database['public']['Tables']['inventory']['Row'];
type ReleaseRow = Database['public']['Tables']['releases']['Row'];
type MasterRow = Database['public']['Tables']['masters']['Row'];
type ArtistRow = Database['public']['Tables']['artists']['Row'];
type RecordingRow = Database['public']['Tables']['recordings']['Row'];
type ReleaseTrackRow = Database['public']['Tables']['release_tracks']['Row'];

type MasterTagLinkRow = {
  master_tags?: { name: string | null } | null;
};

export type Album = {
  inventory?: InventoryRow | null;
  release?: (ReleaseRow & {
    master?: (MasterRow & {
      artist?: ArtistRow | null;
      master_tag_links?: MasterTagLinkRow[] | null;
    }) | null;
    release_tracks?: (ReleaseTrackRow & {
      recording?: RecordingRow | null;
    })[] | null;
  }) | null;
} & {
  id: number;
  inventory_id?: number | null;
  release_id?: number | null;
  master_id?: number | null;

  // Core fields
  artist?: string | null;
  title?: string | null;
  year?: string | number | null;
  image_url?: string | null;
  format?: string | null;

  // Location / status
  status?: string | null;
  collection_status?: string | null;
  for_sale?: boolean | null;
  location?: string | null;
  country?: string | null;
  date_added?: string | null;

  // Notes
  personal_notes?: string | null;
  release_notes?: string | null;
  master_notes?: string | null;
  notes?: string | null;

  // Conditions
  media_condition?: string | null;
  sleeve_condition?: string | null;
  package_sleeve_condition?: string | null;
  packaging?: string | null;
  studio?: string | null;
  sound?: string | null;
  vinyl_color?: string[] | null;
  vinyl_weight?: string | null;
  spars_code?: string | null;
  box_set?: string | null;
  rpm?: string | null;
  extra?: string | null;
  is_live?: boolean | null;

  // Release metadata
  barcode?: string | null;
  genres?: string[] | null;
  styles?: string[] | null;
  label?: string | null;
  labels?: string[] | null;
  catalog_number?: string | null;
  cat_no?: string | null;
  tags?: string[] | null;
  custom_tags?: string[] | null;

  // Tracks
  tracks?: Array<{
    position: string;
    title: string;
    artist?: string | null;
    duration: string | null;
    type: 'track' | 'header';
    side?: string;
    note?: string | null;
  }> | null;
  disc_metadata?: Array<Record<string, unknown>> | null;
  matrix_numbers?: string[] | null;
  discs?: number | null;
  sides?: number | null;

  // External IDs
  discogs_release_id?: string | null;
  discogs_master_id?: string | null;
  discogs_id?: string | null;
  spotify_album_id?: string | null;
  spotify_id?: string | null;
  spotify_url?: string | null;
  apple_music_id?: string | null;
  apple_music_url?: string | null;
  lastfm_url?: string | null;
  lastfm_id?: string | null;
  spotify_label?: string | null;
  apple_music_label?: string | null;
  musicbrainz_release_group_id?: string | null;
  musicbrainz_id?: string | null;
  musicbrainz_url?: string | null;
  allmusic_url?: string | null;
  wikipedia_url?: string | null;
  genius_url?: string | null;
  custom_links?: Array<{ url: string; description?: string | null }> | null;

  // Personal / value
  owner?: string | null;
  purchase_price?: number | null;
  current_value?: number | null;
  purchase_date?: string | null;
  play_count?: number | null;
  last_played_at?: string | null;
  played_history?: string | Array<Record<string, unknown>> | null;
  purchase_store?: string | null;
  signed_by?: string[] | null;
  my_rating?: number | null;
  last_cleaned_date?: string | null;

  // Additional legacy-compatible metadata fields used by tabs
  secondary_artists?: string[] | null;
  original_release_year?: number | null;
  master_release_date?: string | null;
  recording_year?: number | null;
  recording_date?: string | null;
  chart_positions?: string[] | null;
  awards?: string[] | null;
  certifications?: string[] | null;
  sort_title?: string | null;
  subtitle?: string | null;
  cultural_significance?: string | null;
  critical_reception?: string | null;
  recording_location?: string | null;
  allmusic_rating?: number | string | null;
  allmusic_review?: string | null;
  pitchfork_score?: number | string | null;
  pitchfork_review?: string | null;
  back_image_url?: string | null;
  spine_image_url?: string | null;
  inner_sleeve_images?: string[] | null;
  vinyl_label_images?: string[] | null;
  enrichment_sources?: string[] | null;
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

  // UI compatibility fields (legacy modal layout mapped to V3 storage)
  sale_quantity?: number | null;
  index_number?: number | null;
  composer?: string | null;
  conductor?: string | null;
  chorus?: string | null;
  composition?: string | null;
  orchestra?: string | null;
  songwriters?: string[] | null;
  producers?: string[] | null;
  engineers?: string[] | null;
  musicians?: string[] | null;

  // Derived
  year_int?: number | null;
};

export const toSafeStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') return [value];
  return [];
};

export const toSafeSearchString = (value: unknown): string => {
  return toSafeStringArray(value)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};
// AUDIT: updated for custom links support.
