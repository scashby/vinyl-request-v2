const BINGO_SESSION_SYNC_CHANNEL = "bingo-session-sync";
const BINGO_SESSION_SYNC_STORAGE_KEY = "bingo-session-sync";

type BingoSessionSyncMessage = {
  sessionId: number;
  timestamp: number;
};

function parseSyncMessage(raw: unknown): BingoSessionSyncMessage | null {
  if (!raw || typeof raw !== "object") return null;

  const payload = raw as Partial<BingoSessionSyncMessage>;
  if (!Number.isFinite(payload.sessionId)) return null;
  if (!Number.isFinite(payload.timestamp)) return null;

  return {
    sessionId: Number(payload.sessionId),
    timestamp: Number(payload.timestamp),
  };
}

export function emitBingoSessionSync(sessionId: number) {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(sessionId)) return;

  const payload: BingoSessionSyncMessage = {
    sessionId,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(BINGO_SESSION_SYNC_STORAGE_KEY, JSON.stringify(payload));
    localStorage.removeItem(BINGO_SESSION_SYNC_STORAGE_KEY);
  } catch {
    // Best-effort sync: storage may be unavailable in privacy-restricted contexts.
  }

  if (typeof BroadcastChannel === "undefined") return;

  try {
    const channel = new BroadcastChannel(BINGO_SESSION_SYNC_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  } catch {
    // Ignore channel errors and rely on poll fallback.
  }
}

export function subscribeToBingoSessionSync(onSessionChange: (sessionId: number) => void) {
  if (typeof window === "undefined") return () => undefined;

  const handleSyncPayload = (raw: unknown) => {
    const payload = parseSyncMessage(raw);
    if (!payload) return;
    onSessionChange(payload.sessionId);
  };

  let channel: BroadcastChannel | null = null;

  const onStorage = (event: StorageEvent) => {
    if (event.key !== BINGO_SESSION_SYNC_STORAGE_KEY || !event.newValue) return;
    try {
      handleSyncPayload(JSON.parse(event.newValue));
    } catch {
      // Ignore malformed payloads.
    }
  };

  const onBroadcastMessage = (event: MessageEvent) => {
    handleSyncPayload(event.data);
  };

  window.addEventListener("storage", onStorage);

  if (typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(BINGO_SESSION_SYNC_CHANNEL);
      channel.addEventListener("message", onBroadcastMessage);
    } catch {
      channel = null;
    }
  }

  return () => {
    window.removeEventListener("storage", onStorage);
    if (channel) {
      channel.removeEventListener("message", onBroadcastMessage);
      channel.close();
    }
  };
}