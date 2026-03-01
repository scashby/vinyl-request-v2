"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  title: string;
  session_code: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  status: "pending" | "running" | "paused" | "completed";
  show_title: boolean;
  show_round: boolean;
  show_scoreboard: boolean;
  show_connection_prompt: boolean;
  connection_points: number;
  detail_bonus_points: number;
  target_gap_seconds: number;
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  accepted_connection: string;
  accepted_detail: string | null;
  status: "pending" | "played_track_a" | "played_track_b" | "discussion" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
};

export default function BackToBackConnectionJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/back-to-back-connection/sessions/${sessionId}`),
      fetch(`/api/games/back-to-back-connection/sessions/${sessionId}/calls`),
      fetch(`/api/games/back-to-back-connection/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) {
      const payload = await sessionRes.json();
      setSession(payload);
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

  const currentCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const promptText = useMemo(() => {
    if (!currentCall) return "Waiting for host to start the next pair";
    if (currentCall.status === "played_track_a") return "Track A played. Track B is coming next.";
    if (currentCall.status === "played_track_b") return "Talk with your table. Find the connection.";
    if (currentCall.status === "discussion") return "Lock your connection and detail now.";
    if (currentCall.status === "revealed" || currentCall.status === "scored") {
      return currentCall.accepted_detail
        ? `${currentCall.accepted_connection} · ${currentCall.accepted_detail}`
        : currentCall.accepted_connection;
    }
    if (currentCall.status === "skipped") return "Pair skipped by host.";
    return "Get ready for the next pair.";
  }, [currentCall]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#5f3a11,transparent_38%),linear-gradient(180deg,#020202,#0d0d0d)] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-amber-700/40 bg-black/35 p-6">
          {session?.show_title ? <h1 className="text-5xl font-black uppercase tracking-tight text-amber-200">{session?.title ?? "Back-to-Back Connection"}</h1> : null}

          <div className="mt-4 flex flex-wrap gap-6 text-xl font-semibold">
            {session?.show_round ? <p>Round {session?.current_round} of {session?.round_count}</p> : null}
            <p>Pair {session?.current_call_index ?? 0} / {session?.round_count ?? 0}</p>
            <p>Gap Budget: <span className="font-black text-amber-300">{session?.target_gap_seconds ?? 0}s</span></p>
            {session?.status === "paused" ? <p className="text-red-400">Paused</p> : null}
          </div>
        </header>

        <section className="rounded-3xl border border-stone-700 bg-black/45 p-8">
          {session?.show_connection_prompt ? (
            <>
              <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Connection Prompt</p>
              <p className="mt-2 text-5xl font-black text-amber-200">{promptText}</p>
            </>
          ) : (
            <p className="text-4xl font-black text-amber-200">Connection prompt hidden by host</p>
          )}

          {(currentCall?.status === "revealed" || currentCall?.status === "scored") ? (
            <p className="mt-4 text-2xl font-semibold text-emerald-300">Answer revealed</p>
          ) : (
            <p className="mt-4 text-2xl font-semibold text-stone-300">Answer remains hidden</p>
          )}

          <p className="mt-6 text-xl text-stone-200">
            Scoring: {session?.connection_points ?? 2} for connection + {session?.detail_bonus_points ?? 1} for detail
          </p>
        </section>

        {session?.show_scoreboard ? (
          <section className="rounded-3xl border border-stone-700 bg-black/45 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Leaderboard</p>
            <div className="mt-3 grid gap-2 text-2xl font-semibold">
              {leaderboard.slice(0, 6).map((row, index) => (
                <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-700 bg-stone-950/70 px-3 py-2">
                  <span>{index + 1}. {row.team_name}</span>
                  <span className="text-amber-300">{row.total_points} pts</span>
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
