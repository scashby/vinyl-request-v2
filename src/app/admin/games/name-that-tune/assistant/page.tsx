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
  lock_in_rule: "time_window" | "first_sheet_wins" | "hand_raise";
  lock_in_window_seconds: number;
  remaining_seconds: number;
  target_gap_seconds: number;
  host_overlay?: "none" | "welcome" | "countdown" | "intermission";
  host_overlay_remaining_seconds?: number;
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  artist_answer: string;
  title_answer: string;
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

type ScoreDraft = Record<number, { artist_correct: boolean; title_correct: boolean; awarded_points: string }>;

function getDefaultPoints(artistCorrect: boolean, titleCorrect: boolean): number {
  if (artistCorrect && titleCorrect) return 2;
  if (artistCorrect || titleCorrect) return 1;
  return 0;
}

export default function NameThatTuneAssistantScopePage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [overlayBusy, setOverlayBusy] = useState(false);
  const [overlaySecondsInput, setOverlaySecondsInput] = useState(600);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/name-that-tune/sessions/${sessionId}`),
      fetch(`/api/games/name-that-tune/sessions/${sessionId}/calls`),
      fetch(`/api/games/name-that-tune/sessions/${sessionId}/leaderboard`),
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
      draft[row.team_id] = { artist_correct: false, title_correct: false, awarded_points: "" };
    }
    setScoreDraft(draft);
  }, [callForControls?.id, leaderboard]);

  const patchCallStatus = async (status: "locked" | "answer_revealed" | "scored") => {
    if (!callForControls) return;
    setWorking(true);
    setErrorText(null);
    try {
      const res = await fetch(`/api/games/name-that-tune/calls/${callForControls.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? `Failed to mark ${status}`);
      }
      await load();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : `Failed to mark ${status}`);
    } finally {
      setWorking(false);
    }
  };

  const runSessionAction = async (path: string, fallbackError: string) => {
    setWorking(true);
    setErrorText(null);
    try {
      const res = await fetch(path, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? fallbackError);
      }
      await load();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : fallbackError);
    } finally {
      setWorking(false);
    }
  };

  const advance = async () => {
    await runSessionAction(`/api/games/name-that-tune/sessions/${sessionId}/advance`, "Failed to advance");
  };

  const pause = async () => {
    await runSessionAction(`/api/games/name-that-tune/sessions/${sessionId}/pause`, "Failed to pause");
  };

  const resume = async () => {
    await runSessionAction(`/api/games/name-that-tune/sessions/${sessionId}/resume`, "Failed to resume");
  };

  const setOverlay = async (mode: "none" | "welcome" | "countdown" | "intermission", durationSeconds?: number) => {
    setOverlayBusy(true);
    setErrorText(null);
    try {
      const res = await fetch(`/api/games/name-that-tune/sessions/${sessionId}/overlay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, duration_seconds: durationSeconds ?? 0 }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to update overlay");
      }
      await load();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to update overlay");
    } finally {
      setOverlayBusy(false);
    }
  };

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
        };
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: team.team_id,
          artist_correct: draft.artist_correct,
          title_correct: draft.title_correct,
          awarded_points:
            Number.isFinite(parsedPoints) && draft.awarded_points !== ""
              ? parsedPoints
              : undefined,
        };
      });

      const res = await fetch(`/api/games/name-that-tune/sessions/${sessionId}/score`, {
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#171717)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl space-y-4 rounded-3xl border border-stone-700 bg-black/50 p-6">
        <h1 className="text-3xl font-black uppercase text-rose-200">Name That Tune Assistant</h1>
        <p className="text-sm text-stone-300">
          {session?.title ?? "Session"} · {session?.session_code ?? "-"} · Round {session?.current_round ?? 0} of {session?.round_count ?? 0}
        </p>

        {errorText ? <div className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200">{errorText}</div> : null}

        <div className="rounded border border-stone-700 bg-stone-950/60 p-3 text-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-rose-200">Session Controls</p>
          <p className="mt-1 text-stone-300">Gap target: {session?.target_gap_seconds ?? 0}s · Remaining: {session?.remaining_seconds ?? 0}s · Lock rule: {session?.lock_in_rule ?? "-"} ({session?.lock_in_window_seconds ?? 0}s)</p>
          <p className="mt-1 text-xs text-stone-400">Overlay: {session?.host_overlay ?? "none"}{(session?.host_overlay === "countdown" || session?.host_overlay === "intermission") ? ` · ${session?.host_overlay_remaining_seconds ?? 0}s left` : ""}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button disabled={working} onClick={advance} className="rounded bg-rose-700 px-2 py-1 disabled:opacity-50">Advance Snippet</button>
            <button disabled={working} onClick={session?.status === "paused" ? resume : pause} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">{session?.status === "paused" ? "Resume" : "Pause"}</button>
            <button disabled={overlayBusy || working} onClick={() => setOverlay("welcome")} className="rounded border border-violet-700 px-2 py-1 text-violet-300 disabled:opacity-50">Welcome</button>
            <button disabled={overlayBusy || working} onClick={() => setOverlay("countdown", 300)} className="rounded border border-sky-700 px-2 py-1 text-sky-300 disabled:opacity-50">Countdown</button>
            <button disabled={overlayBusy || working} onClick={() => setOverlay("intermission", overlaySecondsInput)} className="rounded border border-amber-700 px-2 py-1 text-amber-300 disabled:opacity-50">Intermission</button>
            <button disabled={overlayBusy || working} onClick={() => setOverlay("none")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Clear Overlay</button>
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-xs text-stone-300">
            Intermission seconds
            <input
              type="number"
              min={30}
              max={3600}
              className="w-24 rounded border border-stone-700 bg-stone-950 px-2 py-1"
              value={overlaySecondsInput}
              onChange={(event) => setOverlaySecondsInput(Math.max(30, Number(event.target.value) || 30))}
            />
          </label>
        </div>

        <div className="rounded border border-stone-700 bg-stone-950/60 p-3 text-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-rose-200">Current Snippet</p>
          {callForControls ? (
            <>
              <p className="mt-1 text-lg font-black text-stone-100">#{callForControls.call_index} · Round {callForControls.round_number}</p>
              <p className="text-stone-300">{(callForControls.status === "answer_revealed" || callForControls.status === "scored") ? `${callForControls.artist_answer} - ${callForControls.title_answer}` : "Answer hidden until reveal"}</p>
              <p className="text-xs text-stone-400">Status: {callForControls.status}</p>
            </>
          ) : (
            <p className="mt-1 text-stone-400">Waiting for host to advance.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button disabled={working || !callForControls} onClick={() => patchCallStatus("locked")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Mark Locked</button>
            <button disabled={working || !callForControls} onClick={() => patchCallStatus("answer_revealed")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Mark Revealed</button>
            <button disabled={working || !callForControls} onClick={() => patchCallStatus("scored")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Mark Scored</button>
          </div>
          <div className="mt-3 text-xs">
            <p className="font-semibold text-stone-300">Recently Played</p>
            <div className="mt-1 max-h-24 overflow-auto text-stone-400">
              {previousCalls.map((call) => (
                <div key={call.id}>#{call.call_index} {call.artist_answer} - {call.title_answer} ({call.status})</div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded border border-stone-700 bg-stone-950/60 p-3 text-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-rose-200">Score Entry</p>
          <div className="mt-2 space-y-2 text-xs">
            {leaderboard.map((team) => {
              const draft = scoreDraft[team.team_id] ?? {
                artist_correct: false,
                title_correct: false,
                awarded_points: "",
              };
              const suggestedPoints = getDefaultPoints(draft.artist_correct, draft.title_correct);

              return (
                <div key={team.team_id} className="grid grid-cols-[1.2fr,auto,auto,90px] items-center gap-2 rounded border border-stone-800 bg-black/40 p-2">
                  <div>
                    <p className="font-semibold">{team.team_name}</p>
                    <p className="text-[11px] text-stone-400">Total: {team.total_points} · Artist: {team.artist_hits} · Title: {team.title_hits} · Perfect: {team.perfect_calls}</p>
                  </div>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={draft.artist_correct}
                      onChange={(e) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [team.team_id]: {
                            ...(current[team.team_id] ?? { title_correct: false, awarded_points: "" }),
                            artist_correct: e.target.checked,
                          },
                        }))
                      }
                    />
                    Artist
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={draft.title_correct}
                      onChange={(e) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [team.team_id]: {
                            ...(current[team.team_id] ?? { artist_correct: false, awarded_points: "" }),
                            title_correct: e.target.checked,
                          },
                        }))
                      }
                    />
                    Title
                  </label>
                  <input
                    className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                    placeholder={`Auto ${suggestedPoints}`}
                    value={draft.awarded_points}
                    onChange={(e) =>
                      setScoreDraft((current) => ({
                        ...current,
                        [team.team_id]: {
                          ...(current[team.team_id] ?? { artist_correct: false, title_correct: false }),
                          awarded_points: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              );
            })}
          </div>
          <button disabled={saving || !callForControls} onClick={submitScores} className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold disabled:opacity-50">
            {saving ? "Saving..." : "Save Scores"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/name-that-tune">Setup</Link>
          <button type="button" className="rounded border border-stone-700 px-2 py-1" onClick={() => window.open(`/admin/games/name-that-tune/host?sessionId=${sessionId}`, "name_that_tune_host", "width=1280,height=900")}>Host</button>
          <button type="button" className="rounded border border-stone-700 px-2 py-1" onClick={() => window.open(`/admin/games/name-that-tune/jumbotron?sessionId=${sessionId}`, "name_that_tune_jumbotron", "width=1920,height=1080")}>Jumbotron</button>
        </div>
      </div>
    </div>
  );
}
