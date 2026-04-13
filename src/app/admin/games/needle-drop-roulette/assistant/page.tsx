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
  answer_mode: "slips" | "whiteboard" | "mixed";
  snippet_seconds: number;
  target_gap_seconds: number;
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  artist: string;
  title: string;
  source_label: string | null;
  detail: string | null;
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

type ScoreDraft = Record<number, { artist_correct: boolean; title_correct: boolean; awarded_points: string; notes: string }>;

function getDefaultPoints(artistCorrect: boolean, titleCorrect: boolean): number {
  if (artistCorrect && titleCorrect) return 2;
  if (artistCorrect || titleCorrect) return 1;
  return 0;
}

export default function NeedleDropRouletteAssistantPage() {
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
      fetch(`/api/games/needle-drop-roulette/sessions/${sessionId}`),
      fetch(`/api/games/needle-drop-roulette/sessions/${sessionId}/calls`),
      fetch(`/api/games/needle-drop-roulette/sessions/${sessionId}/leaderboard`),
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
    const poll = setInterval(load, 2500);
    return () => clearInterval(poll);
  }, [load]);

  const activeCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const pending = useMemo(() => calls.filter((call) => call.status === "pending").slice(0, 5), [calls]);
  const callForControls = activeCall ?? pending[0] ?? null;

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = { artist_correct: false, title_correct: false, awarded_points: "", notes: "" };
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
          artist_correct: false,
          title_correct: false,
          awarded_points: "",
          notes: "",
        };
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: team.team_id,
          artist_correct: draft.artist_correct,
          title_correct: draft.title_correct,
          awarded_points:
            Number.isFinite(parsedPoints) && draft.awarded_points !== "" ? parsedPoints : undefined,
          notes: draft.notes || undefined,
        };
      });

      const res = await fetch(`/api/games/needle-drop-roulette/sessions/${sessionId}/score`, {
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#17100c,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl space-y-4 rounded-3xl border border-amber-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black uppercase text-amber-100">Needle Drop Roulette Assistant</h1>
            <p className="mt-1 text-sm text-stone-300">
              {session?.title ?? "(none selected)"} · {session?.session_code ?? ""} · Round {session?.current_round ?? 0} of {session?.round_count ?? 0}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded border border-stone-600 px-3 py-1 text-xs uppercase" type="button" onClick={() => window.open(`/admin/games/needle-drop-roulette/host?sessionId=${sessionId}`, "needle_drop_roulette_host", "width=1280,height=900")}>Host</button>
            <button className="rounded border border-stone-600 px-3 py-1 text-xs uppercase" type="button" onClick={() => window.open(`/admin/games/needle-drop-roulette/jumbotron?sessionId=${sessionId}`, "needle_drop_roulette_jumbotron", "width=1920,height=1080")}>Jumbotron</button>
            <Link href="/admin/games/needle-drop-roulette" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
          </div>
        </div>

        <p className="text-sm text-stone-300">Status: {session?.status ?? "pending"} · Snippet: {session?.snippet_seconds ?? 0}s · Mode: {session?.answer_mode ?? "-"} · Pacing: {session?.target_gap_seconds ?? 0}s</p>
        {errorText ? <div className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200">{errorText}</div> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Live Call Monitor</h2>
            {callForControls ? (
              <div className="mt-2 text-sm text-stone-200">
                <p>#{callForControls.call_index} · Round {callForControls.round_number}</p>
                <p className="text-stone-400">{callForControls.artist} - {callForControls.title}</p>
                <p className="text-stone-400">Status: {callForControls.status}</p>
                <p className="text-stone-400">Source: {callForControls.source_label ?? "Unlabeled"} · Snippet: {callForControls.detail ?? `${session?.snippet_seconds ?? 0}s`}</p>
                {callForControls.host_notes ? <p className="mt-1 text-xs text-stone-500">Host note: {callForControls.host_notes}</p> : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-stone-400">No active call yet.</p>
            )}

            <p className="mt-3 text-xs uppercase tracking-wide text-stone-400">Next pending</p>
            <ul className="mt-1 space-y-1 text-xs text-stone-300">
              {pending.map((call) => (
                <li key={call.id}>#{call.call_index} {call.artist} - {call.title}</li>
              ))}
              {pending.length === 0 ? <li className="text-stone-500">No pending calls.</li> : null}
            </ul>
          </section>

          <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Score Helper</h2>
            <div className="mt-2 space-y-2 text-sm">
              {leaderboard.map((row) => {
                const draft = scoreDraft[row.team_id] ?? {
                  artist_correct: false,
                  title_correct: false,
                  awarded_points: "",
                  notes: "",
                };
                const suggestedPoints = getDefaultPoints(draft.artist_correct, draft.title_correct);

                return (
                  <div key={row.team_id} className="rounded border border-stone-800 bg-black/20 px-2 py-2">
                    <div className="grid grid-cols-[1.1fr,auto,auto,100px] items-center gap-2">
                      <div>
                        <p>{row.team_name}</p>
                        <p className="text-[11px] text-stone-400">{row.total_points} pts · Artist {row.artist_hits} · Title {row.title_hits} · Perfect {row.perfect_calls}</p>
                      </div>
                      <label className="inline-flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={draft.artist_correct}
                          onChange={(event) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [row.team_id]: {
                                ...(current[row.team_id] ?? { title_correct: false, awarded_points: "", notes: "" }),
                                artist_correct: event.target.checked,
                              },
                            }))
                          }
                        />
                        Artist
                      </label>
                      <label className="inline-flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={draft.title_correct}
                          onChange={(event) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [row.team_id]: {
                                ...(current[row.team_id] ?? { artist_correct: false, awarded_points: "", notes: "" }),
                                title_correct: event.target.checked,
                              },
                            }))
                          }
                        />
                        Title
                      </label>
                      <input
                        className="rounded border border-stone-700 bg-stone-950 px-2 py-1 text-xs"
                        placeholder={`Auto ${suggestedPoints}`}
                        value={draft.awarded_points}
                        onChange={(event) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [row.team_id]: {
                              ...(current[row.team_id] ?? { artist_correct: false, title_correct: false, notes: "" }),
                              awarded_points: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <input
                      className="mt-2 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1 text-xs"
                      placeholder="Score note (optional)"
                      value={draft.notes}
                      onChange={(event) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [row.team_id]: {
                            ...(current[row.team_id] ?? { artist_correct: false, title_correct: false, awarded_points: "" }),
                            notes: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                );
              })}
              {leaderboard.length === 0 ? <p className="text-stone-500">No scores recorded yet.</p> : null}
            </div>
            <button disabled={!callForControls || saving} onClick={submitScores} className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold disabled:opacity-50">
              {saving ? "Saving..." : "Save Scores for Current Drop"}
            </button>
          </section>
        </div>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Assistant mode now handles live answer adjudication and per-team artist/title scoring while host keeps transport and reveal timing centralized.
        </section>
      </div>
    </div>
  );
}
