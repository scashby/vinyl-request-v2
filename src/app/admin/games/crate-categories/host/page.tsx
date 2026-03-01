"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  id: number;
  title: string;
  session_code: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  target_gap_seconds: number;
  remaining_seconds: number;
  status: "pending" | "running" | "paused" | "completed";
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
  round_number: number;
  call_index: number;
  track_in_round: number;
  source_label: string | null;
  artist: string;
  title: string;
  crate_tag: string | null;
  host_notes: string | null;
  status: "pending" | "playing" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  rounds_scored: number;
};

type ScoreDraft = Record<number, { awarded_points: string; guess_summary: string; rationale: string }>;

function statusChip(callStatus: Call["status"]): string {
  if (callStatus === "playing") return "text-emerald-300";
  if (callStatus === "revealed") return "text-amber-300";
  if (callStatus === "scored") return "text-sky-300";
  if (callStatus === "skipped") return "text-rose-300";
  return "text-stone-400";
}

export default function CrateCategoriesHostPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [session, setSession] = useState<Session | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, roundsRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/crate-categories/sessions/${sessionId}`),
      fetch(`/api/games/crate-categories/sessions/${sessionId}/rounds`),
      fetch(`/api/games/crate-categories/sessions/${sessionId}/calls`),
      fetch(`/api/games/crate-categories/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) setSession(await sessionRes.json());
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

  const activeRound = useMemo(() => {
    if (!session) return null;
    return (
      rounds.find((round) => round.round_number === session.current_round) ??
      rounds.find((round) => round.status === "active") ??
      rounds.find((round) => round.status === "pending") ??
      null
    );
  }, [rounds, session]);

  const activeCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const nextPendingCall = useMemo(() => calls.find((call) => call.status === "pending") ?? null, [calls]);
  const callForControls = activeCall ?? nextPendingCall;

  const recentCalls = useMemo(
    () =>
      calls
        .filter((call) => ["playing", "revealed", "scored", "skipped"].includes(call.status))
        .slice(-8),
    [calls]
  );

  useEffect(() => {
    if (!activeRound) return;

    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = {
        awarded_points: String(activeRound.points_correct),
        guess_summary: "",
        rationale: "",
      };
    }
    setScoreDraft(draft);
  }, [activeRound, leaderboard]);

  const runAction = async (fn: () => Promise<void>) => {
    setWorking(true);
    try {
      await fn();
      await load();
    } finally {
      setWorking(false);
    }
  };

  const advance = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/crate-categories/sessions/${sessionId}/advance`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to advance track");
      }
    });
  };

  const pause = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/crate-categories/sessions/${sessionId}/pause`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to pause");
      }
    });
  };

  const resume = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/crate-categories/sessions/${sessionId}/resume`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to resume");
      }
    });
  };

  const patchCallStatus = async (status: "playing" | "revealed" | "scored" | "skipped") => {
    if (!callForControls) return;
    await runAction(async () => {
      const res = await fetch(`/api/games/crate-categories/calls/${callForControls.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? `Failed to mark ${status}`);
      }
    });
  };

  const submitRoundScores = async () => {
    if (!activeRound) return;

    setSaving(true);
    try {
      const awards = leaderboard.map((row) => {
        const draft = scoreDraft[row.team_id] ?? {
          awarded_points: String(activeRound.points_correct),
          guess_summary: "",
          rationale: "",
        };
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: row.team_id,
          awarded_points: Number.isFinite(parsedPoints) ? parsedPoints : undefined,
          guess_summary: draft.guess_summary,
          rationale: draft.rationale,
        };
      });

      const res = await fetch(`/api/games/crate-categories/sessions/${sessionId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round_id: activeRound.id,
          awards,
          scored_by: "host",
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to save round scores");
      }

      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save round scores");
    } finally {
      setSaving(false);
    }
  };

  if (!Number.isFinite(sessionId)) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#16110c,#0a0908)] p-6 text-stone-100">
        <div className="mx-auto max-w-3xl rounded-2xl border border-stone-700 bg-black/50 p-5 text-sm text-stone-300">
          Invalid or missing `sessionId` query parameter.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#16110c,#0a0908)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-lime-900/40 bg-black/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-lime-300">Host Console</p>
              <h1 className="text-3xl font-black uppercase">Crate Categories Host</h1>
              <p className="text-sm text-stone-400">
                {session?.title} · {session?.session_code} · Round {session?.current_round} of {session?.round_count}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/crate-categories/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/crate-categories/history">History</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/crate-categories">Setup</Link>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-lime-200">Round + Call Stack</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Slot</th>
                    <th className="pb-2">Track</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-lime-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2">{call.track_in_round}</td>
                      <td className="py-2">{call.artist} - {call.title}</td>
                      <td className={`py-2 ${statusChip(call.status)}`}>{call.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-lime-200">Current Round</h2>
              <div className="mt-3 rounded border border-lime-700/40 bg-lime-950/20 p-3">
                <p className="text-xs uppercase text-lime-300">
                  {activeRound ? `Round ${activeRound.round_number} · ${activeRound.prompt_type}` : "Waiting for first round"}
                </p>
                <p className="mt-1 text-lg font-black">{activeRound?.category_label ?? "No active round"}</p>
                <p className="mt-2 text-sm text-stone-300">
                  Tracks: {activeRound?.tracks_in_round ?? 0} · Rubric: {activeRound?.points_correct ?? 0} base + {activeRound?.points_bonus ?? 0} bonus
                </p>
              </div>

              <div className="mt-3 rounded border border-stone-700 bg-stone-950/70 p-3">
                <p className="text-xs uppercase text-lime-300">
                  {callForControls
                    ? `Call ${callForControls.call_index} · Round ${callForControls.round_number} · Slot ${callForControls.track_in_round}`
                    : "No call selected"}
                </p>
                <p className="mt-1 text-lg font-black">
                  {callForControls ? `${callForControls.artist} - ${callForControls.title}` : "Advance to start"}
                </p>
                <p className="mt-1 text-xs text-stone-300">
                  Source: {callForControls?.source_label ?? "-"} · Crate tag: {callForControls?.crate_tag ?? "-"}
                </p>
                {callForControls?.host_notes ? (
                  <p className="mt-1 text-xs text-stone-400">Host note: {callForControls.host_notes}</p>
                ) : null}
              </div>

              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Recent Calls</p>
                <div className="mt-1 max-h-24 overflow-auto text-stone-400">
                  {recentCalls.map((call) => (
                    <div key={call.id}>#{call.call_index} {call.artist} - {call.title} ({call.status})</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-lime-300">Controls</p>
              <p className="mt-1 text-xs text-stone-400">Gap timer target: {session?.target_gap_seconds ?? 0}s · Remaining: {session?.remaining_seconds ?? 0}s · Status: {session?.status ?? "-"}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={advance} className="rounded bg-lime-700 px-2 py-1 disabled:opacity-50">Advance Track</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("playing")} className="rounded bg-emerald-700 px-2 py-1 disabled:opacity-50">Mark Playing</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("revealed")} className="rounded bg-amber-700 px-2 py-1 disabled:opacity-50">Reveal</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("scored")} className="rounded bg-sky-700 px-2 py-1 disabled:opacity-50">Mark Scored</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("skipped")} className="rounded bg-rose-700 px-2 py-1 disabled:opacity-50">Skip</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={pause} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Pause</button>
                <button disabled={working} onClick={resume} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Resume</button>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-lime-300">Round Score Entry</p>
              <p className="mt-1 text-xs text-stone-400">Score against current round prompt type and rubric.</p>
              <div className="mt-2 space-y-2 text-xs">
                {leaderboard.map((team) => {
                  const draft = scoreDraft[team.team_id] ?? {
                    awarded_points: String(activeRound?.points_correct ?? 0),
                    guess_summary: "",
                    rationale: "",
                  };

                  return (
                    <div key={team.team_id} className="grid grid-cols-[1.05fr,86px,1fr,1fr] items-center gap-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                      <div className="font-semibold text-stone-100">{team.team_name}</div>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        className="rounded border border-stone-700 bg-black px-2 py-1"
                        value={draft.awarded_points}
                        onChange={(e) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [team.team_id]: {
                              ...draft,
                              awarded_points: e.target.value,
                            },
                          }))
                        }
                      />
                      <input
                        className="rounded border border-stone-700 bg-black px-2 py-1"
                        placeholder="Guess summary"
                        value={draft.guess_summary}
                        onChange={(e) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [team.team_id]: {
                              ...draft,
                              guess_summary: e.target.value,
                            },
                          }))
                        }
                      />
                      <input
                        className="rounded border border-stone-700 bg-black px-2 py-1"
                        placeholder="Rationale"
                        value={draft.rationale}
                        onChange={(e) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [team.team_id]: {
                              ...draft,
                              rationale: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>

              <button
                disabled={saving || !activeRound || leaderboard.length === 0}
                onClick={submitRoundScores}
                className="mt-3 rounded bg-lime-500 px-3 py-2 text-xs font-semibold text-black disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Scores For Round"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
