import { isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";
import { SupabaseImportJobsRepository } from "@/lib/importJobsSupabaseRepo";
import {
  InMemoryImportJobsRepository,
  type ImportJobsRepository,
} from "@/lib/importJobsRepo";

let cachedRepository: ImportJobsRepository | null = null;

export function getImportJobsRepository(): ImportJobsRepository {
  if (cachedRepository) return cachedRepository;

  cachedRepository = isStandaloneSupabaseConfigured()
    ? new SupabaseImportJobsRepository()
    : new InMemoryImportJobsRepository();

  return cachedRepository;
}
