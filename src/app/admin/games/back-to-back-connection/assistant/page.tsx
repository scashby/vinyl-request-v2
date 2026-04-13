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
  connection_points: number;
  detail_bonus_points: number;
  target_gap_seconds: number;
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
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

export default function BackToBackConnectionAssistantPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

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

  const nextPendingCall = useMemo(() => calls.find((call) => call.status === "pending") ?? null, [calls]);
  const callForControls = currentCall ?? nextPendingCall;

  const upcomingPairs = useMemo(
    () => calls.filter((call) => call.call_index > (session?.current_call_index ?? 0)).slice(0, 2),
    [calls, session?.current_call_index]
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

  const submitScores = async () => {
    if (!callForControls) return;
    setSaving(true);
    setErrorText(null);

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

        {errorText ? <div className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200">{errorText}</div> : null}

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Current Pair Monitor</h2>
          {callForControls ? (
            <div className="mt-2 text-sm text-stone-200">
              <p className="font-semibold">Pair #{callForControls.call_index} · Round {callForControls.round_number}</p>
              <p className="mt-1">Track A: {callForControls.track_a_artist} - {callForControls.track_a_title}</p>
              <p>Track B: {callForControls.track_b_artist} - {callForControls.track_b_title}</p>
              <p className="mt-1 text-stone-400">State: {callForControls.status}</p>
              <p className="mt-1 text-stone-400">Sources: {callForControls.track_a_source_label ?? "-"} | {callForControls.track_b_source_label ?? "-"}</p>
              {(callForControls.status === "revealed" || callForControls.status === "scored") ? (
                <p className="mt-2 text-amber-300">Answer: {callForControls.accepted_connection}{callForControls.accepted_detail ? ` · Detail: ${callForControls.accepted_detail}` : ""}</p>
              ) : (
                <p className="mt-2 text-stone-400">Answer hidden until host reveal.</p>
              )}
              {callForControls.host_notes ? <p className="mt-2 text-xs text-stone-400">Host note: {callForControls.host_notes}</p> : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-stone-400">No active pair yet.</p>
          )}
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Score Helper</h2>
          <p className="mt-2 text-xs text-stone-400">Default points: +{session?.connection_points ?? 0} for the connection and +{session?.detail_bonus_points ?? 0} for the detail bonus. Gap target: {session?.target_gap_seconds ?? 0}s.</p>
          <div className="mt-3 space-y-2 text-xs">
            {leaderboard.map((row) => {
              const draft = scoreDraft[row.team_id] ?? {
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
                <div key={row.team_id} className="space-y-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{row.team_name}</p>
                      <p className="text-[11px] text-stone-400">Total: {row.total_points} · Connections: {row.connection_hits} · Details: {row.detail_hits}</p>
                    </div>
                    <input
                      className="w-24 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      placeholder={`Auto ${suggestedPoints}`}
                      value={draft.awarded_points}
                      onChange={(event) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [row.team_id]: {
                            ...(current[row.team_id] ?? {
                              guessed_connection: "",
                              guessed_detail: "",
                              connection_correct: false,
                              detail_correct: false,
                              notes: "",
                            }),
                            awarded_points: event.target.value,
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
                      onChange={(event) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [row.team_id]: {
                            ...(current[row.team_id] ?? {
                              guessed_detail: "",
                              connection_correct: false,
                              detail_correct: false,
                              awarded_points: "",
                              notes: "",
                            }),
                            guessed_connection: event.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      placeholder="Guessed detail"
                      value={draft.guessed_detail}
                      onChange={(event) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [row.team_id]: {
                            ...(current[row.team_id] ?? {
                              guessed_connection: "",
                              connection_correct: false,
                              detail_correct: false,
                              awarded_points: "",
                              notes: "",
                            }),
                            guessed_detail: event.target.value,
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
                        onChange={(event) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [row.team_id]: {
                              ...(current[row.team_id] ?? {
                                guessed_connection: "",
                                guessed_detail: "",
                                detail_correct: false,
                                awarded_points: "",
                                notes: "",
                              }),
                              connection_correct: event.target.checked,
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
                        onChange={(event) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [row.team_id]: {
                              ...(current[row.team_id] ?? {
                                guessed_connection: "",
                                guessed_detail: "",
                                connection_correct: false,
                                awarded_points: "",
                                notes: "",
                              }),
                              detail_correct: event.target.checked,
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
                      onChange={(event) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [row.team_id]: {
                            ...(current[row.team_id] ?? {
                              guessed_connection: "",
                              guessed_detail: "",
                              connection_correct: false,
                              detail_correct: false,
                              awarded_points: "",
                            }),
                            notes: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              );
            })}
            {leaderboard.length === 0 ? <p className="mt-2 text-sm text-stone-400">No scores yet.</p> : null}
          </div>
          <button
            disabled={saving || !callForControls}
            onClick={submitScores}
            className="mt-3 rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-300"
          >
            {saving ? "Saving..." : "Save Scores for Current Pair"}
          </button>
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
