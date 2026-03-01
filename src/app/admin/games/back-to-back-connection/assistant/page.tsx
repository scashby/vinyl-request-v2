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
  connection_points: number;
  detail_bonus_points: number;
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  track_a_artist: string;
  track_a_title: string;
  track_b_artist: string;
  track_b_title: string;
  status: "pending" | "played_track_a" | "played_track_b" | "discussion" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  connection_hits: number;
  detail_hits: number;
};

export default function BackToBackConnectionAssistantPage() {
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

  const currentCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const upcomingPairs = useMemo(
    () => calls.filter((call) => call.call_index > (session?.current_call_index ?? 0)).slice(0, 2),
    [calls, session?.current_call_index]
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#1d160f,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl space-y-4 rounded-3xl border border-amber-900/50 bg-black/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black uppercase text-amber-100">Back-to-Back Connection Assistant</h1>
            <p className="mt-1 text-sm text-stone-300">
              {session?.title ?? "Session"} · {session?.session_code ?? "-"} · Status: {session?.status ?? "-"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href={`/admin/games/back-to-back-connection/host?sessionId=${sessionId}`} className="rounded border border-stone-600 px-3 py-1">Host</Link>
            <Link href={`/admin/games/back-to-back-connection/jumbotron?sessionId=${sessionId}`} className="rounded border border-stone-600 px-3 py-1">Jumbotron</Link>
            <Link href="/admin/games/back-to-back-connection/help" className="rounded border border-stone-600 px-3 py-1">Help</Link>
            <Link href="/admin/games/back-to-back-connection" className="rounded border border-stone-600 px-3 py-1">Setup</Link>
          </div>
        </div>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Current Pair Monitor</h2>
          {currentCall ? (
            <div className="mt-2 text-sm text-stone-200">
              <p className="font-semibold">Pair #{currentCall.call_index} · Round {currentCall.round_number}</p>
              <p className="mt-1">Track A: {currentCall.track_a_artist} - {currentCall.track_a_title}</p>
              <p>Track B: {currentCall.track_b_artist} - {currentCall.track_b_title}</p>
              <p className="mt-1 text-stone-400">State: {currentCall.status}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-stone-400">No active pair yet.</p>
          )}
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Assistant Checklist</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-200">
            <li>Record table guesses while host controls transport and reveal.</li>
            <li>Flag potential tie conditions before final two rounds.</li>
            <li>Stage next two sleeves and confirm cue points while host scores.</li>
            <li>Escalate disputes to host with short notes only.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Leaderboard Snapshot</h2>
          {leaderboard.length === 0 ? (
            <p className="mt-2 text-sm text-stone-400">No scores yet.</p>
          ) : (
            <div className="mt-2 space-y-1 text-sm">
              {leaderboard.map((row, index) => (
                <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-800 bg-stone-900/70 px-3 py-1">
                  <span>{index + 1}. {row.team_name}</span>
                  <span className="text-amber-300">{row.total_points} pts</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Upcoming Pairs</h2>
          {upcomingPairs.length === 0 ? (
            <p className="mt-2 text-sm text-stone-400">No upcoming pairs.</p>
          ) : (
            <div className="mt-2 space-y-2 text-sm text-stone-300">
              {upcomingPairs.map((call) => (
                <div key={call.id} className="rounded border border-stone-800 bg-stone-900/60 p-2">
                  <p className="font-semibold text-stone-200">#{call.call_index} · Round {call.round_number}</p>
                  <p>Track A: {call.track_a_artist} - {call.track_a_title}</p>
                  <p>Track B: {call.track_b_artist} - {call.track_b_title}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
