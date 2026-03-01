"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  title: string;
  session_code: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  status: "pending" | "running" | "paused" | "completed";
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
  correct_calls: number;
  artist_bonus_hits: number;
};

export default function OriginalOrCoverAssistantPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/original-or-cover/sessions/${sessionId}`),
      fetch(`/api/games/original-or-cover/sessions/${sessionId}/calls`),
      fetch(`/api/games/original-or-cover/sessions/${sessionId}/leaderboard`),
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
    const poll = setInterval(load, 4000);
    return () => clearInterval(poll);
  }, [load]);

  const currentCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#17130c,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-amber-900/50 bg-black/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black uppercase text-amber-100">Original or Cover Assistant</h1>
            <p className="mt-1 text-sm text-stone-300">
              {session?.title} · {session?.session_code} · Round {session?.current_round} of {session?.round_count} · Status: {session?.status}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/admin/games/original-or-cover/host?sessionId=${sessionId}`} className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Host</Link>
            <Link href={`/admin/games/original-or-cover/jumbotron?sessionId=${sessionId}`} className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Jumbotron</Link>
            <Link href="/admin/games/original-or-cover" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Setup</Link>
          </div>
        </div>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Current Call Snapshot</h2>
          {currentCall ? (
            <div className="mt-3 text-sm text-stone-200">
              <p className="font-semibold">#{currentCall.call_index} · Round {currentCall.round_number}</p>
              <p className="mt-1">{currentCall.spin_artist} - {currentCall.track_title}</p>
              <p className="mt-1 text-stone-400">Status: {currentCall.status}</p>
              {(currentCall.status === "revealed" || currentCall.status === "scored") ? (
                <p className="mt-2 text-amber-300">Answer: {currentCall.is_cover ? "COVER" : "ORIGINAL"} · Original artist: {currentCall.original_artist}</p>
              ) : (
                <p className="mt-2 text-stone-400">Answer hidden until host reveal.</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-400">No active call yet.</p>
          )}
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Live Leaderboard</h2>
          <div className="mt-3 space-y-2 text-sm">
            {leaderboard.length === 0 ? (
              <p className="text-stone-400">No scores yet.</p>
            ) : (
              leaderboard.map((row) => (
                <div key={row.team_id} className="rounded border border-stone-800 bg-stone-900/60 px-3 py-2">
                  <p className="font-semibold">{row.team_name}</p>
                  <p className="text-xs text-stone-400">{row.total_points} pts · Correct calls: {row.correct_calls} · Artist bonuses: {row.artist_bonus_hits}</p>
                </div>
              ))
            )}
          </div>
          <p className="mt-3 text-xs text-stone-400">Assistant scope stays non-transport: score verification and call-sheet reconciliation only.</p>
        </section>
      </div>
    </div>
  );
}
