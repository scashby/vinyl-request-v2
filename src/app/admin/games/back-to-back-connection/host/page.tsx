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
  connection_points: number;
  detail_bonus_points: number;
  target_gap_seconds: number;
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  track_a_artist: string;
  track_a_title: string;
  track_b_artist: string;
  track_b_title: string;
  track_a_source_label: string | null;
  track_b_source_label: string | null;
  accepted_connection: string;
  accepted_detail: string | null;
  host_notes: string | null;
  status: "pending" | "played_track_a" | "played_track_b" | "discussion" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  connection_hits: number;
  detail_hits: number;
};

type ScoreDraft = Record<
  number,
  {
    guessed_connection: string;
    guessed_detail: string;
    connection_correct: boolean;
    detail_correct: boolean;
    awarded_points: string;
    notes: string;
  }
>;

function getDefaultPoints(
  connectionCorrect: boolean,
  detailCorrect: boolean,
  connectionPoints: number,
  detailBonusPoints: number
): number {
  return (connectionCorrect ? connectionPoints : 0) + (detailCorrect ? detailBonusPoints : 0);
}

export default function BackToBackConnectionHostPage() {
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

  const activeCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const nextPendingCall = useMemo(() => calls.find((call) => call.status === "pending") ?? null, [calls]);
  const callForControls = activeCall ?? nextPendingCall;

  const recentCalls = useMemo(
    () =>
      calls
        .filter((call) => ["played_track_a", "played_track_b", "discussion", "revealed", "scored", "skipped"].includes(call.status))
        .slice(-6),
    [calls]
  );

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = {
        guessed_connection: "",
        guessed_detail: "",
        connection_correct: false,
        detail_correct: false,
        awarded_points: "",
        notes: "",
      };
    }
    setScoreDraft(draft);
  }, [callForControls?.id, leaderboard]);

  const runAction = async (fn: () => Promise<void>) => {
    setWorking(true);
    try {
      await fn();
      await load();
    } finally {
      setWorking(false);
    }
  };

  const postNoBodyAction = async (path: string, fallbackError: string) => {
    const res = await fetch(path, { method: "POST" });
    if (!res.ok) {
      const payload = await res.json();
      throw new Error(payload.error ?? fallbackError);
    }
  };

  const advance = async () => {
    await runAction(async () => {
      await postNoBodyAction(`/api/games/back-to-back-connection/sessions/${sessionId}/advance`, "Failed to advance pair");
    });
  };

  const pause = async () => {
    await runAction(async () => {
      await postNoBodyAction(`/api/games/back-to-back-connection/sessions/${sessionId}/pause`, "Failed to pause");
    });
  };

  const resume = async () => {
    await runAction(async () => {
      await postNoBodyAction(`/api/games/back-to-back-connection/sessions/${sessionId}/resume`, "Failed to resume");
    });
  };

  const patchCallStatus = async (
    status: "played_track_a" | "played_track_b" | "discussion" | "revealed" | "scored" | "skipped"
  ) => {
    if (!callForControls) return;
    await runAction(async () => {
      const res = await fetch(`/api/games/back-to-back-connection/calls/${callForControls.id}`, {
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
          guessed_connection: "",
          guessed_detail: "",
          connection_correct: false,
          detail_correct: false,
          awarded_points: "",
          notes: "",
        };
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: team.team_id,
          guessed_connection: draft.guessed_connection,
          guessed_detail: draft.guessed_detail,
          connection_correct: draft.connection_correct,
          detail_correct: draft.detail_correct,
          awarded_points:
            Number.isFinite(parsedPoints) && draft.awarded_points !== ""
              ? parsedPoints
              : undefined,
          notes: draft.notes || undefined,
        };
      });

      const res = await fetch(`/api/games/back-to-back-connection/sessions/${sessionId}/score`, {
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
        <header className="rounded-3xl border border-amber-900/40 bg-black/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Host Console</p>
              <h1 className="text-3xl font-black uppercase">Back-to-Back Connection Host</h1>
              <p className="text-sm text-stone-400">
                {session?.title} · {session?.session_code} · Round {session?.current_round} of {session?.round_count}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/back-to-back-connection/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/back-to-back-connection/assistant?sessionId=${sessionId}`}>Assistant</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/back-to-back-connection/help">Help</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/back-to-back-connection/history">History</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/back-to-back-connection">Setup</Link>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">Pair Stack</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Track A</th>
                    <th className="pb-2">Track B</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-amber-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2">{call.track_a_artist} - {call.track_a_title}</td>
                      <td className="py-2">{call.track_b_artist} - {call.track_b_title}</td>
                      <td className="py-2 text-stone-400">{call.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">Current Pair</h2>
              <div className="mt-3 rounded border border-amber-700/40 bg-amber-950/20 p-3">
                <p className="text-xs uppercase text-amber-300">
                  {callForControls
                    ? `Pair ${callForControls.call_index} · Round ${callForControls.round_number}`
                    : "Waiting"}
                </p>
                <p className="mt-1 text-lg font-black">
                  {callForControls
                    ? `${callForControls.track_a_artist} - ${callForControls.track_a_title}  ->  ${callForControls.track_b_artist} - ${callForControls.track_b_title}`
                    : "No active pair"}
                </p>
                <p className="mt-2 text-sm text-stone-300">
                  Sources: {callForControls?.track_a_source_label ?? "-"} | {callForControls?.track_b_source_label ?? "-"}
                </p>
                {(callForControls?.status === "revealed" || callForControls?.status === "scored") ? (
                  <p className="mt-2 text-sm text-amber-200">
                    Answer: {callForControls.accepted_connection}
                    {callForControls.accepted_detail ? ` · Detail: ${callForControls.accepted_detail}` : ""}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-stone-400">Answer hidden until reveal.</p>
                )}
                {callForControls?.host_notes ? (
                  <p className="mt-2 text-xs text-stone-400">Host note: {callForControls.host_notes}</p>
                ) : null}
              </div>

              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Recent Pair Activity</p>
                <div className="mt-1 max-h-24 overflow-auto text-stone-400">
                  {recentCalls.map((call) => (
                    <div key={call.id}>#{call.call_index} ({call.status})</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-amber-300">Controls</p>
              <p className="mt-1 text-xs text-stone-400">
                Gap timer target: {session?.target_gap_seconds ?? 0}s · Status: {session?.status ?? "-"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={advance} className="rounded bg-amber-700 px-2 py-1 disabled:opacity-50">Advance Pair</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("played_track_a")} className="rounded bg-blue-700 px-2 py-1 disabled:opacity-50">Track A Played</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("played_track_b")} className="rounded bg-violet-700 px-2 py-1 disabled:opacity-50">Track B Played</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("discussion")} className="rounded bg-teal-700 px-2 py-1 disabled:opacity-50">Open Discussion</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("revealed")} className="rounded bg-emerald-700 px-2 py-1 disabled:opacity-50">Reveal Answer</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("skipped")} className="rounded bg-red-700 px-2 py-1 disabled:opacity-50">Skip</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={pause} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Pause</button>
                <button disabled={working} onClick={resume} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Resume</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("scored")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Mark Scored</button>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-amber-300">Score Entry</p>
              <div className="mt-2 space-y-2 text-xs">
                {leaderboard.map((team) => {
                  const draft = scoreDraft[team.team_id] ?? {
                    guessed_connection: "",
                    guessed_detail: "",
                    connection_correct: false,
                    detail_correct: false,
                    awarded_points: "",
                    notes: "",
                  };
                  const suggestedPoints = getDefaultPoints(
                    draft.connection_correct,
                    draft.detail_correct,
                    session?.connection_points ?? 2,
                    session?.detail_bonus_points ?? 1
                  );

                  return (
                    <div key={team.team_id} className="space-y-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{team.team_name}</p>
                          <p className="text-[11px] text-stone-400">
                            Total: {team.total_points} · Connections: {team.connection_hits} · Details: {team.detail_hits}
                          </p>
                        </div>
                        <input
                          className="w-24 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                          placeholder={`Auto ${suggestedPoints}`}
                          value={draft.awarded_points}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? {
                                  guessed_connection: "",
                                  guessed_detail: "",
                                  connection_correct: false,
                                  detail_correct: false,
                                  notes: "",
                                }),
                                awarded_points: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <input
                          className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                          placeholder="Guessed connection"
                          value={draft.guessed_connection}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? {
                                  guessed_detail: "",
                                  connection_correct: false,
                                  detail_correct: false,
                                  awarded_points: "",
                                  notes: "",
                                }),
                                guessed_connection: e.target.value,
                              },
                            }))
                          }
                        />
                        <input
                          className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                          placeholder="Guessed detail"
                          value={draft.guessed_detail}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? {
                                  guessed_connection: "",
                                  connection_correct: false,
                                  detail_correct: false,
                                  awarded_points: "",
                                  notes: "",
                                }),
                                guessed_detail: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={draft.connection_correct}
                            onChange={(e) =>
                              setScoreDraft((current) => ({
                                ...current,
                                [team.team_id]: {
                                  ...(current[team.team_id] ?? {
                                    guessed_connection: "",
                                    guessed_detail: "",
                                    detail_correct: false,
                                    awarded_points: "",
                                    notes: "",
                                  }),
                                  connection_correct: e.target.checked,
                                },
                              }))
                            }
                          />
                          Connection
                        </label>
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={draft.detail_correct}
                            onChange={(e) =>
                              setScoreDraft((current) => ({
                                ...current,
                                [team.team_id]: {
                                  ...(current[team.team_id] ?? {
                                    guessed_connection: "",
                                    guessed_detail: "",
                                    connection_correct: false,
                                    awarded_points: "",
                                    notes: "",
                                  }),
                                  detail_correct: e.target.checked,
                                },
                              }))
                            }
                          />
                          Detail
                        </label>
                        <input
                          className="min-w-[220px] flex-1 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                          placeholder="Optional scoring note"
                          value={draft.notes}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? {
                                  guessed_connection: "",
                                  guessed_detail: "",
                                  connection_correct: false,
                                  detail_correct: false,
                                  awarded_points: "",
                                }),
                                notes: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                disabled={saving || !callForControls}
                onClick={submitScores}
                className="mt-3 rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-300"
              >
                {saving ? "Saving..." : "Save Scores for Current Pair"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
