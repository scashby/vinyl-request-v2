export interface StandaloneBingoPresetRecord {
  id: string;
  tenantId: string;
  name: string;
  sourcePlaylistIds: string[];
  sourcePlaylistNames: string[];
  poolSize: number;
  note?: string | null;
  createdFromSessionId?: string | null;
  createdAt: string;
}

export interface CreateStandaloneBingoPresetInput {
  tenantId: string;
  name: string;
  sourcePlaylistIds: string[];
  sourcePlaylistNames: string[];
  poolSize: number;
  note?: string | null;
  createdFromSessionId?: string | null;
}

export interface StandaloneBingoPresetsRepository {
  listByTenant(tenantId: string): Promise<StandaloneBingoPresetRecord[]>;
  create(input: CreateStandaloneBingoPresetInput): Promise<StandaloneBingoPresetRecord>;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class InMemoryStandaloneBingoPresetsRepository implements StandaloneBingoPresetsRepository {
  private readonly presets: StandaloneBingoPresetRecord[] = [];

  async listByTenant(tenantId: string): Promise<StandaloneBingoPresetRecord[]> {
    return this.presets.filter((preset) => preset.tenantId === tenantId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async create(input: CreateStandaloneBingoPresetInput): Promise<StandaloneBingoPresetRecord> {
    const preset: StandaloneBingoPresetRecord = {
      id: makeId(),
      tenantId: input.tenantId,
      name: input.name,
      sourcePlaylistIds: input.sourcePlaylistIds,
      sourcePlaylistNames: input.sourcePlaylistNames,
      poolSize: input.poolSize,
      note: input.note ?? null,
      createdFromSessionId: input.createdFromSessionId ?? null,
      createdAt: new Date().toISOString(),
    };
    this.presets.push(preset);
    return preset;
  }
}
