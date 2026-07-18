export type BingoGameMode =
  | "single_line"
  | "double_line"
  | "triple_line"
  | "criss_cross"
  | "four_corners"
  | "blackout"
  | "death";

export interface CreateBingoSessionCommand {
  tenantId: string;
  createdByUserId: string;
  playlistSnapshotId: string;
  roundCount: number;
  cardCount: number;
  gameMode: BingoGameMode;
  callIntervalSeconds: number;
}

export interface BingoSessionRecord {
  id: string;
  tenantId: string;
  sessionCode: string;
  status: "pending" | "running" | "paused" | "completed";
  playlistSnapshotId: string;
  roundCount: number;
  cardCount: number;
  gameMode: BingoGameMode;
  callIntervalSeconds: number;
  createdByUserId?: string | null;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
}
