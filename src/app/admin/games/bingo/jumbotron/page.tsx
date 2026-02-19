"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  id: number;
  session_code: string;
  status: "pending" | "active" | "paused" | "completed";
  current_call_index: number;
  round_count: number;
  current_round: number;
  seconds_to_next_call: number;
  recent_calls_limit: number;
  show_title: boolean;
  show_logo: boolean;
  show_rounds: boolean;
  show_countdown: boolean;
};

type Call = {
  id: number;
  call_index: number;
  status: "pending" | "prep_started" | "called" | "played" | "skipped" | "completed";
  column_letter: "B" | "I" | "N" | "G" | "O";
  track_title: string;
  artist_name: string;
};

export default function BingoJumbotronPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [countdown, setCountdown] = useState(45);

  const load = useCallback(async () => {
    if (!sessionId) return;
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/vb/sessions/${sessionId}`),
      fetch(`/api/vb/sessions/${sessionId}/calls`),
    ]);

    if (sRes.ok) {
      const s = await sRes.json();
      const next = s.data as Session;
      setSession(next);
      setCountdown(next.seconds_to_next_call ?? 45);
    }

    if (cRes.ok) {
      const c = await cRes.json();
      setCalls((c.data ?? []) as Call[]);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const i = setInterval(load, 2000);
    return () => clearInterval(i);
  }, [load]);

  useEffect(() => {
    if (!session || session.status !== "active") return;
    const t = setInterval(() => setCountdown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [session?.status, session?.current_call_index]);

  const current = calls.find((c) => c.call_index === (session?.current_call_index ?? 0)) ?? null;
  const recent = useMemo(() => {
    const limit = session?.recent_calls_limit ?? 5;
    return calls.filter((c) => ["played", "called", "completed"].includes(c.status)).slice(-limit).reverse();
  }, [calls, session?.recent_calls_limit]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0810] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(239,68,68,0.25),transparent_35%),radial-gradient(circle_at_80%_85%,rgba(59,130,246,0.2),transparent_30%),linear-gradient(180deg,#120b1a,#07060c)]" />
      <div className="relative z-10 flex h-full flex-col p-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(session?.show_logo ?? true) && <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 font-black">★</div>}
            {(session?.show_title ?? true) && <div className="text-3xl font-black uppercase tracking-wide">Vinyl Bingo</div>}
          </div>
          <div className="text-right text-lg">
            {(session?.show_rounds ?? true) && <p>Round {session?.current_round ?? 1} of {session?.round_count ?? 3}</p>}
            {(session?.show_countdown ?? true) && <p className="font-semibold">{session?.status === "paused" ? "Paused" : `Time Until Next Call: ${countdown}s`}</p>}
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center">
          {session?.status === "paused" ? (
            <div className="rounded-2xl border border-yellow-400/40 bg-yellow-500/10 px-10 py-8 text-6xl font-black uppercase text-yellow-300">Paused</div>
          ) : current ? (
            <div className="text-center">
              <div className="mx-auto mb-6 inline-flex rounded-2xl bg-rose-500 px-8 py-4 text-7xl font-black">{current.column_letter}</div>
              <h1 className="text-6xl font-black">{current.track_title}</h1>
              <p className="mt-3 text-3xl text-white/75">{current.artist_name}</p>
            </div>
          ) : (
            <div className="text-center text-4xl font-black">Waiting for first call</div>
          )}
        </main>

        <footer className="grid grid-cols-[1fr_auto] items-end gap-8">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-white/50">Recently Called</p>
            {recent.length === 0 ? <p className="text-sm text-white/40">No calls yet</p> : (
              <div className="space-y-1">
                {recent.map((c) => (
                  <div key={c.id} className="text-sm text-white/85">
                    <span className="mr-2 inline-block w-6 rounded bg-white/15 text-center font-bold">{c.column_letter}</span>
                    {c.track_title} <span className="text-white/60">- {c.artist_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-white/50">Session Code</p>
            <p className="text-5xl font-black tracking-[0.2em] text-rose-400">{session?.session_code ?? "----"}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
