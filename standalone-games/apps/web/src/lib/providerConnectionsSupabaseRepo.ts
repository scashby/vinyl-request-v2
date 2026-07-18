import { getStandaloneSupabaseClient } from "@/lib/supabaseStandalone";
import {
  type CreateProviderConnectionInput,
  type ProviderConnectionRecord,
  type ProviderConnectionsRepository,
} from "@/lib/providerConnectionsRepo";

function mapRow(row: Record<string, unknown>): ProviderConnectionRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    provider: row.provider as ProviderConnectionRecord["provider"],
    externalAccountId:
      typeof row.external_account_id === "string" ? row.external_account_id : null,
    connectionStatus: row.connection_status as ProviderConnectionRecord["connectionStatus"],
    encryptedAccessToken:
      typeof row.encrypted_access_token === "string" ? row.encrypted_access_token : null,
    encryptedRefreshToken:
      typeof row.encrypted_refresh_token === "string" ? row.encrypted_refresh_token : null,
    tokenExpiresAt:
      typeof row.token_expires_at === "string" ? row.token_expires_at : null,
    lastSyncedAt:
      typeof row.last_synced_at === "string" ? row.last_synced_at : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class SupabaseProviderConnectionsRepository
  implements ProviderConnectionsRepository
{
  async listByTenant(tenantId: string): Promise<ProviderConnectionRecord[]> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_provider_connections")
      .select(
        "id, tenant_id, provider, external_account_id, connection_status, encrypted_access_token, encrypted_refresh_token, token_expires_at, last_synced_at, created_at, updated_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async create(
    input: CreateProviderConnectionInput
  ): Promise<ProviderConnectionRecord> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_provider_connections")
      .insert({
        tenant_id: input.tenantId,
        provider: input.provider,
        external_account_id: input.externalAccountId,
        connection_status: "active",
        encrypted_access_token: input.accessToken,
        encrypted_refresh_token: input.refreshToken,
        token_expires_at: input.tokenExpiresAt,
      })
      .select(
        "id, tenant_id, provider, external_account_id, connection_status, encrypted_access_token, encrypted_refresh_token, token_expires_at, last_synced_at, created_at, updated_at"
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapRow(data as Record<string, unknown>);
  }

  async getById(
    tenantId: string,
    connectionId: string
  ): Promise<ProviderConnectionRecord | null> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_provider_connections")
      .select(
        "id, tenant_id, provider, external_account_id, connection_status, encrypted_access_token, encrypted_refresh_token, token_expires_at, last_synced_at, created_at, updated_at"
      )
      .eq("tenant_id", tenantId)
      .eq("id", connectionId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapRow(data as Record<string, unknown>) : null;
  }
}
