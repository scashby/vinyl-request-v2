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
};

type Matchup = {
  id: number;
  round_number: number;
  matchup_index: number;
  status: "pending" | "active" | "voting_locked" | "scored" | "skipped";
  notes: string | null;
  higher_seed_entry: Entry | null;
  lower_seed_entry: Entry | null;
  winner_entry: Entry | null;
  tallies: Array<{ winner_entry_id: number; vote_count: number }>;
};

type Session = {
  id: number;
  title: string;
  status: "pending" | "running" | "paused" | "completed";
  current_round: number;
  current_matchup_index: number;
  rounds_total: number;
  matchups: Matchup[];
};

function entryLabel(entry: Entry | null): string {
  if (!entry) return "TBD";
  if (entry.artist && entry.title) return `${entry.artist} - ${entry.title}`;
  return entry.entry_label;
}

function votesFor(matchup: Matchup | null, entryId: number | undefined): number {
  if (!matchup || !entryId) return 0;
  return matchup.tallies.find((row) => row.winner_entry_id === entryId)?.vote_count ?? 0;
}

export default function BracketBattleAssistantPage() {
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [selectedMatchupId, setSelectedMatchupId] = useState<number | null>(null);
  const [votesA, setVotesA] = useState("0");
  const [votesB, setVotesB] = useState("0");
  const [winnerId, setWinnerId] = useState("");
  const [notes, setNotes] = useState("");
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
    const poll = setInterval(load, 2500);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    if (!session) return;
    const active =
      session.matchups.find((matchup) => matchup.status === "active" || matchup.status === "voting_locked") ??
      session.matchups.find(
        (matchup) => matchup.round_number === session.current_round && matchup.matchup_index === session.current_matchup_index
      ) ??
      session.matchups[0] ??
      null;
    setSelectedMatchupId((current) => current ?? active?.id ?? null);
  }, [session?.id, session?.current_round, session?.current_matchup_index, session?.matchups]);

  const selectedMatchup = useMemo(
    () => session?.matchups.find((matchup) => matchup.id === selectedMatchupId) ?? null,
    [selectedMatchupId, session?.matchups]
  );

  useEffect(() => {
    if (!selectedMatchup) return;
    setVotesA(String(votesFor(selectedMatchup, selectedMatchup.higher_seed_entry?.id)));
    setVotesB(String(votesFor(selectedMatchup, selectedMatchup.lower_seed_entry?.id)));
    setWinnerId(selectedMatchup.winner_entry?.id ? String(selectedMatchup.winner_entry.id) : "");
    setNotes(selectedMatchup.notes ?? "");
  }, [selectedMatchup?.id]);

  const runAction = async (fn: () => Promise<void>) => {
    setWorking(true);
    try {
      await fn();
      await load();
    } finally {
      setWorking(false);
    }
  };

  const saveTallies = async () => {
    if (!selectedMatchup) return;
    const higher = selectedMatchup.higher_seed_entry?.id;
    const lower = selectedMatchup.lower_seed_entry?.id;
    if (!higher || !lower) return;

    await runAction(async () => {
      const res = await fetch(
        `/api/games/bracket-battle/sessions/${sessionId}/matchups/${selectedMatchup.id}/votes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tallies: [
              { winner_entry_id: higher, vote_count: Number(votesA || 0) },
              { winner_entry_id: lower, vote_count: Number(votesB || 0) },
            ],
          }),
        }
      );
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to save tallies");
      }
    });
  };

  const matchupAction = async (action: "open" | "lock" | "resolve") => {
    if (!selectedMatchup) return;
    await runAction(async () => {
      const res = await fetch(`/api/games/bracket-battle/sessions/${sessionId}/matchups/${selectedMatchup.id}`, {
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

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#16120e,#110d09)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-3xl border border-amber-900/50 bg-black/40 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black uppercase text-amber-100">Bracket Battle Assistant</h1>
              <p className="mt-2 text-sm text-stone-300">{session?.title ?? "Session"}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button className="rounded border border-stone-600 px-2 py-1" type="button" onClick={() => window.open(`/admin/games/bracket-battle/host?sessionId=${sessionId}`, "bracket_battle_host", "width=1280,height=900")}>Host</button>
              <button className="rounded border border-stone-600 px-2 py-1" type="button" onClick={() => window.open(`/admin/games/bracket-battle/jumbotron?sessionId=${sessionId}`, "bracket_battle_jumbotron", "width=1920,height=1080")}>Jumbotron</button>
              <Link href="/admin/games/bracket-battle" className="rounded border border-stone-600 px-2 py-1">Setup</Link>
            </div>
          </div>

          <p className="mt-3 text-xs text-stone-400">
            Status: {session?.status ?? "-"} · Round {session?.current_round ?? 0}/{session?.rounds_total ?? 0} · Session {Number.isFinite(sessionId) ? sessionId : "(none selected)"}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-amber-300">Matchups</p>
            <div className="mt-3 space-y-2 text-xs">
              {(session?.matchups ?? []).map((matchup) => (
                <button
                  key={matchup.id}
                  className={`block w-full rounded border px-2 py-2 text-left ${selectedMatchupId === matchup.id ? "border-amber-400 bg-amber-900/30" : "border-stone-700 bg-stone-950/70"}`}
                  type="button"
                  onClick={() => setSelectedMatchupId(matchup.id)}
                >
                  <p className="font-semibold">R{matchup.round_number} · M{matchup.matchup_index}</p>
                  <p className="text-stone-400">{matchup.status}</p>
                </button>
              ))}
              {(session?.matchups ?? []).length === 0 ? <p className="text-stone-500">No matchups yet.</p> : null}
            </div>
          </aside>

          <section className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-amber-300">Vote Operations</p>
            {selectedMatchup ? (
              <>
                <p className="mt-2 text-lg font-black text-stone-100">Round {selectedMatchup.round_number} · Matchup {selectedMatchup.matchup_index}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {[selectedMatchup.higher_seed_entry, selectedMatchup.lower_seed_entry].map((entry, index) => (
                    <div key={entry?.id ?? `empty-${index}`} className="rounded border border-stone-800 bg-stone-900/70 p-3">
                      <p className="text-xs text-stone-400">Seed {entry?.seed ?? "-"}</p>
                      <p className="mt-1 text-sm font-semibold text-stone-100">{entryLabel(entry)}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-xs text-stone-300">
                    {entryLabel(selectedMatchup.higher_seed_entry)} votes
                    <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={votesA} onChange={(event) => setVotesA(event.target.value)} />
                  </label>
                  <label className="text-xs text-stone-300">
                    {entryLabel(selectedMatchup.lower_seed_entry)} votes
                    <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={votesB} onChange={(event) => setVotesB(event.target.value)} />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <button className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50" disabled={working} onClick={saveTallies}>Save Tallies</button>
                  <button className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50" disabled={working} onClick={() => matchupAction("open")}>Open</button>
                  <button className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50" disabled={working} onClick={() => matchupAction("lock")}>Lock</button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr]">
                  <label className="text-xs text-stone-300">
                    Winner
                    <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={winnerId} onChange={(event) => setWinnerId(event.target.value)}>
                      <option value="">Choose winner</option>
                      {selectedMatchup.higher_seed_entry ? <option value={selectedMatchup.higher_seed_entry.id}>{entryLabel(selectedMatchup.higher_seed_entry)}</option> : null}
                      {selectedMatchup.lower_seed_entry ? <option value={selectedMatchup.lower_seed_entry.id}>{entryLabel(selectedMatchup.lower_seed_entry)}</option> : null}
                    </select>
                  </label>
                  <label className="text-xs text-stone-300">
                    Notes
                    <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={notes} onChange={(event) => setNotes(event.target.value)} />
                  </label>
                </div>

                <button className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold disabled:opacity-50" disabled={working || winnerId === ""} onClick={() => matchupAction("resolve")}>Confirm Winner</button>
              </>
            ) : (
              <p className="mt-2 text-sm text-stone-400">Select a matchup to manage votes.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
