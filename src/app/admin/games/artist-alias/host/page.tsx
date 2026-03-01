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
  stage_one_points: number;
  stage_two_points: number;
  final_reveal_points: number;
  target_gap_seconds: number;
  status: "pending" | "running" | "paused" | "completed";
  show_title: boolean;
  show_round: boolean;
  show_scoreboard: boolean;
  show_stage_hint: boolean;
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  source_label: string | null;
  artist_name: string;
  accepted_aliases: string[];
  clue_era: string;
  clue_collaborator: string;
  clue_label_region: string;
  audio_clue_source: string | null;
  host_notes: string | null;
  status: "pending" | "stage_1" | "stage_2" | "final_reveal" | "scored" | "skipped";
  stage_revealed: number;
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  exact_hits: number;
  stage_1_hits: number;
  stage_2_hits: number;
  stage_3_hits: number;
  audio_clue_uses: number;
};

type ScoreDraft = Record<
  number,
  {
    guessed_artist: string;
    guessed_at_stage: string;
    exact_match: boolean;
    used_audio_clue: boolean;
    awarded_points: string;
    notes: string;
  }
>;

function getDefaultPoints(session: Session | null, exactMatch: boolean, stageValue: string): number {
  if (!session || !exactMatch) return 0;
  const stage = Number(stageValue);
  if (stage === 1) return session.stage_one_points;
  if (stage === 2) return session.stage_two_points;
  if (stage === 3) return session.final_reveal_points;
  return 0;
}

export default function ArtistAliasHostPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/artist-alias/sessions/${sessionId}`),
      fetch(`/api/games/artist-alias/sessions/${sessionId}/calls`),
      fetch(`/api/games/artist-alias/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) setSession(await sessionRes.json());
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

  const nextPendingCall = useMemo(
    () => calls.find((call) => call.status === "pending") ?? null,
    [calls]
  );
  const callForControls = activeCall ?? nextPendingCall;

  const previousCalls = useMemo(
    () => calls.filter((call) => ["stage_1", "stage_2", "final_reveal", "scored", "skipped"].includes(call.status)).slice(-6),
    [calls]
  );

  useEffect(() => {
    const draft: ScoreDraft = {};
    const stageValue = String(callForControls?.stage_revealed && callForControls.stage_revealed > 0 ? callForControls.stage_revealed : 3);
    for (const row of leaderboard) {
      draft[row.team_id] = {
        guessed_artist: "",
        guessed_at_stage: stageValue,
        exact_match: false,
        used_audio_clue: false,
        awarded_points: "",
        notes: "",
      };
    }
    setScoreDraft(draft);
  }, [callForControls?.id, callForControls?.stage_revealed, leaderboard]);

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
      const res = await fetch(`/api/games/artist-alias/sessions/${sessionId}/advance`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to advance");
      }
    });
  };

  const pause = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/artist-alias/sessions/${sessionId}/pause`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to pause");
      }
    });
  };

  const resume = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/artist-alias/sessions/${sessionId}/resume`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to resume");
      }
    });
  };

  const patchCallStatus = async (status: "stage_1" | "stage_2" | "final_reveal" | "scored" | "skipped") => {
    if (!callForControls) return;
    await runAction(async () => {
      const res = await fetch(`/api/games/artist-alias/calls/${callForControls.id}`, {
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
          guessed_artist: "",
          guessed_at_stage: "3",
          exact_match: false,
          used_audio_clue: false,
          awarded_points: "",
          notes: "",
        };
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: team.team_id,
          guessed_artist: draft.guessed_artist,
          guessed_at_stage: Number(draft.guessed_at_stage),
          exact_match: draft.exact_match,
          used_audio_clue: draft.used_audio_clue,
          awarded_points:
            Number.isFinite(parsedPoints) && draft.awarded_points !== ""
              ? parsedPoints
              : undefined,
          notes: draft.notes || undefined,
        };
      });

      const res = await fetch(`/api/games/artist-alias/sessions/${sessionId}/score`, {
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#1c1130,#09090b)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-violet-900/50 bg-black/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-violet-300">Host Console</p>
              <h1 className="text-3xl font-black uppercase">Artist Alias Host</h1>
              <p className="text-sm text-stone-400">
                {session?.title} · {session?.session_code} · Round {session?.current_round} of {session?.round_count}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/artist-alias/assistant?sessionId=${sessionId}`}>Assistant</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/artist-alias/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/artist-alias/history">History</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/artist-alias">Setup</Link>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-violet-200">Clue Card Stack</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Artist</th>
                    <th className="pb-2">Source</th>
                    <th className="pb-2">Stage</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-violet-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2">{call.artist_name}</td>
                      <td className="py-2">{call.source_label ?? "-"}</td>
                      <td className="py-2">{call.stage_revealed}</td>
                      <td className="py-2 text-stone-400">{call.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-violet-200">Current Clue Card</h2>
              <div className="mt-3 rounded border border-violet-700/40 bg-violet-950/20 p-3">
                <p className="text-xs uppercase text-violet-300">
                  {callForControls
                    ? `Card ${callForControls.call_index} · Round ${callForControls.round_number}`
                    : "Waiting"}
                </p>
                <p className="mt-1 text-lg font-black">
                  {(callForControls?.status === "scored")
                    ? callForControls.artist_name
                    : "Answer hidden until scored"}
                </p>
                <div className="mt-2 space-y-1 text-sm text-stone-300">
                  <p>Stage 1 (Era): {callForControls?.clue_era ?? "-"}</p>
                  <p>Stage 2 (Collaborator): {(callForControls?.stage_revealed ?? 0) >= 2 ? callForControls?.clue_collaborator : "Hidden"}</p>
                  <p>Stage 3 (Label/Region): {(callForControls?.stage_revealed ?? 0) >= 3 ? callForControls?.clue_label_region : "Hidden"}</p>
                </div>
                {callForControls?.accepted_aliases?.length ? (
                  <p className="mt-2 text-xs text-violet-200">Accepted aliases: {callForControls.accepted_aliases.join(", ")}</p>
                ) : null}
                {callForControls?.host_notes ? (
                  <p className="mt-2 text-xs text-stone-400">Host note: {callForControls.host_notes}</p>
                ) : null}
              </div>

              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Recently Played</p>
                <div className="mt-1 max-h-24 overflow-auto text-stone-400">
                  {previousCalls.map((call) => (
                    <div key={call.id}>#{call.call_index} {call.artist_name} ({call.status})</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-violet-300">Controls</p>
              <p className="mt-1 text-xs text-stone-400">
                Gap timer target: {session?.target_gap_seconds ?? 0}s · Status: {session?.status ?? "-"} · Score model: {session?.stage_one_points ?? 0}/{session?.stage_two_points ?? 0}/{session?.final_reveal_points ?? 0}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={advance} className="rounded bg-violet-700 px-2 py-1 disabled:opacity-50">Advance Card</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("stage_1")} className="rounded bg-blue-700 px-2 py-1 disabled:opacity-50">Stage 1</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("stage_2")} className="rounded bg-indigo-700 px-2 py-1 disabled:opacity-50">Stage 2</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("final_reveal")} className="rounded bg-amber-700 px-2 py-1 disabled:opacity-50">Stage 3</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("skipped")} className="rounded bg-red-700 px-2 py-1 disabled:opacity-50">Skip</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={pause} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Pause</button>
                <button disabled={working} onClick={resume} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Resume</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("scored")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Mark Scored</button>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-violet-300">Score Entry</p>
              <div className="mt-2 space-y-2 text-xs">
                {leaderboard.map((team) => {
                  const draft = scoreDraft[team.team_id] ?? {
                    guessed_artist: "",
                    guessed_at_stage: "3",
                    exact_match: false,
                    used_audio_clue: false,
                    awarded_points: "",
                    notes: "",
                  };
                  const suggestedPoints = getDefaultPoints(session, draft.exact_match, draft.guessed_at_stage);

                  return (
                    <div key={team.team_id} className="space-y-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">{team.team_name}</p>
                          <p className="text-[11px] text-stone-400">Total: {team.total_points} · Exact: {team.exact_hits}</p>
                        </div>
                        <p className="text-[11px] text-stone-400">Suggested: {suggestedPoints}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                          placeholder="Guessed artist"
                          value={draft.guessed_artist}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...current[team.team_id],
                                guessed_artist: e.target.value,
                              },
                            }))
                          }
                        />
                        <select
                          className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                          value={draft.guessed_at_stage}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...current[team.team_id],
                                guessed_at_stage: e.target.value,
                              },
                            }))
                          }
                        >
                          <option value="1">Stage 1</option>
                          <option value="2">Stage 2</option>
                          <option value="3">Stage 3</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-[auto,auto,110px] items-center gap-2">
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={draft.exact_match}
                            onChange={(e) =>
                              setScoreDraft((current) => ({
                                ...current,
                                [team.team_id]: {
                                  ...current[team.team_id],
                                  exact_match: e.target.checked,
                                },
                              }))
                            }
                          />
                          Exact match
                        </label>
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={draft.used_audio_clue}
                            onChange={(e) =>
                              setScoreDraft((current) => ({
                                ...current,
                                [team.team_id]: {
                                  ...current[team.team_id],
                                  used_audio_clue: e.target.checked,
                                },
                              }))
                            }
                          />
                          Audio clue
                        </label>
                        <input
                          className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                          placeholder={`Auto ${suggestedPoints}`}
                          value={draft.awarded_points}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...current[team.team_id],
                                awarded_points: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>

                      <input
                        className="w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                        placeholder="Optional note"
                        value={draft.notes}
                        onChange={(e) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [team.team_id]: {
                              ...current[team.team_id],
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
                {saving ? "Saving..." : "Save Scores for Current Card"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
