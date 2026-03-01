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
  points_correct_call: number;
  bonus_original_artist_points: number;
  remaining_seconds: number;
  target_gap_seconds: number;
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  source_label: string | null;
  spin_artist: string;
  track_title: string;
  original_artist: string;
  alt_accept_original_artist: string | null;
  is_cover: boolean;
  host_notes: string | null;
  status: "pending" | "asked" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  correct_calls: number;
  artist_bonus_hits: number;
};

type ScoreDraft = Record<
  number,
  {
    called_original: "" | "original" | "cover";
    named_original_artist: string;
    awarded_points: string;
  }
>;

function canonicalizeArtistName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAcceptedOriginalArtistNames(call: Call | null): Set<string> {
  if (!call) return new Set();

  const names = [call.original_artist, call.alt_accept_original_artist]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(/[;,|]/).map((part) => part.trim()))
    .map(canonicalizeArtistName)
    .filter(Boolean);

  return new Set(names);
}

function toCalledOriginal(value: "" | "original" | "cover"): boolean | null {
  if (value === "original") return true;
  if (value === "cover") return false;
  return null;
}

export default function OriginalOrCoverHostPage() {
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
      fetch(`/api/games/original-or-cover/sessions/${sessionId}`),
      fetch(`/api/games/original-or-cover/sessions/${sessionId}/calls`),
      fetch(`/api/games/original-or-cover/sessions/${sessionId}/leaderboard`),
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
    () => calls.filter((call) => ["asked", "revealed", "scored", "skipped"].includes(call.status)).slice(-6),
    [calls]
  );

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = { called_original: "", named_original_artist: "", awarded_points: "" };
    }
    setScoreDraft(draft);
  }, [callForControls?.id, leaderboard]);

  const acceptedOriginalArtistNames = useMemo(
    () => getAcceptedOriginalArtistNames(callForControls),
    [callForControls]
  );

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
      const res = await fetch(`/api/games/original-or-cover/sessions/${sessionId}/advance`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to advance");
      }
    });
  };

  const pause = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/original-or-cover/sessions/${sessionId}/pause`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to pause");
      }
    });
  };

  const resume = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/original-or-cover/sessions/${sessionId}/resume`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to resume");
      }
    });
  };

  const patchCallStatus = async (status: "asked" | "revealed" | "scored" | "skipped") => {
    if (!callForControls) return;
    await runAction(async () => {
      const res = await fetch(`/api/games/original-or-cover/calls/${callForControls.id}`, {
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
          called_original: "" as const,
          named_original_artist: "",
          awarded_points: "",
        };
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: team.team_id,
          called_original: toCalledOriginal(draft.called_original),
          named_original_artist: draft.named_original_artist,
          awarded_points:
            Number.isFinite(parsedPoints) && draft.awarded_points !== ""
              ? parsedPoints
              : undefined,
        };
      });

      const res = await fetch(`/api/games/original-or-cover/sessions/${sessionId}/score`, {
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#171717)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-yellow-900/40 bg-black/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-yellow-300">Host Console</p>
              <h1 className="text-3xl font-black uppercase">Original or Cover Host</h1>
              <p className="text-sm text-stone-400">
                {session?.title} · {session?.session_code} · Round {session?.current_round} of {session?.round_count}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/original-or-cover/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/original-or-cover/history">History</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/original-or-cover">Setup</Link>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-yellow-200">Pair Stack</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Spin</th>
                    <th className="pb-2">Answer</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-yellow-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2">{call.spin_artist} - {call.track_title}</td>
                      <td className="py-2">{call.is_cover ? "Cover" : "Original"}</td>
                      <td className="py-2 text-stone-400">{call.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-yellow-200">Current Call</h2>
              <div className="mt-3 rounded border border-yellow-700/40 bg-yellow-950/20 p-3">
                <p className="text-xs uppercase text-yellow-300">
                  {callForControls
                    ? `Call ${callForControls.call_index} · Round ${callForControls.round_number}`
                    : "Waiting"}
                </p>
                <p className="mt-1 text-lg font-black">
                  {callForControls ? `${callForControls.spin_artist} - ${callForControls.track_title}` : "No active call"}
                </p>
                <p className="mt-2 text-sm text-stone-300">
                  Source: {callForControls?.source_label ?? "Unlabeled"} · Target gap: {session?.target_gap_seconds ?? 0}s
                </p>
                <p className="mt-2 text-sm text-amber-300">
                  {(callForControls?.status === "revealed" || callForControls?.status === "scored")
                    ? `Answer: ${callForControls.is_cover ? "COVER" : "ORIGINAL"} · Original artist: ${callForControls.original_artist}`
                    : "Answer hidden until reveal"}
                </p>
                {callForControls?.host_notes ? (
                  <p className="mt-2 text-xs text-stone-400">Host note: {callForControls.host_notes}</p>
                ) : null}
              </div>

              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Recently Played</p>
                <div className="mt-1 max-h-24 overflow-auto text-stone-400">
                  {previousCalls.map((call) => (
                    <div key={call.id}>#{call.call_index} {call.spin_artist} - {call.track_title} ({call.status})</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-yellow-300">Controls</p>
              <p className="mt-1 text-xs text-stone-400">Gap timer target: {session?.target_gap_seconds ?? 0}s · Remaining: {session?.remaining_seconds ?? 0}s · Status: {session?.status ?? "-"}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={advance} className="rounded bg-yellow-700 px-2 py-1 disabled:opacity-50">Advance Call</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("asked")} className="rounded bg-blue-700 px-2 py-1 disabled:opacity-50">Mark Asked</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("revealed")} className="rounded bg-amber-700 px-2 py-1 disabled:opacity-50">Reveal</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("skipped")} className="rounded bg-red-700 px-2 py-1 disabled:opacity-50">Skip</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={pause} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Pause</button>
                <button disabled={working} onClick={resume} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Resume</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("scored")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Mark Scored</button>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-yellow-300">Score Entry</p>
              <div className="mt-2 space-y-2 text-xs">
                {leaderboard.map((team) => {
                  const draft = scoreDraft[team.team_id] ?? {
                    called_original: "" as const,
                    named_original_artist: "",
                    awarded_points: "",
                  };

                  const calledOriginal = toCalledOriginal(draft.called_original);
                  const callCorrect = calledOriginal !== null && callForControls
                    ? calledOriginal === !callForControls.is_cover
                    : false;

                  const artistGuess = canonicalizeArtistName(draft.named_original_artist);
                  const artistBonus = callCorrect && artistGuess.length > 0 && acceptedOriginalArtistNames.has(artistGuess);
                  const suggestedPoints =
                    (callCorrect ? session?.points_correct_call ?? 0 : 0) +
                    (artistBonus ? session?.bonus_original_artist_points ?? 0 : 0);

                  return (
                    <div key={team.team_id} className="grid grid-cols-[1fr,130px,150px,96px] items-center gap-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                      <div>
                        <p className="font-semibold">{team.team_name}</p>
                        <p className="text-[11px] text-stone-400">Total: {team.total_points} · Correct: {team.correct_calls} · Bonus: {team.artist_bonus_hits}</p>
                      </div>
                      <select
                        className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                        value={draft.called_original}
                        onChange={(e) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [team.team_id]: {
                              ...(current[team.team_id] ?? { named_original_artist: "", awarded_points: "" }),
                              called_original: e.target.value as "" | "original" | "cover",
                            },
                          }))
                        }
                      >
                        <option value="">No call</option>
                        <option value="original">Called ORIGINAL</option>
                        <option value="cover">Called COVER</option>
                      </select>
                      <input
                        className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                        value={draft.named_original_artist}
                        onChange={(e) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [team.team_id]: {
                              ...(current[team.team_id] ?? { called_original: "", awarded_points: "" }),
                              named_original_artist: e.target.value,
                            },
                          }))
                        }
                        placeholder="Original artist guess"
                      />
                      <input
                        className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                        value={draft.awarded_points}
                        onChange={(e) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [team.team_id]: {
                              ...(current[team.team_id] ?? { called_original: "", named_original_artist: "" }),
                              awarded_points: e.target.value,
                            },
                          }))
                        }
                        placeholder={`${suggestedPoints}`}
                        inputMode="numeric"
                      />
                    </div>
                  );
                })}
              </div>
              <button
                disabled={saving || !callForControls}
                onClick={submitScores}
                className="mt-3 rounded bg-yellow-700 px-3 py-2 text-xs font-semibold uppercase disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Scores for Current Call"}
              </button>
              <p className="mt-2 text-[11px] text-stone-400">Default points auto-calc: +{session?.points_correct_call ?? 0} for correct call and +{session?.bonus_original_artist_points ?? 0} for correct original artist.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
