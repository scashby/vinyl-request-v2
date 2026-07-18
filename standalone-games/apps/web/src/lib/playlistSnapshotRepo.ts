import { getStandaloneSupabaseClient, isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";

export interface PlaylistSnapshotLookupResult {
  exists: boolean;
  tenantId?: string;
}

export interface PlaylistSnapshotRepository {
  existsForTenant(tenantId: string, snapshotId: string): Promise<boolean>;
}

class InMemoryPlaylistSnapshotRepository implements PlaylistSnapshotRepository {
  async existsForTenant(_tenantId: string, _snapshotId: string): Promise<boolean> {
    return true;
  }
}

class SupabasePlaylistSnapshotRepository implements PlaylistSnapshotRepository {
  async existsForTenant(tenantId: string, snapshotId: string): Promise<boolean> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_tenant_playlist_snapshots")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", snapshotId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return Boolean(data);
  }
}

const globalStore = globalThis as unknown as {
  __standalonePlaylistSnapshotRepo?: PlaylistSnapshotRepository;
};

export function getPlaylistSnapshotRepository(): PlaylistSnapshotRepository {
  if (!globalStore.__standalonePlaylistSnapshotRepo) {
    globalStore.__standalonePlaylistSnapshotRepo = isStandaloneSupabaseConfigured()
      ? new SupabasePlaylistSnapshotRepository()
      : new InMemoryPlaylistSnapshotRepository();
  }

  return globalStore.__standalonePlaylistSnapshotRepo;
}
