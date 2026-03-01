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
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  decade_start: number;
  accepted_adjacent_decades: number[];
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

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = { selected_decade: "", awarded_points: "", notes: "" };
    }
    setScoreDraft(draft);
  }, [activeCall?.id, leaderboard]);

  const submitScores = async () => {
    if (!activeCall) return;
    setSaving(true);
    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? { selected_decade: "", awarded_points: "", notes: "" };
        const selectedDecade = normalizeDecade(draft.selected_decade);
        const suggestedPoints = computeSuggestedPoints(session, activeCall, selectedDecade);
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
        body: JSON.stringify({ call_id: activeCall.id, awards, scored_by: "assistant" }),
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#171b28,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-sky-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-sky-100">Decade Dash Assistant</h1>
          <Link href="/admin/games/decade-dash" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">
          Session: {session?.session_code ?? "(none selected)"} · Round {session?.current_round ?? "-"} / {session?.round_count ?? "-"} · Status: {session?.status ?? "-"}
        </p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">Current Call</h2>
          <p className="mt-2 text-sm text-stone-200">
            {activeCall
              ? `Call ${activeCall.call_index} · Round ${activeCall.round_number} · Status: ${activeCall.status}`
              : "No active call selected by host yet."}
          </p>
          <p className="mt-1 text-sm text-stone-400">
            Scoring: exact {session?.exact_points ?? 2}, adjacent {session?.adjacent_points ?? 1} ({session?.adjacent_scoring_enabled ? "enabled" : "disabled"})
          </p>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">Score Helper</h2>
          <div className="mt-3 space-y-2 text-xs">
            {leaderboard.map((team) => {
              const draft = scoreDraft[team.team_id] ?? { selected_decade: "", awarded_points: "", notes: "" };
              const selectedDecade = normalizeDecade(draft.selected_decade);
              const suggestedPoints = computeSuggestedPoints(session, activeCall, selectedDecade);
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
            disabled={!activeCall || saving}
          >
            {saving ? "Saving..." : "Save Scores"}
          </button>
        </section>
      </div>
    </div>
  );
}
