"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type SnapshotRecord = {
  id: string;
  tenantPlaylistId: string;
  snapshotName?: string | null;
  createdAt: string;
  snapshotPayload?: {
    itemCount?: number;
    playlistName?: string;
    items?: Array<unknown>;
  } | null;
};

type SessionRecord = {
  id: string;
  sessionCode: string;
  status: "pending" | "running" | "paused" | "completed";
  playlistSnapshotId: string;
  roundCount: number;
  cardCount: number;
  gameMode: string;
  callIntervalSeconds: number;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
};

type CallRecord = {
  id: string;
  callIndex: number;
  trackTitle: string;
  artistName: string;
  status: "pending" | "called" | "skipped" | "completed";
  calledAt?: string | null;
};

type CardRecord = {
  id: string;
  cardIndex: number;
  cardIdentifier: string;
  createdAt: string;
};

type CardValidationResponse = {
  card_identifier: string;
  is_winner: boolean;
  active_modes: string[];
  winning_patterns: Array<{ mode: string; label: string }>;
  mistakes: Array<{ mode: string; message: string; missing_cells: Array<{ label: string }> }>;
  marked_square_count: number;
  playable_square_count: number;
};

type StandaloneBingoHomeProps = {
  tenantId: string;
  userId: string;
  entitlements: string;
  initialSessionId: string;
};

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getSnapshotItemCount(snapshot: SnapshotRecord) {
  const directCount = Number(snapshot.snapshotPayload?.itemCount ?? 0);
  if (Number.isFinite(directCount) && directCount > 0) return directCount;
  if (Array.isArray(snapshot.snapshotPayload?.items)) {
    return snapshot.snapshotPayload.items.length;
  }
  return 0;
}

export default function StandaloneBingoHome({
  tenantId,
  userId,
  entitlements,
  initialSessionId,
}: StandaloneBingoHomeProps) {
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [winnerCheckInput, setWinnerCheckInput] = useState("");
  const [winnerCheckResult, setWinnerCheckResult] = useState<CardValidationResponse | null>(null);
  const [winnerCheckError, setWinnerCheckError] = useState<string | null>(null);
  const [checkingWinner, setCheckingWinner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestHeaders = useMemo(
    () => ({
      "x-tenant-id": tenantId,
      "x-user-id": userId,
      "x-entitlements": entitlements,
    }),
    [entitlements, tenantId, userId]
  );

  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null;
  const currentCall = [...calls].reverse().find((call) => call.status === "called") ?? null;
  const pendingCalls = calls.filter((call) => call.status === "pending");
  const completedCalls = calls.filter(
    (call) => call.status === "completed" || call.status === "called"
  );

  async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...requestHeaders,
      },
      cache: "no-store",
    });

    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      data?: T;
    };

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }

    return (payload.data as T) ?? (payload as T);
  }

  async function loadBaseData() {
    setLoading(true);
    setError(null);
    try {
      const [nextSnapshots, nextSessions] = await Promise.all([
        fetchJson<SnapshotRecord[]>("/api/v1/playlists/snapshots"),
        fetchJson<SessionRecord[]>("/api/v1/games/bingo/sessions"),
      ]);

      setSnapshots(nextSnapshots);
      setSessions(nextSessions);

      if (!selectedSnapshotId && nextSnapshots.length > 0) {
        setSelectedSnapshotId(nextSnapshots[0]!.id);
      }

      if (!selectedSessionId && nextSessions.length > 0) {
        setSelectedSessionId(nextSessions[0]!.id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load standalone data.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCalls(sessionId: string) {
    try {
      const nextCalls = await fetchJson<CallRecord[]>(
        `/api/v1/games/bingo/sessions/${sessionId}/calls`
      );
      setCalls(nextCalls);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load calls.");
    }
  }

  async function loadCards(sessionId: string) {
    try {
      const nextCards = await fetchJson<CardRecord[]>(
        `/api/v1/games/bingo/sessions/${sessionId}/cards`
      );
      setCards(nextCards);
      if (nextCards.length > 0 && !winnerCheckInput) {
        setWinnerCheckInput(nextCards[0]!.cardIdentifier);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load cards.");
    }
  }

  useEffect(() => {
    void loadBaseData();
  }, [tenantId, userId, entitlements]);

  useEffect(() => {
    if (!selectedSessionId) {
      setCalls([]);
      setCards([]);
      setWinnerCheckInput("");
      setWinnerCheckResult(null);
      setWinnerCheckError(null);
      return;
    }

    void loadCalls(selectedSessionId);
    void loadCards(selectedSessionId);
    const timer = window.setInterval(() => {
      void loadCalls(selectedSessionId);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [selectedSessionId]);

  async function handleCreateSession() {
    if (!selectedSnapshotId) return;
    setCreating(true);
    setError(null);
    try {
      const created = await fetchJson<SessionRecord>("/api/v1/games/bingo/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playlistSnapshotId: selectedSnapshotId,
          roundCount: 3,
          cardCount: 40,
          gameMode: "single_line",
          callIntervalSeconds: 45,
        }),
      });
      await loadBaseData();
      setSelectedSessionId(created.id);
      await Promise.all([loadCalls(created.id), loadCards(created.id)]);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create session.");
    } finally {
      setCreating(false);
    }
  }

  async function handleAdvance() {
    if (!selectedSessionId) return;
    setAdvancing(true);
    setError(null);
    try {
      await fetchJson<{ session: SessionRecord; call: CallRecord }>(
        `/api/v1/games/bingo/sessions/${selectedSessionId}/advance`,
        { method: "POST" }
      );
      await Promise.all([loadBaseData(), loadCalls(selectedSessionId)]);
    } catch (advanceError) {
      setError(advanceError instanceof Error ? advanceError.message : "Failed to advance call.");
      await Promise.all([loadBaseData(), loadCalls(selectedSessionId)]);
    } finally {
      setAdvancing(false);
    }
  }

  async function handleWinnerCheck() {
    if (!selectedSessionId) return;
    const cardIdentifier = winnerCheckInput.trim().toUpperCase();
    if (!cardIdentifier) return;

    setCheckingWinner(true);
    setWinnerCheckError(null);
    try {
      const result = await fetchJson<CardValidationResponse>(
        `/api/v1/games/bingo/cards/validate?sessionId=${encodeURIComponent(
          selectedSessionId
        )}&cardIdentifier=${encodeURIComponent(cardIdentifier)}`
      );
      setWinnerCheckResult(result);
    } catch (checkError) {
      setWinnerCheckResult(null);
      setWinnerCheckError(
        checkError instanceof Error ? checkError.message : "Failed to validate card."
      );
    } finally {
      setCheckingWinner(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        color: "#f5efe6",
        background:
          "radial-gradient(circle at top left, #40301b 0%, #1b1712 42%, #100f0d 100%)",
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <section style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 24, padding: 24, background: "rgba(255,255,255,0.04)", backdropFilter: "blur(10px)", marginBottom: 20 }}>
          <p style={{ margin: 0, letterSpacing: "0.2em", textTransform: "uppercase", color: "#d0b07a", fontSize: 12 }}>Standalone Bingo Test Surface</p>
          <h1 style={{ margin: "8px 0 12px", fontSize: 40 }}>Bingo Host</h1>
          <p style={{ margin: 0, color: "#d9d1c3", maxWidth: 820, lineHeight: 1.5 }}>
            This page drives the standalone Bingo flow directly against the new tenant-scoped APIs.
            It loads imported snapshots, creates playable Bingo sessions, and advances live calls in browser.
          </p>
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13 }}>
            <span>Tenant: {tenantId}</span>
            <span>User: {userId}</span>
            <span>Entitlements: {entitlements}</span>
          </div>
          {error ? <div style={{ marginTop: 16, border: "1px solid rgba(255,120,120,0.45)", background: "rgba(120,20,20,0.25)", color: "#ffd8d8", borderRadius: 14, padding: 14 }}>{error}</div> : null}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)", gap: 20 }}>
          <section style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 24, padding: 20, background: "rgba(255,255,255,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 24 }}>Snapshots</h2>
              <button onClick={() => void loadBaseData()} disabled={loading} style={buttonStyle(false)}>{loading ? "Refreshing..." : "Refresh"}</button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {snapshots.map((snapshot) => {
                const isSelected = snapshot.id === selectedSnapshotId;
                return (
                  <button key={snapshot.id} onClick={() => setSelectedSnapshotId(snapshot.id)} style={snapshotButtonStyle(isSelected)}>
                    <strong style={{ display: "block", fontSize: 16 }}>{snapshot.snapshotName || snapshot.snapshotPayload?.playlistName || "Unnamed snapshot"}</strong>
                    <span style={{ display: "block", marginTop: 6, fontSize: 12, opacity: 0.85 }}>{getSnapshotItemCount(snapshot)} tracks · {formatTimestamp(snapshot.createdAt)}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => void handleCreateSession()} disabled={!selectedSnapshotId || creating} style={{ ...buttonStyle(true), marginTop: 14, width: "100%" }}>{creating ? "Creating Session..." : "Create Bingo Session From Selected Snapshot"}</button>

            <h2 style={{ margin: "24px 0 12px", fontSize: 24 }}>Sessions</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {sessions.map((session) => {
                const isSelected = session.id === selectedSessionId;
                return (
                  <button key={session.id} onClick={() => setSelectedSessionId(session.id)} style={snapshotButtonStyle(isSelected)}>
                    <strong style={{ display: "block", fontSize: 16 }}>{session.sessionCode} · {session.status}</strong>
                    <span style={{ display: "block", marginTop: 6, fontSize: 12, opacity: 0.85 }}>{session.gameMode} · {session.cardCount} cards · {formatTimestamp(session.createdAt)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 24, padding: 20, background: "rgba(255,255,255,0.04)" }}>
            {selectedSession ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#d0b07a" }}>Live Session</p>
                    <h2 style={{ margin: "8px 0 0", fontSize: 32 }}>{selectedSession.sessionCode}</h2>
                    <p style={{ margin: "8px 0 0", color: "#d9d1c3" }}>Status: {selectedSession.status} · Started: {formatTimestamp(selectedSession.startedAt)}</p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => void loadCalls(selectedSession.id)} style={buttonStyle(false)}>Refresh Calls</button>
                    <button onClick={() => void handleAdvance()} disabled={advancing} style={buttonStyle(true)}>{advancing ? "Advancing..." : currentCall ? "Call Next Track" : "Start Game"}</button>
                  </div>
                </div>

                <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 420px)", gap: 16 }}>
                  <div style={{ borderRadius: 24, padding: 24, background: "linear-gradient(135deg, rgba(214,163,82,0.3), rgba(74,53,25,0.45))", minHeight: 220 }}>
                    <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#f2d29b" }}>Current Call</p>
                    <h3 style={{ margin: "12px 0 8px", fontSize: 42, lineHeight: 1.05 }}>{currentCall ? currentCall.trackTitle : "Ready to start"}</h3>
                    <p style={{ margin: 0, fontSize: 22, color: "#f5efe6" }}>{currentCall ? currentCall.artistName : "Press Start Game to reveal the first track."}</p>
                    {currentCall ? <p style={{ marginTop: 14, fontSize: 13, color: "#f0e0bf" }}>Call {currentCall.callIndex} of {calls.length}</p> : null}
                  </div>

                  <div style={{ borderRadius: 24, padding: 20, background: "rgba(0,0,0,0.24)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <h3 style={{ marginTop: 0, fontSize: 20 }}>Next Up</h3>
                    <div style={{ display: "grid", gap: 10 }}>
                      {pendingCalls.slice(0, 8).map((call) => (
                        <div key={call.id} style={callRowStyle}>
                          <strong>{call.callIndex}. {call.trackTitle}</strong>
                          <span style={{ fontSize: 13, color: "#d9d1c3" }}>{call.artistName}</span>
                        </div>
                      ))}
                      {pendingCalls.length === 0 ? <p style={{ margin: 0 }}>No pending calls remaining.</p> : null}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 20 }}>Call Sheet</h3>
                  <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden", background: "rgba(0,0,0,0.2)" }}>
                    {calls.map((call) => (
                      <div key={call.id} style={{ display: "grid", gridTemplateColumns: "80px minmax(0, 1fr) 160px", gap: 12, alignItems: "center", padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", background: call.status === "called" ? "rgba(214,163,82,0.18)" : call.status === "completed" ? "rgba(255,255,255,0.05)" : "transparent" }}>
                        <strong>#{call.callIndex}</strong>
                        <div>
                          <div>{call.trackTitle}</div>
                          <div style={{ fontSize: 13, color: "#d9d1c3" }}>{call.artistName}</div>
                        </div>
                        <div style={{ textTransform: "capitalize", fontSize: 13, color: "#d9d1c3" }}>{call.status}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#d9d1c3" }}>Completed or live calls: {completedCalls.length} · Remaining: {pendingCalls.length}</p>
                </div>

                <div style={{ marginTop: 20, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, background: "rgba(0,0,0,0.2)", padding: 16 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 20 }}>Winner Check</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10 }}>
                    <input
                      value={winnerCheckInput}
                      onChange={(event) => setWinnerCheckInput(event.target.value)}
                      placeholder="Enter card identifier"
                      style={{
                        width: "100%",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.16)",
                        background: "rgba(255,255,255,0.03)",
                        color: "#f5efe6",
                        padding: "10px 12px",
                        fontSize: 14,
                      }}
                    />
                    <button onClick={() => void handleWinnerCheck()} disabled={checkingWinner} style={buttonStyle(true)}>
                      {checkingWinner ? "Checking..." : "Validate"}
                    </button>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 13, color: "#d9d1c3" }}>
                      Cards generated: {cards.length}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {cards.slice(0, 20).map((card) => (
                        <button
                          key={card.id}
                          onClick={() => setWinnerCheckInput(card.cardIdentifier)}
                          style={{
                            ...buttonStyle(false),
                            padding: "6px 10px",
                            fontSize: 12,
                            borderRadius: 10,
                          }}
                        >
                          {card.cardIdentifier}
                        </button>
                      ))}
                    </div>
                  </div>

                  {winnerCheckError ? (
                    <div style={{ marginTop: 12, color: "#ffd8d8", border: "1px solid rgba(255,120,120,0.45)", borderRadius: 12, padding: 10, background: "rgba(120,20,20,0.22)" }}>
                      {winnerCheckError}
                    </div>
                  ) : null}

                  {winnerCheckResult ? (
                    <div style={{
                      marginTop: 12,
                      border: winnerCheckResult.is_winner
                        ? "1px solid rgba(82,214,145,0.7)"
                        : "1px solid rgba(214,163,82,0.7)",
                      borderRadius: 12,
                      padding: 12,
                      background: winnerCheckResult.is_winner
                        ? "rgba(24,83,58,0.35)"
                        : "rgba(83,58,24,0.35)",
                    }}>
                      <strong>
                        {winnerCheckResult.card_identifier} · {winnerCheckResult.is_winner ? "Winner" : "Not Yet Winning"}
                      </strong>
                      <div style={{ marginTop: 6, fontSize: 13, color: "#d9d1c3" }}>
                        Marked: {winnerCheckResult.marked_square_count} / {winnerCheckResult.playable_square_count + 1}
                      </div>
                      {winnerCheckResult.winning_patterns.length > 0 ? (
                        <div style={{ marginTop: 6, fontSize: 13, color: "#f3e5cb" }}>
                          {winnerCheckResult.winning_patterns
                            .map((pattern) => `${pattern.mode.replace("_", " ")}: ${pattern.label}`)
                            .join(" | ")}
                        </div>
                      ) : null}
                      {winnerCheckResult.mistakes.length > 0 ? (
                        <div style={{ marginTop: 6, fontSize: 13, color: "#f3e5cb" }}>
                          {winnerCheckResult.mistakes
                            .slice(0, 2)
                            .map((mistake) => mistake.message)
                            .join(" | ")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div style={{ padding: 40, textAlign: "center" }}>
                <h2 style={{ marginTop: 0 }}>No Session Selected</h2>
                <p style={{ color: "#d9d1c3" }}>Pick a snapshot and create a session, or select an existing session from the left.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function buttonStyle(primary: boolean): CSSProperties {
  return {
    appearance: "none",
    border: primary ? "1px solid rgba(208,176,122,0.65)" : "1px solid rgba(255,255,255,0.16)",
    borderRadius: 999,
    background: primary ? "#d6a352" : "rgba(255,255,255,0.04)",
    color: primary ? "#20160c" : "#f5efe6",
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function snapshotButtonStyle(active: boolean): CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    border: active ? "1px solid rgba(214,163,82,0.75)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(214,163,82,0.16)" : "rgba(0,0,0,0.18)",
    color: "#f5efe6",
    borderRadius: 18,
    padding: 14,
    cursor: "pointer",
  };
}

const callRowStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 12,
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
};