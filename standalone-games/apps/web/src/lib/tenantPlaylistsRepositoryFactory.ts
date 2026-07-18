import { isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";
import { SupabaseTenantPlaylistsRepository } from "@/lib/tenantPlaylistsSupabaseRepo";
import {
  InMemoryTenantPlaylistsRepository,
  type TenantPlaylistsRepository,
} from "@/lib/tenantPlaylistsRepo";

let cachedRepository: TenantPlaylistsRepository | null = null;

export function getTenantPlaylistsRepository(): TenantPlaylistsRepository {
  if (cachedRepository) return cachedRepository;

  cachedRepository = isStandaloneSupabaseConfigured()
    ? new SupabaseTenantPlaylistsRepository()
    : new InMemoryTenantPlaylistsRepository();

  return cachedRepository;
}
