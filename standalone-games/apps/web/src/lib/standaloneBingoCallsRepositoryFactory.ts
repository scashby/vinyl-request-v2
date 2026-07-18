import { isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";
import { SupabaseStandaloneBingoCallsRepository } from "@/lib/standaloneBingoCallsSupabaseRepo";
import {
  InMemoryStandaloneBingoCallsRepository,
  type StandaloneBingoCallsRepository,
} from "@/lib/standaloneBingoCallsRepo";

let cachedRepository: StandaloneBingoCallsRepository | null = null;

export function getStandaloneBingoCallsRepository(): StandaloneBingoCallsRepository {
  if (cachedRepository) return cachedRepository;

  cachedRepository = isStandaloneSupabaseConfigured()
    ? new SupabaseStandaloneBingoCallsRepository()
    : new InMemoryStandaloneBingoCallsRepository();

  return cachedRepository;
}