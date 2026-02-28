"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  title: string;
  session_code: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  lock_in_window_seconds: number;
  remaining_seconds: number;
  status: "pending" | "running" | "paused" | "completed";
  show_title: boolean;
  show_rounds: boolean;
  show_scoreboard: boolean;
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  artist_answer: string;
  title_answer: string;
  status: "pending" | "asked" | "locked" | "answer_revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
};

export default function NameThatTuneJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [remaining, setRemaining] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/name-that-tune/sessions/${sessionId}`),
      fetch(`/api/games/name-that-tune/sessions/${sessionId}/calls`),
      fetch(`/api/games/name-that-tune/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) {
      const payload = await sessionRes.json();
      setSession(payload);
      setRemaining(payload.remaining_seconds ?? 0);
    }

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
    const poll = setInterval(load, 3000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => {
      setRemaining((value) => {
        if (!session || session.status === "paused") return value;
        return Math.max(0, value - 1);
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [session]);

  const currentCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const promptText = useMemo(() => {
    if (!currentCall) return "Waiting for host to start the next snippet";
    if (currentCall.status === "asked") return "Write artist and title now";
    if (currentCall.status === "locked") return "Answers locked";
    if (currentCall.status === "answer_revealed" || currentCall.status === "scored") {
      return `${currentCall.artist_answer} - ${currentCall.title_answer}`;
    }
    if (currentCall.status === "skipped") return "Snippet skipped by host";
    return "Get ready for next snippet";
  }, [currentCall]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#5f112e,transparent_38%),linear-gradient(180deg,#020202,#0d0d0d)] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-rose-700/40 bg-black/35 p-6">
          {session?.show_title ? <h1 className="text-5xl font-black uppercase tracking-tight text-rose-200">{session?.title ?? "Name That Tune"}</h1> : null}

          <div className="mt-4 flex flex-wrap gap-6 text-xl font-semibold">
            {session?.show_rounds ? <p>Round {session?.current_round} of {session?.round_count}</p> : null}
            <p>Snippet {session?.current_call_index ?? 0} / {session?.round_count ?? 0}</p>
            <p>Next Gap: <span className="font-black text-rose-300">{remaining}s</span></p>
            {session?.status === "paused" ? <p className="text-red-400">Paused</p> : null}
          </div>
        </header>

        <section className="rounded-3xl border border-stone-700 bg-black/45 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Current Prompt</p>
          <p className="mt-2 text-5xl font-black text-rose-200">{promptText}</p>
          <p className="mt-3 text-xl text-stone-200">
            Lock-in window: {session?.lock_in_window_seconds ?? 0}s
          </p>
          {(currentCall?.status === "answer_revealed" || currentCall?.status === "scored") ? (
            <p className="mt-4 text-2xl font-semibold text-amber-300">Answer revealed</p>
          ) : (
            <p className="mt-4 text-2xl font-semibold text-stone-300">No answer shown until reveal</p>
          )}
        </section>

        {session?.show_scoreboard ? (
          <section className="rounded-3xl border border-stone-700 bg-black/45 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Leaderboard</p>
            <div className="mt-3 grid gap-2 text-2xl font-semibold">
              {leaderboard.slice(0, 6).map((row, index) => (
                <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-700 bg-stone-950/70 px-3 py-2">
                  <span>{index + 1}. {row.team_name}</span>
                  <span className="text-rose-300">{row.total_points} pts</span>
                </div>
              ))}
              {leaderboard.length === 0 ? <p className="text-stone-400">No scores yet</p> : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
