"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type SessionRecord = {
  id: string;
  sessionCode: string;
  status: "pending" | "running" | "paused" | "completed";
  cardCount: number;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
};

type CallRecord = {
  id: string;
  status: "pending" | "called" | "skipped" | "completed";
};

type HistoryRow = SessionRecord & {
  callsPlayed: number;
};

type StandaloneBingoHistoryProps = {
  tenantId: string;
  userId: string;
  entitlements: string;
};

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function StandaloneBingoHistory({
  tenantId,
  userId,
  entitlements,
}: StandaloneBingoHistoryProps) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestHeaders = useMemo(
    () => ({
      "x-tenant-id": tenantId,
      "x-user-id": userId,
      "x-entitlements": entitlements,
    }),
    [entitlements, tenantId, userId]
  );

  async function fetchJson<T>(input: string): Promise<T> {
    const response = await fetch(input, { headers: requestHeaders, cache: "no-store" });
    const payload = (await response.json()) as { ok?: boolean; error?: string; data?: T };
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }
    return (payload.data as T) ?? (payload as T);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const sessions = await fetchJson<SessionRecord[]>("/api/v1/games/bingo/sessions");
        const withCounts = await Promise.all(
          sessions.map(async (session) => {
            const calls = await fetchJson<CallRecord[]>(`/api/v1/games/bingo/sessions/${session.id}/calls`);
            return {
              ...session,
              callsPlayed: calls.filter((call) => call.status === "called" || call.status === "completed").length,
            };
          })
        );
        if (cancelled) return;
        setRows(withCounts);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load bingo history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [requestHeaders]);

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 20 }}>
        <section style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <p style={eyebrowStyle}>Standalone Bingo</p>
              <h1 style={{ margin: "8px 0 0", fontSize: 36 }}>History</h1>
            </div>
            <a href={`/?tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}&entitlements=${encodeURIComponent(entitlements)}`} style={linkStyle}>
              Back to Setup
            </a>
          </div>
          {error ? <div style={errorStyle}>{error}</div> : null}
          {loading ? <p style={{ color: "#d9d1c3" }}>Loading history…</p> : null}
        </section>

        <section style={panelStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#d9d1c3" }}>
                <th style={headStyle}>Session</th>
                <th style={headStyle}>Status</th>
                <th style={headStyle}>Cards</th>
                <th style={headStyle}>Calls Played</th>
                <th style={headStyle}>Created</th>
                <th style={headStyle}>Started</th>
                <th style={headStyle}>Ended</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <td style={cellStyle}>{row.sessionCode}</td>
                  <td style={cellStyle}>{row.status}</td>
                  <td style={cellStyle}>{row.cardCount}</td>
                  <td style={cellStyle}>{row.callsPlayed}</td>
                  <td style={cellStyle}>{formatTimestamp(row.createdAt)}</td>
                  <td style={cellStyle}>{formatTimestamp(row.startedAt)}</td>
                  <td style={cellStyle}>{formatTimestamp(row.endedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  color: "#f5efe6",
  background: "radial-gradient(circle at top left, #20170f 0%, #110d0b 55%, #0b0908 100%)",
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
  color: "#d0b07a",
  fontSize: 12,
};

const linkStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 999,
  padding: "8px 12px",
  color: "#f5efe6",
  textDecoration: "none",
  fontSize: 13,
  background: "rgba(255,255,255,0.04)",
};

const headStyle: CSSProperties = {
  padding: "10px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const cellStyle: CSSProperties = {
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
