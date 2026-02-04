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
  collection_status?: 'in_collection' | 'wish_list' | 'on_order' | 'sold' | 'not_in_collection' | null;
  status?: string | null;
  location?: string | null;
  country?: string | null;
  date_added?: string | null;

  // Notes
  personal_notes?: string | null;
  release_notes?: string | null;

  // Conditions
  media_condition?: string | null;
  package_sleeve_condition?: string | null;

  // Release metadata
  barcode?: string | null;
  cat_no?: string | null;
  labels?: string[] | null;
  genres?: string[] | null;
  styles?: string[] | null;
  custom_tags?: string[] | null;

  // Tracks
  tracks?: Array<{
    position: string;
    title: string;
    artist?: string | null;
    duration: string | null;
    type: 'track' | 'header';
    side?: string;
  }> | null;

  // External IDs
  discogs_release_id?: string | null;
  discogs_master_id?: string | null;
  spotify_album_id?: string | null;
  musicbrainz_id?: string | null;

  // Personal / value
  owner?: string | null;
  purchase_price?: number | null;
  current_value?: number | null;
  purchase_date?: string | null;
  play_count?: number | null;
  last_played_at?: string | null;

  // Derived
  year_int?: number | null;
};
