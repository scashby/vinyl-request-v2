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
};

type ScoreDraft = Record<number, { selected_decade: string; awarded_points: string; notes: string }>;

function normalizeDecade(value: string): number | null {
  const raw = value.trim().replace(/s$/i, "");
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return null;
  const decade = Math.floor(numeric / 10) * 10;
  if (decade < 1950 || decade > 2030) return null;
  return decade;
}

function computeSuggestedPoints(session: Session | null, call: Call | null, selectedDecade: number | null): number {
  if (!session || !call || selectedDecade === null) return 0;
  if (selectedDecade === call.decade_start) return session.exact_points;
  if (session.adjacent_scoring_enabled && call.accepted_adjacent_decades.includes(selectedDecade)) return session.adjacent_points;
  return 0;
}

export default function DecadeDashAssistantPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

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
    setErrorText(null);
    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? { selected_decade: "", awarded_points: "", notes: "" };
        const selectedDecade = normalizeDecade(draft.selected_decade);
        const suggestedPoints = computeSuggestedPoints(session, callForControls, selectedDecade);
        const parsedPoints = Number(draft.awarded_points);
        return {
          team_id: team.team_id,
          selected_decade: selectedDecade ?? undefined,
          awarded_points:
            Number.isFinite(parsedPoints) && draft.awarded_points !== ""
              ? parsedPoints
              : suggestedPoints,
          notes: draft.notes || undefined,
        };
      });

      const res = await fetch(`/api/games/decade-dash/sessions/${sessionId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_id: callForControls.id, awards, scored_by: "assistant" }),
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#171b28,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-sky-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black uppercase text-sky-100">Decade Dash Assistant</h1>
            <p className="mt-2 text-sm text-stone-300">
              Session: {session?.session_code ?? "(none selected)"} · Round {session?.current_round ?? "-"} / {session?.round_count ?? "-"} · Status: {session?.status ?? "-"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase" onClick={() => window.open(`/admin/games/decade-dash/host?sessionId=${sessionId}`, "decade_dash_host", "width=1280,height=900")}>Host</button>
            <button type="button" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase" onClick={() => window.open(`/admin/games/decade-dash/jumbotron?sessionId=${sessionId}`, "decade_dash_jumbotron", "width=1920,height=1080")}>Jumbotron</button>
            <Link href="/admin/games/decade-dash" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
          </div>
        </div>

        {errorText ? <div className="mt-3 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200">{errorText}</div> : null}

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">Session Controls</h2>
          <p className="mt-2 text-sm text-stone-400">Gap target: {session?.target_gap_seconds ?? 0}s · Scoring: exact {session?.exact_points ?? 2}, adjacent {session?.adjacent_points ?? 1} ({session?.adjacent_scoring_enabled ? "enabled" : "disabled"})</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button disabled={working} onClick={advance} className="rounded bg-sky-700 px-2 py-1 disabled:opacity-50">Advance Call</button>
            <button disabled={working || !callForControls} onClick={() => patchCallStatus("asked")} className="rounded bg-blue-700 px-2 py-1 disabled:opacity-50">Mark Asked</button>
            <button disabled={working || !callForControls} onClick={() => patchCallStatus("locked")} className="rounded bg-violet-700 px-2 py-1 disabled:opacity-50">Lock Picks</button>
            <button disabled={working || !callForControls} onClick={() => patchCallStatus("revealed")} className="rounded bg-amber-700 px-2 py-1 disabled:opacity-50">Reveal Decade</button>
            <button disabled={working || !callForControls} onClick={() => patchCallStatus("skipped")} className="rounded bg-red-700 px-2 py-1 disabled:opacity-50">Skip</button>
            <button disabled={working || !callForControls} onClick={() => patchCallStatus("scored")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Mark Scored</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <button disabled={working} onClick={pause} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Pause</button>
            <button disabled={working} onClick={resume} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Resume</button>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">Current Call</h2>
          <p className="mt-2 text-sm text-stone-200">
            {callForControls
              ? `Call ${callForControls.call_index} · Round ${callForControls.round_number} · Status: ${callForControls.status}`
              : "No active call selected by host yet."}
          </p>
          {callForControls ? (
            <>
              <p className="mt-2 text-sm text-stone-300">{callForControls.artist ?? "Unknown"} - {callForControls.title ?? "Untitled"}</p>
              <p className="mt-1 text-sm text-stone-400">Source: {callForControls.source_label ?? "Unlabeled"} · Year: {callForControls.release_year ?? "?"}</p>
              <p className="mt-1 text-sm text-stone-400">Correct decade: {(callForControls.status === "revealed" || callForControls.status === "scored") ? `${callForControls.decade_start}s` : "hidden"}</p>
              {callForControls.accepted_adjacent_decades.length ? <p className="mt-1 text-xs text-stone-400">Adjacent accepted: {callForControls.accepted_adjacent_decades.map((decade) => `${decade}s`).join(", ")}</p> : null}
              {callForControls.host_notes ? <p className="mt-2 text-xs text-stone-400">Host note: {callForControls.host_notes}</p> : null}
            </>
          ) : null}
          <div className="mt-3 text-xs">
            <p className="font-semibold text-stone-300">Recently Played</p>
            <div className="mt-1 max-h-24 overflow-auto text-stone-400">
              {previousCalls.map((call) => (
                <div key={call.id}>#{call.call_index} {call.artist ?? "Unknown"} - {call.title ?? "Untitled"} ({call.status})</div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">Score Helper</h2>
            <button type="button" onClick={setAllMiss} className="rounded border border-stone-600 px-2 py-1 text-xs">Preset: All Miss</button>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            {leaderboard.map((team) => {
              const draft = scoreDraft[team.team_id] ?? { selected_decade: "", awarded_points: "", notes: "" };
              const selectedDecade = normalizeDecade(draft.selected_decade);
              const suggestedPoints = computeSuggestedPoints(session, callForControls, selectedDecade);
              return (
                <div key={team.team_id} className="grid grid-cols-[1fr,120px,120px,1fr] items-center gap-2 rounded border border-stone-800 bg-black/40 p-2">
                  <div>
                    <p className="font-semibold">{team.team_name}</p>
                    <p className="text-stone-500">Total: {team.total_points} · Exact: {team.exact_hits} · Adjacent: {team.adjacent_hits}</p>
                  </div>
                  <input
                    className="rounded border border-stone-700 bg-black px-2 py-1"
                    placeholder="Decade"
                    value={draft.selected_decade}
                    onChange={(event) =>
                      setScoreDraft((current) => ({
                        ...current,
                        [team.team_id]: { ...draft, selected_decade: event.target.value },
                      }))
                    }
                  />
                  <input
                    className="rounded border border-stone-700 bg-black px-2 py-1"
                    placeholder={`${suggestedPoints}`}
                    value={draft.awarded_points}
                    onChange={(event) =>
                      setScoreDraft((current) => ({
                        ...current,
                        [team.team_id]: { ...draft, awarded_points: event.target.value },
                      }))
                    }
                  />
                  <input
                    className="rounded border border-stone-700 bg-black px-2 py-1"
                    placeholder="Optional note"
                    value={draft.notes}
                    onChange={(event) =>
                      setScoreDraft((current) => ({
                        ...current,
                        [team.team_id]: { ...draft, notes: event.target.value },
                      }))
                    }
                  />
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="mt-3 rounded bg-sky-700 px-3 py-2 text-xs font-semibold disabled:opacity-50"
            onClick={submitScores}
            disabled={!callForControls || saving}
          >
            {saving ? "Saving..." : "Save Scores"}
          </button>
        </section>
      </div>
    </div>
  );
}
