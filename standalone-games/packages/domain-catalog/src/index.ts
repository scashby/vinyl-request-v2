export type ProviderName = "spotify" | "apple" | "tidal" | "csv" | "manual";

export type TenantId = string;
export type UserId = string;

export interface ExternalTrackRecord {
  id: string;
  tenantId: TenantId;
  provider: ProviderName;
  providerTrackId: string;
  providerUri?: string | null;
  trackTitle?: string | null;
  artistName?: string | null;
  albumName?: string | null;
  durationMs?: number | null;
  isrc?: string | null;
  rawPayload?: unknown;
}

export interface CanonicalTrackRecord {
  id: string;
  normalizedTitle: string;
  normalizedArtist: string;
  normalizedAlbum?: string | null;
  isrc?: string | null;
}

export interface TrackMappingRecord {
  id: string;
  tenantId: TenantId;
  externalTrackId: string;
  canonicalTrackId: string;
  confidenceScore: number;
  mappingStatus: "auto_matched" | "manual_matched" | "unmatched" | "rejected";
}

export interface TenantPlaylistItem {
  id: string;
  sortOrder: number;
  externalTrackId?: string | null;
  canonicalTrackId?: string | null;
  displayTitle?: string | null;
}

export interface TenantPlaylist {
  id: string;
  tenantId: TenantId;
  provider: ProviderName;
  providerPlaylistId?: string | null;
  name: string;
  description?: string | null;
  items: TenantPlaylistItem[];
}

export interface PlaylistSnapshot {
  id: string;
  tenantId: TenantId;
  tenantPlaylistId: string;
  snapshotName?: string | null;
  snapshotPayload: {
    playlistName: string;
    trackCount: number;
    items: Array<{
      index: number;
      trackTitle: string;
      artistName: string;
      canonicalTrackId?: string | null;
    }>;
  };
  createdByUserId?: UserId | null;
  createdAt: string;
}
