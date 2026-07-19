import { isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";
import {
  InMemoryStandaloneBingoSessionPlaylistsRepository,
  type StandaloneBingoSessionPlaylistsRepository,
} from "@/lib/standaloneBingoSessionPlaylistsRepo";
import { SupabaseStandaloneBingoSessionPlaylistsRepository } from "@/lib/standaloneBingoSessionPlaylistsSupabaseRepo";

let cachedRepository: StandaloneBingoSessionPlaylistsRepository | null = null;

export function getStandaloneBingoSessionPlaylistsRepository(): StandaloneBingoSessionPlaylistsRepository {
  if (cachedRepository) return cachedRepository;

  cachedRepository = isStandaloneSupabaseConfigured()
    ? new SupabaseStandaloneBingoSessionPlaylistsRepository()
    : new InMemoryStandaloneBingoSessionPlaylistsRepository();

  return cachedRepository;
}
