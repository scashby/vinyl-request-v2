export type BingoGameMode =
  | "single_line"
  | "double_line"
  | "triple_line"
  | "criss_cross"
  | "four_corners"
  | "blackout"
  | "death";

export interface CreateStandaloneBingoSessionInput {
  tenantId: string;
  createdByUserId: string;
  playlistSnapshotId: string;
  roundCount: number;
  cardCount: number;
  gameMode: BingoGameMode;
  callIntervalSeconds: number;
}

export interface StandaloneBingoSessionRecord {
  id: string;
  tenantId: string;
  createdByUserId: string;
  sessionCode: string;
  status: "pending" | "running" | "paused" | "completed";
  playlistSnapshotId: string;
  roundCount: number;
  cardCount: number;
  gameMode: BingoGameMode;
  callIntervalSeconds: number;
  createdAt: string;
}

export interface StandaloneBingoSessionsRepository {
  listByTenant(tenantId: string): Promise<StandaloneBingoSessionRecord[]>;
  create(input: CreateStandaloneBingoSessionInput): Promise<StandaloneBingoSessionRecord>;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function makeSessionCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export class InMemoryStandaloneBingoSessionsRepository
  implements StandaloneBingoSessionsRepository
{
  private readonly sessions: StandaloneBingoSessionRecord[] = [];

  async listByTenant(tenantId: string): Promise<StandaloneBingoSessionRecord[]> {
    return this.sessions
      .filter((session) => session.tenantId === tenantId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async create(
    input: CreateStandaloneBingoSessionInput
  ): Promise<StandaloneBingoSessionRecord> {
    const session: StandaloneBingoSessionRecord = {
      id: makeId(),
      tenantId: input.tenantId,
      createdByUserId: input.createdByUserId,
      sessionCode: makeSessionCode(),
      status: "pending",
      playlistSnapshotId: input.playlistSnapshotId,
      roundCount: input.roundCount,
      cardCount: input.cardCount,
      gameMode: input.gameMode,
      callIntervalSeconds: input.callIntervalSeconds,
      createdAt: new Date().toISOString(),
    };

    this.sessions.push(session);
    return session;
  }
}
