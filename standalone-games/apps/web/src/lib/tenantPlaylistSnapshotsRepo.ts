export interface TenantPlaylistSnapshotRecord {
  id: string;
  tenantId: string;
  tenantPlaylistId: string;
  snapshotName?: string | null;
  snapshotPayload: unknown;
  createdByUserId?: string | null;
  createdAt: string;
}

export interface CreateTenantPlaylistSnapshotInput {
  tenantId: string;
  tenantPlaylistId: string;
  snapshotName?: string | null;
  snapshotPayload: unknown;
  createdByUserId?: string | null;
}

export interface TenantPlaylistSnapshotsRepository {
  listByTenant(tenantId: string): Promise<TenantPlaylistSnapshotRecord[]>;
  create(input: CreateTenantPlaylistSnapshotInput): Promise<TenantPlaylistSnapshotRecord>;
  existsForTenant(tenantId: string, snapshotId: string): Promise<boolean>;
  getById(tenantId: string, snapshotId: string): Promise<TenantPlaylistSnapshotRecord | null>;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class InMemoryTenantPlaylistSnapshotsRepository implements TenantPlaylistSnapshotsRepository {
  private readonly snapshots: TenantPlaylistSnapshotRecord[] = [];

  async listByTenant(tenantId: string): Promise<TenantPlaylistSnapshotRecord[]> {
    return this.snapshots
      .filter((snapshot) => snapshot.tenantId === tenantId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async create(input: CreateTenantPlaylistSnapshotInput): Promise<TenantPlaylistSnapshotRecord> {
    const snapshot: TenantPlaylistSnapshotRecord = {
      id: makeId(),
      tenantId: input.tenantId,
      tenantPlaylistId: input.tenantPlaylistId,
      snapshotName: input.snapshotName ?? null,
      snapshotPayload: input.snapshotPayload,
      createdByUserId: input.createdByUserId ?? null,
      createdAt: new Date().toISOString(),
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  async existsForTenant(tenantId: string, snapshotId: string): Promise<boolean> {
    return this.snapshots.some(
      (snapshot) => snapshot.tenantId === tenantId && snapshot.id === snapshotId
    );
  }

  async getById(tenantId: string, snapshotId: string): Promise<TenantPlaylistSnapshotRecord | null> {
    return (
      this.snapshots.find(
        (snapshot) => snapshot.tenantId === tenantId && snapshot.id === snapshotId
      ) ?? null
    );
  }
}
