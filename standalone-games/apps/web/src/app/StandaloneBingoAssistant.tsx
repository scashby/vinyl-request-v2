"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type SessionRecord = {
  id: string;
  sessionCode: string;
  status: "pending" | "running" | "paused" | "completed";
  currentRound?: number;
  roundCount?: number;
  callIntervalSeconds: number;
  countdownStartedAt?: string | null;
  pausedRemainingSeconds?: number | null;
};

type CallRecord = {
  id: string;
  callIndex: number;
  trackTitle: string;
  artistName: string;
  status: "pending" | "called" | "skipped" | "completed";
  calledAt?: string | null;
};

type StandaloneBingoAssistantProps = {
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

export default function StandaloneBingoAssistant({
  tenantId,
  userId,
  entitlements,
  sessionId,
}: StandaloneBingoAssistantProps) {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  const requestHeaders = useMemo(
    () => ({
      "x-tenant-id": tenantId,
      "x-user-id": userId,
      "x-entitlements": entitlements,
    }),
    [entitlements, tenantId, userId]
  );

  const currentCall = [...calls].reverse().find((call) => call.status === "called") ?? null;
  const prepRows = calls.filter((call) => call.status === "pending").slice(0, 2);
  const recentCalled = calls
    .filter((call) => call.status === "called" || call.status === "completed")
    .slice(-5)
    .reverse();

  async function fetchJson<T>(input: string): Promise<T> {
    const response = await fetch(input, {
      headers: requestHeaders,
      cache: "no-store",
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string; data?: T };
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }
    return (payload.data as T) ?? (payload as T);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [nextSession, nextCalls] = await Promise.all([
          fetchJson<SessionRecord>(`/api/v1/games/bingo/sessions/${sessionId}`),
          fetchJson<CallRecord[]>(`/api/v1/games/bingo/sessions/${sessionId}/calls`),
        ]);
        if (cancelled) return;
        setSession(nextSession);
        setCalls(nextCalls);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load assistant data.");
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 3500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [requestHeaders, sessionId]);

  useEffect(() => {
    if (!session) return;
    if (session.status === "paused") {
      setRemaining(session.pausedRemainingSeconds ?? session.callIntervalSeconds);
      return;
    }

    const referenceStartedAt = session.countdownStartedAt ?? currentCall?.calledAt;
    if (!referenceStartedAt) {
      setRemaining(session.callIntervalSeconds);
      return;
    }

    const elapsed = Math.floor((Date.now() - new Date(referenceStartedAt).getTime()) / 1000);
    setRemaining(Math.max(0, session.callIntervalSeconds - elapsed));
  }, [currentCall?.calledAt, session]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!session || session.status === "paused") return;
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [session]);

  const params = new URLSearchParams({ tenantId, userId, entitlements, sessionId }).toString();

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
        <section style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <p style={eyebrowStyle}>Standalone Bingo Sidekick</p>
              <h1 style={{ margin: "8px 0 0", fontSize: 36 }}>Assistant Board</h1>
              <p style={{ margin: "8px 0 0", color: "#d9d1c3" }}>
                {session?.sessionCode ?? "-"} · {session?.status ?? "loading"} · Round {session?.currentRound ?? 1} of {session?.roundCount ?? 1}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9ed7de" }}>
                Next Call In
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 40, fontWeight: 800, color: session?.status === "paused" ? "#f0ba66" : "#82d8e3" }}>
                {session?.status === "paused" ? "PAUSED" : `${remaining}s`}
              </p>
            </div>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={`/?${params}`} target="_blank" rel="noreferrer" style={linkStyle}>Setup</a>
            <a href={`/bingo/prep?${params}`} target="_blank" rel="noreferrer" style={linkStyle}>Prep</a>
            <a href={`/bingo/host?${params}`} target="_blank" rel="noreferrer" style={linkStyle}>Host</a>
            <a href={`/bingo/jumbotron?${params}`} target="_blank" rel="noreferrer" style={linkStyle}>Jumbotron</a>
          </div>
          {error ? <div style={errorStyle}>{error}</div> : null}
        </section>

        <section style={panelStyle}>
          <h2 style={{ margin: 0, fontSize: 24 }}>Current Call</h2>
          <div style={heroStyle}>
            <p style={eyebrowStyle}>{currentCall ? formatBall(currentCall.callIndex) : "Waiting"}</p>
            <h3 style={{ margin: "10px 0 6px", fontSize: 38 }}>{currentCall?.trackTitle ?? "Waiting for first reveal"}</h3>
            <p style={{ margin: 0, fontSize: 22, color: "#f5efe6" }}>{currentCall?.artistName ?? "Use host controls to begin"}</p>
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20 }}>
          <section style={panelStyle}>
            <h2 style={{ marginTop: 0, fontSize: 22 }}>Prep Queue</h2>
            <p style={{ marginTop: 0, color: "#d9d1c3" }}>Next two records to pull and stage.</p>
            <div style={{ display: "grid", gap: 10 }}>
              {prepRows.map((call) => (
                <div key={call.id} style={rowStyle}>
                  <strong>{formatBall(call.callIndex)} · {call.trackTitle}</strong>
                  <span style={{ color: "#d9d1c3", fontSize: 14 }}>{call.artistName}</span>
                </div>
              ))}
              {prepRows.length === 0 ? <div style={{ color: "#d9d1c3" }}>No pending prep rows.</div> : null}
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0, fontSize: 22 }}>Recent Calls</h2>
            <p style={{ marginTop: 0, color: "#d9d1c3" }}>Latest 5 called or completed rows.</p>
            <div style={{ display: "grid", gap: 10 }}>
              {recentCalled.map((call) => (
                <div key={call.id} style={rowStyle}>
                  <strong>{formatBall(call.callIndex)} · {call.trackTitle}</strong>
                  <span style={{ color: "#d9d1c3", fontSize: 14 }}>{call.artistName}</span>
                </div>
              ))}
              {recentCalled.length === 0 ? <div style={{ color: "#d9d1c3" }}>No recent calls yet.</div> : null}
            </div>
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
  background: "linear-gradient(180deg, #0f1a1d 0%, #0a0f11 100%)",
  fontFamily: 'Georgia, "Times New Roman", serif',
};

const panelStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 24,
  padding: 20,
  background: "rgba(255,255,255,0.04)",
};

const heroStyle: CSSProperties = {
  marginTop: 12,
  borderRadius: 20,
  padding: 22,
  background: "linear-gradient(135deg, rgba(47,163,187,0.35), rgba(17,56,66,0.4))",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#9ed7de",
  fontSize: 12,
};

const rowStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 12,
  background: "rgba(0,0,0,0.2)",
  display: "grid",
  gap: 6,
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

const errorStyle: CSSProperties = {
  marginTop: 12,
  border: "1px solid rgba(255,120,120,0.45)",
  background: "rgba(120,20,20,0.25)",
  color: "#ffd8d8",
  borderRadius: 14,
  padding: 12,
};
