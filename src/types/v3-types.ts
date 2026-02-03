// src/types/v3-types.ts
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

export type V3Album = InventoryRow & {
  release?: (ReleaseRow & {
    master?: (MasterRow & {
      artist?: ArtistRow | null;
      master_tag_links?: MasterTagLinkRow[] | null;
    }) | null;
    release_tracks?: (ReleaseTrackRow & {
      recording?: RecordingRow | null;
    })[] | null;
  }) | null;
};

export function toSafeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.length > 0);
}

export function toSafeSearchString(value: unknown): string {
  if (typeof value === 'string') return value.toLowerCase();
  if (Array.isArray(value)) return value.join(' ').toLowerCase();
  return '';
}
