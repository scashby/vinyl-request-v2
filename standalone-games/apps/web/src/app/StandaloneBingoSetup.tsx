"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  generateStandaloneCallSheetPdf,
  generateStandaloneCardsPdf,
} from "@/lib/standaloneBingoPrint";

type PlaylistRecord = {
  id: string;
  name: string;
  provider: string;
  createdAt: string;
};

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
};

type RoundPlaylistSelection = {
  round: number;
  playlistIds: string[];
};

type PlaylistChoice = {
  id: string;
  name: string;
  provider: string;
  trackCount: number;
  snapshotId: string | null;
  snapshotName: string | null;
};

const GAME_MODE_OPTIONS: Array<{ value: SessionRecord["gameMode"]; label: string }> = [
  { value: "single_line", label: "Single Line" },
  { value: "double_line", label: "Double Line" },
  { value: "triple_line", label: "Triple Line" },
  { value: "criss_cross", label: "Criss Cross" },
  { value: "four_corners", label: "Four Corners" },
  { value: "blackout", label: "Blackout" },
  { value: "death", label: "Death" },
];

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
  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [selectedTemplateSessionId, setSelectedTemplateSessionId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId);
  const [roundCount, setRoundCount] = useState(3);
  const [cardCount, setCardCount] = useState(40);
  const [gameMode, setGameMode] = useState<SessionRecord["gameMode"]>("single_line");
  const [callIntervalSeconds, setCallIntervalSeconds] = useState(45);
  const [useDifferentMastersPerRound, setUseDifferentMastersPerRound] = useState(false);
  const [roundPlaylistSelections, setRoundPlaylistSelections] = useState<RoundPlaylistSelection[]>([]);
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
  const templateSession = sessions.find((session) => session.id === selectedTemplateSessionId) ?? null;
  const currentCall = [...calls].reverse().find((call) => call.status === "called") ?? null;
  const nextCalls = calls.filter((call) => call.status === "pending").slice(0, 5);
  const snapshotByPlaylistId = useMemo(() => {
    const next = new Map<string, SnapshotRecord>();
    for (const snapshot of snapshots) {
      if (!next.has(snapshot.tenantPlaylistId)) {
        next.set(snapshot.tenantPlaylistId, snapshot);
      }
    }
    return next;
  }, [snapshots]);
  const playlistChoices = useMemo<PlaylistChoice[]>(() => {
    return playlists.map((playlist) => {
      const snapshot = snapshotByPlaylistId.get(playlist.id) ?? null;
      return {
        id: playlist.id,
        name: playlist.name,
        provider: playlist.provider,
        trackCount: snapshot ? getSnapshotItemCount(snapshot) : 0,
        snapshotId: snapshot?.id ?? null,
        snapshotName: snapshot?.snapshotName ?? null,
      };
    });
  }, [playlists, snapshotByPlaylistId]);
  const playlistChoiceById = useMemo(
    () => new Map(playlistChoices.map((choice) => [choice.id, choice])),
    [playlistChoices]
  );
  const effectiveSelectedPlaylistIds = useDifferentMastersPerRound
    ? roundPlaylistSelections.flatMap((entry) => entry.playlistIds)
    : selectedPlaylistIds;
  const selectedTrackCount = effectiveSelectedPlaylistIds.reduce(
    (sum, playlistId) => sum + (playlistChoiceById.get(playlistId)?.trackCount ?? 0),
    0
  );
  const minimumTrackCount = 75;
  const trackConfigValid = selectedTrackCount >= minimumTrackCount && effectiveSelectedPlaylistIds.length > 0;

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
      const [nextPlaylists, nextSnapshots, nextSessions] = await Promise.all([
        fetchJson<PlaylistRecord[]>("/api/v1/playlists"),
        fetchJson<SnapshotRecord[]>("/api/v1/playlists/snapshots"),
        fetchJson<SessionRecord[]>("/api/v1/games/bingo/sessions"),
      ]);

      setPlaylists(nextPlaylists);
      setSnapshots(nextSnapshots);
      setSessions(nextSessions);

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

  useEffect(() => {
    if (!templateSession) return;
    setRoundCount(templateSession.roundCount);
    setCardCount(templateSession.cardCount);
    setGameMode(templateSession.gameMode);
    setCallIntervalSeconds(templateSession.callIntervalSeconds);
  }, [templateSession]);

  useEffect(() => {
    setRoundPlaylistSelections((current) =>
      Array.from({ length: Math.max(1, roundCount) }, (_, index) => {
        const round = index + 1;
        return current.find((entry) => entry.round === round) ?? { round, playlistIds: [] };
      })
    );
  }, [roundCount]);

  function toggleMasterPlaylist(playlistId: string) {
    setSelectedPlaylistIds((current) =>
      current.includes(playlistId)
        ? current.filter((value) => value !== playlistId)
        : [...current, playlistId]
    );
  }

  function updateRoundPlaylist(round: number, playlistId: string) {
    setRoundPlaylistSelections((current) =>
      current.map((entry) =>
        entry.round === round ? { ...entry, playlistIds: playlistId ? [playlistId] : [] } : entry
      )
    );
  }

  async function handleCreateSession() {
    if (!trackConfigValid) return;
    setCreating(true);
    setError(null);
    try {
      const created = await fetchJson<SessionRecord>("/api/v1/games/bingo/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          master_playlist_ids: selectedPlaylistIds,
          round_playlist_ids: useDifferentMastersPerRound
            ? roundPlaylistSelections.map((entry) => ({
                round: entry.round,
                playlist_ids: entry.playlistIds,
              }))
            : [],
          cards_per_round_enabled: useDifferentMastersPerRound,
          round_count: roundCount,
          card_count: cardCount,
          game_mode: gameMode,
          call_interval_seconds: callIntervalSeconds,
        }),
      });
      await loadBaseData();
      setSelectedSessionId(created.id);
      await loadCalls(created.id);
      const prepQuery = new URLSearchParams({
        tenantId,
        userId,
        entitlements,
        sessionId: created.id,
      }).toString();
      window.open(`/bingo/prep?${prepQuery}`, "_blank", "noopener,noreferrer");
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
            This setup follows the original playlist-first session creation flow: choose source playlists,
            configure the game, create the session, then launch prep, host, assistant, and jumbotron views.
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
              <h2 style={panelTitleStyle}>1. Session Setup</h2>
              <button onClick={() => void loadBaseData()} disabled={loading} style={buttonStyle(false)}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={fieldLabelStyle}>Estimated # of Players</label>
                <select value={cardCount} onChange={(event) => setCardCount(Number(event.target.value))} style={fieldStyle}>
                  {[20, 30, 40, 50, 60, 75, 100].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={fieldLabelStyle}>Reuse Session Template (optional)</label>
                <select value={selectedTemplateSessionId} onChange={(event) => setSelectedTemplateSessionId(event.target.value)} style={fieldStyle}>
                  <option value="">Do not copy a session template</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>{session.sessionCode} · {session.status}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={fieldLabelStyle}>Round Count</label>
                <select value={roundCount} onChange={(event) => setRoundCount(Number(event.target.value))} style={fieldStyle}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={fieldLabelStyle}>Game Mode</label>
                <select value={gameMode} onChange={(event) => setGameMode(event.target.value as SessionRecord["gameMode"])} style={fieldStyle}>
                  {GAME_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={fieldLabelStyle}>Seconds To Next Call</label>
                <input type="number" min={1} value={callIntervalSeconds} onChange={(event) => setCallIntervalSeconds(Number(event.target.value) || 45)} style={fieldStyle} />
              </div>

              <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
                <input type="checkbox" checked={useDifferentMastersPerRound} onChange={(event) => setUseDifferentMastersPerRound(event.target.checked)} />
                Use Different Master Playlist Per Round
              </label>

              <div>
                <p style={fieldLabelStyle}>Master Playlists</p>
                <p style={helpTextStyle}>Minimum playlist size: 75 tracks. Imported snapshots drive the available track counts.</p>
                <div style={{ display: "grid", gap: 8, maxHeight: 280, overflow: "auto" }}>
                  {playlistChoices.map((playlist) => (
                    <label key={playlist.id} style={selectionCardStyle(selectedPlaylistIds.includes(playlist.id))}>
                      <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedPlaylistIds.includes(playlist.id)}
                          onChange={() => toggleMasterPlaylist(playlist.id)}
                          disabled={useDifferentMastersPerRound}
                        />
                        <span>
                          <strong>{playlist.name}</strong>
                          <span style={selectionMetaStyle}>{playlist.trackCount} tracks · {playlist.provider} · {playlist.snapshotName ?? "No snapshot"}</span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {useDifferentMastersPerRound ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {Array.from({ length: Math.max(1, roundCount) }, (_, index) => {
                    const round = index + 1;
                    const selectedValue = roundPlaylistSelections.find((entry) => entry.round === round)?.playlistIds[0] ?? "";
                    return (
                      <div key={round}>
                        <label style={fieldLabelStyle}>Round {round} Playlist</label>
                        <select value={selectedValue} onChange={(event) => updateRoundPlaylist(round, event.target.value)} style={fieldStyle}>
                          <option value="">Select playlist</option>
                          {playlistChoices.map((playlist) => (
                            <option key={playlist.id} value={playlist.id}>
                              {playlist.name} · {playlist.trackCount} tracks
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div style={{ ...selectionCardStyle(trackConfigValid), cursor: "default" }}>
                <strong>Total available tracks: {selectedTrackCount}</strong>
                <span style={selectionMetaStyle}>
                  {trackConfigValid ? "Track pool meets minimum session size." : "Select imported playlists with at least 75 total tracks."}
                </span>
              </div>
            </div>
            <button onClick={() => void handleCreateSession()} disabled={!trackConfigValid || creating} style={{ ...buttonStyle(true), marginTop: 14, width: "100%" }}>
              {creating ? "Creating Session..." : "Create Session"}
            </button>
          </section>

          <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <h2 style={panelTitleStyle}>Existing Sessions</h2>
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

const fieldLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 700,
  color: "#f0e0bf",
};

const helpTextStyle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 12,
  color: "#d9d1c3",
};

const fieldStyle: CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.22)",
  color: "#f5efe6",
  padding: "10px 12px",
  fontSize: 14,
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