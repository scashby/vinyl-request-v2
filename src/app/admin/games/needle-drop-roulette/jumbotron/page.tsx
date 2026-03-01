"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  id: number;
  title: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  show_title: boolean;
  show_round: boolean;
  show_scoreboard: boolean;
  status: "pending" | "running" | "paused" | "completed";
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  artist: string;
  title: string;
  source_label: string | null;
  status: "pending" | "asked" | "locked" | "answer_revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
};

export default function NeedleDropRouletteJumbotronPage() {
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
    const poll = setInterval(load, 2000);
    return () => clearInterval(poll);
  }, [load]);

  const currentCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const revealAnswer = currentCall?.status === "answer_revealed" || currentCall?.status === "scored";
  const topFive = leaderboard.slice(0, 5);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_45%_0%,#6b2f00,transparent_40%),linear-gradient(180deg,#020202,#0a0a0a)] p-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6 rounded-3xl border border-orange-700/40 bg-black/40 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {session?.show_title ? <h1 className="text-5xl font-black uppercase tracking-tight text-orange-200">{session?.title ?? "Needle Drop Roulette"}</h1> : null}
            {session?.show_round ? (
              <p className="mt-2 text-xl text-stone-100">Round {session?.current_round ?? 0} of {session?.round_count ?? 0}</p>
            ) : null}
          </div>
          <p className="rounded border border-stone-700 px-3 py-1 text-xs uppercase tracking-[0.15em] text-stone-300">{session?.status ?? "pending"}</p>
        </div>

        <section className="rounded-2xl border border-stone-700 bg-stone-950/55 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-orange-300">Current Drop</p>
          <p className="mt-2 text-3xl font-black">
            {revealAnswer && currentCall ? `${currentCall.artist} - ${currentCall.title}` : "Guess Artist + Song"}
          </p>
          <p className="mt-3 text-sm text-stone-300">
            Drop #{currentCall?.call_index ?? 0} · Source: {currentCall?.source_label ?? "-"} · Status: {currentCall?.status ?? "waiting"}
          </p>
        </section>

        {session?.show_scoreboard ? (
          <section className="rounded-2xl border border-stone-700 bg-stone-950/55 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-300">Top Teams</p>
            {topFive.length === 0 ? (
              <p className="mt-2 text-sm text-stone-400">No scores yet.</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {topFive.map((row, idx) => (
                  <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-800 bg-black/30 px-3 py-2 text-lg">
                    <p>{idx + 1}. {row.team_name}</p>
                    <p className="font-black text-orange-200">{row.total_points}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <div className="flex flex-wrap gap-2 text-xs">
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/needle-drop-roulette">Setup</Link>
          <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/needle-drop-roulette/host?sessionId=${sessionId}`}>Host</Link>
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/needle-drop-roulette/history">History</Link>
        </div>
      </div>
    </div>
  );
}
