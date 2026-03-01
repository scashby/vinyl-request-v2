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
  judge_mode: "official_key" | "crowd_check";
  close_match_policy: "host_discretion" | "strict_key";
  remaining_seconds: number;
  target_gap_seconds: number;
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  source_label: string | null;
  artist: string;
  title: string;
  cue_lyric: string;
  answer_lyric: string;
  accepted_answers: unknown;
  host_notes: string | null;
  status: "pending" | "asked" | "locked" | "answer_revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  exact_hits: number;
  close_hits: number;
};

type ScoreDraft = Record<number, { exact_match: boolean; close_match: boolean; awarded_points: string }>;

function getDefaultPoints(exactMatch: boolean, closeMatch: boolean): number {
  if (exactMatch) return 2;
  if (closeMatch) return 1;
  return 0;
}

function parseAcceptedAnswers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => String(entry).trim()).filter(Boolean);
}

export default function LyricGapRelayHostPage() {
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
      fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}`),
      fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}/calls`),
      fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}/leaderboard`),
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
      draft[row.team_id] = { exact_match: false, close_match: false, awarded_points: "" };
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
      const res = await fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}/advance`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to advance");
      }
    });
  };

  const pause = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}/pause`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to pause");
      }
    });
  };

  const resume = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}/resume`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to resume");
      }
    });
  };

  const patchCallStatus = async (status: "asked" | "locked" | "answer_revealed" | "scored" | "skipped") => {
    if (!callForControls) return;
    await runAction(async () => {
      const res = await fetch(`/api/games/lyric-gap-relay/calls/${callForControls.id}`, {
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
          exact_match: false,
          close_match: false,
          awarded_points: "",
        };
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: team.team_id,
          exact_match: draft.exact_match,
          close_match: draft.close_match,
          awarded_points:
            Number.isFinite(parsedPoints) && draft.awarded_points !== ""
              ? parsedPoints
              : undefined,
        };
      });

      const res = await fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}/score`, {
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

  const acceptedAnswers = parseAcceptedAnswers(callForControls?.accepted_answers);
  const answerVisible = callForControls?.status === "answer_revealed" || callForControls?.status === "scored";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#171717)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-fuchsia-900/40 bg-black/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-fuchsia-300">Host Console</p>
              <h1 className="text-3xl font-black uppercase">Lyric Gap Relay Host</h1>
              <p className="text-sm text-stone-400">
                {session?.title} · {session?.session_code} · Round {session?.current_round} of {session?.round_count}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/lyric-gap-relay/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/lyric-gap-relay/help">Help</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/lyric-gap-relay/history">History</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/lyric-gap-relay">Setup</Link>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-fuchsia-200">Lyric Gap Stack</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Track</th>
                    <th className="pb-2">Cue Lyric</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-fuchsia-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2">{call.artist} - {call.title}</td>
                      <td className="py-2">{call.cue_lyric}</td>
                      <td className="py-2 text-stone-400">{call.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-fuchsia-200">Current Gap</h2>
              <div className="mt-3 rounded border border-fuchsia-700/40 bg-fuchsia-950/20 p-3">
                <p className="text-xs uppercase text-fuchsia-300">
                  {callForControls
                    ? `Gap ${callForControls.call_index} · Round ${callForControls.round_number}`
                    : "Waiting"}
                </p>
                <p className="mt-1 text-lg font-black">
                  {callForControls ? `${callForControls.artist} - ${callForControls.title}` : "No active gap"}
                </p>
                <p className="mt-2 text-sm text-stone-200">Cue lyric: {callForControls?.cue_lyric ?? "-"}</p>
                <p className="mt-1 text-sm text-stone-300">
                  {answerVisible ? `Official line: ${callForControls?.answer_lyric}` : "Official line hidden until reveal"}
                </p>
                {answerVisible && acceptedAnswers.length > 1 ? (
                  <p className="mt-1 text-xs text-stone-400">Accepted alternates: {acceptedAnswers.slice(1).join(" | ")}</p>
                ) : null}
                <p className="mt-2 text-sm text-stone-300">
                  Source: {callForControls?.source_label ?? "Unlabeled"} · Judge: {session?.judge_mode ?? "-"} · Close-match policy: {session?.close_match_policy ?? "-"}
                </p>
                {callForControls?.host_notes ? (
                  <p className="mt-2 text-xs text-stone-400">Host note: {callForControls.host_notes}</p>
                ) : null}
              </div>

              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Recently Played</p>
                <div className="mt-1 max-h-24 overflow-auto text-stone-400">
                  {previousCalls.map((call) => (
                    <div key={call.id}>#{call.call_index} {call.artist} - {call.title} ({call.status})</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-fuchsia-300">Controls</p>
              <p className="mt-1 text-xs text-stone-400">Gap timer target: {session?.target_gap_seconds ?? 0}s · Remaining: {session?.remaining_seconds ?? 0}s · Status: {session?.status ?? "-"}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={advance} className="rounded bg-fuchsia-700 px-2 py-1 disabled:opacity-50">Advance Gap</button>
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
              <p className="text-xs uppercase text-fuchsia-300">Score Entry</p>
              <div className="mt-2 space-y-2 text-xs">
                {leaderboard.map((team) => {
                  const draft = scoreDraft[team.team_id] ?? {
                    exact_match: false,
                    close_match: false,
                    awarded_points: "",
                  };
                  const suggestedPoints = getDefaultPoints(draft.exact_match, draft.close_match);

                  return (
                    <div key={team.team_id} className="grid grid-cols-[1.1fr,auto,auto,100px] items-center gap-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                      <div>
                        <p className="font-semibold">{team.team_name}</p>
                        <p className="text-[11px] text-stone-400">Total: {team.total_points} · Exact: {team.exact_hits} · Close: {team.close_hits}</p>
                      </div>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={draft.exact_match}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? { close_match: false, awarded_points: "" }),
                                exact_match: e.target.checked,
                                close_match: e.target.checked ? false : (current[team.team_id]?.close_match ?? false),
                              },
                            }))
                          }
                        />
                        Exact
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={draft.close_match}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? { exact_match: false, awarded_points: "" }),
                                exact_match: e.target.checked ? false : (current[team.team_id]?.exact_match ?? false),
                                close_match: e.target.checked,
                              },
                            }))
                          }
                        />
                        Close
                      </label>
                      <input
                        className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                        placeholder={`Auto ${suggestedPoints}`}
                        value={draft.awarded_points}
                        onChange={(e) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [team.team_id]: {
                              ...(current[team.team_id] ?? { exact_match: false, close_match: false }),
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
                {saving ? "Saving..." : "Save Scores for Current Gap"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
