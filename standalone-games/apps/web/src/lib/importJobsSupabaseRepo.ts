import { getStandaloneSupabaseClient } from "@/lib/supabaseStandalone";
import {
  type CreateImportJobInput,
  type ImportJobRecord,
  type ImportJobsRepository,
  type UpdateImportJobInput,
} from "@/lib/importJobsRepo";

function parseSummary(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const maybeMessage = (value as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
  }
  return undefined;
}

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
    summary: parseSummary(row.summary),
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
        summary: { message: "Queued" },
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

  async update(
    jobId: string,
    tenantId: string,
    input: UpdateImportJobInput
  ): Promise<ImportJobRecord> {
    const updates: Record<string, unknown> = {};

    if (input.status !== undefined) {
      updates.status = input.status;
    }
    if (input.progressPercent !== undefined) {
      updates.progress_percent = Math.min(100, Math.max(0, input.progressPercent));
    }
    if (input.summary !== undefined) {
      updates.summary = { message: input.summary };
    }
    if (input.startedAt !== undefined) {
      updates.started_at = input.startedAt;
    }
    if (input.finishedAt !== undefined) {
      updates.finished_at = input.finishedAt;
    }

    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_import_jobs")
      .update(updates)
      .eq("id", jobId)
      .eq("tenant_id", tenantId)
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
