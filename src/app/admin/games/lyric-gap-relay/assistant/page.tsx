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

type ScoreDraft = Record<number, { exact_match: boolean; close_match: boolean; awarded_points: string; notes: string }>;

function getDefaultPoints(exactMatch: boolean, closeMatch: boolean): number {
  if (exactMatch) return 2;
  if (closeMatch) return 1;
  return 0;
}

function parseAcceptedAnswers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => String(entry).trim()).filter(Boolean);
}

export default function LyricGapRelayAssistantPage() {
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}`),
      fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}/calls`),
      fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) setSession((await sessionRes.json()) as Session);
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

  const activeCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const nextPendingCall = useMemo(() => calls.find((call) => call.status === "pending") ?? null, [calls]);
  const callForControls = activeCall ?? nextPendingCall;
  const acceptedAnswers = parseAcceptedAnswers(callForControls?.accepted_answers);
  const answerVisible = callForControls?.status === "answer_revealed" || callForControls?.status === "scored";

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = { exact_match: false, close_match: false, awarded_points: "", notes: "" };
    }
    setScoreDraft(draft);
  }, [callForControls?.id, leaderboard]);

  const submitScores = async () => {
    if (!callForControls) return;
    setSaving(true);
    setErrorText(null);

    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? {
          exact_match: false,
          close_match: false,
          awarded_points: "",
          notes: "",
        };
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: team.team_id,
          exact_match: draft.exact_match,
          close_match: draft.close_match,
          awarded_points:
            Number.isFinite(parsedPoints) && draft.awarded_points !== "" ? parsedPoints : undefined,
          notes: draft.notes || undefined,
        };
      });

      const res = await fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: callForControls.id,
          awards,
          scored_by: "assistant",
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to save scores");
      }

      await load();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to save scores");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#17101b,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4 rounded-3xl border border-fuchsia-900/50 bg-black/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black uppercase text-fuchsia-100">Lyric Gap Relay Assistant</h1>
            <p className="mt-1 text-sm text-stone-300">
              {session?.title ?? "(loading)"} · {session?.session_code ?? ""} · Round {session?.current_round ?? 0} of {session?.round_count ?? 0}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded border border-stone-600 px-3 py-1 text-xs uppercase" type="button" onClick={() => window.open(`/admin/games/lyric-gap-relay/host?sessionId=${sessionId}`, "lyric_gap_relay_host", "width=1280,height=900")}>Host</button>
            <button className="rounded border border-stone-600 px-3 py-1 text-xs uppercase" type="button" onClick={() => window.open(`/admin/games/lyric-gap-relay/jumbotron?sessionId=${sessionId}`, "lyric_gap_relay_jumbotron", "width=1920,height=1080")}>Jumbotron</button>
            <Link href="/admin/games/lyric-gap-relay/help" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Help</Link>
            <Link href="/admin/games/lyric-gap-relay" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
          </div>
        </div>

        {errorText ? <div className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200">{errorText}</div> : null}

        <div className="grid gap-4 lg:grid-cols-[1fr,1.05fr]">
          <section className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-fuchsia-200">Current Gap</h2>
            <div className="mt-3 rounded border border-fuchsia-700/40 bg-fuchsia-950/20 p-3">
              <p className="text-xs uppercase text-fuchsia-300">
                {callForControls ? `Gap ${callForControls.call_index} · Round ${callForControls.round_number}` : "Waiting"}
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
              {callForControls?.host_notes ? <p className="mt-2 text-xs text-stone-400">Host note: {callForControls.host_notes}</p> : null}
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
                  {calls.slice(-8).map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-fuchsia-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2">{call.artist} - {call.title}</td>
                      <td className="py-2 text-stone-400">{call.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4">
            <p className="text-xs uppercase text-fuchsia-300">Score Helper</p>
            <p className="mt-1 text-xs text-stone-400">Gap target: {session?.target_gap_seconds ?? 0}s · Remaining: {session?.remaining_seconds ?? 0}s · Status: {session?.status ?? "-"}</p>
            <div className="mt-2 space-y-2 text-xs">
              {leaderboard.map((team) => {
                const draft = scoreDraft[team.team_id] ?? {
                  exact_match: false,
                  close_match: false,
                  awarded_points: "",
                  notes: "",
                };
                const suggestedPoints = getDefaultPoints(draft.exact_match, draft.close_match);

                return (
                  <div key={team.team_id} className="rounded border border-stone-800 bg-stone-950/70 p-2">
                    <div className="grid grid-cols-[1.1fr,auto,auto,100px] items-center gap-2">
                      <div>
                        <p className="font-semibold">{team.team_name}</p>
                        <p className="text-[11px] text-stone-400">Total: {team.total_points} · Exact: {team.exact_hits} · Close: {team.close_hits}</p>
                      </div>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={draft.exact_match}
                          onChange={(event) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? { close_match: false, awarded_points: "", notes: "" }),
                                exact_match: event.target.checked,
                                close_match: event.target.checked ? false : (current[team.team_id]?.close_match ?? false),
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
                          onChange={(event) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? { exact_match: false, awarded_points: "", notes: "" }),
                                exact_match: event.target.checked ? false : (current[team.team_id]?.exact_match ?? false),
                                close_match: event.target.checked,
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
                        onChange={(event) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [team.team_id]: {
                              ...(current[team.team_id] ?? { exact_match: false, close_match: false, notes: "" }),
                              awarded_points: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <input
                      className="mt-2 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1 text-xs"
                      placeholder="Dispute note (optional)"
                      value={draft.notes}
                      onChange={(event) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [team.team_id]: {
                            ...(current[team.team_id] ?? { exact_match: false, close_match: false, awarded_points: "" }),
                            notes: event.target.value,
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
          </section>
        </div>
      </div>
    </div>
  );
}
