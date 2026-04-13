"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type Round = {
  round_number: number;
  round_name: string;
  expected_matchups: number;
  status: "pending" | "active" | "closed";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  tie_break_points: number;
};

type SessionPayload = {
  id: number;
  title: string;
  session_code: string;
  bracket_size: number;
  vote_method: "hands" | "slips";
  target_gap_seconds: number;
  current_round: number;
  current_matchup_index: number;
  status: "pending" | "running" | "paused" | "completed";
  show_title: boolean;
  show_round: boolean;
  show_bracket: boolean;
  show_scoreboard: boolean;
  rounds_total: number;
  matchups_total: number;
  rounds: Round[];
  entries: Entry[];
  matchups: Matchup[];
  leaderboard: LeaderboardRow[];
  show_logo: boolean;
  welcome_heading_text: string | null;
  welcome_message_text: string | null;
  intermission_heading_text: string | null;
  intermission_message_text: string | null;
  thanks_heading_text: string | null;
  thanks_subheading_text: string | null;
  host_overlay: string;
  host_overlay_remaining_seconds: number;
  event: { venue_logo_url: string | null } | null;
};

function formatEntry(entry: Entry | null): string {
  if (!entry) return "TBD";
  if (entry.artist && entry.title) return `${entry.artist} - ${entry.title}`;
  return entry.entry_label;
}

function matchupStatusCopy(status: Matchup["status"] | null): string {
  if (status === "active") return "Voting is open";
  if (status === "voting_locked") return "Votes are locked";
  if (status === "scored") return "Winner confirmed";
  if (status === "skipped") return "Matchup skipped";
  return "Stand by for the next matchup";
}

export default function BracketBattleJumbotronPage() {
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("sessionId"));
  const containerRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [overlayRemaining, setOverlayRemaining] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const sessionRes = await fetch(`/api/games/bracket-battle/sessions/${sessionId}`);
    if (!sessionRes.ok) return;

    const payload = (await sessionRes.json()) as SessionPayload;
    setSession(payload);
  }, [sessionId]);

  useEffect(() => {
    const remaining = session?.host_overlay_remaining_seconds ?? 0;
    setOverlayRemaining(remaining);
    if (remaining <= 0) return;
    const tick = setInterval(() => setOverlayRemaining((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(tick);
  }, [session?.host_overlay, session?.host_overlay_remaining_seconds]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 3000);
    return () => clearInterval(poll);
  }, [load]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "f" || event.key === "F") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  const currentRound = useMemo(() => {
    if (!session) return null;
    return session.rounds.find((round) => round.round_number === session.current_round) ?? null;
  }, [session]);

  const currentRoundIndex = Math.max(1, session?.current_matchup_index || 1);

  const currentMatchup = useMemo(() => {
    if (!session) return null;

    const currentRoundMatchups = session.matchups.filter((matchup) => matchup.round_number === session.current_round);
    return (
      currentRoundMatchups.find((matchup) => matchup.status === "active" || matchup.status === "voting_locked") ??
      currentRoundMatchups.find((matchup) => matchup.matchup_index === currentRoundIndex) ??
      currentRoundMatchups[0] ??
      null
    );
  }, [currentRoundIndex, session]);

  const currentWinner = currentMatchup?.winner_entry ?? null;
  const showThanksOverlay = session?.status === "completed" || session?.host_overlay === "thanks";
  const showOverlay = showThanksOverlay || (!!session?.host_overlay && session.host_overlay !== "none");
  const logoUrl = session?.show_logo ? (session?.event?.venue_logo_url ?? null) : null;
  const topTeams = session?.leaderboard.slice(0, 6) ?? [];

  return (
    <div ref={containerRef} className="min-h-screen bg-[linear-gradient(180deg,#090909,#050505)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-6 rounded-3xl border border-fuchsia-900/40 bg-black/55 p-6">
        {!showOverlay ? (
        <>
        <div className="flex items-center justify-between gap-3">
          <div>
            {logoUrl ? <img src={logoUrl} alt="Venue logo" className="mb-3 h-14 w-auto object-contain" /> : null}
            {session?.show_title ? <h1 className="text-3xl font-black uppercase text-fuchsia-100">{session?.title ?? "Bracket Battle"}</h1> : null}
            <p className="mt-2 text-sm text-stone-300">
              Session: {session?.session_code ?? (Number.isFinite(sessionId) ? sessionId : "(none selected)")} · Status: {session?.status ?? "-"}
            </p>
          </div>
          <Link href="/admin/games/bracket-battle" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <section className="rounded-3xl border border-stone-700 bg-stone-950/60 p-6">
          <div className="flex flex-wrap items-center gap-4 text-sm uppercase tracking-[0.16em] text-fuchsia-200">
            {session?.show_round ? <span>{currentRound?.round_name ?? `Round ${session?.current_round ?? 1}`}</span> : null}
            <span>Matchup {currentMatchup?.matchup_index ?? currentRoundIndex}</span>
            <span>Bracket {session?.bracket_size ?? "-"}</span>
            <span>Voting: {currentMatchup?.vote_method ?? session?.vote_method ?? "-"}</span>
            <span>Reset Buffer: {session?.target_gap_seconds ?? 0}s</span>
          </div>

          <p className="mt-4 text-4xl font-black text-fuchsia-100">{matchupStatusCopy(currentMatchup?.status ?? null)}</p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {[currentMatchup?.higher_seed_entry ?? null, currentMatchup?.lower_seed_entry ?? null].map((entry, index) => {
              const isWinner = currentWinner?.id === entry?.id;
              const tally = currentMatchup?.tallies.find((row) => row.winner_entry_id === entry?.id)?.vote_count ?? 0;
              return (
                <article
                  key={entry?.id ?? `slot-${index}`}
                  className={`rounded-3xl border p-6 ${
                    isWinner ? "border-emerald-500 bg-emerald-950/20" : "border-stone-700 bg-black/35"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.16em] text-stone-400">Seed {entry?.seed ?? "-"}</p>
                      <p className="mt-3 text-3xl font-black text-stone-100">{formatEntry(entry)}</p>
                      {entry?.source_label ? <p className="mt-3 text-lg text-stone-300">{entry.source_label}</p> : null}
                    </div>
                    {isWinner ? <span className="rounded-full border border-emerald-400 bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Winner</span> : null}
                  </div>
                  <p className="mt-6 text-lg text-fuchsia-200">Votes: {tally}</p>
                </article>
              );
            })}
          </div>

          {currentMatchup?.notes ? <p className="mt-4 text-sm text-stone-300">Host note: {currentMatchup.notes}</p> : null}
        </section>

        {session?.show_bracket ? (
          <section className="rounded-3xl border border-stone-700 bg-stone-950/60 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-fuchsia-200">Bracket Progression</h2>
            <div className="mt-4 grid gap-4 xl:grid-cols-4 md:grid-cols-2">
              {session?.rounds.map((round) => {
                const roundMatchups = session.matchups.filter((matchup) => matchup.round_number === round.round_number);
                return (
                  <div key={round.round_number} className="rounded-2xl border border-stone-800 bg-black/35 p-4">
                    <p className="text-sm font-black uppercase tracking-[0.12em] text-fuchsia-100">{round.round_name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-400">{round.status}</p>
                    <div className="mt-4 space-y-3">
                      {roundMatchups.map((matchup) => (
                        <div key={matchup.id} className="rounded-xl border border-stone-800 bg-stone-950/60 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Matchup {matchup.matchup_index}</p>
                          <p className="mt-2 text-sm font-semibold text-stone-100">{formatEntry(matchup.higher_seed_entry)}</p>
                          <p className="mt-1 text-xs text-stone-500">vs</p>
                          <p className="mt-1 text-sm font-semibold text-stone-100">{formatEntry(matchup.lower_seed_entry)}</p>
                          {matchup.winner_entry ? <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">Advances: {formatEntry(matchup.winner_entry)}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {session?.show_scoreboard ? (
          <section className="rounded-3xl border border-stone-700 bg-stone-950/60 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-fuchsia-200">Leaderboard</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {topTeams.map((team, index) => (
                <div key={team.team_id} className="rounded-2xl border border-stone-800 bg-black/35 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-stone-500">#{index + 1}</p>
                  <p className="mt-2 text-2xl font-black text-stone-100">{team.team_name}</p>
                  <p className="mt-2 text-lg text-fuchsia-200">{team.total_points} pts</p>
                  {team.tie_break_points > 0 ? <p className="text-sm text-stone-400">Tie-break: {team.tie_break_points}</p> : null}
                </div>
              ))}
              {topTeams.length === 0 ? <p className="text-sm text-stone-400">No scores yet.</p> : null}
            </div>
          </section>
        ) : null}

        </>
        ) : null}

        {/* Welcome overlay */}
        {!showThanksOverlay && session?.host_overlay === "welcome" ? (
          <section className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_50%_0%,#1a0a2e,transparent_45%),linear-gradient(180deg,#020202,#0b0b0b)] p-8 text-center">
            <div className="max-w-4xl rounded-3xl border border-fuchsia-700/40 bg-black/70 p-10">
              {logoUrl ? <img src={logoUrl} alt="Venue logo" className="mx-auto mb-6 h-20 w-auto object-contain" /> : null}
              <p className="text-6xl font-black text-fuchsia-200">{session.welcome_heading_text ?? "Welcome to Bracket Battle"}</p>
              <p className="mt-4 text-2xl text-stone-200">{session.welcome_message_text ?? "Vote for your favourite track in each matchup to advance seeds through the bracket."}</p>
            </div>
          </section>
        ) : null}

        {/* Countdown overlay */}
        {!showThanksOverlay && session?.host_overlay === "countdown" ? (
          <section className="fixed inset-0 z-40 flex items-center justify-center bg-[linear-gradient(180deg,#020202,#0b0b0b)] p-8 text-center">
            <div className="max-w-xl rounded-3xl border border-fuchsia-700/40 bg-black/70 p-10">
              <p className="text-3xl font-bold uppercase text-stone-300">Starting in…</p>
              <p className="mt-4 text-9xl font-black text-fuchsia-300">{overlayRemaining > 0 ? overlayRemaining : ""}</p>
            </div>
          </section>
        ) : null}

        {/* Intermission overlay */}
        {!showThanksOverlay && session?.host_overlay === "intermission" ? (
          <section className="fixed inset-0 z-40 flex items-center justify-center bg-[linear-gradient(180deg,#020202,#0b0b0b)] p-8 text-center">
            <div className="max-w-4xl rounded-3xl border border-fuchsia-700/40 bg-black/70 p-10">
              {logoUrl ? <img src={logoUrl} alt="Venue logo" className="mx-auto mb-6 h-20 w-auto object-contain" /> : null}
              <p className="text-6xl font-black text-fuchsia-200">{session.intermission_heading_text ?? "Intermission"}</p>
              <p className="mt-4 text-2xl text-stone-200">{session.intermission_message_text ?? "Short break before the next round."}</p>
              {overlayRemaining > 0 ? <p className="mt-6 text-4xl font-bold text-fuchsia-300">{overlayRemaining}s</p> : null}
            </div>
          </section>
        ) : null}

        {/* Thanks overlay */}
        {showThanksOverlay ? (
          <section className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_50%_0%,#1f2937,transparent_45%),linear-gradient(180deg,#020202,#0b0b0b)] p-8 text-center">
            <div className="max-w-4xl rounded-3xl border border-fuchsia-700/40 bg-black/70 p-10">
              {logoUrl ? <img src={logoUrl} alt="Venue logo" className="mx-auto mb-6 h-20 w-auto object-contain" /> : null}
              <p className="text-6xl font-black text-fuchsia-200">{session?.thanks_heading_text ?? "Thanks for Playing"}</p>
              <p className="mt-4 text-2xl text-stone-200">{session?.thanks_subheading_text ?? "See you at the next round."}</p>
            </div>
          </section>
        ) : null}
      </div>

      <button
        type="button"
        onClick={toggleFullscreen}
        className="fixed bottom-3 right-3 z-50 rounded border border-stone-600/70 bg-black/55 px-3 py-1 text-xs text-stone-200"
        aria-label="Toggle fullscreen"
      >
        Fullscreen (F)
      </button>
    </div>
  );
}
