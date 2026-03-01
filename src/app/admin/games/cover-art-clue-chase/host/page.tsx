"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type SessionTeam = {
  id: number;
  team_name: string;
  table_label: string | null;
  active: boolean;
};

type Session = {
  id: number;
  session_code: string;
  title: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  status: "pending" | "running" | "paused" | "completed";
  target_gap_seconds: number;
  stage_one_points: number;
  stage_two_points: number;
  final_reveal_points: number;
  audio_clue_enabled: boolean;
  teams: SessionTeam[];
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  source_label: string | null;
  artist: string;
  title: string;
  release_year: number | null;
  audio_clue_source: string | null;
  host_notes: string | null;
  status: "pending" | "stage_1" | "stage_2" | "final_reveal" | "scored" | "skipped";
  stage_revealed: number;
  score_rows: number;
  score_exact_hits: number;
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  table_label: string | null;
  total_points: number;
  exact_hits: number;
  audio_clue_hits: number;
  scored_calls: number;
};

type ScoreDraft = Record<number, {
  exact_match: boolean;
  guessed_at_stage: string;
  used_audio_clue: boolean;
  awarded_points: string;
  guessed_artist: string;
  guessed_title: string;
}>;

function clampStage(value: number): number {
  return Math.max(1, Math.min(3, value));
}

export default function CoverArtClueChaseHostPage() {
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
      fetch(`/api/games/cover-art-clue-chase/sessions/${sessionId}`),
      fetch(`/api/games/cover-art-clue-chase/sessions/${sessionId}/calls`),
      fetch(`/api/games/cover-art-clue-chase/sessions/${sessionId}/leaderboard`),
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

  useEffect(() => {
    const defaultStage = clampStage(callForControls?.stage_revealed || 3);
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = {
        exact_match: false,
        guessed_at_stage: String(defaultStage),
        used_audio_clue: false,
        awarded_points: "",
        guessed_artist: "",
        guessed_title: "",
      };
    }
    setScoreDraft(draft);
  }, [callForControls?.id, callForControls?.stage_revealed, leaderboard]);

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

  const postAction = async (path: string, body?: Record<string, unknown>) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const payload = await res.json();
      throw new Error(payload.error ?? "Action failed");
    }
  };

  const startSession = async () => {
    await runAction(async () => {
      await postAction(`/api/games/cover-art-clue-chase/sessions/${sessionId}/start`);
    });
  };

  const advance = async () => {
    await runAction(async () => {
      await postAction(`/api/games/cover-art-clue-chase/sessions/${sessionId}/advance`);
    });
  };

  const pause = async () => {
    await runAction(async () => {
      await postAction(`/api/games/cover-art-clue-chase/sessions/${sessionId}/pause`);
    });
  };

  const resume = async () => {
    await runAction(async () => {
      await postAction(`/api/games/cover-art-clue-chase/sessions/${sessionId}/resume`);
    });
  };

  const revealStage = async (stage: number) => {
    if (!callForControls) return;
    await runAction(async () => {
      await postAction(`/api/games/cover-art-clue-chase/sessions/${sessionId}/reveal`, {
        call_id: callForControls.id,
        stage,
      });
    });
  };

  const submitScores = async () => {
    if (!callForControls) return;
    setSaving(true);

    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? {
          exact_match: false,
          guessed_at_stage: "3",
          used_audio_clue: false,
          awarded_points: "",
          guessed_artist: "",
          guessed_title: "",
        };
        const parsedPoints = Number(draft.awarded_points);
        const parsedStage = clampStage(Number(draft.guessed_at_stage) || 3);

        return {
          team_id: team.team_id,
          guessed_artist: draft.guessed_artist || undefined,
          guessed_title: draft.guessed_title || undefined,
          guessed_at_stage: parsedStage,
          used_audio_clue: draft.used_audio_clue,
          exact_match: draft.exact_match,
          awarded_points: Number.isFinite(parsedPoints) && draft.awarded_points !== "" ? parsedPoints : undefined,
        };
      });

      const res = await fetch(`/api/games/cover-art-clue-chase/sessions/${sessionId}/score`, {
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#102126,#09090b)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-teal-900/50 bg-black/45 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-teal-300">Host Console</p>
              <h1 className="text-3xl font-black uppercase">Cover Art Clue Chase Host</h1>
              <p className="text-sm text-stone-400">
                {session?.title ?? "(loading)"} · {session?.session_code ?? ""} · Round {session?.current_round ?? 0} of {session?.round_count ?? 0}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/cover-art-clue-chase/help">Help</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/cover-art-clue-chase/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/cover-art-clue-chase/assistant?sessionId=${sessionId}`}>Assistant</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/cover-art-clue-chase/history">History</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/cover-art-clue-chase">Setup</Link>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-teal-200">Cover Deck</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Album</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Stage</th>
                    <th className="pb-2">Scores</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-teal-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2">
                        {call.artist} - {call.title}
                        {call.source_label ? <div className="text-stone-500">{call.source_label}</div> : null}
                      </td>
                      <td className="py-2 text-stone-300">{call.status}</td>
                      <td className="py-2">{call.stage_revealed || 0}</td>
                      <td className="py-2 text-stone-400">{call.score_rows} rows · {call.score_exact_hits} exact</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-teal-200">Round Controls</h2>
              <p className="mt-2 text-xs text-stone-400">
                Status: {session?.status ?? "(unknown)"} · Current call: {session?.current_call_index ?? 0} · Gap target: {session?.target_gap_seconds ?? 0}s
              </p>
              <p className="mt-1 text-xs text-stone-400">
                Active: {callForControls ? `#${callForControls.call_index} ${callForControls.artist} - ${callForControls.title}` : "(none)"}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <button className="rounded border border-teal-700 px-2 py-2" disabled={working || !session || session.current_call_index > 0} onClick={startSession}>Start Session</button>
                <button className="rounded border border-stone-600 px-2 py-2" disabled={working || !session || session.status === "completed"} onClick={advance}>Advance Call</button>
                <button className="rounded border border-stone-600 px-2 py-2" disabled={working || !session || session.status !== "running"} onClick={pause}>Pause</button>
                <button className="rounded border border-stone-600 px-2 py-2" disabled={working || !session || session.status === "completed"} onClick={resume}>Resume</button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <button className="rounded border border-sky-700 px-2 py-2" disabled={working || !callForControls} onClick={() => revealStage(1)}>Reveal 1</button>
                <button className="rounded border border-sky-700 px-2 py-2" disabled={working || !callForControls} onClick={() => revealStage(2)}>Reveal 2</button>
                <button className="rounded border border-sky-700 px-2 py-2" disabled={working || !callForControls} onClick={() => revealStage(3)}>Final/Audio</button>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-teal-200">Score Current Call</h2>
              <p className="mt-1 text-xs text-stone-400">
                Default scoring model: {session?.stage_one_points ?? 3}/{session?.stage_two_points ?? 2}/{session?.final_reveal_points ?? 1}
              </p>
              {leaderboard.length === 0 ? (
                <p className="mt-3 text-xs text-stone-500">No teams found for this session.</p>
              ) : (
                <div className="mt-3 space-y-2 text-xs">
                  {leaderboard.map((team) => {
                    const draft = scoreDraft[team.team_id] ?? {
                      exact_match: false,
                      guessed_at_stage: "3",
                      used_audio_clue: false,
                      awarded_points: "",
                      guessed_artist: "",
                      guessed_title: "",
                    };

                    return (
                      <div key={team.team_id} className="rounded border border-stone-800 p-2">
                        <p className="font-semibold text-teal-200">{team.team_name}</p>
                        <div className="mt-1 grid gap-2 md:grid-cols-3">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={draft.exact_match}
                              onChange={(e) =>
                                setScoreDraft((prev) => ({
                                  ...prev,
                                  [team.team_id]: { ...draft, exact_match: e.target.checked },
                                }))
                              }
                            />
                            Exact match
                          </label>

                          <label>
                            Stage
                            <select
                              className="ml-2 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                              value={draft.guessed_at_stage}
                              onChange={(e) =>
                                setScoreDraft((prev) => ({
                                  ...prev,
                                  [team.team_id]: { ...draft, guessed_at_stage: e.target.value },
                                }))
                              }
                            >
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                            </select>
                          </label>

                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={draft.used_audio_clue}
                              onChange={(e) =>
                                setScoreDraft((prev) => ({
                                  ...prev,
                                  [team.team_id]: { ...draft, used_audio_clue: e.target.checked },
                                }))
                              }
                            />
                            Audio clue used
                          </label>

                          <label>
                            Guessed artist
                            <input
                              className="ml-2 w-36 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                              value={draft.guessed_artist}
                              onChange={(e) =>
                                setScoreDraft((prev) => ({
                                  ...prev,
                                  [team.team_id]: { ...draft, guessed_artist: e.target.value },
                                }))
                              }
                            />
                          </label>

                          <label>
                            Guessed title
                            <input
                              className="ml-2 w-36 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                              value={draft.guessed_title}
                              onChange={(e) =>
                                setScoreDraft((prev) => ({
                                  ...prev,
                                  [team.team_id]: { ...draft, guessed_title: e.target.value },
                                }))
                              }
                            />
                          </label>

                          <label>
                            Override pts
                            <input
                              className="ml-2 w-16 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                              value={draft.awarded_points}
                              onChange={(e) =>
                                setScoreDraft((prev) => ({
                                  ...prev,
                                  [team.team_id]: { ...draft, awarded_points: e.target.value },
                                }))
                              }
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button className="mt-3 rounded bg-teal-600 px-3 py-2 text-xs font-semibold text-black disabled:opacity-40" disabled={saving || !callForControls || leaderboard.length === 0} onClick={submitScores}>
                {saving ? "Saving..." : "Save Scores"}
              </button>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-teal-200">Leaderboard</h2>
              <div className="mt-2 space-y-1 text-xs">
                {leaderboard.map((row, index) => (
                  <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-800 px-2 py-1">
                    <p>{index + 1}. {row.team_name}</p>
                    <p className="text-stone-300">{row.total_points} pts · {row.exact_hits} exact</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
