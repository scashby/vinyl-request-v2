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
  stage_one_points: number;
  stage_two_points: number;
  final_reveal_points: number;
  audio_clue_enabled: boolean;
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  artist: string;
  title: string;
  source_label: string | null;
  status: "pending" | "stage_1" | "stage_2" | "final_reveal" | "scored" | "skipped";
  stage_revealed: number;
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  exact_hits: number;
};

type ScoreDraft = Record<
  number,
  {
    exact_match: boolean;
    guessed_at_stage: string;
    used_audio_clue: boolean;
    awarded_points: string;
    guessed_artist: string;
    guessed_title: string;
  }
>;

function clampStage(value: number): number {
  return Math.max(1, Math.min(3, value));
}

export default function CoverArtClueChaseAssistantPage() {
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/cover-art-clue-chase/sessions/${sessionId}`),
      fetch(`/api/games/cover-art-clue-chase/sessions/${sessionId}/calls`),
      fetch(`/api/games/cover-art-clue-chase/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) setSession((await sessionRes.json()) as Session);
    if (callsRes.ok) setCalls(((await callsRes.json()).data ?? []) as Call[]);
    if (leaderboardRes.ok) setLeaderboard(((await leaderboardRes.json()).data ?? []) as LeaderboardRow[]);
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

  const pendingCall = useMemo(() => calls.find((call) => call.status === "pending") ?? null, [calls]);
  const callForControls = activeCall ?? pendingCall;

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
    setErrorText(null);
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

      await postAction(`/api/games/cover-art-clue-chase/sessions/${sessionId}/score`, {
        call_id: callForControls.id,
        awards,
        scored_by: "assistant",
      });
      await load();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to save scores");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#111c20,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-cyan-900/50 bg-black/45 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Assistant Console</p>
              <h1 className="text-3xl font-black uppercase text-cyan-100">Cover Art Clue Chase Assistant</h1>
              <p className="text-sm text-stone-400">
                {session?.title ?? "(loading)"} · {session?.session_code ?? ""} · Round {session?.current_round ?? 0} of {session?.round_count ?? 0}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button className="rounded border border-stone-700 px-2 py-1" type="button" onClick={() => window.open(`/admin/games/cover-art-clue-chase/host?sessionId=${sessionId}`, "cover_art_clue_chase_host", "width=1280,height=900")}>Host</button>
              <button className="rounded border border-stone-700 px-2 py-1" type="button" onClick={() => window.open(`/admin/games/cover-art-clue-chase/jumbotron?sessionId=${sessionId}`, "cover_art_clue_chase_jumbotron", "width=1920,height=1080")}>Jumbotron</button>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/cover-art-clue-chase/history">History</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/cover-art-clue-chase">Setup</Link>
            </div>
          </div>
        </header>

        {errorText ? <div className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200">{errorText}</div> : null}

        <div className="grid gap-4 lg:grid-cols-[1fr,1.15fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-cyan-200">Controls</h2>
            <p className="mt-2 text-xs text-stone-400">
              Status: {session?.status ?? "-"} · Current call: {session?.current_call_index ?? 0} · Active: {callForControls ? `#${callForControls.call_index}` : "(none)"}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <button className="rounded border border-cyan-700 px-2 py-2" disabled={working || !session || session.current_call_index > 0} onClick={startSession}>Start</button>
              <button className="rounded border border-stone-600 px-2 py-2" disabled={working || !session || session.status === "completed"} onClick={advance}>Advance</button>
              <button className="rounded border border-stone-600 px-2 py-2" disabled={working || !session || session.status !== "running"} onClick={pause}>Pause</button>
              <button className="rounded border border-stone-600 px-2 py-2" disabled={working || !session || session.status === "completed"} onClick={resume}>Resume</button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <button className="rounded border border-sky-700 px-2 py-2" disabled={working || !callForControls} onClick={() => revealStage(1)}>Reveal 1</button>
              <button className="rounded border border-sky-700 px-2 py-2" disabled={working || !callForControls} onClick={() => revealStage(2)}>Reveal 2</button>
              <button className="rounded border border-sky-700 px-2 py-2" disabled={working || !callForControls} onClick={() => revealStage(3)}>Final</button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Album</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-cyan-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2">{call.artist} - {call.title}</td>
                      <td className="py-2 text-stone-300">{call.status}</td>
                      <td className="py-2">{call.stage_revealed || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-cyan-200">Score Current Call</h2>
            <p className="mt-1 text-xs text-stone-400">
              Default points: {session?.stage_one_points ?? 3}/{session?.stage_two_points ?? 2}/{session?.final_reveal_points ?? 1} · Audio clue {session?.audio_clue_enabled ? "enabled" : "disabled"}
            </p>

            {leaderboard.length === 0 ? (
              <p className="mt-3 text-xs text-stone-500">No teams in leaderboard yet.</p>
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
                      <p className="font-semibold text-cyan-200">{team.team_name}</p>
                      <p className="text-[11px] text-stone-400">{team.total_points} pts · {team.exact_hits} exact</p>
                      <div className="mt-1 grid gap-2 md:grid-cols-3">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draft.exact_match}
                            onChange={(event) =>
                              setScoreDraft((prev) => ({
                                ...prev,
                                [team.team_id]: { ...draft, exact_match: event.target.checked },
                              }))
                            }
                          />
                          Exact
                        </label>

                        <label>
                          Stage
                          <select
                            className="ml-2 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                            value={draft.guessed_at_stage}
                            onChange={(event) =>
                              setScoreDraft((prev) => ({
                                ...prev,
                                [team.team_id]: { ...draft, guessed_at_stage: event.target.value },
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
                            onChange={(event) =>
                              setScoreDraft((prev) => ({
                                ...prev,
                                [team.team_id]: { ...draft, used_audio_clue: event.target.checked },
                              }))
                            }
                          />
                          Audio clue
                        </label>

                        <label>
                          Artist guess
                          <input
                            className="ml-2 w-36 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                            value={draft.guessed_artist}
                            onChange={(event) =>
                              setScoreDraft((prev) => ({
                                ...prev,
                                [team.team_id]: { ...draft, guessed_artist: event.target.value },
                              }))
                            }
                          />
                        </label>

                        <label>
                          Title guess
                          <input
                            className="ml-2 w-36 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                            value={draft.guessed_title}
                            onChange={(event) =>
                              setScoreDraft((prev) => ({
                                ...prev,
                                [team.team_id]: { ...draft, guessed_title: event.target.value },
                              }))
                            }
                          />
                        </label>

                        <label>
                          Override pts
                          <input
                            className="ml-2 w-16 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                            value={draft.awarded_points}
                            onChange={(event) =>
                              setScoreDraft((prev) => ({
                                ...prev,
                                [team.team_id]: { ...draft, awarded_points: event.target.value },
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

            <button className="mt-3 rounded bg-cyan-600 px-3 py-2 text-xs font-semibold text-black disabled:opacity-40" disabled={saving || !callForControls || leaderboard.length === 0} onClick={submitScores}>
              {saving ? "Saving..." : "Save Scores"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
