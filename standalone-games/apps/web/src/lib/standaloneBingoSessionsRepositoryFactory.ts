import { isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";
import { SupabaseStandaloneBingoSessionsRepository } from "@/lib/standaloneBingoSessionsSupabaseRepo";
import {
  InMemoryStandaloneBingoSessionsRepository,
  type StandaloneBingoSessionsRepository,
} from "@/lib/standaloneBingoSessionsRepo";

let cachedRepository: StandaloneBingoSessionsRepository | null = null;

export function getStandaloneBingoSessionsRepository(): StandaloneBingoSessionsRepository {
  if (cachedRepository) return cachedRepository;

  cachedRepository = isStandaloneSupabaseConfigured()
    ? new SupabaseStandaloneBingoSessionsRepository()
    : new InMemoryStandaloneBingoSessionsRepository();

  return cachedRepository;
}
