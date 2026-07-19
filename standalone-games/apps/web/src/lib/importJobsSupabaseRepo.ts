import { getStandaloneSupabaseClient, isStandaloneSupabaseConfigured } from "@/lib/supabaseStandalone";
import {
  type CreateImportJobInput,
  type ImportJobRecord,
  type ImportJobsRepository,
} from "@/lib/importJobsRepo";

function mapRow(row: Record<string, unknown>): ImportJobRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    provider: row.provider as ImportJobRecord["provider"],
    jobType: row.job_type as ImportJobRecord["jobType"],
    status: row.status as ImportJobRecord["status"],
    requestedByUserId: String(row.requested_by_user_id),
    progressPercent: Number(row.progress_percent),
    source: (row.source_payload ?? {}) as ImportJobRecord["source"],
    summary: typeof row.summary === "string" ? row.summary : undefined,
    createdAt: String(row.created_at),
    startedAt: typeof row.started_at === "string" ? row.started_at : undefined,
    finishedAt: typeof row.finished_at === "string" ? row.finished_at : undefined,
  };
}

export class SupabaseImportJobsRepository implements ImportJobsRepository {
  async listByTenant(tenantId: string): Promise<ImportJobRecord[]> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_import_jobs")
      .select(
        "id, tenant_id, provider, job_type, status, requested_by_user_id, progress_percent, source_payload, summary, created_at, started_at, finished_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async create(input: CreateImportJobInput): Promise<ImportJobRecord> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_import_jobs")
      .insert({
        tenant_id: input.tenantId,
        requested_by_user_id: input.requestedByUserId,
        provider: input.provider,
        job_type: input.jobType,
        status: "pending",
        progress_percent: 0,
        source_payload: input.source,
        summary: "Queued",
      })
      .select(
        "id, tenant_id, provider, job_type, status, requested_by_user_id, progress_percent, source_payload, summary, created_at, started_at, finished_at"
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapRow(data as Record<string, unknown>);
  }
}

export function getImportJobsRepository(): ImportJobsRepository {
  if (isStandaloneSupabaseConfigured()) {
    return new SupabaseImportJobsRepository();
  }

  const { getImportJobsRepository: getInMemoryRepo } = require("@/lib/importJobsRepo");
  return getInMemoryRepo();
}
