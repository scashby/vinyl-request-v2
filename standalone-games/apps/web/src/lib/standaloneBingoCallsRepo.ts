export interface CreateStandaloneBingoCallInput {
  callIndex: number;
  canonicalTrackId?: string | null;
  trackTitle: string;
  artistName: string;
}

export interface StandaloneBingoCallRecord {
  id: string;
  sessionId: string;
  callIndex: number;
  canonicalTrackId?: string | null;
  trackTitle: string;
  artistName: string;
  status: "pending" | "called" | "skipped" | "completed";
  calledAt?: string | null;
  createdAt: string;
}

export interface StandaloneBingoCallsRepository {
  listBySession(sessionId: string): Promise<StandaloneBingoCallRecord[]>;
  createMany(sessionId: string, calls: CreateStandaloneBingoCallInput[]): Promise<void>;
  getCurrentCalled(sessionId: string): Promise<StandaloneBingoCallRecord | null>;
  getNextPending(sessionId: string): Promise<StandaloneBingoCallRecord | null>;
  markCompleted(callId: string): Promise<void>;
  markCalled(callId: string, calledAt: string): Promise<StandaloneBingoCallRecord | null>;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class InMemoryStandaloneBingoCallsRepository implements StandaloneBingoCallsRepository {
  private readonly calls: StandaloneBingoCallRecord[] = [];

  async listBySession(sessionId: string): Promise<StandaloneBingoCallRecord[]> {
    return this.calls
      .filter((call) => call.sessionId === sessionId)
      .sort((a, b) => a.callIndex - b.callIndex);
  }

  async createMany(sessionId: string, calls: CreateStandaloneBingoCallInput[]): Promise<void> {
    const createdAt = new Date().toISOString();
    for (const call of calls) {
      this.calls.push({
        id: makeId(),
        sessionId,
        callIndex: call.callIndex,
        canonicalTrackId: call.canonicalTrackId ?? null,
        trackTitle: call.trackTitle,
        artistName: call.artistName,
        status: "pending",
        calledAt: null,
        createdAt,
      });
    }
  }

  async getCurrentCalled(sessionId: string): Promise<StandaloneBingoCallRecord | null> {
    return (
      [...this.calls]
        .filter((call) => call.sessionId === sessionId && call.status === "called")
        .sort((a, b) => b.callIndex - a.callIndex)[0] ?? null
    );
  }

  async getNextPending(sessionId: string): Promise<StandaloneBingoCallRecord | null> {
    return (
      [...this.calls]
        .filter((call) => call.sessionId === sessionId && call.status === "pending")
        .sort((a, b) => a.callIndex - b.callIndex)[0] ?? null
    );
  }

  async markCompleted(callId: string): Promise<void> {
    const call = this.calls.find((entry) => entry.id === callId);
    if (call) {
      call.status = "completed";
    }
  }

  async markCalled(callId: string, calledAt: string): Promise<StandaloneBingoCallRecord | null> {
    const call = this.calls.find((entry) => entry.id === callId);
    if (!call) return null;

    call.status = "called";
    call.calledAt = calledAt;
    return call;
  }
}