"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  generateStandaloneCallSheetPdf,
  generateStandaloneCardsPdf,
} from "@/lib/standaloneBingoPrint";

type SnapshotRecord = {
  id: string;
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
};

type CallRecord = {
  id: string;
  callIndex: number;
  trackTitle: string;
  artistName: string;
  status: "pending" | "called" | "skipped" | "completed";
};

type CardRecord = {
  id: string;
  cardIndex: number;
  cardIdentifier: string;
  grid: Array<{
    row: number;
    col: number;
    track_title: string;
    artist_name: string;
    free: boolean;
  }>;
};

type StandaloneBingoSetupProps = {
  tenantId: string;
  userId: string;
  entitlements: string;
  initialSessionId: string;
};

function getSnapshotItemCount(snapshot: SnapshotRecord) {
  const directCount = Number(snapshot.snapshotPayload?.itemCount ?? 0);
  if (Number.isFinite(directCount) && directCount > 0) return directCount;
  if (Array.isArray(snapshot.snapshotPayload?.items)) return snapshot.snapshotPayload.items.length;
  return 0;
}

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function StandaloneBingoSetup({
  tenantId,
  userId,
  entitlements,
  initialSessionId,
}: StandaloneBingoSetupProps) {
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
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
  const nextCalls = calls.filter((call) => call.status === "pending").slice(0, 5);

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
    return fetchJson<CardRecord[]>(`/api/v1/games/bingo/sessions/${sessionId}/cards`);
  }

  useEffect(() => {
    void loadBaseData();
  }, [tenantId, userId, entitlements]);

  useEffect(() => {
    if (!selectedSessionId) {
      setCalls([]);
      return;
    }
    void loadCalls(selectedSessionId);
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
      await loadCalls(created.id);
      const hostQuery = new URLSearchParams({
        tenantId,
        userId,
        entitlements,
        sessionId: created.id,
      }).toString();
      window.location.href = `/bingo/host?${hostQuery}`;
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create session.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDownloadCards(layout: "2-up" | "4-up") {
    if (!selectedSession) return;
    try {
      const cards = await loadCards(selectedSession.id);
      const doc = generateStandaloneCardsPdf(selectedSession.sessionCode, cards, layout);
      doc.save(`bingo-${selectedSession.sessionCode}-cards-${layout}.pdf`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download cards PDF.");
    }
  }

  async function handleDownloadCallSheet() {
    if (!selectedSession) return;
    try {
      const sessionCalls = await fetchJson<CallRecord[]>(`/api/v1/games/bingo/sessions/${selectedSession.id}/calls`);
      const doc = generateStandaloneCallSheetPdf(selectedSession.sessionCode, sessionCalls);
      doc.save(`bingo-${selectedSession.sessionCode}-call-sheet.pdf`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download call sheet PDF.");
    }
  }

  const baseQuery = new URLSearchParams({
    tenantId,
    userId,
    entitlements,
    sessionId: selectedSessionId,
  }).toString();

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <section style={heroStyle}>
          <p style={eyebrowStyle}>Standalone Vinyl Music Bingo</p>
          <h1 style={{ margin: "10px 0 12px", fontSize: 42 }}>Game Setup</h1>
          <p style={{ margin: 0, maxWidth: 860, color: "#d9d1c3", lineHeight: 1.5 }}>
            This is the standalone setup-first entry page. Use it to choose an imported snapshot,
            create a playable session, then launch the host and jumbotron screens for live testing.
          </p>
          <div style={{ marginTop: 16 }}>
            <a href={`/bingo/history?tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}&entitlements=${encodeURIComponent(entitlements)}`} style={linkButtonStyle(false)}>
              Open History
            </a>
          </div>
          {error ? <div style={errorStyle}>{error}</div> : null}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)", gap: 20 }}>
          <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <h2 style={panelTitleStyle}>Snapshots</h2>
              <button onClick={() => void loadBaseData()} disabled={loading} style={buttonStyle(false)}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {snapshots.map((snapshot) => (
                <button
                  key={snapshot.id}
                  onClick={() => setSelectedSnapshotId(snapshot.id)}
                  style={selectionCardStyle(snapshot.id === selectedSnapshotId)}
                >
                  <strong>{snapshot.snapshotName || snapshot.snapshotPayload?.playlistName || "Unnamed snapshot"}</strong>
                  <span style={selectionMetaStyle}>{getSnapshotItemCount(snapshot)} tracks · {formatTimestamp(snapshot.createdAt)}</span>
                </button>
              ))}
            </div>
            <button onClick={() => void handleCreateSession()} disabled={!selectedSnapshotId || creating} style={{ ...buttonStyle(true), marginTop: 14, width: "100%" }}>
              {creating ? "Creating Session..." : "Create Bingo Session"}
            </button>
          </section>

          <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <h2 style={panelTitleStyle}>Sessions</h2>
            </div>
            <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  style={selectionCardStyle(session.id === selectedSessionId)}
                >
                  <strong>{session.sessionCode} · {session.status}</strong>
                  <span style={selectionMetaStyle}>{session.gameMode} · {session.cardCount} cards · {formatTimestamp(session.createdAt)}</span>
                </button>
              ))}
            </div>

            {selectedSession ? (
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 18, background: "rgba(0,0,0,0.18)" }}>
                  <p style={eyebrowStyle}>Selected Session</p>
                  <h3 style={{ margin: "8px 0 6px", fontSize: 28 }}>{selectedSession.sessionCode}</h3>
                  <p style={{ margin: 0, color: "#d9d1c3" }}>Status: {selectedSession.status} · Started: {formatTimestamp(selectedSession.startedAt)}</p>
                  <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                    <a href={`/bingo/prep?${baseQuery}`} target="_blank" rel="noreferrer" style={linkButtonStyle(false)}>
                      Open Prep
                    </a>
                    <a href={`/bingo/host?${baseQuery}`} target="_blank" rel="noreferrer" style={linkButtonStyle(true)}>
                      Open Host
                    </a>
                    <a href={`/bingo/assistant?${baseQuery}`} target="_blank" rel="noreferrer" style={linkButtonStyle(false)}>
                      Open Assistant
                    </a>
                    <a href={`/bingo/jumbotron?${baseQuery}`} target="_blank" rel="noreferrer" style={linkButtonStyle(false)}>
                      Open Jumbotron
                    </a>
                    <button onClick={() => void handleDownloadCards("2-up")} style={buttonStyle(false)}>
                      Cards 2-up
                    </button>
                    <button onClick={() => void handleDownloadCards("4-up")} style={buttonStyle(false)}>
                      Cards 4-up
                    </button>
                    <button onClick={() => void handleDownloadCallSheet()} style={buttonStyle(false)}>
                      Call Sheet
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 320px)", gap: 16 }}>
                  <div style={{ borderRadius: 20, padding: 20, background: "linear-gradient(135deg, rgba(214,163,82,0.3), rgba(74,53,25,0.45))" }}>
                    <p style={eyebrowStyle}>Current Call Preview</p>
                    <h4 style={{ margin: "8px 0", fontSize: 30 }}>{currentCall ? currentCall.trackTitle : "No call revealed yet"}</h4>
                    <p style={{ margin: 0, fontSize: 20 }}>{currentCall ? currentCall.artistName : "Open Host to start the round."}</p>
                  </div>
                  <div style={{ borderRadius: 20, padding: 20, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <h4 style={{ marginTop: 0 }}>Next Up</h4>
                    <div style={{ display: "grid", gap: 8 }}>
                      {nextCalls.map((call) => (
                        <div key={call.id} style={miniCallStyle}>
                          <strong>{call.callIndex}. {call.trackTitle}</strong>
                          <span style={{ fontSize: 13, color: "#d9d1c3" }}>{call.artistName}</span>
                        </div>
                      ))}
                      {nextCalls.length === 0 ? <span style={{ color: "#d9d1c3" }}>No pending calls loaded.</span> : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 18, padding: 24, color: "#d9d1c3" }}>
                Select or create a session to launch the standalone game screens.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  color: "#f5efe6",
  background: "radial-gradient(circle at top left, #40301b 0%, #1b1712 42%, #100f0d 100%)",
  fontFamily: 'Georgia, "Times New Roman", serif',
};

const heroStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 24,
  padding: 24,
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(10px)",
  marginBottom: 20,
};

const panelStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 24,
  padding: 20,
  background: "rgba(255,255,255,0.04)",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

const panelTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 24,
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#d0b07a",
  fontSize: 12,
};

const errorStyle: CSSProperties = {
  marginTop: 16,
  border: "1px solid rgba(255,120,120,0.45)",
  background: "rgba(120,20,20,0.25)",
  color: "#ffd8d8",
  borderRadius: 14,
  padding: 14,
};

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

function linkButtonStyle(primary: boolean): CSSProperties {
  return {
    ...buttonStyle(primary),
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function selectionCardStyle(active: boolean): CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    border: active ? "1px solid rgba(214,163,82,0.75)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(214,163,82,0.16)" : "rgba(0,0,0,0.18)",
    color: "#f5efe6",
    borderRadius: 18,
    padding: 14,
    cursor: "pointer",
    display: "grid",
    gap: 6,
  };
}

const selectionMetaStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  opacity: 0.85,
};

const miniCallStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 10,
  borderRadius: 12,
  background: "rgba(255,255,255,0.04)",
};