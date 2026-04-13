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
  status: "pending" | "running" | "paused" | "completed";
};

type Round = {
  id: number;
  round_number: number;
  category_label: string;
  points_correct: number;
  points_bonus: number;
  status: "pending" | "active" | "closed";
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  artist: string;
  title: string;
  source_label: string | null;
  status: "pending" | "playing" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  rounds_scored: number;
};

type ScoreDraft = Record<number, { awarded_points: string; guess_summary: string; rationale: string }>;

export default function CrateCategoriesAssistantPage() {
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, roundsRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/crate-categories/sessions/${sessionId}`),
      fetch(`/api/games/crate-categories/sessions/${sessionId}/rounds`),
      fetch(`/api/games/crate-categories/sessions/${sessionId}/calls`),
      fetch(`/api/games/crate-categories/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) setSession((await sessionRes.json()) as Session);
    if (roundsRes.ok) setRounds(((await roundsRes.json()).data ?? []) as Round[]);
    if (callsRes.ok) setCalls(((await callsRes.json()).data ?? []) as Call[]);
    if (leaderboardRes.ok) setLeaderboard(((await leaderboardRes.json()).data ?? []) as LeaderboardRow[]);
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

  const pendingCall = useMemo(() => calls.find((call) => call.status === "pending") ?? null, [calls]);
  const callForControls = activeCall ?? pendingCall;

  useEffect(() => {
    if (!activeRound) return;
    const draft: ScoreDraft = {};
    for (const team of leaderboard) {
      draft[team.team_id] = {
        awarded_points: String(activeRound.points_correct),
        guess_summary: "",
        rationale: "",
      };
    }
    setScoreDraft(draft);
  }, [activeRound, leaderboard]);

  const runAction = async (fn: () => Promise<void>) => {
    setWorking(true);
    setErrorText(null);
    try {
      await fn();
      await load();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Action failed");
    } finally {
      setWorking(false);
    }
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
    setErrorText(null);
    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? {
          awarded_points: String(activeRound.points_correct),
          guess_summary: "",
          rationale: "",
        };
        const parsedPoints = Number(draft.awarded_points);
        return {
          team_id: team.team_id,
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
          scored_by: "assistant",
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to save round scores");
      }

      await load();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to save round scores");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#22170f,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-amber-900/50 bg-black/40 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black uppercase text-amber-100">Crate Categories Assistant</h1>
              <p className="mt-1 text-sm text-stone-300">
                {session?.title ?? "(loading)"} · {session?.session_code ?? ""} · Round {session?.current_round ?? 0}/{session?.round_count ?? 0}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button className="rounded border border-stone-700 px-2 py-1" type="button" onClick={() => window.open(`/admin/games/crate-categories/host?sessionId=${sessionId}`, "crate_categories_host", "width=1280,height=900")}>Host</button>
              <button className="rounded border border-stone-700 px-2 py-1" type="button" onClick={() => window.open(`/admin/games/crate-categories/jumbotron?sessionId=${sessionId}`, "crate_categories_jumbotron", "width=1920,height=1080")}>Jumbotron</button>
              <Link href="/admin/games/crate-categories/history" className="rounded border border-stone-700 px-2 py-1">History</Link>
              <Link href="/admin/games/crate-categories" className="rounded border border-stone-700 px-2 py-1">Setup</Link>
            </div>
          </div>
        </header>

        {errorText ? <div className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200">{errorText}</div> : null}

        <div className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">Round Assist Controls</h2>
            <p className="mt-2 text-xs text-stone-400">
              Status: {session?.status ?? "-"} · Call {session?.current_call_index ?? 0} · Active round: {activeRound?.round_number ?? "-"}
            </p>
            <p className="mt-1 text-xs text-stone-400">Current track: {callForControls ? `${callForControls.artist} - ${callForControls.title}` : "(none)"}</p>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <button className="rounded border border-emerald-700 px-2 py-2" disabled={working || !callForControls} onClick={() => patchCallStatus("playing")}>Mark Playing</button>
              <button className="rounded border border-amber-700 px-2 py-2" disabled={working || !callForControls} onClick={() => patchCallStatus("revealed")}>Mark Revealed</button>
              <button className="rounded border border-sky-700 px-2 py-2" disabled={working || !callForControls} onClick={() => patchCallStatus("scored")}>Mark Scored</button>
              <button className="rounded border border-rose-700 px-2 py-2" disabled={working || !callForControls} onClick={() => patchCallStatus("skipped")}>Mark Skipped</button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Track</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.slice(-10).map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-amber-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2">{call.artist} - {call.title}</td>
                      <td className="py-2 text-stone-300">{call.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">Round Score Helper</h2>
            <p className="mt-1 text-xs text-stone-400">
              Category: {activeRound?.category_label ?? "-"} · Correct: {activeRound?.points_correct ?? "-"} · Bonus: {activeRound?.points_bonus ?? "-"}
            </p>

            {leaderboard.length === 0 ? (
              <p className="mt-3 text-xs text-stone-500">No leaderboard rows available.</p>
            ) : (
              <div className="mt-3 space-y-2 text-xs">
                {leaderboard.map((team) => {
                  const draft = scoreDraft[team.team_id] ?? {
                    awarded_points: String(activeRound?.points_correct ?? 0),
                    guess_summary: "",
                    rationale: "",
                  };

                  return (
                    <div key={team.team_id} className="rounded border border-stone-800 p-2">
                      <p className="font-semibold text-amber-200">{team.team_name}</p>
                      <p className="text-[11px] text-stone-400">{team.total_points} pts · {team.rounds_scored} rounds</p>
                      <div className="mt-1 grid gap-2 md:grid-cols-3">
                        <label>
                          Points
                          <input
                            className="ml-2 w-14 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                            value={draft.awarded_points}
                            onChange={(event) =>
                              setScoreDraft((prev) => ({
                                ...prev,
                                [team.team_id]: { ...draft, awarded_points: event.target.value },
                              }))
                            }
                          />
                        </label>
                        <label>
                          Guess summary
                          <input
                            className="ml-2 w-44 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                            value={draft.guess_summary}
                            onChange={(event) =>
                              setScoreDraft((prev) => ({
                                ...prev,
                                [team.team_id]: { ...draft, guess_summary: event.target.value },
                              }))
                            }
                            placeholder="Guess summary"
                          />
                        </label>
                        <label>
                          Rationale
                          <input
                            className="ml-2 w-40 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                            value={draft.rationale}
                            onChange={(event) =>
                              setScoreDraft((prev) => ({
                                ...prev,
                                [team.team_id]: { ...draft, rationale: event.target.value },
                              }))
                            }
                            placeholder="Rationale"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              className="mt-3 rounded bg-amber-600 px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
              disabled={saving || !activeRound || leaderboard.length === 0}
              onClick={submitRoundScores}
            >
              {saving ? "Saving..." : "Save Round Scores"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
