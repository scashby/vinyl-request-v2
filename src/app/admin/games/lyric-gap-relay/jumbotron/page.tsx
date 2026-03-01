"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  title: string;
  session_code: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  remaining_seconds: number;
  status: "pending" | "running" | "paused" | "completed";
  show_title: boolean;
  show_round: boolean;
  show_scoreboard: boolean;
  show_answer_mode: boolean;
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  cue_lyric: string;
  answer_lyric: string;
  status: "pending" | "asked" | "locked" | "answer_revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
};

export default function LyricGapRelayJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [remaining, setRemaining] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}`),
      fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}/calls`),
      fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}/leaderboard`),
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

  const promptState = useMemo(() => {
    if (!currentCall) return "Waiting for host to start the next lyric gap";
    if (currentCall.status === "asked") return "Write the next line now";
    if (currentCall.status === "locked") return "Answers locked";
    if (currentCall.status === "answer_revealed" || currentCall.status === "scored") {
      return "Official answer";
    }
    if (currentCall.status === "skipped") return "Gap skipped by host";
    return "Get ready for next lyric gap";
  }, [currentCall]);

  const showAnswer = currentCall?.status === "answer_revealed" || currentCall?.status === "scored";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#5f114e,transparent_38%),linear-gradient(180deg,#020202,#0d0d0d)] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-fuchsia-700/40 bg-black/35 p-6">
          {session?.show_title ? <h1 className="text-5xl font-black uppercase tracking-tight text-fuchsia-200">{session?.title ?? "Lyric Gap Relay"}</h1> : null}

          <div className="mt-4 flex flex-wrap gap-6 text-xl font-semibold">
            {session?.show_round ? <p>Round {session?.current_round} of {session?.round_count}</p> : null}
            <p>Gap {session?.current_call_index ?? 0} / {session?.round_count ?? 0}</p>
            <p>Next Reset: <span className="font-black text-fuchsia-300">{remaining}s</span></p>
            {session?.status === "paused" ? <p className="text-red-400">Paused</p> : null}
          </div>
        </header>

        <section className="rounded-3xl border border-stone-700 bg-black/45 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Prompt State</p>
          <p className="mt-2 text-5xl font-black text-fuchsia-200">{promptState}</p>
          <p className="mt-4 text-xl text-stone-200">Cue lyric:</p>
          <p className="mt-2 text-4xl font-semibold text-stone-100">{currentCall?.cue_lyric ?? "Waiting for next lyric gap"}</p>
          {showAnswer ? (
            <>
              <p className="mt-6 text-xl text-amber-300">Official line:</p>
              <p className="mt-2 text-4xl font-semibold text-amber-200">{currentCall?.answer_lyric}</p>
            </>
          ) : (
            <p className="mt-6 text-2xl font-semibold text-stone-300">Answer hidden until reveal</p>
          )}

          {session?.show_answer_mode ? (
            <p className="mt-6 text-lg text-stone-200">Scoring rubric: <span className="font-bold text-fuchsia-300">2 exact</span> · <span className="font-bold text-fuchsia-300">1 close</span> · <span className="font-bold text-fuchsia-300">0 miss</span></p>
          ) : null}
        </section>

        {session?.show_scoreboard ? (
          <section className="rounded-3xl border border-stone-700 bg-black/45 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Leaderboard</p>
            <div className="mt-3 grid gap-2 text-2xl font-semibold">
              {leaderboard.slice(0, 6).map((row, index) => (
                <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-700 bg-stone-950/70 px-3 py-2">
                  <span>{index + 1}. {row.team_name}</span>
                  <span className="text-fuchsia-300">{row.total_points} pts</span>
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
