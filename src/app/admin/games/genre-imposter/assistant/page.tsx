"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  id: number;
  title: string;
  session_code: string;
  status: "pending" | "running" | "paused" | "completed";
  current_round: number;
  reason_mode: "host_judged" | "strict_key";
  teams: Array<{ id: number; team_name: string; table_label: string | null; active: boolean }>;
  rounds: Array<{ id: number; round_number: number; category_label: string; reason_key: string | null }>;
  calls: Array<{ id: number; round_number: number; call_index: number; artist: string | null; title: string | null; status: string }>;
};

type PickRow = {
  team_id: number;
  picked_call_id: number;
  reason_text: string | null;
  reason_correct: boolean;
};

type PickDraft = Record<number, { picked_call_id: string; reason_text: string; reason_correct: boolean }>;

export default function GenreImposterAssistantPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [session, setSession] = useState<Session | null>(null);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [draft, setDraft] = useState<PickDraft>({});
  const [savingPicks, setSavingPicks] = useState(false);
  const [savingScores, setSavingScores] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const sessionRes = await fetch(`/api/games/genre-imposter/sessions/${sessionId}`);
    if (sessionRes.ok) {
      const payload = (await sessionRes.json()) as Session;
      setSession(payload);

      const picksRes = await fetch(`/api/games/genre-imposter/sessions/${sessionId}/picks?roundNumber=${payload.current_round}`);
      if (picksRes.ok) {
        const picksPayload = await picksRes.json();
        setPicks(picksPayload.data ?? []);
      }
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 3000);
    return () => clearInterval(poll);
  }, [load]);

  const currentRound = useMemo(() => {
    if (!session) return null;
    return session.rounds.find((round) => round.round_number === session.current_round) ?? null;
  }, [session]);

  const currentRoundCalls = useMemo(() => {
    if (!session) return [];
    return session.calls
      .filter((call) => call.round_number === session.current_round)
      .sort((a, b) => a.call_index - b.call_index);
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const byTeam = new Map<number, PickRow>(picks.map((pick) => [pick.team_id, pick]));
    const next: PickDraft = {};

    for (const team of session.teams.filter((entry) => entry.active)) {
      const pick = byTeam.get(team.id);
      next[team.id] = {
        picked_call_id: pick?.picked_call_id ? String(pick.picked_call_id) : String(currentRoundCalls[0]?.id ?? ""),
        reason_text: pick?.reason_text ?? "",
        reason_correct: Boolean(pick?.reason_correct),
      };
    }

    setDraft(next);
  }, [session, picks, currentRoundCalls]);

  const savePicks = async () => {
    if (!session || !currentRound) return;
    setSavingPicks(true);

    try {
      const rows = session.teams
        .filter((team) => team.active)
        .map((team) => ({
          team_id: team.id,
          picked_call_id: Number(draft[team.id]?.picked_call_id),
          reason_text: draft[team.id]?.reason_text ?? "",
        }))
        .filter((row) => Number.isFinite(row.picked_call_id) && row.picked_call_id > 0);

      const res = await fetch(`/api/games/genre-imposter/sessions/${sessionId}/picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round_number: currentRound.round_number, picks: rows }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to save picks");
      }

      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save picks");
    } finally {
      setSavingPicks(false);
    }
  };

  const scoreRound = async () => {
    if (!session || !currentRound) return;
    setSavingScores(true);

    try {
      const awards = session.teams
        .filter((team) => team.active)
        .map((team) => ({
          team_id: team.id,
          reason_correct: Boolean(draft[team.id]?.reason_correct),
          reason_text: draft[team.id]?.reason_text ?? "",
        }));

      const res = await fetch(`/api/games/genre-imposter/sessions/${sessionId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round_number: currentRound.round_number,
          awards,
          scored_by: "assistant",
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to score round");
      }

      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to score round");
    } finally {
      setSavingScores(false);
    }
  };

  if (!Number.isFinite(sessionId)) {
    return <div className="p-6 text-sm text-red-300">Invalid session id.</div>;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#1d1610,#140f0a)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-4 rounded-3xl border border-amber-900/50 bg-black/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black uppercase text-amber-100">Genre Imposter Assistant</h1>
            <p className="text-sm text-stone-300">{session?.title} · {session?.session_code} · Round {session?.current_round ?? 0}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href={`/admin/games/genre-imposter/host?sessionId=${sessionId}`} className="rounded border border-stone-600 px-2 py-1">Host</Link>
            <Link href={`/admin/games/genre-imposter/jumbotron?sessionId=${sessionId}`} className="rounded border border-stone-600 px-2 py-1">Jumbotron</Link>
            <Link href="/admin/games/genre-imposter" className="rounded border border-stone-600 px-2 py-1">Setup</Link>
          </div>
        </div>

        <section className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Current Category</p>
          <p className="mt-2 text-lg font-black">{currentRound?.category_label ?? "Waiting"}</p>
          <p className="mt-1 text-xs text-stone-400">Reason mode: {session?.reason_mode ?? "-"}{session?.reason_mode === "strict_key" && currentRound?.reason_key ? ` · Key: ${currentRound.reason_key}` : ""}</p>

          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {currentRoundCalls.map((call) => (
              <div key={call.id} className="rounded border border-stone-700 bg-stone-950 p-2 text-xs">
                <p className="font-semibold text-amber-300">Slot {call.call_index}</p>
                <p>{call.artist ?? "Unknown"} - {call.title ?? "Untitled"}</p>
                <p className="text-stone-400">{call.status}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Pick Capture</p>
          <div className="mt-3 space-y-2 text-xs">
            {session?.teams.filter((team) => team.active).map((team) => (
              <div key={team.id} className="grid grid-cols-[1.1fr,120px,1fr,auto] items-center gap-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                <div>
                  <p className="font-semibold">{team.team_name}</p>
                  <p className="text-[11px] text-stone-400">Table: {team.table_label ?? "-"}</p>
                </div>

                <select
                  className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                  value={draft[team.id]?.picked_call_id ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [team.id]: {
                        ...(prev[team.id] ?? { reason_text: "", reason_correct: false }),
                        picked_call_id: e.target.value,
                      },
                    }))
                  }
                >
                  {currentRoundCalls.map((call) => (
                    <option key={call.id} value={call.id}>Slot {call.call_index}</option>
                  ))}
                </select>

                <input
                  className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                  placeholder="Reason"
                  value={draft[team.id]?.reason_text ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [team.id]: {
                        ...(prev[team.id] ?? { picked_call_id: "", reason_correct: false }),
                        reason_text: e.target.value,
                      },
                    }))
                  }
                />

                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={Boolean(draft[team.id]?.reason_correct)}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [team.id]: {
                          ...(prev[team.id] ?? { picked_call_id: "", reason_text: "" }),
                          reason_correct: e.target.checked,
                        },
                      }))
                    }
                  />
                  +Reason
                </label>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button disabled={savingPicks} onClick={savePicks} className="rounded bg-amber-700 px-2 py-1 disabled:opacity-50">{savingPicks ? "Saving..." : "Save Picks"}</button>
            <button disabled={savingScores} onClick={scoreRound} className="rounded bg-violet-700 px-2 py-1 disabled:opacity-50">{savingScores ? "Scoring..." : "Score Round"}</button>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4 text-xs text-stone-300">
          Assistant instructions: capture picks immediately after spin 3, flag ambiguous reasons in text, then score when host confirms reveal.
        </section>
      </div>
    </div>
  );
}
