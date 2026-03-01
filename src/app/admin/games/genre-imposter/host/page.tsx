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
  round_count: number;
  current_call_index: number;
  reason_mode: "host_judged" | "strict_key";
  imposter_points: number;
  reason_bonus_points: number;
  target_gap_seconds: number;
  remaining_seconds: number;
  playlist: { id: number; name: string; track_count: number } | null;
  teams: Array<{ id: number; team_name: string; table_label: string | null; active: boolean }>;
  rounds: Array<{
    id: number;
    round_number: number;
    category_label: string;
    category_card_note: string | null;
    reason_key: string | null;
    imposter_call_index: number;
    status: "pending" | "active" | "closed";
  }>;
  calls: Array<{
    id: number;
    round_id: number;
    round_number: number;
    call_index: number;
    play_order: number;
    artist: string | null;
    title: string | null;
    source_label: string | null;
    is_imposter: boolean;
    status: "pending" | "cued" | "played" | "revealed" | "scored" | "skipped";
    host_notes: string | null;
  }>;
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  imposter_hits: number;
  reason_bonus_hits: number;
  rounds_scored: number;
};

type PickRow = {
  id: number;
  round_id: number;
  team_id: number;
  picked_call_id: number;
  reason_text: string | null;
  reason_correct: boolean;
  awarded_points: number;
};

type PickDraft = Record<number, { picked_call_id: string; reason_text: string; reason_correct: boolean }>;

const CALL_STATUS_ACTIONS: Array<{ status: "cued" | "played" | "revealed" | "scored" | "skipped"; label: string; className: string }> = [
  { status: "cued", label: "Mark Cued", className: "bg-sky-700" },
  { status: "played", label: "Mark Played", className: "bg-emerald-700" },
  { status: "revealed", label: "Reveal", className: "bg-amber-700" },
  { status: "scored", label: "Mark Scored", className: "bg-violet-700" },
  { status: "skipped", label: "Skip", className: "bg-rose-700" },
];

export default function GenreImposterHostPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [session, setSession] = useState<Session | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [pickDraft, setPickDraft] = useState<PickDraft>({});
  const [working, setWorking] = useState(false);
  const [savingPicks, setSavingPicks] = useState(false);
  const [savingScores, setSavingScores] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/genre-imposter/sessions/${sessionId}`),
      fetch(`/api/games/genre-imposter/sessions/${sessionId}/leaderboard`),
    ]);

    let nextSession: Session | null = null;

    if (sessionRes.ok) {
      const payload = (await sessionRes.json()) as Session;
      setSession(payload);
      nextSession = payload;
    }

    if (leaderboardRes.ok) {
      const payload = await leaderboardRes.json();
      setLeaderboard(payload.data ?? []);
    }

    if (nextSession) {
      const picksRes = await fetch(`/api/games/genre-imposter/sessions/${sessionId}/picks?roundNumber=${nextSession.current_round}`);
      if (picksRes.ok) {
        const payload = await picksRes.json();
        setPicks(payload.data ?? []);
      }
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 3000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    if (!session) return;

    const callsByRound = session.calls.filter((call) => call.round_number === session.current_round);
    const picksByTeam = new Map<number, PickRow>(picks.map((pick) => [pick.team_id, pick]));

    const nextDraft: PickDraft = {};
    for (const team of session.teams.filter((entry) => entry.active)) {
      const existing = picksByTeam.get(team.id);
      nextDraft[team.id] = {
        picked_call_id: existing?.picked_call_id ? String(existing.picked_call_id) : String(callsByRound[0]?.id ?? ""),
        reason_text: existing?.reason_text ?? "",
        reason_correct: Boolean(existing?.reason_correct),
      };
    }

    setPickDraft(nextDraft);
  }, [session, picks]);

  const currentRound = useMemo(() => {
    if (!session) return null;
    return session.rounds.find((round) => round.round_number === session.current_round) ?? null;
  }, [session]);

  const currentRoundCalls = useMemo(() => {
    if (!session) return [];
    return session.calls
      .filter((call) => call.round_number === session.current_round)
      .sort((a, b) => a.play_order - b.play_order);
  }, [session]);

  const activeCall = useMemo(() => {
    if (!session) return null;

    if (session.current_call_index > 0) {
      return currentRoundCalls.find((call) => call.call_index === session.current_call_index) ?? null;
    }

    return currentRoundCalls.find((call) => call.status !== "scored") ?? currentRoundCalls[0] ?? null;
  }, [currentRoundCalls, session]);

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
      const res = await fetch(`/api/games/genre-imposter/sessions/${sessionId}/advance`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to advance");
      }
    });
  };

  const pause = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/genre-imposter/sessions/${sessionId}/pause`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to pause");
      }
    });
  };

  const resume = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/genre-imposter/sessions/${sessionId}/resume`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to resume");
      }
    });
  };

  const patchCallStatus = async (status: "cued" | "played" | "revealed" | "scored" | "skipped") => {
    if (!activeCall) return;

    await runAction(async () => {
      const res = await fetch(`/api/games/genre-imposter/calls/${activeCall.id}`, {
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

  const savePicks = async () => {
    if (!session || !currentRound) return;
    setSavingPicks(true);

    try {
      const rows = session.teams
        .filter((team) => team.active)
        .map((team) => ({
          team_id: team.id,
          picked_call_id: Number(pickDraft[team.id]?.picked_call_id),
          reason_text: pickDraft[team.id]?.reason_text ?? "",
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
          reason_correct: Boolean(pickDraft[team.id]?.reason_correct),
          reason_text: pickDraft[team.id]?.reason_text ?? "",
        }));

      const res = await fetch(`/api/games/genre-imposter/sessions/${sessionId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round_number: currentRound.round_number,
          awards,
          scored_by: "host",
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#0f1e1b,#0a120f)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-emerald-900/50 bg-black/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">Host Console</p>
              <h1 className="text-3xl font-black uppercase">Genre Imposter Host</h1>
              <p className="text-sm text-stone-400">
                {session?.title} · {session?.session_code} · Round {session?.current_round ?? 0} of {session?.round_count ?? 0}
              </p>
              <p className="text-xs text-stone-500">Playlist: {session?.playlist?.name ?? "(none)"}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/genre-imposter/assistant?sessionId=${sessionId}`}>Assistant</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/genre-imposter/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/genre-imposter/history">History</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/genre-imposter">Setup</Link>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-200">Round Stack</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Slot</th>
                    <th className="pb-2">Track</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(session?.calls ?? []).map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2 font-bold text-emerald-300">{call.call_index}</td>
                      <td className="py-2">{call.artist ?? "Unknown"} - {call.title ?? "Untitled"}</td>
                      <td className="py-2 text-stone-400">{call.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-200">Current Round</h2>
              <div className="mt-3 rounded border border-emerald-700/40 bg-emerald-950/20 p-3">
                <p className="text-xs uppercase text-emerald-300">
                  Round {session?.current_round ?? 0} · Spin {session?.current_call_index ?? 0} of 3
                </p>
                <p className="mt-1 text-lg font-black">{currentRound?.category_label ?? "Waiting for host"}</p>
                <p className="mt-2 text-sm text-stone-300">{currentRound?.category_card_note ?? "No category note"}</p>
                <p className="mt-2 text-xs text-stone-400">
                  Active: {activeCall ? `${activeCall.artist ?? "Unknown"} - ${activeCall.title ?? "Untitled"}` : "No active call"}
                </p>
                {session?.reason_mode === "strict_key" && currentRound?.reason_key ? (
                  <p className="mt-2 text-xs text-amber-300">Strict key: {currentRound.reason_key}</p>
                ) : null}
              </div>

              <div className="mt-3 text-xs text-stone-300">
                <p>Gap target: {session?.target_gap_seconds ?? 0}s</p>
                <p>Remaining: {session?.remaining_seconds ?? 0}s</p>
                <p>Status: {session?.status ?? "-"}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={advance} className="rounded bg-emerald-700 px-2 py-1 disabled:opacity-50">Advance Spin</button>
                <button disabled={working} onClick={pause} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Pause</button>
                <button disabled={working} onClick={resume} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Resume</button>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {CALL_STATUS_ACTIONS.map((action) => (
                  <button
                    key={action.status}
                    disabled={working || !activeCall}
                    onClick={() => patchCallStatus(action.status)}
                    className={`rounded px-2 py-1 disabled:opacity-50 ${action.className}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-emerald-300">Pick Capture + Scoring</p>
              <p className="mt-1 text-xs text-stone-400">2 points imposter, +1 reason bonus (when imposter is correct).</p>
              <div className="mt-2 space-y-2 text-xs">
                {session?.teams.filter((team) => team.active).map((team) => (
                  <div key={team.id} className="grid grid-cols-[1.1fr,120px,1fr,auto] items-center gap-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                    <div>
                      <p className="font-semibold">{team.team_name}</p>
                      <p className="text-[11px] text-stone-400">Table: {team.table_label ?? "-"}</p>
                    </div>

                    <select
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={pickDraft[team.id]?.picked_call_id ?? ""}
                      onChange={(e) =>
                        setPickDraft((draft) => ({
                          ...draft,
                          [team.id]: {
                            ...(draft[team.id] ?? { reason_text: "", reason_correct: false }),
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
                      value={pickDraft[team.id]?.reason_text ?? ""}
                      onChange={(e) =>
                        setPickDraft((draft) => ({
                          ...draft,
                          [team.id]: {
                            ...(draft[team.id] ?? { picked_call_id: "", reason_correct: false }),
                            reason_text: e.target.value,
                          },
                        }))
                      }
                    />

                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={Boolean(pickDraft[team.id]?.reason_correct)}
                        onChange={(e) =>
                          setPickDraft((draft) => ({
                            ...draft,
                            [team.id]: {
                              ...(draft[team.id] ?? { picked_call_id: "", reason_text: "" }),
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
                <button disabled={savingPicks || !session} onClick={savePicks} className="rounded bg-cyan-700 px-2 py-1 disabled:opacity-50">{savingPicks ? "Saving Picks..." : "Save Picks"}</button>
                <button disabled={savingScores || !session} onClick={scoreRound} className="rounded bg-violet-700 px-2 py-1 disabled:opacity-50">{savingScores ? "Scoring..." : "Score Round"}</button>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-emerald-300">Leaderboard</p>
              <div className="mt-2 space-y-1 text-sm">
                {leaderboard.map((row, index) => (
                  <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-800 bg-stone-950/70 px-2 py-1">
                    <span>{index + 1}. {row.team_name}</span>
                    <span className="text-emerald-300">{row.total_points} pts</span>
                  </div>
                ))}
                {leaderboard.length === 0 ? <p className="text-xs text-stone-400">No scores yet.</p> : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
