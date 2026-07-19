export type StandaloneBingoSessionEventType = "cue_set" | "pull_set" | "pull_promote" | "call_set";

export interface StandaloneBingoSessionEventRecord {
  id: string;
  sessionId: string;
  eventType: StandaloneBingoSessionEventType;
  payload: {
    call_id?: string;
    after_call_id?: string;
  } | null;
  createdAt: string;
}

export interface StandaloneBingoSessionEventsRepository {
  listBySession(sessionId: string): Promise<StandaloneBingoSessionEventRecord[]>;
  create(sessionId: string, eventType: StandaloneBingoSessionEventType, payload: StandaloneBingoSessionEventRecord["payload"]): Promise<void>;
  deleteBySession(sessionId: string): Promise<void>;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class InMemoryStandaloneBingoSessionEventsRepository implements StandaloneBingoSessionEventsRepository {
  private readonly rows: StandaloneBingoSessionEventRecord[] = [];

  async listBySession(sessionId: string): Promise<StandaloneBingoSessionEventRecord[]> {
    return this.rows
      .filter((row) => row.sessionId === sessionId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  async create(
    sessionId: string,
    eventType: StandaloneBingoSessionEventType,
    payload: StandaloneBingoSessionEventRecord["payload"]
  ): Promise<void> {
    this.rows.push({
      id: makeId(),
      sessionId,
      eventType,
      payload,
      createdAt: new Date().toISOString(),
    });
  }

  async deleteBySession(sessionId: string): Promise<void> {
    for (let index = this.rows.length - 1; index >= 0; index -= 1) {
      if (this.rows[index]?.sessionId === sessionId) {
        this.rows.splice(index, 1);
      }
    }
  }
}
