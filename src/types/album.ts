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
  location?: string | null;
  country?: string | null;
  date_added?: string | null;

  // Notes
  personal_notes?: string | null;
  release_notes?: string | null;

  // Conditions
  media_condition?: string | null;
  sleeve_condition?: string | null;

  // Release metadata
  barcode?: string | null;
  genres?: string[] | null;
  styles?: string[] | null;
  label?: string | null;
  catalog_number?: string | null;
  tags?: string[] | null;

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
  musicbrainz_release_group_id?: string | null;

  // Personal / value
  owner?: string | null;
  purchase_price?: number | null;
  current_value?: number | null;
  purchase_date?: string | null;
  play_count?: number | null;
  last_played_at?: string | null;

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
