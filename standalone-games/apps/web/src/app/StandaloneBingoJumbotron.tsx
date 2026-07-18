"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type SessionRecord = {
  id: string;
  sessionCode: string;
  status: "pending" | "running" | "paused" | "completed";
};

type CallRecord = {
  id: string;
  callIndex: number;
  trackTitle: string;
  artistName: string;
  status: "pending" | "called" | "skipped" | "completed";
};

type StandaloneBingoJumbotronProps = {
  tenantId: string;
  userId: string;
  entitlements: string;
  sessionId: string;
};

export default function StandaloneBingoJumbotron({
  tenantId,
  userId,
  entitlements,
  sessionId,
}: StandaloneBingoJumbotronProps) {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const requestHeaders = useMemo(
    () => ({
      "x-tenant-id": tenantId,
      "x-user-id": userId,
      "x-entitlements": entitlements,
    }),
    [entitlements, tenantId, userId]
  );

  const currentCall = [...calls].reverse().find((call) => call.status === "called") ?? null;
  const nextCalls = calls.filter((call) => call.status === "pending").slice(0, 6);

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
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load jumbotron data.");
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [requestHeaders, sessionId]);

  return (
    <main style={jumbotronPageStyle}>
      <div style={{ display: "grid", gap: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={jumbotronEyebrowStyle}>Standalone Vinyl Music Bingo</p>
            <h1 style={{ margin: "8px 0 0", fontSize: 42 }}>Now Playing</h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{session?.sessionCode ?? "-"}</div>
            <div style={{ color: "#d9d1c3" }}>{session?.status ?? "loading"}</div>
          </div>
        </div>

        {error ? <div style={jumbotronErrorStyle}>{error}</div> : null}

        <section style={heroCallStyle}>
          <p style={jumbotronEyebrowStyle}>Current Call</p>
          <h2 style={{ margin: "16px 0 12px", fontSize: 72, lineHeight: 1 }}>{currentCall?.trackTitle ?? "Waiting For First Call"}</h2>
          <p style={{ margin: 0, fontSize: 34 }}>{currentCall?.artistName ?? "Open the host screen to start the session."}</p>
        </section>

        <section style={upNextStyle}>
          <h3 style={{ marginTop: 0, fontSize: 28 }}>Up Next</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            {nextCalls.map((call) => (
              <div key={call.id} style={nextCardStyle}>
                <div style={{ color: "#d0b07a", fontSize: 14, marginBottom: 8 }}>#{call.callIndex}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{call.trackTitle}</div>
                <div style={{ fontSize: 18, color: "#d9d1c3", marginTop: 8 }}>{call.artistName}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

const jumbotronPageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 32,
  background: "radial-gradient(circle at top, #2a2115 0%, #13110d 45%, #090807 100%)",
  color: "#fff8ee",
  fontFamily: 'Georgia, "Times New Roman", serif',
};

const jumbotronEyebrowStyle: CSSProperties = {
  margin: 0,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "#d0b07a",
  fontSize: 14,
};

const heroCallStyle: CSSProperties = {
  borderRadius: 28,
  padding: 32,
  minHeight: 320,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  background: "linear-gradient(135deg, rgba(214,163,82,0.38), rgba(55,37,16,0.55))",
  border: "1px solid rgba(255,255,255,0.08)",
};

const upNextStyle: CSSProperties = {
  borderRadius: 24,
  padding: 24,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const nextCardStyle: CSSProperties = {
  borderRadius: 20,
  padding: 20,
  background: "rgba(0,0,0,0.22)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const jumbotronErrorStyle: CSSProperties = {
  border: "1px solid rgba(255,120,120,0.45)",
  background: "rgba(120,20,20,0.25)",
  color: "#ffd8d8",
  borderRadius: 14,
  padding: 14,
};