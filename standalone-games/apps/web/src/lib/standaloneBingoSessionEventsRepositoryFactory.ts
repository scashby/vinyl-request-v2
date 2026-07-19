import { isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";
import {
  InMemoryStandaloneBingoSessionEventsRepository,
  type StandaloneBingoSessionEventsRepository,
} from "@/lib/standaloneBingoSessionEventsRepo";
import { SupabaseStandaloneBingoSessionEventsRepository } from "@/lib/standaloneBingoSessionEventsSupabaseRepo";

let cachedRepository: StandaloneBingoSessionEventsRepository | null = null;

export function getStandaloneBingoSessionEventsRepository(): StandaloneBingoSessionEventsRepository {
  if (cachedRepository) return cachedRepository;

  cachedRepository = isStandaloneSupabaseConfigured()
    ? new SupabaseStandaloneBingoSessionEventsRepository()
    : new InMemoryStandaloneBingoSessionEventsRepository();

  return cachedRepository;
}
