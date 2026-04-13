"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildWrongLyricOptions } from "src/lib/wrongLyricChallengeEngine";

type Session = {
  id: number;
  session_code: string;
  title: string;
  option_count: number;
  current_call_index: number;
  current_round: number;
  round_count: number;
  target_gap_seconds: number;
  remaining_seconds: number;
  lyric_points: number;
  song_bonus_enabled: boolean;
  song_bonus_points: number;
  show_options: boolean;
  status: "pending" | "running" | "paused" | "completed";
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  source_label: string | null;
  artist: string;
  title: string;
  correct_lyric: string;
  decoy_lyric_1: string;
  decoy_lyric_2: string;
  decoy_lyric_3: string | null;
  answer_slot: number;
  dj_cue_hint: string | null;
  host_notes: string | null;
  status: "pending" | "asked" | "locked" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  lyric_hits: number;
  bonus_hits: number;
};

type ScoreDraft = Record<number, { lyric_correct: boolean; song_bonus_awarded: boolean; awarded_points: string; guessed_option: string; notes: string }>;

function createDefaultScoreDraftEntry(): ScoreDraft[number] {
  return {
    lyric_correct: false,
    song_bonus_awarded: false,
    awarded_points: "",
    guessed_option: "",
    notes: "",
  };
}

function defaultPoints(session: Session | null, lyricCorrect: boolean, bonusAwarded: boolean): number {
  if (!session) return 0;
  const base = lyricCorrect ? session.lyric_points : 0;
  const bonus = lyricCorrect && bonusAwarded && session.song_bonus_enabled ? session.song_bonus_points : 0;
  return base + bonus;
}

export default function WrongLyricChallengeAssistantPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/wrong-lyric-challenge/sessions/${sessionId}`),
      fetch(`/api/games/wrong-lyric-challenge/sessions/${sessionId}/calls`),
      fetch(`/api/games/wrong-lyric-challenge/sessions/${sessionId}/leaderboard`),
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

  const options = useMemo(() => {
    if (!callForControls || !session) return [];
    return buildWrongLyricOptions(callForControls, session.option_count);
  }, [callForControls, session]);

  const previousCalls = useMemo(
    () => calls.filter((call) => ["asked", "locked", "revealed", "scored", "skipped"].includes(call.status)).slice(-6),
    [calls]
  );

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = createDefaultScoreDraftEntry();
    }
    setScoreDraft(draft);
  }, [callForControls?.id, leaderboard]);

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

  const advance = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/wrong-lyric-challenge/sessions/${sessionId}/advance`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to advance");
      }
    });
  };

  const pause = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/wrong-lyric-challenge/sessions/${sessionId}/pause`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to pause");
      }
    });
  };

  const resume = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/wrong-lyric-challenge/sessions/${sessionId}/resume`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to resume");
      }
    });
  };

  const patchCallStatus = async (status: "asked" | "locked" | "revealed" | "scored" | "skipped") => {
    if (!callForControls) return;
    await runAction(async () => {
      const res = await fetch(`/api/games/wrong-lyric-challenge/calls/${callForControls.id}`, {
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
    setErrorText(null);

    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? createDefaultScoreDraftEntry();

        const parsedPoints = Number(draft.awarded_points);
        const parsedOption = Number(draft.guessed_option);

        return {
          team_id: team.team_id,
          guessed_option: Number.isFinite(parsedOption) && draft.guessed_option !== "" ? parsedOption : undefined,
          lyric_correct: draft.lyric_correct,
          song_bonus_awarded: draft.song_bonus_awarded,
          awarded_points: Number.isFinite(parsedPoints) && draft.awarded_points !== "" ? parsedPoints : undefined,
          notes: draft.notes || undefined,
        };
      });

      const res = await fetch(`/api/games/wrong-lyric-challenge/sessions/${sessionId}/score`, {
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#171312,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-red-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black uppercase text-red-100">Wrong Lyric Challenge Assistant</h1>
            <p className="mt-1 text-sm text-stone-300">
              {session?.title} · {session?.session_code} · Round {session?.current_round} of {session?.round_count} · Status {session?.status}
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <button className="rounded border border-stone-700 px-2 py-1" onClick={() => load()}>Refresh</button>
            <Link href="/admin/games/wrong-lyric-challenge/help" className="rounded border border-stone-600 px-3 py-1 uppercase">Help</Link>
            <button type="button" onClick={() => window.open(`/admin/games/wrong-lyric-challenge/host?sessionId=${sessionId}`, "wrong_lyric_challenge_host", "width=1280,height=900")} className="rounded border border-stone-600 px-3 py-1 uppercase">Host</button>
            <button type="button" onClick={() => window.open(`/admin/games/wrong-lyric-challenge/jumbotron?sessionId=${sessionId}`, "wrong_lyric_challenge_jumbotron", "width=1920,height=1080")} className="rounded border border-stone-600 px-3 py-1 uppercase">Jumbotron</button>
            <Link href="/admin/games/wrong-lyric-challenge" className="rounded border border-stone-600 px-3 py-1 uppercase">Setup</Link>
          </div>
        </div>

        {errorText ? <div className="mt-3 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200">{errorText}</div> : null}

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-red-200">Session Controls</h2>
          <p className="mt-2 text-xs text-stone-400">Gap timer target: {session?.target_gap_seconds ?? 0}s · Remaining: {session?.remaining_seconds ?? 0}s · Status: {session?.status ?? "-"}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button disabled={working} onClick={advance} className="rounded bg-red-700 px-2 py-1 disabled:opacity-50">Advance Call</button>
            <button disabled={working || !callForControls} onClick={() => patchCallStatus("asked")} className="rounded bg-blue-700 px-2 py-1 disabled:opacity-50">Mark Asked</button>
            <button disabled={working || !callForControls} onClick={() => patchCallStatus("locked")} className="rounded bg-violet-700 px-2 py-1 disabled:opacity-50">Lock Picks</button>
            <button disabled={working || !callForControls} onClick={() => patchCallStatus("revealed")} className="rounded bg-amber-700 px-2 py-1 disabled:opacity-50">Reveal</button>
            <button disabled={working || !callForControls} onClick={() => patchCallStatus("skipped")} className="rounded bg-red-900 px-2 py-1 disabled:opacity-50">Skip</button>
            <button disabled={working || !callForControls} onClick={() => patchCallStatus("scored")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Mark Scored</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <button disabled={working} onClick={pause} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Pause</button>
            <button disabled={working} onClick={resume} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Resume</button>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-red-200">Current Call Intake</h2>
          <p className="mt-2 text-sm text-stone-300">
            {callForControls ? `Call ${callForControls.call_index} · ${callForControls.artist} - ${callForControls.title}` : "Waiting for host to open a call."}
          </p>
          <p className="mt-1 text-xs text-stone-400">Source: {callForControls?.source_label ?? "Unlabeled"} · Cue: {callForControls?.dj_cue_hint ?? "none"} · Status: {callForControls?.status ?? "-"}</p>
          {callForControls?.host_notes ? <p className="mt-2 text-xs text-stone-400">Host note: {callForControls.host_notes}</p> : null}

          {session?.show_options && options.length ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {options.map((option) => (
                <div key={option.slot} className="rounded border border-stone-700 bg-stone-950/70 px-2 py-1 text-sm">
                  <span className="mr-2 font-bold text-red-200">{option.label}.</span>
                  {option.lyric}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 text-xs">
            <p className="font-semibold text-stone-300">Recently Called</p>
            <div className="mt-1 max-h-24 overflow-auto text-stone-400">
              {previousCalls.map((call) => (
                <div key={call.id}>#{call.call_index} {call.artist} - {call.title} ({call.status})</div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-red-200">Assistant Score Entry</h2>
          <div className="mt-3 space-y-2 text-xs">
            {leaderboard.map((team) => {
              const draft = scoreDraft[team.team_id] ?? createDefaultScoreDraftEntry();
              const suggested = defaultPoints(session, draft.lyric_correct, draft.song_bonus_awarded);

              return (
                <div key={team.team_id} className="rounded border border-stone-800 bg-stone-950/70 p-2">
                  <div className="grid grid-cols-[1.2fr,auto,auto,110px] items-center gap-2">
                    <div>
                      <p className="font-semibold">{team.team_name}</p>
                      <p className="text-[11px] text-stone-400">Total: {team.total_points} · Lyric hits: {team.lyric_hits} · Bonus: {team.bonus_hits}</p>
                    </div>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={draft.lyric_correct}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setScoreDraft((current) => {
                            const currentDraft = current[team.team_id] ?? createDefaultScoreDraftEntry();
                            return {
                              ...current,
                              [team.team_id]: {
                                ...currentDraft,
                                lyric_correct: checked,
                                song_bonus_awarded: checked ? currentDraft.song_bonus_awarded : false,
                              },
                            };
                          });
                        }}
                      />
                      Lyric
                    </label>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={draft.song_bonus_awarded}
                        disabled={!session?.song_bonus_enabled || !draft.lyric_correct}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setScoreDraft((current) => {
                            const currentDraft = current[team.team_id] ?? createDefaultScoreDraftEntry();
                            return {
                              ...current,
                              [team.team_id]: {
                                ...currentDraft,
                                song_bonus_awarded: checked,
                              },
                            };
                          });
                        }}
                      />
                      Bonus
                    </label>
                    <input
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      placeholder={`Auto ${suggested}`}
                      value={draft.awarded_points}
                      onChange={(e) => {
                        const value = e.target.value;
                        setScoreDraft((current) => {
                          const currentDraft = current[team.team_id] ?? createDefaultScoreDraftEntry();
                          return {
                            ...current,
                            [team.team_id]: {
                              ...currentDraft,
                              awarded_points: value,
                            },
                          };
                        });
                      }}
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-[90px,1fr] gap-2">
                    <select
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={draft.guessed_option}
                      onChange={(e) => {
                        const value = e.target.value;
                        setScoreDraft((current) => {
                          const currentDraft = current[team.team_id] ?? createDefaultScoreDraftEntry();
                          return {
                            ...current,
                            [team.team_id]: {
                              ...currentDraft,
                              guessed_option: value,
                            },
                          };
                        });
                      }}
                    >
                      <option value="">Option</option>
                      {(session?.option_count ?? 3) >= 1 ? <option value="1">A</option> : null}
                      {(session?.option_count ?? 3) >= 2 ? <option value="2">B</option> : null}
                      {(session?.option_count ?? 3) >= 3 ? <option value="3">C</option> : null}
                      {(session?.option_count ?? 3) >= 4 ? <option value="4">D</option> : null}
                    </select>
                    <input
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      placeholder="Dispute note (optional)"
                      value={draft.notes}
                      onChange={(e) => {
                        const value = e.target.value;
                        setScoreDraft((current) => {
                          const currentDraft = current[team.team_id] ?? createDefaultScoreDraftEntry();
                          return {
                            ...current,
                            [team.team_id]: {
                              ...currentDraft,
                              notes: value,
                            },
                          };
                        });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <button disabled={!callForControls || saving} onClick={submitScores} className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold disabled:opacity-50">
            {saving ? "Saving..." : "Save Scores as Assistant"}
          </button>
        </section>
      </div>
    </div>
  );
}
