import { isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";
import { SupabaseTenantPlaylistSnapshotsRepository } from "@/lib/tenantPlaylistSnapshotsSupabaseRepo";
import {
  InMemoryTenantPlaylistSnapshotsRepository,
  type TenantPlaylistSnapshotsRepository,
} from "@/lib/tenantPlaylistSnapshotsRepo";

let cachedRepository: TenantPlaylistSnapshotsRepository | null = null;

export function getTenantPlaylistSnapshotsRepository(): TenantPlaylistSnapshotsRepository {
  if (cachedRepository) return cachedRepository;

  cachedRepository = isStandaloneSupabaseConfigured()
    ? new SupabaseTenantPlaylistSnapshotsRepository()
    : new InMemoryTenantPlaylistSnapshotsRepository();

  return cachedRepository;
}
