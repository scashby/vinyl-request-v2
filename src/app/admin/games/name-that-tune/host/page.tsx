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
  lock_in_rule: "time_window" | "first_sheet_wins" | "hand_raise";
  lock_in_window_seconds: number;
  remaining_seconds: number;
  target_gap_seconds: number;
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  source_label: string | null;
  artist_answer: string;
  title_answer: string;
  snippet_start_seconds: number;
  snippet_duration_seconds: number;
  host_notes: string | null;
  status: "pending" | "asked" | "locked" | "answer_revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  artist_hits: number;
  title_hits: number;
  perfect_calls: number;
};

type ScoreDraft = Record<number, { artist_correct: boolean; title_correct: boolean; awarded_points: string }>;

function getDefaultPoints(artistCorrect: boolean, titleCorrect: boolean): number {
  if (artistCorrect && titleCorrect) return 2;
  if (artistCorrect || titleCorrect) return 1;
  return 0;
}

export default function NameThatTuneHostPage() {
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
      fetch(`/api/games/name-that-tune/sessions/${sessionId}`),
      fetch(`/api/games/name-that-tune/sessions/${sessionId}/calls`),
      fetch(`/api/games/name-that-tune/sessions/${sessionId}/leaderboard`),
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
    () => calls.filter((call) => ["asked", "locked", "answer_revealed", "scored", "skipped"].includes(call.status)).slice(-6),
    [calls]
  );

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = { artist_correct: false, title_correct: false, awarded_points: "" };
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

  const advance = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/name-that-tune/sessions/${sessionId}/advance`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to advance");
      }
    });
  };

  const pause = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/name-that-tune/sessions/${sessionId}/pause`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to pause");
      }
    });
  };

  const resume = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/name-that-tune/sessions/${sessionId}/resume`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to resume");
      }
    });
  };

  const patchCallStatus = async (status: "asked" | "locked" | "answer_revealed" | "scored" | "skipped") => {
    if (!callForControls) return;
    await runAction(async () => {
      const res = await fetch(`/api/games/name-that-tune/calls/${callForControls.id}`, {
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
    if (!callForControls) return;
    setSaving(true);

    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? {
          artist_correct: false,
          title_correct: false,
          awarded_points: "",
        };
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: team.team_id,
          artist_correct: draft.artist_correct,
          title_correct: draft.title_correct,
          awarded_points:
            Number.isFinite(parsedPoints) && draft.awarded_points !== ""
              ? parsedPoints
              : undefined,
        };
      });

      const res = await fetch(`/api/games/name-that-tune/sessions/${sessionId}/score`, {
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
        <header className="rounded-3xl border border-rose-900/40 bg-black/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-rose-300">Host Console</p>
              <h1 className="text-3xl font-black uppercase">Name That Tune Host</h1>
              <p className="text-sm text-stone-400">
                {session?.title} · {session?.session_code} · Round {session?.current_round} of {session?.round_count}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/name-that-tune/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/name-that-tune/history">History</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/name-that-tune">Setup</Link>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-rose-200">Snippet Stack</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Track</th>
                    <th className="pb-2">Snippet</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-rose-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2">{call.artist_answer} - {call.title_answer}</td>
                      <td className="py-2">{call.snippet_duration_seconds}s</td>
                      <td className="py-2 text-stone-400">{call.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-rose-200">Current Snippet</h2>
              <div className="mt-3 rounded border border-rose-700/40 bg-rose-950/20 p-3">
                <p className="text-xs uppercase text-rose-300">
                  {callForControls
                    ? `Snippet ${callForControls.call_index} · Round ${callForControls.round_number}`
                    : "Waiting"}
                </p>
                <p className="mt-1 text-lg font-black">
                  {(callForControls?.status === "answer_revealed" || callForControls?.status === "scored")
                    ? `${callForControls.artist_answer} - ${callForControls.title_answer}`
                    : "Answer hidden until reveal"}
                </p>
                <p className="mt-2 text-sm text-stone-300">
                  Source: {callForControls?.source_label ?? "Unlabeled"} · Snippet: {callForControls?.snippet_duration_seconds ?? 0}s · Lock rule: {session?.lock_in_rule ?? "-"} ({session?.lock_in_window_seconds ?? 0}s)
                </p>
                {callForControls?.host_notes ? (
                  <p className="mt-2 text-xs text-stone-400">Host note: {callForControls.host_notes}</p>
                ) : null}
              </div>

              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Recently Played</p>
                <div className="mt-1 max-h-24 overflow-auto text-stone-400">
                  {previousCalls.map((call) => (
                    <div key={call.id}>#{call.call_index} {call.artist_answer} - {call.title_answer} ({call.status})</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-rose-300">Controls</p>
              <p className="mt-1 text-xs text-stone-400">Gap timer target: {session?.target_gap_seconds ?? 0}s · Remaining: {session?.remaining_seconds ?? 0}s · Status: {session?.status ?? "-"}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={advance} className="rounded bg-rose-700 px-2 py-1 disabled:opacity-50">Advance Snippet</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("asked")} className="rounded bg-blue-700 px-2 py-1 disabled:opacity-50">Mark Asked</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("locked")} className="rounded bg-violet-700 px-2 py-1 disabled:opacity-50">Lock Answers</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("answer_revealed")} className="rounded bg-amber-700 px-2 py-1 disabled:opacity-50">Reveal</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("skipped")} className="rounded bg-red-700 px-2 py-1 disabled:opacity-50">Skip</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={pause} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Pause</button>
                <button disabled={working} onClick={resume} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Resume</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("scored")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Mark Scored</button>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-rose-300">Score Entry</p>
              <div className="mt-2 space-y-2 text-xs">
                {leaderboard.map((team) => {
                  const draft = scoreDraft[team.team_id] ?? {
                    artist_correct: false,
                    title_correct: false,
                    awarded_points: "",
                  };
                  const suggestedPoints = getDefaultPoints(draft.artist_correct, draft.title_correct);

                  return (
                    <div key={team.team_id} className="grid grid-cols-[1.1fr,auto,auto,100px] items-center gap-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                      <div>
                        <p className="font-semibold">{team.team_name}</p>
                        <p className="text-[11px] text-stone-400">Total: {team.total_points} · Perfect: {team.perfect_calls}</p>
                      </div>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={draft.artist_correct}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? { title_correct: false, awarded_points: "" }),
                                artist_correct: e.target.checked,
                              },
                            }))
                          }
                        />
                        Artist
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={draft.title_correct}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? { artist_correct: false, awarded_points: "" }),
                                title_correct: e.target.checked,
                              },
                            }))
                          }
                        />
                        Title
                      </label>
                      <input
                        className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                        placeholder={`Auto ${suggestedPoints}`}
                        value={draft.awarded_points}
                        onChange={(e) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [team.team_id]: {
                              ...(current[team.team_id] ?? { artist_correct: false, title_correct: false }),
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
                {saving ? "Saving..." : "Save Scores for Current Snippet"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
