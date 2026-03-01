"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildWrongLyricOptions } from "src/lib/wrongLyricChallengeEngine";

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
  show_options: boolean;
  reveal_mode: "host_reads" | "jumbotron_choices";
  option_count: number;
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  artist: string;
  title: string;
  correct_lyric: string;
  decoy_lyric_1: string;
  decoy_lyric_2: string;
  decoy_lyric_3: string | null;
  answer_slot: number;
  status: "pending" | "asked" | "locked" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
};

export default function WrongLyricChallengeJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [remaining, setRemaining] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/wrong-lyric-challenge/sessions/${sessionId}`),
      fetch(`/api/games/wrong-lyric-challenge/sessions/${sessionId}/calls`),
      fetch(`/api/games/wrong-lyric-challenge/sessions/${sessionId}/leaderboard`),
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

  const options = useMemo(() => {
    if (!currentCall || !session) return [];
    return buildWrongLyricOptions(currentCall, session.option_count);
  }, [currentCall, session]);

  const optionsVisible = useMemo(() => {
    if (!session || !session.show_options || !currentCall) return false;
    if (session.reveal_mode === "jumbotron_choices") return true;
    return currentCall.status === "revealed" || currentCall.status === "scored";
  }, [currentCall, session]);

  const promptText = useMemo(() => {
    if (!currentCall) return "Waiting for host to start the next call";
    if (currentCall.status === "pending") return "Get ready for next lyric call";
    if (currentCall.status === "asked") return "Pick the real lyric now";
    if (currentCall.status === "locked") return "Picks locked. Track reveal incoming.";
    if (currentCall.status === "revealed" || currentCall.status === "scored") {
      return `${currentCall.artist} - ${currentCall.title}`;
    }
    if (currentCall.status === "skipped") return "Call skipped by host";
    return "Stand by";
  }, [currentCall]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#7f1d1d,transparent_40%),linear-gradient(180deg,#020202,#0d0d0d)] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-red-700/40 bg-black/35 p-6">
          {session?.show_title ? <h1 className="text-5xl font-black uppercase tracking-tight text-red-100">{session?.title ?? "Wrong Lyric Challenge"}</h1> : null}

          <div className="mt-4 flex flex-wrap gap-6 text-xl font-semibold">
            {session?.show_round ? <p>Round {session?.current_round} of {session?.round_count}</p> : null}
            <p>Call {session?.current_call_index ?? 0} / {session?.round_count ?? 0}</p>
            <p>Next Gap: <span className="font-black text-red-300">{remaining}s</span></p>
            {session?.status === "paused" ? <p className="text-amber-400">Paused</p> : null}
            {session?.status === "completed" ? <p className="text-emerald-400">Completed</p> : null}
          </div>
        </header>

        <section className="rounded-3xl border border-stone-700 bg-black/45 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Current Prompt</p>
          <p className="mt-2 text-5xl font-black text-red-100">{promptText}</p>

          {optionsVisible ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {options.map((option) => {
                const reveal = currentCall?.status === "revealed" || currentCall?.status === "scored";
                return (
                  <div
                    key={option.slot}
                    className={`rounded-2xl border px-4 py-3 text-2xl font-semibold ${
                      reveal && option.is_answer
                        ? "border-emerald-500 bg-emerald-900/40 text-emerald-100"
                        : "border-stone-700 bg-stone-950/70"
                    }`}
                  >
                    <span className="mr-3 text-red-300">{option.label}.</span>
                    {option.lyric}
                  </div>
                );
              })}
            </div>
          ) : session?.show_options ? (
            <p className="mt-5 text-2xl font-semibold text-stone-300">Host is reading options aloud.</p>
          ) : null}

          {(currentCall?.status === "revealed" || currentCall?.status === "scored") ? (
            <p className="mt-5 text-2xl font-semibold text-emerald-300">Answer revealed</p>
          ) : (
            <p className="mt-5 text-2xl font-semibold text-stone-300">No answer shown until reveal</p>
          )}
        </section>

        {session?.show_scoreboard ? (
          <section className="rounded-3xl border border-stone-700 bg-black/45 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Leaderboard</p>
            <div className="mt-3 grid gap-2 text-2xl font-semibold">
              {leaderboard.slice(0, 8).map((row, index) => (
                <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-700 bg-stone-950/70 px-3 py-2">
                  <span>{index + 1}. {row.team_name}</span>
                  <span className="text-red-300">{row.total_points} pts</span>
                </div>
              ))}
              {leaderboard.length === 0 ? <p className="text-stone-400">No scores yet</p> : null}
            </div>
          </section>
        ) : null}

        <footer className="flex justify-end gap-2 text-xs text-stone-400">
          <Link href="/admin/games/wrong-lyric-challenge" className="rounded border border-stone-700 px-2 py-1">Setup</Link>
          <Link href={`/admin/games/wrong-lyric-challenge/host?sessionId=${sessionId}`} className="rounded border border-stone-700 px-2 py-1">Host</Link>
        </footer>
      </div>
    </div>
  );
}
