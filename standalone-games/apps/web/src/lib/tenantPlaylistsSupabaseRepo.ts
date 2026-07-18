import { getStandaloneSupabaseClient } from "@/lib/supabaseStandalone";
import {
  type CreateTenantPlaylistInput,
  type TenantPlaylistRecord,
  type TenantPlaylistsRepository,
} from "@/lib/tenantPlaylistsRepo";

function mapRow(row: Record<string, unknown>): TenantPlaylistRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    provider: row.provider as TenantPlaylistRecord["provider"],
    providerPlaylistId: typeof row.provider_playlist_id === "string" ? row.provider_playlist_id : null,
    name: String(row.name),
    description: typeof row.description === "string" ? row.description : null,
    createdByUserId: typeof row.created_by_user_id === "string" ? row.created_by_user_id : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class SupabaseTenantPlaylistsRepository implements TenantPlaylistsRepository {
  async listByTenant(tenantId: string): Promise<TenantPlaylistRecord[]> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_tenant_playlists")
      .select("id, tenant_id, provider, provider_playlist_id, name, description, created_by_user_id, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async create(input: CreateTenantPlaylistInput): Promise<TenantPlaylistRecord> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_tenant_playlists")
      .insert({
        tenant_id: input.tenantId,
        provider: input.provider,
        provider_playlist_id: input.providerPlaylistId,
        name: input.name,
        description: input.description,
        created_by_user_id: input.createdByUserId,
      })
      .select("id, tenant_id, provider, provider_playlist_id, name, description, created_by_user_id, created_at, updated_at")
      .single();

    if (error) throw new Error(error.message);

    return mapRow(data as Record<string, unknown>);
  }

  async getById(tenantId: string, playlistId: string): Promise<TenantPlaylistRecord | null> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_tenant_playlists")
      .select("id, tenant_id, provider, provider_playlist_id, name, description, created_by_user_id, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .eq("id", playlistId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return data ? mapRow(data as Record<string, unknown>) : null;
  }
}
