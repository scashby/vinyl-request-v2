import { isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";
import { SupabaseProviderConnectionsRepository } from "@/lib/providerConnectionsSupabaseRepo";
import {
  InMemoryProviderConnectionsRepository,
  type ProviderConnectionsRepository,
} from "@/lib/providerConnectionsRepo";

let cachedRepository: ProviderConnectionsRepository | null = null;

export function getProviderConnectionsRepository(): ProviderConnectionsRepository {
  if (cachedRepository) return cachedRepository;

  cachedRepository = isStandaloneSupabaseConfigured()
    ? new SupabaseProviderConnectionsRepository()
    : new InMemoryProviderConnectionsRepository();

  return cachedRepository;
}
