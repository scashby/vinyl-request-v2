"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  title: string;
  session_code: string;
  status: "pending" | "running" | "paused" | "completed";
  current_round: number;
  round_count: number;
  current_call_index: number;
  remaining_seconds: number;
  show_title: boolean;
  show_round: boolean;
  show_category: boolean;
  show_scoreboard: boolean;
  rounds: Array<{ round_number: number; category_label: string }>;
  calls: Array<{
    id: number;
    round_number: number;
    call_index: number;
    artist: string | null;
    title: string | null;
    is_imposter: boolean;
    status: "pending" | "cued" | "played" | "revealed" | "scored" | "skipped";
  }>;
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
};

export default function GenreImposterJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [picksLogged, setPicksLogged] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/genre-imposter/sessions/${sessionId}`),
      fetch(`/api/games/genre-imposter/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) {
      const payload = (await sessionRes.json()) as Session;
      setSession(payload);
      setRemaining(payload.remaining_seconds ?? 0);

      const picksRes = await fetch(`/api/games/genre-imposter/sessions/${sessionId}/picks?roundNumber=${payload.current_round}`);
      if (picksRes.ok) {
        const picksPayload = await picksRes.json();
        setPicksLogged((picksPayload.data ?? []).length);
      }
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

  const currentRound = useMemo(() => {
    if (!session) return null;
    return session.rounds.find((round) => round.round_number === session.current_round) ?? null;
  }, [session]);

  const currentRoundCalls = useMemo(() => {
    if (!session) return [];
    return session.calls
      .filter((call) => call.round_number === session.current_round)
      .sort((a, b) => a.call_index - b.call_index);
  }, [session]);

  const revealReady = useMemo(
    () => currentRoundCalls.some((call) => call.status === "revealed" || call.status === "scored"),
    [currentRoundCalls]
  );

  const imposterCall = useMemo(() => currentRoundCalls.find((call) => call.is_imposter) ?? null, [currentRoundCalls]);

  const statusHeadline = useMemo(() => {
    if (!session) return "Loading";
    if (session.status === "paused") return "Paused";
    if (session.status === "completed") return "Session Complete";

    if (revealReady && imposterCall) {
      return `Imposter: ${imposterCall.artist ?? "Unknown"} - ${imposterCall.title ?? "Untitled"}`;
    }

    if (session.current_call_index <= 0) return "Get ready for Spin 1";
    return `Spin ${session.current_call_index} of 3 in progress`;
  }, [imposterCall, revealReady, session]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_55%_0%,#14532d,transparent_38%),linear-gradient(180deg,#020202,#0d0d0d)] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-emerald-700/40 bg-black/35 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              {session?.show_title ? <h1 className="text-5xl font-black uppercase tracking-tight text-emerald-200">{session?.title ?? "Genre Imposter"}</h1> : null}
              <div className="mt-4 flex flex-wrap gap-6 text-xl font-semibold">
                {session?.show_round ? <p>Round {session?.current_round} of {session?.round_count}</p> : null}
                <p>Spin {session?.current_call_index ?? 0} / 3</p>
                <p>Next Gap: <span className="font-black text-emerald-300">{remaining}s</span></p>
                {session?.status === "paused" ? <p className="text-red-400">Paused</p> : null}
              </div>
            </div>
            <div className="text-right text-xs text-stone-300">
              <p>{session?.session_code}</p>
              <p>Picks logged: {picksLogged}</p>
              <div className="mt-2 flex justify-end gap-2">
                <Link href={`/admin/games/genre-imposter/host?sessionId=${sessionId}`} className="rounded border border-stone-600 px-2 py-1">Host</Link>
                <Link href="/admin/games/genre-imposter" className="rounded border border-stone-600 px-2 py-1">Setup</Link>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-stone-700 bg-black/45 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Current Prompt</p>
          {session?.show_category ? <p className="mt-2 text-4xl font-black text-emerald-200">{currentRound?.category_label ?? "Waiting"}</p> : null}
          <p className="mt-4 text-5xl font-black text-amber-200">{statusHeadline}</p>
          {!revealReady ? (
            <p className="mt-4 text-2xl font-semibold text-stone-300">Pick the one that does not belong</p>
          ) : (
            <p className="mt-4 text-2xl font-semibold text-emerald-300">Reveal live</p>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {currentRoundCalls.map((call) => (
              <div key={call.id} className="rounded border border-stone-700 bg-stone-950/70 p-3">
                <p className="text-xs uppercase text-stone-400">Slot {call.call_index}</p>
                <p className="mt-1 text-lg font-semibold">
                  {revealReady || call.status === "revealed" || call.status === "scored"
                    ? `${call.artist ?? "Unknown"} - ${call.title ?? "Untitled"}`
                    : "Track hidden until reveal"}
                </p>
                <p className="mt-1 text-xs text-stone-400">{call.status}</p>
              </div>
            ))}
          </div>
        </section>

        {session?.show_scoreboard ? (
          <section className="rounded-3xl border border-stone-700 bg-black/45 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Leaderboard</p>
            <div className="mt-3 grid gap-2 text-2xl font-semibold">
              {leaderboard.slice(0, 8).map((row, index) => (
                <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-700 bg-stone-950/70 px-3 py-2">
                  <span>{index + 1}. {row.team_name}</span>
                  <span className="text-emerald-300">{row.total_points} pts</span>
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
