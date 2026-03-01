"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  title: string;
  session_code: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  points_correct_call: number;
  bonus_original_artist_points: number;
  remaining_seconds: number;
  status: "pending" | "running" | "paused" | "completed";
  show_title: boolean;
  show_round: boolean;
  show_scoreboard: boolean;
  show_prompt: boolean;
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  spin_artist: string;
  track_title: string;
  original_artist: string;
  is_cover: boolean;
  status: "pending" | "asked" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
};

export default function OriginalOrCoverJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [remaining, setRemaining] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/original-or-cover/sessions/${sessionId}`),
      fetch(`/api/games/original-or-cover/sessions/${sessionId}/calls`),
      fetch(`/api/games/original-or-cover/sessions/${sessionId}/leaderboard`),
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
    if (!currentCall) return "Waiting for host to start the next call";
    if (currentCall.status === "asked") return "ORIGINAL or COVER?";
    if (currentCall.status === "revealed" || currentCall.status === "scored") {
      return currentCall.is_cover ? "Correct Answer: COVER" : "Correct Answer: ORIGINAL";
    }
    if (currentCall.status === "skipped") return "Call skipped by host";
    return "Get ready for next call";
  }, [currentCall]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#664d03,transparent_38%),linear-gradient(180deg,#020202,#0d0d0d)] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-yellow-700/40 bg-black/35 p-6">
          {session?.show_title ? <h1 className="text-5xl font-black uppercase tracking-tight text-yellow-200">{session?.title ?? "Original or Cover"}</h1> : null}

          <div className="mt-4 flex flex-wrap gap-6 text-xl font-semibold">
            {session?.show_round ? <p>Round {session?.current_round} of {session?.round_count}</p> : null}
            <p>Call {session?.current_call_index ?? 0} / {session?.round_count ?? 0}</p>
            <p>Next Gap: <span className="font-black text-yellow-300">{remaining}s</span></p>
            {session?.status === "paused" ? <p className="text-red-400">Paused</p> : null}
          </div>
        </header>

        <section className="rounded-3xl border border-stone-700 bg-black/45 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Current Prompt</p>
          <p className="mt-2 text-6xl font-black text-yellow-200">{promptText}</p>

          {session?.show_prompt ? (
            <p className="mt-4 text-2xl text-stone-200">Write your call and original artist now</p>
          ) : null}

          {currentCall ? (
            <p className="mt-4 text-xl text-stone-300">
              Now spinning: {currentCall.spin_artist} - {currentCall.track_title}
            </p>
          ) : null}

          {(currentCall?.status === "revealed" || currentCall?.status === "scored") ? (
            <p className="mt-4 text-2xl font-semibold text-amber-300">Original artist: {currentCall.original_artist}</p>
          ) : (
            <p className="mt-4 text-2xl font-semibold text-stone-300">Original artist hidden until reveal</p>
          )}

          <p className="mt-6 text-xl text-stone-200">Scoring: +{session?.points_correct_call ?? 2} correct call, +{session?.bonus_original_artist_points ?? 1} original artist</p>
        </section>

        {session?.show_scoreboard ? (
          <section className="rounded-3xl border border-stone-700 bg-black/45 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Leaderboard</p>
            <div className="mt-3 grid gap-2 text-2xl font-semibold">
              {leaderboard.slice(0, 6).map((row, index) => (
                <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-700 bg-stone-950/70 px-3 py-2">
                  <span>{index + 1}. {row.team_name}</span>
                  <span className="text-yellow-300">{row.total_points} pts</span>
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
