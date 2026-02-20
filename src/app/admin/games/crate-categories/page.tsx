"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  round_count: number;
  rounds_total: number;
  rounds_scored: number;
  event_title: string | null;
};

type RoundDraft = {
  category_label: string;
  prompt_type: "identify-thread" | "odd-one-out" | "belongs-or-bust" | "decade-lock" | "mood-match";
  tracks_in_round?: number;
  points_correct?: number;
  points_bonus?: number;
};

type CallDraft = {
  round_number: number;
  track_in_round: number;
  artist: string;
  title: string;
  release_year?: number;
  source_label?: string;
  crate_tag?: string;
};

function parseRounds(lines: string): RoundDraft[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map<RoundDraft | null>((line, index) => {
      const parts = line.split("|").map((part) => part.trim());
      const [categoryLabel, promptType, tracksInRound, pointsCorrect, pointsBonus] = parts;
      if (!categoryLabel) return null;

      const normalizedPrompt = (
        ["identify-thread", "odd-one-out", "belongs-or-bust", "decade-lock", "mood-match"].includes(promptType)
          ? promptType
          : "identify-thread"
      ) as RoundDraft["prompt_type"];

      return {
        category_label: categoryLabel || `Round ${index + 1}`,
        prompt_type: normalizedPrompt,
        ...(Number.isFinite(Number(tracksInRound)) ? { tracks_in_round: Number(tracksInRound) } : {}),
        ...(Number.isFinite(Number(pointsCorrect)) ? { points_correct: Number(pointsCorrect) } : {}),
        ...(Number.isFinite(Number(pointsBonus)) ? { points_bonus: Number(pointsBonus) } : {}),
      };
    })
    .filter((round): round is RoundDraft => round !== null);
}

function parseCalls(lines: string): CallDraft[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map<CallDraft | null>((line) => {
      const parts = line.split("|").map((part) => part.trim());
      const [roundNumber, trackInRound, metaPart, yearPart, sourceLabel, crateTag] = parts;
      const [artist, title] = (metaPart ?? "").split(" - ").map((part) => part.trim());
      if (!artist || !title) return null;

      const round = Number(roundNumber);
      const track = Number(trackInRound);
      if (!Number.isFinite(round) || !Number.isFinite(track)) return null;

      const year = Number(yearPart);
      return {
        round_number: round,
        track_in_round: track,
        artist,
        title,
        ...(Number.isFinite(year) ? { release_year: year } : {}),
        ...(sourceLabel ? { source_label: sourceLabel } : {}),
        ...(crateTag ? { crate_tag: crateTag } : {}),
      };
    })
    .filter((call): call is CallDraft => call !== null);
}

export default function CrateCategoriesSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [title, setTitle] = useState("Crate Categories Session");
  const [roundCount, setRoundCount] = useState(4);
  const [defaultTracksPerRound, setDefaultTracksPerRound] = useState(4);

  const [showTitle, setShowTitle] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showPrompt, setShowPrompt] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);

  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(12);

  const [teamNamesText, setTeamNamesText] = useState("Table 1\nTable 2");
  const [roundListText, setRoundListText] = useState(
    "Women in Soul | identify-thread | 4 | 2 | 1\n90s One-Hit Wonders | odd-one-out | 3 | 2 | 1"
  );
  const [callListText, setCallListText] = useState(
    "1 | 1 | Aretha Franklin - Think | 1968 | 45 A | soul\n1 | 2 | Gladys Knight & The Pips - Midnight Train to Georgia | 1973 | LP B | soul\n1 | 3 | Chaka Khan - I'm Every Woman | 1978 | 12in | soul\n1 | 4 | Etta James - At Last | 1960 | LP A | soul\n2 | 1 | Chumbawamba - Tubthumping | 1997 | LP C | alt\n2 | 2 | New Radicals - You Get What You Give | 1998 | LP D | pop\n2 | 3 | The Verve - Bitter Sweet Symphony | 1997 | LP E | brit"
  );

  const [preflight, setPreflight] = useState({
    categoryCardsPrinted: false,
    crateOrderMarked: false,
    resetBufferValidated: false,
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

  const rounds = useMemo(() => parseRounds(roundListText), [roundListText]);
  const calls = useMemo(() => parseCalls(callListText), [callListText]);
  const preflightComplete = useMemo(() => Object.values(preflight).every(Boolean), [preflight]);
  const targetGapSeconds = useMemo(
    () => removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds,
    [cueSeconds, findRecordSeconds, hostBufferSeconds, removeResleeveSeconds]
  );

  const load = useCallback(async () => {
    const [eventRes, sessionRes] = await Promise.all([
      fetch("/api/games/crate-categories/events"),
      fetch(`/api/games/crate-categories/sessions${eventId ? `?eventId=${eventId}` : ""}`),
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
      const res = await fetch("/api/games/crate-categories/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          title,
          round_count: roundCount,
          default_tracks_per_round: defaultTracksPerRound,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_title: showTitle,
          show_round: showRound,
          show_prompt: showPrompt,
          show_scoreboard: showScoreboard,
          team_names: teamNames,
          rounds,
          calls,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      router.push(`/admin/games/crate-categories/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const roundCountWarning = rounds.length < roundCount;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#3a1f14,transparent_42%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Brewery Floor Mode</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-4xl font-black uppercase text-amber-100">Crate Categories Setup</h1>
            <div className="flex gap-2">
              <Link href="/admin/games/crate-categories/history" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">History</Link>
              <Link href="/admin/games/crate-categories/jumbotron" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Jumbotron Scope</Link>
            </div>
          </div>
          <p className="mt-2 text-sm text-stone-300">Category-led rounds from your crates and tags, with pacing controls for solo-host vinyl flow.</p>
        </header>

        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">Session Config</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">Event (optional)
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={eventId ?? ""} onChange={(e) => setEventId(Number(e.target.value) || null)}>
                <option value="">No linked event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{event.date} - {event.title}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">Session Title
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm">Rounds (3-8)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={3} max={8} value={roundCount} onChange={(e) => setRoundCount(Math.max(3, Math.min(8, Number(e.target.value) || 3)))} />
            </label>

            <label className="text-sm">Default tracks/round (3-5)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={3} max={5} value={defaultTracksPerRound} onChange={(e) => setDefaultTracksPerRound(Math.max(3, Math.min(5, Number(e.target.value) || 3)))} />
            </label>
          </div>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> Jumbotron title</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showRound} onChange={(e) => setShowRound(e.target.checked)} /> Jumbotron round</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showPrompt} onChange={(e) => setShowPrompt(e.target.checked)} /> Jumbotron prompt</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showScoreboard} onChange={(e) => setShowScoreboard(e.target.checked)} /> Jumbotron scoreboard</label>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">Pacing Budget</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">Remove + Resleeve (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={removeResleeveSeconds} onChange={(e) => setRemoveResleeveSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-sm">Find Record (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={findRecordSeconds} onChange={(e) => setFindRecordSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-sm">Cue (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={cueSeconds} onChange={(e) => setCueSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-sm">Host Buffer (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={hostBufferSeconds} onChange={(e) => setHostBufferSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
          </div>
          <p className="mt-3 text-sm text-stone-300">Target reset gap per spin: <span className="font-semibold text-amber-200">{targetGapSeconds}s</span></p>
        </section>

        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">Teams + Round Plan</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="text-sm">Team names (one per line)
              <textarea className="mt-1 h-40 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 font-mono text-xs" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
            </label>
            <label className="text-sm">Rounds (`category | prompt | tracks | points_correct | points_bonus`)
              <textarea className="mt-1 h-40 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 font-mono text-xs" value={roundListText} onChange={(e) => setRoundListText(e.target.value)} />
            </label>
          </div>

          <label className="mt-4 block text-sm">Calls (`round | track_slot | artist - title | year | source_label | crate_tag`)
            <textarea className="mt-1 h-48 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 font-mono text-xs" value={callListText} onChange={(e) => setCallListText(e.target.value)} />
          </label>

          <div className="mt-4 rounded border border-stone-700 bg-stone-950/60 p-3 text-sm text-stone-300">
            Parsed: {teamNames.length} teams · {rounds.length} rounds · {calls.length} calls
          </div>
          {roundCountWarning ? <p className="mt-2 text-sm text-amber-300">Round list has fewer rows than selected round count. Missing rounds auto-fill on create.</p> : null}
        </section>

        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">Preflight</h2>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.categoryCardsPrinted} onChange={(e) => setPreflight((current) => ({ ...current, categoryCardsPrinted: e.target.checked }))} /> Category cards/prompt sheet ready</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.crateOrderMarked} onChange={(e) => setPreflight((current) => ({ ...current, crateOrderMarked: e.target.checked }))} /> Crate pull order marked</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.resetBufferValidated} onChange={(e) => setPreflight((current) => ({ ...current, resetBufferValidated: e.target.checked }))} /> Reset buffer validated live</label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50" disabled={creating || !preflightComplete} onClick={createSession}>
              {creating ? "Creating..." : "Create Session"}
            </button>
            <Link href="/admin/games/crate-categories/host" className="rounded border border-stone-600 px-3 py-2 text-sm">Open Host Scope</Link>
            <Link href="/admin/games/crate-categories/assistant" className="rounded border border-stone-600 px-3 py-2 text-sm">Open Assistant Scope</Link>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">Recent Sessions</h2>
          {sessions.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">No sessions yet.</p>
          ) : (
            <div className="mt-4 space-y-2 text-sm">
              {sessions.map((session) => (
                <div key={session.id} className="rounded border border-stone-700 bg-stone-950/70 p-3">
                  <p>{session.session_code} · {session.title}</p>
                  <p className="text-stone-400">Event: {session.event_title ?? "(none)"} · Round: {session.current_round}/{session.round_count} · Scored rounds: {session.rounds_scored}/{session.rounds_total} · Status: {session.status}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={`/admin/games/crate-categories/host?sessionId=${session.id}`} className="rounded border border-stone-600 px-2 py-1 text-xs">Host</Link>
                    <Link href={`/admin/games/crate-categories/assistant?sessionId=${session.id}`} className="rounded border border-stone-600 px-2 py-1 text-xs">Assistant</Link>
                    <Link href={`/admin/games/crate-categories/jumbotron?sessionId=${session.id}`} className="rounded border border-stone-600 px-2 py-1 text-xs">Jumbotron</Link>
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
