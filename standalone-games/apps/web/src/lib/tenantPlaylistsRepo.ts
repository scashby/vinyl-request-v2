export type TenantPlaylistProvider = "spotify" | "apple" | "tidal" | "csv" | "manual";

export interface TenantPlaylistRecord {
  id: string;
  tenantId: string;
  provider: TenantPlaylistProvider;
  providerPlaylistId?: string | null;
  name: string;
  description?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantPlaylistInput {
  tenantId: string;
  provider: TenantPlaylistProvider;
  providerPlaylistId?: string | null;
  name: string;
  description?: string | null;
  createdByUserId?: string | null;
}

export interface TenantPlaylistsRepository {
  listByTenant(tenantId: string): Promise<TenantPlaylistRecord[]>;
  create(input: CreateTenantPlaylistInput): Promise<TenantPlaylistRecord>;
  getById(tenantId: string, playlistId: string): Promise<TenantPlaylistRecord | null>;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class InMemoryTenantPlaylistsRepository implements TenantPlaylistsRepository {
  private readonly playlists: TenantPlaylistRecord[] = [];

  async listByTenant(tenantId: string): Promise<TenantPlaylistRecord[]> {
    return this.playlists
      .filter((playlist) => playlist.tenantId === tenantId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async create(input: CreateTenantPlaylistInput): Promise<TenantPlaylistRecord> {
    const now = new Date().toISOString();
    const playlist: TenantPlaylistRecord = {
      id: makeId(),
      tenantId: input.tenantId,
      provider: input.provider,
      providerPlaylistId: input.providerPlaylistId ?? null,
      name: input.name,
      description: input.description ?? null,
      createdByUserId: input.createdByUserId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.playlists.push(playlist);
    return playlist;
  }

  async getById(tenantId: string, playlistId: string): Promise<TenantPlaylistRecord | null> {
    return this.playlists.find(
      (playlist) => playlist.tenantId === tenantId && playlist.id === playlistId
    ) ?? null;
  }
}
