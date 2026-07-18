import type { ProviderName } from "@dwd/domain-catalog";

export interface ProviderAuthorizationResult {
  connectionId: string;
  provider: ProviderName;
  externalAccountId?: string | null;
  scopes?: string[];
}

export interface ProviderPlaylistSummary {
  providerPlaylistId: string;
  name: string;
  trackCount: number;
}

export interface ProviderTrackPageItem {
  providerTrackId: string;
  uri?: string | null;
  trackTitle?: string | null;
  artistName?: string | null;
  albumName?: string | null;
  durationMs?: number | null;
  isrc?: string | null;
  rawPayload?: unknown;
}

export interface ProviderTrackPage {
  items: ProviderTrackPageItem[];
  nextCursor?: string | null;
  done: boolean;
}

export interface ImportProgressReporter {
  onProgress: (percent: number, summary?: string) => Promise<void>;
  onPartial: (summary: string) => Promise<void>;
}

export interface ProviderAdapter {
  readonly provider: ProviderName;
  authorize: (params: {
    tenantId: string;
    userId: string;
    authCode?: string;
    redirectUri?: string;
  }) => Promise<ProviderAuthorizationResult>;
  listPlaylists: (params: {
    tenantId: string;
    connectionId: string;
  }) => Promise<ProviderPlaylistSummary[]>;
  fetchPlaylistPage: (params: {
    tenantId: string;
    connectionId: string;
    providerPlaylistId: string;
    cursor?: string;
  }) => Promise<ProviderTrackPage>;
}

export interface ProviderAdapterRegistry {
  get: (provider: ProviderName) => ProviderAdapter;
}
