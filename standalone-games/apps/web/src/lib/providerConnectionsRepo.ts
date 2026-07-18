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

export interface ProviderConnectionsRepository {
  getById(tenantId: string, connectionId: string): Promise<ProviderConnectionRecord | null>;
}

export class InMemoryProviderConnectionsRepository
  implements ProviderConnectionsRepository
{
  private readonly connections: ProviderConnectionRecord[] = [];

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
