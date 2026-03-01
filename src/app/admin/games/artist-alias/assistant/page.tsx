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
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
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
  exact_hits: number;
};

export default function ArtistAliasAssistantPage() {
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

  const currentCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#120d24,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-violet-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-violet-100">Artist Alias Assistant</h1>
          <Link href="/admin/games/artist-alias" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">
          Session: {session?.session_code ?? (Number.isFinite(sessionId) ? sessionId : "(none selected)")} · Round {session?.current_round ?? "-"} / {session?.round_count ?? "-"} · Status: {session?.status ?? "-"}
        </p>

        <section className="mt-6 rounded-xl border border-violet-800/50 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-200">Current Card Snapshot</h2>
          <p className="mt-2 text-sm text-stone-200">Card #{currentCall?.call_index ?? "-"} · Round {currentCall?.round_number ?? "-"}</p>
          <div className="mt-3 grid gap-2 text-sm">
            <p>Era: {currentCall?.stage_revealed && currentCall.stage_revealed >= 1 ? currentCall.clue_era : "Hidden"}</p>
            <p>Collaborator: {currentCall?.stage_revealed && currentCall.stage_revealed >= 2 ? currentCall.clue_collaborator : "Hidden"}</p>
            <p>Label/Region: {currentCall?.stage_revealed && currentCall.stage_revealed >= 3 ? currentCall.clue_label_region : "Hidden"}</p>
            <p>Answer: {currentCall?.status === "scored" ? currentCall.artist_name : "Hidden until scored"}</p>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-200">Assistant Checklist</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Log team guesses on paper/slips and flag disputed alias calls quickly.</li>
            <li>Prep next clue card and pull order while host scores current round.</li>
            <li>Keep reveal progression host-owned: assistant does not change stage state.</li>
            <li>Confirm scoreboard totals match slip counts before tie-break rounds.</li>
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-200">Live Scoreboard</h2>
          <div className="mt-3 space-y-2 text-sm">
            {leaderboard.map((row) => (
              <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-800 bg-black/50 px-3 py-2">
                <p>{row.team_name} · Exact {row.exact_hits}</p>
                <p className="font-black text-violet-200">{row.total_points}</p>
              </div>
            ))}
            {leaderboard.length === 0 ? <p className="text-stone-500">No teams scored yet.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
