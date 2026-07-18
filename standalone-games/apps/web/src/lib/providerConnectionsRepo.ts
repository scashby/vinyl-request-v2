export type ProviderName = "spotify" | "apple" | "tidal" | "csv";

export interface ProviderConnectionRecord {
  id: string;
  tenantId: string;
  provider: ProviderName;
  externalAccountId?: string | null;
  connectionStatus: "active" | "revoked" | "expired" | "error";
  encryptedAccessToken?: string | null;
  encryptedRefreshToken?: string | null;
  tokenExpiresAt?: string | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderConnectionInput {
  tenantId: string;
  provider: ProviderName;
  externalAccountId?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
}

export interface ProviderConnectionsRepository {
  listByTenant(tenantId: string): Promise<ProviderConnectionRecord[]>;
  create(input: CreateProviderConnectionInput): Promise<ProviderConnectionRecord>;
  getById(tenantId: string, connectionId: string): Promise<ProviderConnectionRecord | null>;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class InMemoryProviderConnectionsRepository
  implements ProviderConnectionsRepository
{
  private readonly connections: ProviderConnectionRecord[] = [];

  async listByTenant(tenantId: string): Promise<ProviderConnectionRecord[]> {
    return this.connections
      .filter((item) => item.tenantId === tenantId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async create(
    input: CreateProviderConnectionInput
  ): Promise<ProviderConnectionRecord> {
    const now = new Date().toISOString();
    const record: ProviderConnectionRecord = {
      id: makeId(),
      tenantId: input.tenantId,
      provider: input.provider,
      externalAccountId: input.externalAccountId ?? null,
      connectionStatus: "active",
      encryptedAccessToken: input.accessToken ?? null,
      encryptedRefreshToken: input.refreshToken ?? null,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.connections.push(record);
    return record;
  }

  async getById(
    tenantId: string,
    connectionId: string
  ): Promise<ProviderConnectionRecord | null> {
    return (
      this.connections.find(
        (item) => item.tenantId === tenantId && item.id === connectionId
      ) ?? null
    );
  }
}
