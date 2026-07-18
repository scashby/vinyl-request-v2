export type ImportProvider = "spotify" | "apple" | "tidal" | "csv";
export type ImportJobType = "playlist_import" | "library_import" | "manual_upload";
export type ImportJobStatus =
  | "pending"
  | "running"
  | "partial"
  | "completed"
  | "failed"
  | "cancelled";

export interface ImportJobRecord {
  id: string;
  tenantId: string;
  provider: ImportProvider;
  jobType: ImportJobType;
  status: ImportJobStatus;
  requestedByUserId: string;
  progressPercent: number;
  source: {
    providerConnectionId?: string;
    providerPlaylistId?: string;
    uploadName?: string;
  };
  summary?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface CreateImportJobInput {
  tenantId: string;
  requestedByUserId: string;
  provider: ImportProvider;
  jobType: ImportJobType;
  source: {
    providerConnectionId?: string;
    providerPlaylistId?: string;
    uploadName?: string;
  };
}

export interface ImportJobsRepository {
  listByTenant(tenantId: string): Promise<ImportJobRecord[]>;
  create(input: CreateImportJobInput): Promise<ImportJobRecord>;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class InMemoryImportJobsRepository implements ImportJobsRepository {
  private readonly jobs: ImportJobRecord[] = [];

  async listByTenant(tenantId: string): Promise<ImportJobRecord[]> {
    return this.jobs
      .filter((job) => job.tenantId === tenantId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async create(input: CreateImportJobInput): Promise<ImportJobRecord> {
    const now = new Date().toISOString();
    const job: ImportJobRecord = {
      id: makeId(),
      tenantId: input.tenantId,
      provider: input.provider,
      jobType: input.jobType,
      status: "pending",
      requestedByUserId: input.requestedByUserId,
      progressPercent: 0,
      source: input.source,
      summary: "Queued",
      createdAt: now,
    };

    this.jobs.push(job);
    return job;
  }
}
