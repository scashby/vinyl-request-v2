"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  id: number;
  session_code: string;
  title: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  status: "pending" | "running" | "paused" | "completed";
  show_title: boolean;
  show_round: boolean;
  show_scoreboard: boolean;
  show_scoring_hint: boolean;
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  decade_start: number;
  status: "pending" | "asked" | "locked" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
};

function getStateCopy(status: Call["status"] | null): string {
  if (status === "asked") return "Listen and choose your decade card";
  if (status === "locked") return "Cards up: picks are locked";
  if (status === "revealed") return "Decade revealed";
  if (status === "scored") return "Scores updated";
  if (status === "skipped") return "Call skipped";
  return "Stand by for the next spin";
}

export default function DecadeDashJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/decade-dash/sessions/${sessionId}`),
      fetch(`/api/games/decade-dash/sessions/${sessionId}/calls`),
      fetch(`/api/games/decade-dash/sessions/${sessionId}/leaderboard`),
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
    const poll = setInterval(load, 3000);
    return () => clearInterval(poll);
  }, [load]);

  const activeCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#040404)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl rounded-3xl border border-sky-900/40 bg-black/55 p-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-sky-100">Decade Dash Jumbotron</h1>
          <Link href="/admin/games/decade-dash" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">
          Session: {session?.session_code ?? "(none selected)"} · Status: {session?.status ?? "-"}
        </p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          {session?.show_title ? (
            <p className="text-xs uppercase tracking-[0.18em] text-sky-300">{session.title}</p>
          ) : null}
          {session?.show_round ? (
            <p className="mt-2 text-4xl font-black text-sky-100">Round {session.current_round} / {session.round_count}</p>
          ) : null}
          <p className="mt-4 text-xl text-stone-100">{getStateCopy(activeCall?.status ?? null)}</p>

          <div className="mt-6 rounded-2xl border border-sky-800/50 bg-sky-950/25 p-6 text-center">
            {(activeCall?.status === "revealed" || activeCall?.status === "scored") ? (
              <>
                <p className="text-sm uppercase tracking-[0.2em] text-sky-300">Answer</p>
                <p className="mt-2 text-7xl font-black text-sky-100">{activeCall.decade_start}s</p>
              </>
            ) : (
              <>
                <p className="text-sm uppercase tracking-[0.2em] text-sky-300">Pick a Decade</p>
                <p className="mt-2 text-4xl font-black text-stone-200">1950s · 1960s · 1970s · 1980s · 1990s · 2000s · 2010s</p>
              </>
            )}
          </div>

          {session?.show_scoring_hint ? (
            <p className="mt-4 text-sm text-stone-300">
              Scoring: Exact = 2, Adjacent = 1 (if enabled), Miss = 0
            </p>
          ) : null}
        </section>

        {session?.show_scoreboard ? (
          <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">Scoreboard</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {leaderboard.slice(0, 8).map((team, index) => (
                <div key={team.team_id} className="rounded border border-stone-700 bg-black/40 p-3">
                  <p className="text-sm text-stone-400">#{index + 1}</p>
                  <p className="text-2xl font-black text-sky-100">{team.team_name}</p>
                  <p className="text-lg text-stone-200">{team.total_points} pts</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">Operator Notes</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Use this screen for public state only, not answer key prep notes.</li>
            <li>Keep decade card options visible until host reveals the answer.</li>
            <li>In solo-host mode, hold this on a separate display and drive transitions from Host.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
