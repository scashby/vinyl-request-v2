import { isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";
import { InMemoryStandaloneEventsRepository, type StandaloneEventsRepository } from "@/lib/standaloneEventsRepo";
import { SupabaseStandaloneEventsRepository } from "@/lib/standaloneEventsSupabaseRepo";

let cachedRepository: StandaloneEventsRepository | null = null;

export function getStandaloneEventsRepository(): StandaloneEventsRepository {
  if (cachedRepository) return cachedRepository;

  cachedRepository = isStandaloneSupabaseConfigured()
    ? new SupabaseStandaloneEventsRepository()
    : new InMemoryStandaloneEventsRepository();

  return cachedRepository;
}
