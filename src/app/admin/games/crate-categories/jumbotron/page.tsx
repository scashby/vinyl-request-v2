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
  show_prompt: boolean;
  show_scoreboard: boolean;
};

type Round = {
  id: number;
  round_number: number;
  category_label: string;
  prompt_type: "identify-thread" | "odd-one-out" | "belongs-or-bust" | "decade-lock" | "mood-match";
  tracks_in_round: number;
  points_correct: number;
  points_bonus: number;
  status: "pending" | "active" | "closed";
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  track_in_round: number;
  artist: string;
  title: string;
  status: "pending" | "playing" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
};

export default function CrateCategoriesJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [session, setSession] = useState<Session | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [remaining, setRemaining] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, roundsRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/crate-categories/sessions/${sessionId}`),
      fetch(`/api/games/crate-categories/sessions/${sessionId}/rounds`),
      fetch(`/api/games/crate-categories/sessions/${sessionId}/calls`),
      fetch(`/api/games/crate-categories/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) {
      const payload = await sessionRes.json();
      setSession(payload);
      setRemaining(payload.remaining_seconds ?? 0);
    }

    if (roundsRes.ok) {
      const payload = await roundsRes.json();
      setRounds(payload.data ?? []);
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

  const currentRound = useMemo(() => {
    if (!session) return null;
    return (
      rounds.find((round) => round.round_number === session.current_round) ??
      rounds.find((round) => round.status === "active") ??
      null
    );
  }, [rounds, session]);

  const promptText = useMemo(() => {
    if (!currentCall) return "Waiting for host to start the next track";
    if (currentCall.status === "playing") return "Listen now and write your answer";
    if (currentCall.status === "revealed") return `${currentCall.artist} - ${currentCall.title}`;
    if (currentCall.status === "scored") return "Round scoring in progress";
    if (currentCall.status === "skipped") return "Track skipped, standby";
    return "Get ready for the next spin";
  }, [currentCall]);

  const trackCounter = useMemo(() => {
    if (!currentCall || !currentRound) return "Track - / -";
    return `Track ${currentCall.track_in_round} / ${currentRound.tracks_in_round}`;
  }, [currentCall, currentRound]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_55%_0%,#3c4f12,transparent_40%),linear-gradient(180deg,#030303,#0d1206)] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-lime-700/40 bg-black/35 p-6">
          {session?.show_title ? <h1 className="text-5xl font-black uppercase tracking-tight text-lime-200">{session?.title ?? "Crate Categories"}</h1> : null}

          <div className="mt-4 flex flex-wrap gap-6 text-xl font-semibold">
            {session?.show_round ? <p>Round {session?.current_round} of {session?.round_count}</p> : null}
            <p>{trackCounter}</p>
            <p>Reset Buffer: <span className="font-black text-lime-300">{remaining}s</span></p>
            {session?.status === "paused" ? <p className="text-red-400">Paused</p> : null}
          </div>
        </header>

        <section className="rounded-3xl border border-stone-700 bg-black/45 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Round Prompt</p>
          {session?.show_prompt ? (
            <>
              <p className="mt-2 text-5xl font-black text-lime-200">{currentRound?.category_label ?? "Standby"}</p>
              <p className="mt-3 text-2xl text-stone-200">Prompt type: {currentRound?.prompt_type ?? "-"}</p>
              <p className="mt-1 text-xl text-stone-300">Rubric: {currentRound?.points_correct ?? 0} base + {currentRound?.points_bonus ?? 0} bonus</p>
            </>
          ) : (
            <p className="mt-2 text-3xl font-black text-lime-200">Prompt hidden by host</p>
          )}

          <p className="mt-6 text-4xl font-black text-amber-200">{promptText}</p>
          {(currentCall?.status === "revealed" || currentCall?.status === "scored") ? (
            <p className="mt-3 text-2xl font-semibold text-amber-300">Answer shown</p>
          ) : (
            <p className="mt-3 text-2xl font-semibold text-stone-300">Answer hidden until reveal</p>
          )}
        </section>

        {session?.show_scoreboard ? (
          <section className="rounded-3xl border border-stone-700 bg-black/45 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Leaderboard</p>
            <div className="mt-3 grid gap-2 text-2xl font-semibold">
              {leaderboard.slice(0, 6).map((row, index) => (
                <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-700 bg-stone-950/70 px-3 py-2">
                  <span>{index + 1}. {row.team_name}</span>
                  <span className="text-lime-300">{row.total_points} pts</span>
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
