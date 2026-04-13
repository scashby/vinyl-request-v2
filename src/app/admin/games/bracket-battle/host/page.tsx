"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Entry = {
  id: number;
  seed: number;
  entry_label: string;
  artist: string | null;
  title: string | null;
  source_label: string | null;
  active: boolean;
};

type Matchup = {
  id: number;
  round_number: number;
  matchup_index: number;
  vote_method: "hands" | "slips";
  status: "pending" | "active" | "voting_locked" | "scored" | "skipped";
  notes: string | null;
  higher_seed_entry: Entry | null;
  lower_seed_entry: Entry | null;
  winner_entry: Entry | null;
  tallies: Array<{
    winner_entry_id: number;
    vote_count: number;
    winner_entry: Entry | null;
  }>;
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  tie_break_points: number;
};

type Session = {
  id: number;
  session_code: string;
  title: string;
  bracket_size: number;
  current_round: number;
  current_matchup_index: number;
  rounds_total: number;
  matchups_total: number;
  status: "pending" | "running" | "paused" | "completed";
  show_title: boolean;
  show_round: boolean;
  show_bracket: boolean;
  show_scoreboard: boolean;
  target_gap_seconds: number;
  entries: Entry[];
  matchups: Matchup[];
  leaderboard: LeaderboardRow[];
};

type ScoreDraft = Record<number, { total_points: string; tie_break_points: string }>;

function entryText(entry: Entry | null): string {
  if (!entry) return "TBD";
  if (entry.artist && entry.title) return `${entry.artist} - ${entry.title}`;
  return entry.entry_label;
}

function entryVotes(matchup: Matchup | null, entryId: number | null | undefined): number {
  if (!matchup || !entryId) return 0;
  return matchup.tallies.find((row) => row.winner_entry_id === entryId)?.vote_count ?? 0;
}

export default function BracketBattleHostPage() {
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [votesA, setVotesA] = useState("0");
  const [votesB, setVotesB] = useState("0");
  const [winnerId, setWinnerId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    const res = await fetch(`/api/games/bracket-battle/sessions/${sessionId}`);
    if (!res.ok) return;
    const payload = (await res.json()) as Session;
    setSession(payload);
  }, [sessionId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 3000);
    return () => clearInterval(poll);
  }, [load]);

  const currentMatchup = useMemo(() => {
    if (!session) return null;
    const roundMatchups = session.matchups.filter((matchup) => matchup.round_number === session.current_round);
    return (
      roundMatchups.find((matchup) => matchup.status === "active" || matchup.status === "voting_locked") ??
      roundMatchups.find((matchup) => matchup.matchup_index === session.current_matchup_index) ??
      roundMatchups[0] ??
      null
    );
  }, [session]);

  useEffect(() => {
    if (!currentMatchup) return;
    const higherVotes = entryVotes(currentMatchup, currentMatchup.higher_seed_entry?.id);
    const lowerVotes = entryVotes(currentMatchup, currentMatchup.lower_seed_entry?.id);
    setVotesA(String(higherVotes));
    setVotesB(String(lowerVotes));
    setWinnerId(currentMatchup.winner_entry?.id ? String(currentMatchup.winner_entry.id) : "");
    setNotes(currentMatchup.notes ?? "");
  }, [currentMatchup?.id]);

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of session?.leaderboard ?? []) {
      draft[row.team_id] = {
        total_points: String(row.total_points),
        tie_break_points: String(row.tie_break_points),
      };
    }
    setScoreDraft(draft);
  }, [session?.id, session?.leaderboard]);

  const runAction = async (fn: () => Promise<void>) => {
    setWorking(true);
    try {
      await fn();
      await load();
    } finally {
      setWorking(false);
    }
  };

  const postNoBody = async (url: string, fallbackError: string) => {
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const payload = await res.json();
      throw new Error(payload.error ?? fallbackError);
    }
  };

  const advance = async () => {
    await runAction(async () => {
      await postNoBody(`/api/games/bracket-battle/sessions/${sessionId}/advance`, "Failed to advance matchup");
    });
  };

  const pause = async () => {
    await runAction(async () => {
      await postNoBody(`/api/games/bracket-battle/sessions/${sessionId}/pause`, "Failed to pause session");
    });
  };

  const resume = async () => {
    await runAction(async () => {
      await postNoBody(`/api/games/bracket-battle/sessions/${sessionId}/resume`, "Failed to resume session");
    });
  };

  const matchupAction = async (action: "open" | "lock" | "resolve" | "skip") => {
    if (!currentMatchup) return;
    await runAction(async () => {
      const res = await fetch(`/api/games/bracket-battle/sessions/${sessionId}/matchups/${currentMatchup.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          winner_entry_id: action === "resolve" ? Number(winnerId) : undefined,
          notes,
        }),
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? `Failed to ${action} matchup`);
      }
    });
  };

  const saveVotes = async () => {
    if (!currentMatchup) return;
    const higherId = currentMatchup.higher_seed_entry?.id;
    const lowerId = currentMatchup.lower_seed_entry?.id;
    if (!higherId || !lowerId) return;

    await runAction(async () => {
      const res = await fetch(`/api/games/bracket-battle/sessions/${sessionId}/matchups/${currentMatchup.id}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tallies: [
            { winner_entry_id: higherId, vote_count: Number(votesA || 0) },
            { winner_entry_id: lowerId, vote_count: Number(votesB || 0) },
          ],
        }),
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to save vote tallies");
      }
    });
  };

  const saveScores = async () => {
    await runAction(async () => {
      const scores = (session?.leaderboard ?? []).map((row) => ({
        team_id: row.team_id,
        total_points: Number(scoreDraft[row.team_id]?.total_points ?? row.total_points),
        tie_break_points: Number(scoreDraft[row.team_id]?.tie_break_points ?? row.tie_break_points),
      }));

      const res = await fetch(`/api/games/bracket-battle/sessions/${sessionId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores }),
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to save scores");
      }
    });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0e1620,#090d12)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-cyan-900/50 bg-black/40 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black uppercase text-cyan-100">Bracket Battle Host Console</h1>
              <p className="mt-2 text-sm text-stone-300">
                {session?.title ?? "Session"} · {session?.session_code ?? (Number.isFinite(sessionId) ? sessionId : "(none selected)")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button className="rounded border border-stone-700 px-2 py-1" type="button" onClick={() => window.open(`/admin/games/bracket-battle/jumbotron?sessionId=${sessionId}`, "bracket_battle_jumbotron", "width=1920,height=1080,noopener,noreferrer")}>Jumbotron</button>
              <button className="rounded border border-stone-700 px-2 py-1" type="button" onClick={() => window.open(`/admin/games/bracket-battle/assistant?sessionId=${sessionId}`, "bracket_battle_assistant", "width=1024,height=800,left=1300,top=0")}>Assistant</button>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/bracket-battle/history">History</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/bracket-battle">Setup</Link>
            </div>
          </div>
          <p className="mt-3 text-xs text-stone-400">
            Status: {session?.status ?? "-"} · Round {session?.current_round ?? 0}/{session?.rounds_total ?? 0} · Matchup {session?.current_matchup_index ?? 0}
            · Bracket {session?.bracket_size ?? 0} · Gap target {session?.target_gap_seconds ?? 0}s
          </p>
        </header>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr]">
          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Current Matchup</p>
              {currentMatchup ? (
                <>
                  <p className="mt-2 text-lg font-black text-stone-100">
                    Round {currentMatchup.round_number} · Matchup {currentMatchup.matchup_index} · {currentMatchup.status}
                  </p>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {[currentMatchup.higher_seed_entry, currentMatchup.lower_seed_entry].map((entry, index) => (
                      <div key={entry?.id ?? `slot-${index}`} className="rounded-xl border border-stone-800 bg-stone-950/70 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Seed {entry?.seed ?? "-"}</p>
                        <p className="mt-2 text-lg font-semibold text-stone-100">{entryText(entry)}</p>
                        {entry?.source_label ? <p className="mt-1 text-sm text-stone-400">{entry.source_label}</p> : null}
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-cyan-200">Winner: {entryText(currentMatchup.winner_entry)}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-stone-400">No matchup loaded.</p>
              )}
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Session Controls</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button disabled={working} onClick={advance} className="rounded bg-cyan-700 px-2 py-1 disabled:opacity-50">Advance</button>
                <button disabled={working} onClick={pause} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Pause</button>
                <button disabled={working} onClick={resume} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Resume</button>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Vote Capture + Resolve</p>
              {currentMatchup ? (
                <>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-stone-300">
                      {entryText(currentMatchup.higher_seed_entry)} votes
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={votesA} onChange={(event) => setVotesA(event.target.value)} />
                    </label>
                    <label className="text-xs text-stone-300">
                      {entryText(currentMatchup.lower_seed_entry)} votes
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={votesB} onChange={(event) => setVotesB(event.target.value)} />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <button disabled={working} onClick={saveVotes} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Save Tallies</button>
                    <button disabled={working} onClick={() => matchupAction("open")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Open Voting</button>
                    <button disabled={working} onClick={() => matchupAction("lock")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Lock Voting</button>
                    <button disabled={working} onClick={() => matchupAction("skip")} className="rounded border border-red-600 px-2 py-1 text-red-200 disabled:opacity-50">Skip Matchup</button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr]">
                    <label className="text-xs text-stone-300">
                      Winner
                      <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={winnerId} onChange={(event) => setWinnerId(event.target.value)}>
                        <option value="">Choose winner</option>
                        {currentMatchup.higher_seed_entry ? <option value={currentMatchup.higher_seed_entry.id}>{entryText(currentMatchup.higher_seed_entry)}</option> : null}
                        {currentMatchup.lower_seed_entry ? <option value={currentMatchup.lower_seed_entry.id}>{entryText(currentMatchup.lower_seed_entry)}</option> : null}
                      </select>
                    </label>
                    <label className="text-xs text-stone-300">
                      Notes
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={notes} onChange={(event) => setNotes(event.target.value)} />
                    </label>
                  </div>
                  <button disabled={working || winnerId === ""} onClick={() => matchupAction("resolve")} className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold disabled:opacity-50">Resolve Winner</button>
                </>
              ) : (
                <p className="mt-2 text-sm text-stone-400">No matchup available.</p>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Leaderboard</p>
              <div className="mt-2 space-y-2 text-xs">
                {(session?.leaderboard ?? []).map((team) => (
                  <div key={team.team_id} className="grid grid-cols-[1fr_90px_90px] items-center gap-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                    <p className="font-semibold">{team.team_name}</p>
                    <input
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={scoreDraft[team.team_id]?.total_points ?? String(team.total_points)}
                      onChange={(event) =>
                        setScoreDraft((draft) => ({
                          ...draft,
                          [team.team_id]: {
                            total_points: event.target.value,
                            tie_break_points: draft[team.team_id]?.tie_break_points ?? String(team.tie_break_points),
                          },
                        }))
                      }
                    />
                    <input
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={scoreDraft[team.team_id]?.tie_break_points ?? String(team.tie_break_points)}
                      onChange={(event) =>
                        setScoreDraft((draft) => ({
                          ...draft,
                          [team.team_id]: {
                            total_points: draft[team.team_id]?.total_points ?? String(team.total_points),
                            tie_break_points: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                ))}
                {(session?.leaderboard ?? []).length === 0 ? <p className="text-stone-500">No teams found.</p> : null}
              </div>
              <button disabled={working || (session?.leaderboard ?? []).length === 0} onClick={saveScores} className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold disabled:opacity-50">Save Leaderboard</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
