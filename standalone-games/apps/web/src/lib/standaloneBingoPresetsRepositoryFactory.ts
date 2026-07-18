import { isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";
import { InMemoryStandaloneBingoPresetsRepository, type StandaloneBingoPresetsRepository } from "@/lib/standaloneBingoPresetsRepo";
import { SupabaseStandaloneBingoPresetsRepository } from "@/lib/standaloneBingoPresetsSupabaseRepo";

let cachedRepository: StandaloneBingoPresetsRepository | null = null;

export function getStandaloneBingoPresetsRepository(): StandaloneBingoPresetsRepository {
  if (cachedRepository) return cachedRepository;

  cachedRepository = isStandaloneSupabaseConfigured()
    ? new SupabaseStandaloneBingoPresetsRepository()
    : new InMemoryStandaloneBingoPresetsRepository();

  return cachedRepository;
}
