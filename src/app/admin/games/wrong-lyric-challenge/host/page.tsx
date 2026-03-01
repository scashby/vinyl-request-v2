"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildWrongLyricOptions } from "src/lib/wrongLyricChallengeEngine";

type Session = {
  id: number;
  session_code: string;
  title: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  target_gap_seconds: number;
  remaining_seconds: number;
  status: "pending" | "running" | "paused" | "completed";
  option_count: number;
  lyric_points: number;
  song_bonus_enabled: boolean;
  song_bonus_points: number;
  show_options: boolean;
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
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

type ScoreDraft = Record<
  number,
  {
    lyric_correct: boolean;
    song_bonus_awarded: boolean;
    awarded_points: string;
    guessed_option: string;
    guessed_artist: string;
    guessed_title: string;
    notes: string;
  }
>;

function createDefaultScoreDraftEntry(): ScoreDraft[number] {
  return {
    lyric_correct: false,
    song_bonus_awarded: false,
    awarded_points: "",
    guessed_option: "",
    guessed_artist: "",
    guessed_title: "",
    notes: "",
  };
}

function getDefaultPoints(session: Session | null, lyricCorrect: boolean, bonusAwarded: boolean): number {
  if (!session) return 0;
  const base = lyricCorrect ? session.lyric_points : 0;
  const bonus = lyricCorrect && session.song_bonus_enabled && bonusAwarded ? session.song_bonus_points : 0;
  return base + bonus;
}

export default function WrongLyricChallengeHostPage() {
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

  const activeCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const nextPendingCall = useMemo(() => calls.find((call) => call.status === "pending") ?? null, [calls]);
  const callForControls = activeCall ?? nextPendingCall;

  const previousCalls = useMemo(
    () => calls.filter((call) => ["asked", "locked", "revealed", "scored", "skipped"].includes(call.status)).slice(-6),
    [calls]
  );

  const callOptions = useMemo(() => {
    if (!callForControls || !session) return [];
    return buildWrongLyricOptions(callForControls, session.option_count);
  }, [callForControls, session]);

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = createDefaultScoreDraftEntry();
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

    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? createDefaultScoreDraftEntry();

        const parsedPoints = Number(draft.awarded_points);
        const parsedOption = Number(draft.guessed_option);

        return {
          team_id: team.team_id,
          guessed_option: Number.isFinite(parsedOption) && draft.guessed_option !== "" ? parsedOption : undefined,
          guessed_artist: draft.guessed_artist || undefined,
          guessed_title: draft.guessed_title || undefined,
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#0d0909,#191212)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-red-900/40 bg-black/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-red-300">Host Console</p>
              <h1 className="text-3xl font-black uppercase">Wrong Lyric Challenge Host</h1>
              <p className="text-sm text-stone-400">
                {session?.title} · {session?.session_code} · Round {session?.current_round} of {session?.round_count}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/wrong-lyric-challenge/help">Help</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/wrong-lyric-challenge/assistant?sessionId=${sessionId}`}>Assistant</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/wrong-lyric-challenge/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/wrong-lyric-challenge/history">History</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/wrong-lyric-challenge">Setup</Link>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-red-200">Call Stack</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Track</th>
                    <th className="pb-2">Source</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-red-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2">{call.artist} - {call.title}</td>
                      <td className="py-2">{call.source_label ?? "-"}</td>
                      <td className="py-2 text-stone-400">{call.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-red-200">Current Call</h2>
              <div className="mt-3 rounded border border-red-700/40 bg-red-950/20 p-3">
                <p className="text-xs uppercase text-red-300">
                  {callForControls
                    ? `Call ${callForControls.call_index} · Round ${callForControls.round_number}`
                    : "Waiting"}
                </p>
                <p className="mt-1 text-lg font-black">
                  {callForControls ? `${callForControls.artist} - ${callForControls.title}` : "No active call"}
                </p>
                <p className="mt-2 text-sm text-stone-300">
                  Source: {callForControls?.source_label ?? "Unlabeled"} · Cue: {callForControls?.dj_cue_hint ?? "none"}
                </p>
                <p className="mt-1 text-sm text-stone-300">Status: {callForControls?.status ?? "-"}</p>
                {callForControls?.host_notes ? (
                  <p className="mt-2 text-xs text-stone-400">Host note: {callForControls.host_notes}</p>
                ) : null}

                {session?.show_options && callOptions.length ? (
                  <div className="mt-3 space-y-1 text-sm">
                    {callOptions.map((option) => {
                      const isReveal = callForControls?.status === "revealed" || callForControls?.status === "scored";
                      return (
                        <div
                          key={option.slot}
                          className={`rounded border px-2 py-1 ${
                            isReveal && option.is_answer
                              ? "border-emerald-500 bg-emerald-900/40 text-emerald-100"
                              : "border-stone-700 bg-stone-950/60"
                          }`}
                        >
                          <span className="mr-2 font-bold text-red-200">{option.label}.</span>
                          <span>{option.lyric}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Recently Called</p>
                <div className="mt-1 max-h-24 overflow-auto text-stone-400">
                  {previousCalls.map((call) => (
                    <div key={call.id}>#{call.call_index} {call.artist} - {call.title} ({call.status})</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-red-300">Controls</p>
              <p className="mt-1 text-xs text-stone-400">
                Gap timer target: {session?.target_gap_seconds ?? 0}s · Remaining: {session?.remaining_seconds ?? 0}s · Status: {session?.status ?? "-"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={advance} className="rounded bg-red-700 px-2 py-1 disabled:opacity-50">Advance Call</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("asked")} className="rounded bg-blue-700 px-2 py-1 disabled:opacity-50">Mark Asked</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("locked")} className="rounded bg-violet-700 px-2 py-1 disabled:opacity-50">Lock Picks</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("revealed")} className="rounded bg-amber-700 px-2 py-1 disabled:opacity-50">Reveal</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("skipped")} className="rounded bg-red-900 px-2 py-1 disabled:opacity-50">Skip</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={pause} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Pause</button>
                <button disabled={working} onClick={resume} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Resume</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("scored")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Mark Scored</button>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-red-300">Score Entry</p>
              <div className="mt-2 space-y-2 text-xs">
                {leaderboard.map((team) => {
                  const draft = scoreDraft[team.team_id] ?? createDefaultScoreDraftEntry();

                  const suggestedPoints = getDefaultPoints(session, draft.lyric_correct, draft.song_bonus_awarded);

                  return (
                    <div key={team.team_id} className="rounded border border-stone-800 bg-stone-950/70 p-2">
                      <div className="grid grid-cols-[1.2fr,auto,auto,110px] items-center gap-2">
                        <div>
                          <p className="font-semibold">{team.team_name}</p>
                          <p className="text-[11px] text-stone-400">Total: {team.total_points} · Lyric hits: {team.lyric_hits} · Bonus hits: {team.bonus_hits}</p>
                        </div>
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={draft.lyric_correct}
                            onChange={(e) =>
                              setScoreDraft((current) => ({
                                ...current,
                                [team.team_id]: {
                                  ...(current[team.team_id] ?? createDefaultScoreDraftEntry()),
                                  lyric_correct: e.target.checked,
                                  song_bonus_awarded: e.target.checked ? (current[team.team_id]?.song_bonus_awarded ?? false) : false,
                                },
                              }))
                            }
                          />
                          Lyric
                        </label>
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={draft.song_bonus_awarded}
                            disabled={!session?.song_bonus_enabled || !draft.lyric_correct}
                            onChange={(e) =>
                              setScoreDraft((current) => ({
                                ...current,
                                [team.team_id]: {
                                  ...(current[team.team_id] ?? createDefaultScoreDraftEntry()),
                                  song_bonus_awarded: e.target.checked,
                                },
                              }))
                            }
                          />
                          Bonus
                        </label>
                        <input
                          className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                          placeholder={`Auto ${suggestedPoints}`}
                          value={draft.awarded_points}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? createDefaultScoreDraftEntry()),
                                awarded_points: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>

                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[80px,1fr,1fr]">
                        <select
                          className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                          value={draft.guessed_option}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? createDefaultScoreDraftEntry()),
                                guessed_option: e.target.value,
                              },
                            }))
                          }
                        >
                          <option value="">Option</option>
                          {(session?.option_count ?? 3) >= 1 ? <option value="1">A</option> : null}
                          {(session?.option_count ?? 3) >= 2 ? <option value="2">B</option> : null}
                          {(session?.option_count ?? 3) >= 3 ? <option value="3">C</option> : null}
                          {(session?.option_count ?? 3) >= 4 ? <option value="4">D</option> : null}
                        </select>
                        <input
                          className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                          placeholder="Guessed artist (optional)"
                          value={draft.guessed_artist}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? createDefaultScoreDraftEntry()),
                                guessed_artist: e.target.value,
                              },
                            }))
                          }
                        />
                        <input
                          className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                          placeholder="Guessed title (optional)"
                          value={draft.guessed_title}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? createDefaultScoreDraftEntry()),
                                guessed_title: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>

                      <input
                        className="mt-2 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                        placeholder="Score note (optional)"
                        value={draft.notes}
                        onChange={(e) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [team.team_id]: {
                              ...(current[team.team_id] ?? createDefaultScoreDraftEntry()),
                              notes: e.target.value,
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
