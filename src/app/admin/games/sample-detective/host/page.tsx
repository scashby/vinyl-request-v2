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
  points_correct_pair: number;
  bonus_both_artists_points: number;
  target_gap_seconds: number;
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  source_label: string | null;
  sampled_artist: string;
  sampled_title: string;
  source_artist: string;
  source_title: string;
  release_year: number | null;
  sample_timestamp: string | null;
  host_notes: string | null;
  status: "pending" | "asked" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  pair_hits: number;
  both_artists_hits: number;
};

type ScoreDraft = Record<number, { pair_correct: boolean; both_artists_named: boolean; awarded_points: string }>;

function getDefaultPoints(
  pairCorrect: boolean,
  bothArtistsNamed: boolean,
  pointsCorrectPair: number,
  bonusBothArtistsPoints: number
): number {
  if (!pairCorrect) return 0;
  return Math.max(0, Math.min(5, pointsCorrectPair + (bothArtistsNamed ? bonusBothArtistsPoints : 0)));
}

export default function SampleDetectiveHostPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/sample-detective/sessions/${sessionId}`),
      fetch(`/api/games/sample-detective/sessions/${sessionId}/calls`),
      fetch(`/api/games/sample-detective/sessions/${sessionId}/leaderboard`),
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

  const nextPendingCall = useMemo(() => calls.find((call) => call.status === "pending") ?? null, [calls]);
  const callForControls = activeCall ?? nextPendingCall;

  const previousCalls = useMemo(
    () => calls.filter((call) => ["asked", "revealed", "scored", "skipped"].includes(call.status)).slice(-6),
    [calls]
  );

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = { pair_correct: false, both_artists_named: false, awarded_points: "" };
    }
    setScoreDraft(draft);
  }, [callForControls?.id, leaderboard]);

  const runAction = async (fn: () => Promise<void>) => {
    setWorking(true);
    try {
      await fn();
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Action failed");
    } finally {
      setWorking(false);
    }
  };

  const advance = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/sample-detective/sessions/${sessionId}/advance`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to advance");
      }
    });
  };

  const pause = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/sample-detective/sessions/${sessionId}/pause`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to pause");
      }
    });
  };

  const resume = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/sample-detective/sessions/${sessionId}/resume`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to resume");
      }
    });
  };

  const patchCallStatus = async (status: "asked" | "revealed" | "scored" | "skipped") => {
    if (!callForControls) return;
    await runAction(async () => {
      const res = await fetch(`/api/games/sample-detective/calls/${callForControls.id}`, {
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

  const submitScores = async () => {
    if (!callForControls || !session) return;
    setSaving(true);

    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? {
          pair_correct: false,
          both_artists_named: false,
          awarded_points: "",
        };
        const pairCorrect = draft.pair_correct;
        const bothArtistsNamed = pairCorrect && draft.both_artists_named;
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: team.team_id,
          pair_correct: pairCorrect,
          both_artists_named: bothArtistsNamed,
          awarded_points:
            Number.isFinite(parsedPoints) && draft.awarded_points !== ""
              ? parsedPoints
              : getDefaultPoints(
                  pairCorrect,
                  bothArtistsNamed,
                  session.points_correct_pair,
                  session.bonus_both_artists_points
                ),
        };
      });

      const res = await fetch(`/api/games/sample-detective/sessions/${sessionId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: callForControls.id,
          awards,
          scored_by: "host",
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to save scores");
      }

      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save scores");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#171717)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-green-900/40 bg-black/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-green-300">Host Console</p>
              <h1 className="text-3xl font-black uppercase">Sample Detective Host</h1>
              <p className="text-sm text-stone-400">
                {session?.title} · {session?.session_code} · Round {session?.current_round} of {session?.round_count}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/sample-detective/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/sample-detective/assistant?sessionId=${sessionId}`}>Assistant</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/sample-detective/history">History</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/sample-detective">Setup</Link>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-green-200">Sample Deck</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Sampled Track</th>
                    <th className="pb-2">Source Track</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-green-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2">{call.sampled_artist} - {call.sampled_title}</td>
                      <td className="py-2">{call.source_artist} - {call.source_title}</td>
                      <td className="py-2 text-stone-400">{call.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-green-200">Current Call</h2>
              <div className="mt-3 rounded border border-green-700/40 bg-green-950/20 p-3">
                <p className="text-xs uppercase text-green-300">
                  {callForControls ? `Call ${callForControls.call_index} · Round ${callForControls.round_number}` : "Waiting"}
                </p>
                <p className="mt-1 text-lg font-black">{callForControls ? `${callForControls.sampled_artist} - ${callForControls.sampled_title}` : "No active call"}</p>
                <p className="mt-2 text-sm text-stone-300">
                  Source: {callForControls && (callForControls.status === "revealed" || callForControls.status === "scored")
                    ? `${callForControls.source_artist} - ${callForControls.source_title}`
                    : "Hidden until reveal"}
                </p>
                <p className="mt-1 text-xs text-stone-400">
                  Label: {callForControls?.source_label ?? "Unlabeled"}
                  {callForControls?.sample_timestamp ? ` · Sample ts: ${callForControls.sample_timestamp}` : ""}
                  {callForControls?.release_year ? ` · ${callForControls.release_year}` : ""}
                </p>
                {callForControls?.host_notes ? (
                  <p className="mt-2 text-xs text-stone-400">Host note: {callForControls.host_notes}</p>
                ) : null}
              </div>

              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Recently Played</p>
                <div className="mt-1 max-h-24 overflow-auto text-stone-400">
                  {previousCalls.map((call) => (
                    <div key={call.id}>#{call.call_index} {call.sampled_artist} - {call.sampled_title} ({call.status})</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-green-300">Controls</p>
              <p className="mt-1 text-xs text-stone-400">Gap target: {session?.target_gap_seconds ?? 0}s · Status: {session?.status ?? "-"}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={advance} className="rounded bg-green-700 px-2 py-1 disabled:opacity-50">Advance Call</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("asked")} className="rounded bg-blue-700 px-2 py-1 disabled:opacity-50">Mark Asked</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("revealed")} className="rounded bg-amber-700 px-2 py-1 disabled:opacity-50">Reveal Source</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("skipped")} className="rounded bg-red-700 px-2 py-1 disabled:opacity-50">Skip</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={pause} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Pause</button>
                <button disabled={working} onClick={resume} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Resume</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("scored")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Mark Scored</button>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-green-300">Score Entry</p>
              <div className="mt-2 space-y-2 text-xs">
                {leaderboard.map((team) => {
                  const draft = scoreDraft[team.team_id] ?? {
                    pair_correct: false,
                    both_artists_named: false,
                    awarded_points: "",
                  };
                  const suggestedPoints = getDefaultPoints(
                    draft.pair_correct,
                    draft.both_artists_named,
                    session?.points_correct_pair ?? 2,
                    session?.bonus_both_artists_points ?? 1
                  );

                  return (
                    <div key={team.team_id} className="grid grid-cols-[1.1fr,auto,auto,100px] items-center gap-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                      <div>
                        <p className="font-semibold">{team.team_name}</p>
                        <p className="text-[11px] text-stone-400">Total: {team.total_points} · Pair hits: {team.pair_hits}</p>
                      </div>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={draft.pair_correct}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? { both_artists_named: false, awarded_points: "" }),
                                pair_correct: e.target.checked,
                                both_artists_named: e.target.checked ? (current[team.team_id]?.both_artists_named ?? false) : false,
                              },
                            }))
                          }
                        />
                        Pair
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={draft.both_artists_named}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? { pair_correct: false, awarded_points: "" }),
                                pair_correct: e.target.checked ? true : (current[team.team_id]?.pair_correct ?? false),
                                both_artists_named: e.target.checked,
                              },
                            }))
                          }
                        />
                        +Both Artists
                      </label>
                      <input
                        className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                        placeholder={`Auto ${suggestedPoints}`}
                        value={draft.awarded_points}
                        onChange={(e) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [team.team_id]: {
                              ...(current[team.team_id] ?? { pair_correct: false, both_artists_named: false }),
                              awarded_points: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  );
                })}
                {leaderboard.length === 0 ? <p className="text-stone-500">No teams found.</p> : null}
              </div>
              <button disabled={!callForControls || saving} onClick={submitScores} className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold disabled:opacity-50">
                {saving ? "Saving..." : "Save Scores for Current Call"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
