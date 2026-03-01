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
  lyric_points: number;
  song_bonus_enabled: boolean;
  song_bonus_points: number;
  status: "pending" | "running" | "paused" | "completed";
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  artist: string;
  title: string;
  correct_lyric: string;
  decoy_lyric_1: string;
  decoy_lyric_2: string;
  decoy_lyric_3: string | null;
  answer_slot: number;
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

  const options = useMemo(() => {
    if (!currentCall || !session) return [];
    return buildWrongLyricOptions(currentCall, session.option_count);
  }, [currentCall, session]);

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = {
        lyric_correct: false,
        song_bonus_awarded: false,
        awarded_points: "",
        guessed_option: "",
        notes: "",
      };
    }
    setScoreDraft(draft);
  }, [currentCall?.id, leaderboard]);

  const submitScores = async () => {
    if (!currentCall) return;
    setSaving(true);

    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? {
          lyric_correct: false,
          song_bonus_awarded: false,
          awarded_points: "",
          guessed_option: "",
          notes: "",
        };

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
          call_id: currentCall.id,
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
      alert(error instanceof Error ? error.message : "Failed to save scores");
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
            <Link href={`/admin/games/wrong-lyric-challenge/host?sessionId=${sessionId}`} className="rounded border border-stone-600 px-3 py-1 uppercase">Host</Link>
            <Link href="/admin/games/wrong-lyric-challenge" className="rounded border border-stone-600 px-3 py-1 uppercase">Setup</Link>
          </div>
        </div>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-red-200">Current Call Intake</h2>
          <p className="mt-2 text-sm text-stone-300">
            {currentCall ? `Call ${currentCall.call_index} · ${currentCall.artist} - ${currentCall.title}` : "Waiting for host to open a call."}
          </p>
          <p className="mt-1 text-xs text-stone-400">Use this screen for score capture only. Host controls transport/reveal timing.</p>

          {options.length ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {options.map((option) => (
                <div key={option.slot} className="rounded border border-stone-700 bg-stone-950/70 px-2 py-1 text-sm">
                  <span className="mr-2 font-bold text-red-200">{option.label}.</span>
                  {option.lyric}
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-red-200">Assistant Score Entry</h2>
          <div className="mt-3 space-y-2 text-xs">
            {leaderboard.map((team) => {
              const draft = scoreDraft[team.team_id] ?? {
                lyric_correct: false,
                song_bonus_awarded: false,
                awarded_points: "",
                guessed_option: "",
                notes: "",
              };
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
                        onChange={(e) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [team.team_id]: {
                              ...(current[team.team_id] ?? {}),
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
                              ...(current[team.team_id] ?? {}),
                              song_bonus_awarded: e.target.checked,
                            },
                          }))
                        }
                      />
                      Bonus
                    </label>
                    <input
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      placeholder={`Auto ${suggested}`}
                      value={draft.awarded_points}
                      onChange={(e) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [team.team_id]: {
                            ...(current[team.team_id] ?? {}),
                            awarded_points: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-[90px,1fr] gap-2">
                    <select
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={draft.guessed_option}
                      onChange={(e) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [team.team_id]: {
                            ...(current[team.team_id] ?? {}),
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
                      placeholder="Dispute note (optional)"
                      value={draft.notes}
                      onChange={(e) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [team.team_id]: {
                            ...(current[team.team_id] ?? {}),
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
          <button disabled={!currentCall || saving} onClick={submitScores} className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold disabled:opacity-50">
            {saving ? "Saving..." : "Save Scores as Assistant"}
          </button>
        </section>
      </div>
    </div>
  );
}
