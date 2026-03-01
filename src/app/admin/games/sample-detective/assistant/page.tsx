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
  points_correct_pair: number;
  bonus_both_artists_points: number;
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  sampled_artist: string;
  sampled_title: string;
  source_artist: string;
  source_title: string;
  status: "pending" | "asked" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  pair_hits: number;
  both_artists_hits: number;
};

type ScoreDraft = Record<number, { pair_correct: boolean; both_artists_named: boolean; awarded_points: string }>;

function getDefaultPoints(
  pairCorrect: boolean,
  bothArtistsNamed: boolean,
  pointsCorrectPair: number,
  bonusBothArtistsPoints: number
): number {
  if (!pairCorrect) return 0;
  return Math.max(0, Math.min(5, pointsCorrectPair + (bothArtistsNamed ? bonusBothArtistsPoints : 0)));
}

export default function SampleDetectiveAssistantPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/sample-detective/sessions/${sessionId}`),
      fetch(`/api/games/sample-detective/sessions/${sessionId}/calls`),
      fetch(`/api/games/sample-detective/sessions/${sessionId}/leaderboard`),
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
    return calls.find((call) => call.call_index === session.current_call_index) ?? calls.find((call) => call.status === "asked") ?? null;
  }, [calls, session]);

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = { pair_correct: false, both_artists_named: false, awarded_points: "" };
    }
    setScoreDraft(draft);
  }, [currentCall?.id, leaderboard]);

  const submitScores = async () => {
    if (!currentCall || !session) return;
    setSaving(true);

    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? {
          pair_correct: false,
          both_artists_named: false,
          awarded_points: "",
        };
        const pairCorrect = draft.pair_correct;
        const bothArtistsNamed = pairCorrect && draft.both_artists_named;
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: team.team_id,
          pair_correct: pairCorrect,
          both_artists_named: bothArtistsNamed,
          awarded_points:
            Number.isFinite(parsedPoints) && draft.awarded_points !== ""
              ? parsedPoints
              : getDefaultPoints(
                  pairCorrect,
                  bothArtistsNamed,
                  session.points_correct_pair,
                  session.bonus_both_artists_points
                ),
        };
      });

      const res = await fetch(`/api/games/sample-detective/sessions/${sessionId}/score`, {
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#171b10,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-green-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black uppercase text-green-100">Sample Detective Assistant</h1>
            <p className="mt-1 text-sm text-stone-300">
              {session?.title} · {session?.session_code} · Round {session?.current_round} / {session?.round_count} · {session?.status}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/games/sample-detective/host?sessionId=${sessionId}`} className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Host</Link>
            <Link href={`/admin/games/sample-detective/jumbotron?sessionId=${sessionId}`} className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Jumbotron</Link>
            <Link href="/admin/games/sample-detective" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Setup</Link>
          </div>
        </div>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-green-200">Current Call (Read-only Prompt)</h2>
          <p className="mt-2 text-lg font-black">{currentCall ? `${currentCall.sampled_artist} - ${currentCall.sampled_title}` : "Waiting for host"}</p>
          <p className="mt-1 text-sm text-stone-300">Source is revealed from host screen only.</p>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-green-200">Assistant Score Entry</h2>
          <p className="mt-2 text-xs text-stone-400">No transport controls here. Assistant is scoring-only support.</p>
          <div className="mt-3 space-y-2 text-xs">
            {leaderboard.map((team) => {
              const draft = scoreDraft[team.team_id] ?? {
                pair_correct: false,
                both_artists_named: false,
                awarded_points: "",
              };
              const suggestedPoints = getDefaultPoints(
                draft.pair_correct,
                draft.both_artists_named,
                session?.points_correct_pair ?? 2,
                session?.bonus_both_artists_points ?? 1
              );

              return (
                <div key={team.team_id} className="grid grid-cols-[1.1fr,auto,auto,100px] items-center gap-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                  <div>
                    <p className="font-semibold">{team.team_name}</p>
                    <p className="text-[11px] text-stone-400">Total: {team.total_points} · Pair hits: {team.pair_hits}</p>
                  </div>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={draft.pair_correct}
                      onChange={(e) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [team.team_id]: {
                            ...(current[team.team_id] ?? { both_artists_named: false, awarded_points: "" }),
                            pair_correct: e.target.checked,
                            both_artists_named: e.target.checked ? (current[team.team_id]?.both_artists_named ?? false) : false,
                          },
                        }))
                      }
                    />
                    Pair
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={draft.both_artists_named}
                      onChange={(e) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [team.team_id]: {
                            ...(current[team.team_id] ?? { pair_correct: false, awarded_points: "" }),
                            pair_correct: e.target.checked ? true : (current[team.team_id]?.pair_correct ?? false),
                            both_artists_named: e.target.checked,
                          },
                        }))
                      }
                    />
                    +Both Artists
                  </label>
                  <input
                    className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                    placeholder={`Auto ${suggestedPoints}`}
                    value={draft.awarded_points}
                    onChange={(e) =>
                      setScoreDraft((current) => ({
                        ...current,
                        [team.team_id]: {
                          ...(current[team.team_id] ?? { pair_correct: false, both_artists_named: false }),
                          awarded_points: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              );
            })}
            {leaderboard.length === 0 ? <p className="text-stone-500">No teams found.</p> : null}
          </div>

          <button
            disabled={!currentCall || saving}
            onClick={submitScores}
            className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Scores for Current Call"}
          </button>
        </section>
      </div>
    </div>
  );
}
