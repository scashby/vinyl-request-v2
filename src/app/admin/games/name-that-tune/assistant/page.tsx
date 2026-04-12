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
      alert(error instanceof Error ? error.message : `Failed to mark ${status}`);
    } finally {
      setWorking(false);
    }
  };

  const submitScores = async () => {
    if (!callForControls) return;
    setSaving(true);

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
      alert(error instanceof Error ? error.message : "Failed to save scores");
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

        <div className="rounded border border-stone-700 bg-stone-950/60 p-3 text-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-rose-200">Current Snippet</p>
          {callForControls ? (
            <>
              <p className="mt-1 text-lg font-black text-stone-100">#{callForControls.call_index} · Round {callForControls.round_number}</p>
              <p className="text-stone-300">{callForControls.artist_answer} - {callForControls.title_answer}</p>
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
                    <p className="text-[11px] text-stone-400">Total: {team.total_points}</p>
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
          <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/name-that-tune/host?sessionId=${sessionId}`}>Host</Link>
          <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/name-that-tune/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
        </div>
      </div>
    </div>
  );
}
