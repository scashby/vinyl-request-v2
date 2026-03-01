"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  id: number;
  title: string;
  session_code: string;
  status: "pending" | "running" | "paused" | "completed";
  current_round: number;
  round_count: number;
  current_call_index: number;
  stage_one_points: number;
  stage_two_points: number;
  final_reveal_points: number;
  show_title: boolean;
  show_round: boolean;
  show_scoreboard: boolean;
  show_stage_hint: boolean;
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  artist_name: string;
  clue_era: string;
  clue_collaborator: string;
  clue_label_region: string;
  status: "pending" | "stage_1" | "stage_2" | "final_reveal" | "scored" | "skipped";
  stage_revealed: number;
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
};

export default function ArtistAliasJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/artist-alias/sessions/${sessionId}`),
      fetch(`/api/games/artist-alias/sessions/${sessionId}/calls`),
      fetch(`/api/games/artist-alias/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) setSession(await sessionRes.json());
    if (callsRes.ok) {
      const payload = await callsRes.json();
      setCalls((payload.data ?? []) as Call[]);
    }
    if (leaderboardRes.ok) {
      const payload = await leaderboardRes.json();
      setLeaderboard((payload.data ?? []) as LeaderboardRow[]);
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

  const revealedStage = activeCall?.stage_revealed ?? 0;
  const showAnswer = activeCall?.status === "scored";
  const topTeams = leaderboard.slice(0, 5);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,#31123e,transparent_40%),linear-gradient(180deg,#08080a,#020202)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl rounded-3xl border border-violet-900/40 bg-black/55 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-violet-100">Artist Alias Jumbotron</h1>
          <Link href="/admin/games/artist-alias" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {session?.session_code ?? (Number.isFinite(sessionId) ? sessionId : "(none selected)")} · Status: {session?.status ?? "-"}</p>

        <section className="mt-6 rounded-xl border border-violet-700/50 bg-stone-950/70 p-6">
          {session?.show_title ? <h2 className="text-4xl font-black text-violet-100">{session.title}</h2> : null}
          {session?.show_round ? (
            <p className="mt-2 text-sm uppercase tracking-[0.2em] text-violet-300">
              Round {session.current_round} / {session.round_count}
            </p>
          ) : null}

          <div className="mt-5 rounded-2xl border border-stone-700 bg-black/50 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-violet-300">
              {activeCall ? `Card ${activeCall.call_index}` : "Waiting for host"}
            </p>
            <p className="mt-2 text-3xl font-black text-stone-100">
              {showAnswer ? activeCall?.artist_name : "Identify the artist"}
            </p>

            {session?.show_stage_hint ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase">
                <span className={`rounded border px-2 py-1 ${revealedStage >= 1 ? "border-violet-400 text-violet-200" : "border-stone-700 text-stone-500"}`}>Stage 1 · {session.stage_one_points} pts</span>
                <span className={`rounded border px-2 py-1 ${revealedStage >= 2 ? "border-indigo-400 text-indigo-200" : "border-stone-700 text-stone-500"}`}>Stage 2 · {session.stage_two_points} pts</span>
                <span className={`rounded border px-2 py-1 ${revealedStage >= 3 ? "border-amber-400 text-amber-200" : "border-stone-700 text-stone-500"}`}>Stage 3 · {session.final_reveal_points} pts</span>
              </div>
            ) : null}

            <div className="mt-5 space-y-3 text-lg">
              <div className={`rounded border px-4 py-3 ${revealedStage >= 1 ? "border-violet-700 bg-violet-950/40 text-violet-100" : "border-stone-800 bg-stone-950/70 text-stone-500"}`}>
                Era: {revealedStage >= 1 ? activeCall?.clue_era : "Hidden"}
              </div>
              <div className={`rounded border px-4 py-3 ${revealedStage >= 2 ? "border-indigo-700 bg-indigo-950/40 text-indigo-100" : "border-stone-800 bg-stone-950/70 text-stone-500"}`}>
                Collaborator: {revealedStage >= 2 ? activeCall?.clue_collaborator : "Hidden"}
              </div>
              <div className={`rounded border px-4 py-3 ${revealedStage >= 3 ? "border-amber-700 bg-amber-950/30 text-amber-100" : "border-stone-800 bg-stone-950/70 text-stone-500"}`}>
                Label/Region: {revealedStage >= 3 ? activeCall?.clue_label_region : "Hidden"}
              </div>
            </div>
          </div>
        </section>

        {session?.show_scoreboard ? (
          <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-200">Scoreboard</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {topTeams.map((team, index) => (
                <div key={team.team_id} className="flex items-center justify-between rounded border border-stone-800 bg-black/45 px-3 py-2">
                  <p className="text-sm"><span className="text-violet-300">#{index + 1}</span> {team.team_name}</p>
                  <p className="text-sm font-black text-violet-200">{team.total_points}</p>
                </div>
              ))}
              {topTeams.length === 0 ? <p className="text-sm text-stone-500">No team scores yet.</p> : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
