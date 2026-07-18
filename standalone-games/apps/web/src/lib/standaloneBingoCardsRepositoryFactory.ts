import { isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";
import { SupabaseStandaloneBingoCardsRepository } from "@/lib/standaloneBingoCardsSupabaseRepo";
import {
  InMemoryStandaloneBingoCardsRepository,
  type StandaloneBingoCardsRepository,
} from "@/lib/standaloneBingoCardsRepo";

let cachedRepository: StandaloneBingoCardsRepository | null = null;

export function getStandaloneBingoCardsRepository(): StandaloneBingoCardsRepository {
  if (cachedRepository) return cachedRepository;

  cachedRepository = isStandaloneSupabaseConfigured()
    ? new SupabaseStandaloneBingoCardsRepository()
    : new InMemoryStandaloneBingoCardsRepository();

  return cachedRepository;
}