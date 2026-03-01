"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  id: number;
  title: string;
  current_call_index: number;
  status: "pending" | "running" | "paused" | "completed";
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  artist: string;
  title: string;
  status: "pending" | "asked" | "locked" | "answer_revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  artist_hits: number;
  title_hits: number;
};

export default function NeedleDropRouletteAssistantPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/needle-drop-roulette/sessions/${sessionId}`),
      fetch(`/api/games/needle-drop-roulette/sessions/${sessionId}/calls`),
      fetch(`/api/games/needle-drop-roulette/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) setSession(await sessionRes.json());
    if (callsRes.ok) {
      const payload = await callsRes.json();
      setCalls(payload.data ?? []);
    }
    if (leaderboardRes.ok) {
      const payload = await leaderboardRes.json();
      setLeaderboard(payload.data ?? []);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 2500);
    return () => clearInterval(poll);
  }, [load]);

  const activeCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const pending = useMemo(() => calls.filter((call) => call.status === "pending").slice(0, 5), [calls]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#17100c,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl space-y-4 rounded-3xl border border-amber-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-amber-100">Needle Drop Roulette Assistant</h1>
          <Link href="/admin/games/needle-drop-roulette" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="text-sm text-stone-300">Session: {session?.title ?? "(none selected)"} · Status: {session?.status ?? "pending"}</p>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Live Call Monitor</h2>
            {activeCall ? (
              <div className="mt-2 text-sm text-stone-200">
                <p>#{activeCall.call_index} · Round {activeCall.round_number}</p>
                <p className="text-stone-400">{activeCall.artist} - {activeCall.title}</p>
                <p className="text-stone-400">Status: {activeCall.status}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-stone-400">No active call yet.</p>
            )}

            <p className="mt-3 text-xs uppercase tracking-wide text-stone-400">Next pending</p>
            <ul className="mt-1 space-y-1 text-xs text-stone-300">
              {pending.map((call) => (
                <li key={call.id}>#{call.call_index} {call.artist} - {call.title}</li>
              ))}
              {pending.length === 0 ? <li className="text-stone-500">No pending calls.</li> : null}
            </ul>
          </section>

          <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Scoreboard Snapshot</h2>
            <div className="mt-2 space-y-1 text-sm">
              {leaderboard.map((row) => (
                <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-800 bg-black/20 px-2 py-1">
                  <p>{row.team_name}</p>
                  <p className="font-semibold text-amber-200">{row.total_points} pts</p>
                </div>
              ))}
              {leaderboard.length === 0 ? <p className="text-stone-500">No scores recorded yet.</p> : null}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Assistant mode for testing: verify answer collection status and monitor leaderboard drift while host controls progression.
        </section>
      </div>
    </div>
  );
}
