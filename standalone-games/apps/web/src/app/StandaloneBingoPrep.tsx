"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  generateStandaloneCallSheetPdf,
  generateStandaloneCardsPdf,
} from "@/lib/standaloneBingoPrint";

type SessionRecord = {
  id: string;
  sessionCode: string;
  status: "pending" | "running" | "paused" | "completed";
  roundCount: number;
  cardCount: number;
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

type StandaloneBingoPrepProps = {
  tenantId: string;
  userId: string;
  entitlements: string;
  sessionId: string;
};

function formatBall(callIndex: number): string {
  const letters = ["B", "I", "N", "G", "O"];
  const letter = letters[(Math.max(1, callIndex) - 1) % letters.length];
  return `${letter}-${callIndex}`;
}

export default function StandaloneBingoPrep({
  tenantId,
  userId,
  entitlements,
  sessionId,
}: StandaloneBingoPrepProps) {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [addingCards, setAddingCards] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestHeaders = useMemo(
    () => ({
      "x-tenant-id": tenantId,
      "x-user-id": userId,
      "x-entitlements": entitlements,
    }),
    [entitlements, tenantId, userId]
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
    const payload = (await response.json()) as { ok?: boolean; error?: string; data?: T };
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }
    return (payload.data as T) ?? (payload as T);
  }

  async function load() {
    try {
      const [nextSession, nextCalls, nextCards] = await Promise.all([
        fetchJson<SessionRecord>(`/api/v1/games/bingo/sessions/${sessionId}`),
        fetchJson<CallRecord[]>(`/api/v1/games/bingo/sessions/${sessionId}/calls`),
        fetchJson<CardRecord[]>(`/api/v1/games/bingo/sessions/${sessionId}/cards`),
      ]);
      setSession(nextSession);
      setCalls(nextCalls);
      setCards(nextCards);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load prep data.");
    }
  }

  useEffect(() => {
    void load();
  }, [sessionId, requestHeaders]);

  async function handleAddCards() {
    const batchSize = Math.max(10, session?.cardCount ?? 40);
    setAddingCards(true);
    try {
      await fetchJson<CardRecord[]>(`/api/v1/games/bingo/sessions/${sessionId}/cards`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count: batchSize }),
      });
      await load();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to add cards.");
    } finally {
      setAddingCards(false);
    }
  }

  function handleDownloadCallSheet() {
    const doc = generateStandaloneCallSheetPdf(session?.sessionCode ?? sessionId, calls);
    doc.save(`bingo-${session?.sessionCode ?? sessionId}-call-sheet.pdf`);
  }

  function handleDownloadCards(layout: "2-up" | "4-up") {
    const doc = generateStandaloneCardsPdf(session?.sessionCode ?? sessionId, cards, layout);
    doc.save(`bingo-${session?.sessionCode ?? sessionId}-cards-${layout}.pdf`);
  }

  const params = new URLSearchParams({ tenantId, userId, entitlements, sessionId }).toString();

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
        <section style={panelStyle}>
          <p style={eyebrowStyle}>Standalone Bingo Prep</p>
          <h1 style={{ margin: "8px 0 10px", fontSize: 38 }}>Crate Pull Board</h1>
          <p style={{ margin: 0, color: "#d9d1c3" }}>
            {session?.sessionCode ?? "-"} · {session?.status ?? "loading"} · Cards {cards.length}
          </p>
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={`/?${params}`} target="_blank" rel="noreferrer" style={linkStyle}>Setup</a>
            <a href={`/bingo/host?${params}`} target="_blank" rel="noreferrer" style={linkStyle}>Host</a>
            <a href={`/bingo/assistant?${params}`} target="_blank" rel="noreferrer" style={linkStyle}>Assistant</a>
            <a href={`/bingo/jumbotron?${params}`} target="_blank" rel="noreferrer" style={linkStyle}>Jumbotron</a>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={buttonStyle} onClick={handleDownloadCallSheet}>Download Call Sheet</button>
            <button style={buttonStyle} onClick={() => handleDownloadCards("2-up")}>Cards 2-up</button>
            <button style={buttonStyle} onClick={() => handleDownloadCards("4-up")}>Cards 4-up</button>
            <button style={buttonStyle} onClick={() => void handleAddCards()} disabled={addingCards}>
              {addingCards ? "Adding Cards..." : `Add ${Math.max(10, session?.cardCount ?? 40)} Cards`}
            </button>
          </div>
          {error ? <div style={errorStyle}>{error}</div> : null}
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0, fontSize: 24 }}>Call Order</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#d9d1c3" }}>
                  <th style={tableHeadStyle}>Draw</th>
                  <th style={tableHeadStyle}>Ball</th>
                  <th style={tableHeadStyle}>Track</th>
                  <th style={tableHeadStyle}>Artist</th>
                  <th style={tableHeadStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={tableCellStyle}>{call.callIndex}</td>
                    <td style={tableCellStyle}>{formatBall(call.callIndex)}</td>
                    <td style={tableCellStyle}>{call.trackTitle}</td>
                    <td style={tableCellStyle}>{call.artistName}</td>
                    <td style={tableCellStyle}>{call.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  color: "#f5efe6",
  background: "radial-gradient(circle at top left, #2d1f1a 0%, #17110f 42%, #0f0c0b 100%)",
  fontFamily: 'Georgia, "Times New Roman", serif',
};

const panelStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 24,
  padding: 20,
  background: "rgba(255,255,255,0.04)",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#d8aa80",
  fontSize: 12,
};

const linkStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.2)",
  color: "#f5efe6",
  borderRadius: 999,
  textDecoration: "none",
  padding: "8px 12px",
  fontSize: 13,
  background: "rgba(255,255,255,0.04)",
};

const buttonStyle: CSSProperties = {
  appearance: "none",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "#f5efe6",
  borderRadius: 999,
  padding: "8px 12px",
  background: "rgba(255,255,255,0.04)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const tableHeadStyle: CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const tableCellStyle: CSSProperties = {
  padding: "10px",
  verticalAlign: "top",
};

const errorStyle: CSSProperties = {
  marginTop: 12,
  border: "1px solid rgba(255,120,120,0.45)",
  background: "rgba(120,20,20,0.25)",
  color: "#ffd8d8",
  borderRadius: 14,
  padding: 12,
};
