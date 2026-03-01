"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GameEventSelect from "src/components/GameEventSelect";
import GameSetupInfoButton from "src/components/GameSetupInfoButton";
import InlineFieldHelp from "src/components/InlineFieldHelp";

type EventRow = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
};

type SessionRow = {
  id: number;
  session_code: string;
  title: string;
  status: string;
  current_round: number;
  bracket_size: number;
  vote_method: "hands" | "slips";
  matchups_total: number;
  event_title: string | null;
};

type EntryDraft = {
  seed: number;
  entry_label: string;
  artist?: string;
  title?: string;
  source_label?: string;
};

const VOTE_OPTIONS = [
  { value: "hands", label: "Hands" },
  { value: "slips", label: "Paper Slips" },
] as const;

const BRACKET_OPTIONS = [4, 8, 16] as const;

function parseEntries(lines: string): EntryDraft[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [seedPart, rest] = line.split(".").map((part) => part.trim());
      const seed = Number(seedPart);
      const [entryLabel, sourceLabel] = (rest ?? line).split("|").map((part) => part.trim());
      const [artist, title] = (entryLabel ?? "").split(" - ").map((part) => part.trim());
      return {
        seed,
        entry_label: entryLabel ?? "",
        artist: artist || undefined,
        title: title || undefined,
        source_label: sourceLabel || undefined,
      };
    })
    .filter((entry) => Number.isFinite(entry.seed) && entry.seed > 0 && entry.entry_label);
}

export default function BracketBattleSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [title, setTitle] = useState("Bracket Battle Session");
  const [bracketSize, setBracketSize] = useState<(typeof BRACKET_OPTIONS)[number]>(8);
  const [voteMethod, setVoteMethod] = useState<"hands" | "slips">("hands");

  const [showTitle, setShowTitle] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showBracket, setShowBracket] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);

  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(10);

  const [teamNamesText, setTeamNamesText] = useState("Table 1\nTable 2");
  const [entryListText, setEntryListText] = useState(
    "1. Artist A - Song A | 12in\n2. Artist B - Song B | 7in\n3. Artist C - Song C | LP\n4. Artist D - Song D | LP\n5. Artist E - Song E | 7in\n6. Artist F - Song F | LP\n7. Artist G - Song G | 7in\n8. Artist H - Song H | LP"
  );

  const [preflight, setPreflight] = useState({
    bracketPrinted: false,
    slipsOrPaddlesReady: false,
    tieBreakerReady: false,
  });

  const [creating, setCreating] = useState(false);

  const teamNames = useMemo(
    () =>
      Array.from(
        new Set(
          teamNamesText
            .split("\n")
            .map((name) => name.trim())
            .filter(Boolean)
        )
      ),
    [teamNamesText]
  );

  const entries = useMemo(() => parseEntries(entryListText), [entryListText]);
  const preflightComplete = useMemo(() => Object.values(preflight).every(Boolean), [preflight]);
  const targetGapSeconds = useMemo(
    () => removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds,
    [cueSeconds, findRecordSeconds, hostBufferSeconds, removeResleeveSeconds]
  );

  const load = useCallback(async () => {
    const [eventRes, sessionRes] = await Promise.all([
      fetch("/api/games/bracket-battle/events"),
      fetch(`/api/games/bracket-battle/sessions${eventId ? `?eventId=${eventId}` : ""}`),
    ]);

    if (eventRes.ok) {
      const payload = await eventRes.json();
      setEvents(payload.data ?? []);
    }

    if (sessionRes.ok) {
      const payload = await sessionRes.json();
      setSessions(payload.data ?? []);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const createSession = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/games/bracket-battle/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          title,
          bracket_size: bracketSize,
          vote_method: voteMethod,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_title: showTitle,
          show_round: showRound,
          show_bracket: showBracket,
          show_scoreboard: showScoreboard,
          team_names: teamNames,
          entries,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      router.push(`/admin/games/bracket-battle/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const entryWarning = entries.length < bracketSize;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#1f2f50,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-blue-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-blue-300">Brewery Floor Mode</p>
          <h1 className="mt-1 text-4xl font-black uppercase text-blue-100">Bracket Battle Setup</h1>
          <p className="mt-2 text-sm text-stone-300">Seeded tournament flow with paper/hands voting and solo-DJ pacing controls.</p>
          <div className="mt-3 flex justify-end"><GameSetupInfoButton gameSlug="bracket-battle" /></div>
        </header>

        <section className="rounded-3xl border border-blue-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-blue-100">Session Config</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GameEventSelect events={events} eventId={eventId} setEventId={setEventId} />

            <label className="text-sm">
              Session Title <InlineFieldHelp label="Session Title" />
              <input
                className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <label className="text-sm">
              Bracket Size <InlineFieldHelp label="Bracket Size" />
              <select
                className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                value={bracketSize}
                onChange={(e) => setBracketSize((Number(e.target.value) as (typeof BRACKET_OPTIONS)[number]) ?? 8)}
              >
                {BRACKET_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value} entries
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Vote Method <InlineFieldHelp label="Vote Method" />
              <select
                className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                value={voteMethod}
                onChange={(e) => setVoteMethod((e.target.value as "hands" | "slips") ?? "hands")}
              >
                {VOTE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> <span>Jumbotron title <InlineFieldHelp label="Jumbotron title" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showRound} onChange={(e) => setShowRound(e.target.checked)} /> <span>Jumbotron round <InlineFieldHelp label="Jumbotron round" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showBracket} onChange={(e) => setShowBracket(e.target.checked)} /> <span>Jumbotron bracket <InlineFieldHelp label="Jumbotron bracket" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showScoreboard} onChange={(e) => setShowScoreboard(e.target.checked)} /> <span>Jumbotron scoreboard <InlineFieldHelp label="Jumbotron scoreboard" /></span></label>
          </div>
        </section>

        <section className="rounded-3xl border border-blue-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-blue-100">Pacing Budget</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">Remove + Resleeve (sec) <InlineFieldHelp label="Remove + Resleeve (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={removeResleeveSeconds} onChange={(e) => setRemoveResleeveSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-sm">Find Record (sec) <InlineFieldHelp label="Find Record (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={findRecordSeconds} onChange={(e) => setFindRecordSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-sm">Cue (sec) <InlineFieldHelp label="Cue (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={cueSeconds} onChange={(e) => setCueSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-sm">Host Buffer (sec) <InlineFieldHelp label="Host Buffer (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={hostBufferSeconds} onChange={(e) => setHostBufferSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
          </div>
          <p className="mt-3 text-sm text-stone-300">Derived target gap: <span className="font-semibold text-blue-300">{targetGapSeconds}s</span></p>
        </section>

        <section className="rounded-3xl border border-blue-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-blue-100">Teams + Bracket Deck</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">Teams (one per line) <InlineFieldHelp label="Teams (one per line)" />
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
              <p className="mt-1 text-xs text-stone-400">Detected teams: {teamNames.length}</p>
            </label>

            <label className="text-sm">Bracket entries <InlineFieldHelp label="Bracket entries" /> (one per line: <code>seed. Artist - Title | optional source</code>)
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={entryListText} onChange={(e) => setEntryListText(e.target.value)} />
              <p className={`mt-1 text-xs ${entryWarning ? "text-amber-300" : "text-stone-400"}`}>
                Valid entries: {entries.length}. Minimum required for current bracket size: {bracketSize}.
              </p>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-stone-700 bg-stone-950/80 p-3 text-sm">
            <p className="font-semibold uppercase tracking-wide text-blue-200">Preflight Checklist</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.bracketPrinted} onChange={(e) => setPreflight((p) => ({ ...p, bracketPrinted: e.target.checked }))} /> <span>Printed bracket sheets staged <InlineFieldHelp label="Printed bracket sheets staged" /></span></label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.slipsOrPaddlesReady} onChange={(e) => setPreflight((p) => ({ ...p, slipsOrPaddlesReady: e.target.checked }))} /> <span>Vote slips/paddles at tables <InlineFieldHelp label="Vote slips/paddles at tables" /></span></label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.tieBreakerReady} onChange={(e) => setPreflight((p) => ({ ...p, tieBreakerReady: e.target.checked }))} /> <span>Tie-breaker matchup prepped <InlineFieldHelp label="Tie-breaker matchup prepped" /></span></label>
            </div>
          </div>

          <button disabled={!preflightComplete || teamNames.length < 2 || entryWarning || creating} onClick={createSession} className="mt-5 rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {creating ? "Creating..." : "Create Session"}
          </button>
        </section>

        <section className="rounded-3xl border border-blue-900/40 bg-black/45 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black uppercase text-blue-100">Existing Sessions</h2>
            <button onClick={load} className="rounded border border-stone-700 px-3 py-1 text-sm">Refresh</button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-stone-400">No sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-stone-700 bg-stone-950/70 p-3">
                  <div className="text-sm">{session.session_code} · {session.title} · Round {session.current_round} · Matchups {session.matchups_total}</div>
                  <div className="text-xs text-stone-400">Event: {session.event_title ?? "(none)"} · Bracket: {session.bracket_size} · Vote: {session.vote_method} · Status: {session.status}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/bracket-battle/host?sessionId=${session.id}`)}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/bracket-battle/assistant?sessionId=${session.id}`)}>Assistant</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/bracket-battle/jumbotron?sessionId=${session.id}`)}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push("/admin/games/bracket-battle/history")}>History</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
