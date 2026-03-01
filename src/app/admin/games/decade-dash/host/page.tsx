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
  adjacent_scoring_enabled: boolean;
  exact_points: number;
  adjacent_points: number;
  target_gap_seconds: number;
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  source_label: string | null;
  artist: string | null;
  title: string | null;
  release_year: number | null;
  decade_start: number;
  accepted_adjacent_decades: number[];
  host_notes: string | null;
  status: "pending" | "asked" | "locked" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  exact_hits: number;
  adjacent_hits: number;
  scored_calls: number;
};

type ScoreDraft = Record<number, { selected_decade: string; awarded_points: string; notes: string }>;

type SuggestedScore = {
  points: number;
  exact: boolean;
  adjacent: boolean;
};

function normalizeDecade(value: string): number | null {
  const raw = value.trim().replace(/s$/i, "");
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return null;
  const decade = Math.floor(numeric / 10) * 10;
  if (decade < 1950 || decade > 2030) return null;
  return decade;
}

function computeSuggestedScore(session: Session | null, call: Call | null, selectedDecade: number | null): SuggestedScore {
  if (!session || !call || selectedDecade === null) return { points: 0, exact: false, adjacent: false };

  const exact = selectedDecade === call.decade_start;
  const adjacent =
    !exact &&
    session.adjacent_scoring_enabled &&
    call.accepted_adjacent_decades.includes(selectedDecade);

  if (exact) return { points: session.exact_points, exact: true, adjacent: false };
  if (adjacent) return { points: session.adjacent_points, exact: false, adjacent: true };
  return { points: 0, exact: false, adjacent: false };
}

export default function DecadeDashHostPage() {
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
      fetch(`/api/games/decade-dash/sessions/${sessionId}`),
      fetch(`/api/games/decade-dash/sessions/${sessionId}/calls`),
      fetch(`/api/games/decade-dash/sessions/${sessionId}/leaderboard`),
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
    () => calls.filter((call) => ["asked", "locked", "revealed", "scored", "skipped"].includes(call.status)).slice(-8),
    [calls]
  );

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = { selected_decade: "", awarded_points: "", notes: "" };
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
      const res = await fetch(`/api/games/decade-dash/sessions/${sessionId}/advance`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to advance");
      }
    });
  };

  const pause = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/decade-dash/sessions/${sessionId}/pause`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to pause");
      }
    });
  };

  const resume = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/decade-dash/sessions/${sessionId}/resume`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to resume");
      }
    });
  };

  const patchCallStatus = async (status: "asked" | "locked" | "revealed" | "scored" | "skipped") => {
    if (!callForControls) return;
    await runAction(async () => {
      const res = await fetch(`/api/games/decade-dash/calls/${callForControls.id}`, {
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

  const setAllMiss = () => {
    setScoreDraft((current) => {
      const next = { ...current };
      for (const team of leaderboard) {
        next[team.team_id] = {
          selected_decade: "",
          awarded_points: "0",
          notes: current[team.team_id]?.notes ?? "",
        };
      }
      return next;
    });
  };

  const submitScores = async () => {
    if (!callForControls) return;
    setSaving(true);
    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? { selected_decade: "", awarded_points: "", notes: "" };
        const selectedDecade = normalizeDecade(draft.selected_decade);
        const suggested = computeSuggestedScore(session, callForControls, selectedDecade);
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: team.team_id,
          selected_decade: selectedDecade ?? undefined,
          awarded_points:
            Number.isFinite(parsedPoints) && draft.awarded_points !== ""
              ? parsedPoints
              : suggested.points,
          notes: draft.notes || undefined,
        };
      });

      const res = await fetch(`/api/games/decade-dash/sessions/${sessionId}/score`, {
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#070b16,#101628)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-sky-900/40 bg-black/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-sky-300">Host Console</p>
              <h1 className="text-3xl font-black uppercase">Decade Dash Host</h1>
              <p className="text-sm text-stone-400">
                {session?.title} · {session?.session_code} · Round {session?.current_round} of {session?.round_count}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/decade-dash/assistant?sessionId=${sessionId}`}>Assistant</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/decade-dash/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/decade-dash/history">History</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/decade-dash">Setup</Link>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-sky-200">Call Stack</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Track</th>
                    <th className="pb-2">Answer</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-sky-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2">{call.artist ?? "Unknown"} - {call.title ?? "Untitled"}</td>
                      <td className="py-2">{call.status === "revealed" || call.status === "scored" ? `${call.decade_start}s` : "Hidden"}</td>
                      <td className="py-2 text-stone-400">{call.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-sky-200">Current Call</h2>
              <div className="mt-3 rounded border border-sky-700/40 bg-sky-950/20 p-3">
                <p className="text-xs uppercase text-sky-300">
                  {callForControls
                    ? `Call ${callForControls.call_index} · Round ${callForControls.round_number}`
                    : "Waiting"}
                </p>
                <p className="mt-1 text-lg font-black">{callForControls ? `${callForControls.artist ?? "Unknown"} - ${callForControls.title ?? "Untitled"}` : "No call selected"}</p>
                <p className="mt-1 text-sm text-stone-300">
                  Source: {callForControls?.source_label ?? "Unlabeled"} · Year: {callForControls?.release_year ?? "?"}
                </p>
                <p className="mt-1 text-sm text-stone-300">
                  Correct decade: {(callForControls?.status === "revealed" || callForControls?.status === "scored")
                    ? `${callForControls.decade_start}s`
                    : "hidden"}
                </p>
                {callForControls?.accepted_adjacent_decades.length ? (
                  <p className="mt-1 text-xs text-stone-400">
                    Adjacent accepted: {callForControls.accepted_adjacent_decades.map((decade) => `${decade}s`).join(", ")}
                  </p>
                ) : null}
                {callForControls?.host_notes ? <p className="mt-2 text-xs text-stone-400">Host note: {callForControls.host_notes}</p> : null}
              </div>

              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Recently Played</p>
                <div className="mt-1 max-h-24 overflow-auto text-stone-400">
                  {previousCalls.map((call) => (
                    <div key={call.id}>#{call.call_index} {call.artist ?? "Unknown"} - {call.title ?? "Untitled"} ({call.status})</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-sky-300">Controls</p>
              <p className="mt-1 text-xs text-stone-400">Gap timer target: {session?.target_gap_seconds ?? 0}s · Status: {session?.status ?? "-"}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={advance} className="rounded bg-sky-700 px-2 py-1 disabled:opacity-50">Advance Call</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("asked")} className="rounded bg-blue-700 px-2 py-1 disabled:opacity-50">Mark Asked</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("locked")} className="rounded bg-violet-700 px-2 py-1 disabled:opacity-50">Lock Picks</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("revealed")} className="rounded bg-amber-700 px-2 py-1 disabled:opacity-50">Reveal Decade</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("skipped")} className="rounded bg-red-700 px-2 py-1 disabled:opacity-50">Skip</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={pause} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Pause</button>
                <button disabled={working} onClick={resume} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Resume</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("scored")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Mark Scored</button>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-sky-300">Leaderboard</p>
              <div className="mt-2 space-y-2 text-xs">
                {leaderboard.map((team) => (
                  <div key={team.team_id} className="rounded border border-stone-800 bg-stone-950/70 p-2">
                    <p className="font-semibold">{team.team_name}</p>
                    <p className="text-stone-400">Points: {team.total_points} · Exact: {team.exact_hits} · Adjacent: {team.adjacent_hits}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase text-sky-300">Score Entry</p>
            <button type="button" onClick={setAllMiss} className="rounded border border-stone-600 px-2 py-1 text-xs">Preset: All Miss</button>
          </div>
          <div className="mt-2 space-y-2 text-xs">
            {leaderboard.map((team) => {
              const draft = scoreDraft[team.team_id] ?? { selected_decade: "", awarded_points: "", notes: "" };
              const selectedDecade = normalizeDecade(draft.selected_decade);
              const suggested = computeSuggestedScore(session, callForControls, selectedDecade);
              const suggestedLabel = suggested.exact ? "Exact" : suggested.adjacent ? "Adjacent" : "Miss";

              return (
                <div key={team.team_id} className="grid grid-cols-[1fr,110px,110px,1fr,auto] items-center gap-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                  <div>
                    <p className="font-semibold">{team.team_name}</p>
                    <p className="text-stone-500">Suggested: {suggestedLabel} ({suggested.points})</p>
                  </div>
                  <input
                    className="rounded border border-stone-700 bg-black px-2 py-1"
                    value={draft.selected_decade}
                    placeholder="Decade"
                    onChange={(event) =>
                      setScoreDraft((current) => ({
                        ...current,
                        [team.team_id]: { ...draft, selected_decade: event.target.value },
                      }))
                    }
                  />
                  <input
                    className="rounded border border-stone-700 bg-black px-2 py-1"
                    value={draft.awarded_points}
                    placeholder={`${suggested.points}`}
                    onChange={(event) =>
                      setScoreDraft((current) => ({
                        ...current,
                        [team.team_id]: { ...draft, awarded_points: event.target.value },
                      }))
                    }
                  />
                  <input
                    className="rounded border border-stone-700 bg-black px-2 py-1"
                    value={draft.notes}
                    placeholder="Optional note"
                    onChange={(event) =>
                      setScoreDraft((current) => ({
                        ...current,
                        [team.team_id]: { ...draft, notes: event.target.value },
                      }))
                    }
                  />
                  <span className="rounded border border-stone-600 px-2 py-1 text-[10px] uppercase text-stone-300">
                    {selectedDecade !== null ? `${selectedDecade}s` : "No pick"}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded bg-sky-700 px-3 py-2 text-xs font-semibold disabled:opacity-50"
              disabled={saving || !callForControls}
              onClick={submitScores}
            >
              {saving ? "Saving..." : "Save Scores"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
