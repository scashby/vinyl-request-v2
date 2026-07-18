import { getStandaloneSupabaseClient } from "@/lib/supabaseStandalone";
import {
  type CreateTenantPlaylistSnapshotInput,
  type TenantPlaylistSnapshotRecord,
  type TenantPlaylistSnapshotsRepository,
} from "@/lib/tenantPlaylistSnapshotsRepo";

function mapRow(row: Record<string, unknown>): TenantPlaylistSnapshotRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    tenantPlaylistId: String(row.tenant_playlist_id),
    snapshotName: typeof row.snapshot_name === "string" ? row.snapshot_name : null,
    snapshotPayload: row.snapshot_payload,
    createdByUserId: typeof row.created_by_user_id === "string" ? row.created_by_user_id : null,
    createdAt: String(row.created_at),
  };
}

export class SupabaseTenantPlaylistSnapshotsRepository implements TenantPlaylistSnapshotsRepository {
  async listByTenant(tenantId: string): Promise<TenantPlaylistSnapshotRecord[]> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_tenant_playlist_snapshots")
      .select("id, tenant_id, tenant_playlist_id, snapshot_name, snapshot_payload, created_by_user_id, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async create(input: CreateTenantPlaylistSnapshotInput): Promise<TenantPlaylistSnapshotRecord> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_tenant_playlist_snapshots")
      .insert({
        tenant_id: input.tenantId,
        tenant_playlist_id: input.tenantPlaylistId,
        snapshot_name: input.snapshotName,
        snapshot_payload: input.snapshotPayload,
        created_by_user_id: input.createdByUserId,
      })
      .select("id, tenant_id, tenant_playlist_id, snapshot_name, snapshot_payload, created_by_user_id, created_at")
      .single();

    if (error) throw new Error(error.message);

    return mapRow(data as Record<string, unknown>);
  }

  async existsForTenant(tenantId: string, snapshotId: string): Promise<boolean> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_tenant_playlist_snapshots")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", snapshotId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return Boolean(data);
  }
}
