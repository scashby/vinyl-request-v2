"use client";

import { useEffect, useMemo, useState } from "react";
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
  lock_in_rule: string;
  calls_total: number;
  event_title: string | null;
};

type SnippetDraft = {
  artist: string;
  title: string;
  source_label?: string;
  snippet_start_seconds?: number;
  snippet_duration_seconds?: number;
  host_notes?: string;
};

const LOCK_IN_OPTIONS = [
  { value: "time_window", label: "Time Window (default)" },
  { value: "first_sheet_wins", label: "First Slip Wins" },
  { value: "hand_raise", label: "Hand Raise" },
] as const;

function parseSnippets(lines: string): SnippetDraft[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [artistTitle, sourceLabel] = line.split("|").map((part) => part.trim());
      const [artist, title] = artistTitle.split(" - ").map((part) => part.trim());
      return {
        artist: artist ?? "",
        title: title ?? "",
        source_label: sourceLabel || undefined,
      };
    })
    .filter((snippet) => snippet.artist && snippet.title);
}

export default function NameThatTuneSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [title, setTitle] = useState("Name That Tune Session");
  const [roundCount, setRoundCount] = useState(10);
  const [lockInRule, setLockInRule] = useState<"time_window" | "first_sheet_wins" | "hand_raise">("time_window");
  const [lockInWindowSeconds, setLockInWindowSeconds] = useState(20);

  const [showTitle, setShowTitle] = useState(true);
  const [showRounds, setShowRounds] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);

  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(8);

  const [teamNamesText, setTeamNamesText] = useState("Team A\nTeam B");
  const [snippetListText, setSnippetListText] = useState(
    "Madonna - Like a Prayer | LP side A\nOutkast - Hey Ya! | 45\nThe Killers - Mr. Brightside | backup"
  );

  const [preflight, setPreflight] = useState({
    snippetsPreCue: false,
    spareNeedleReady: false,
    tieBreakSnippetReady: false,
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
  const snippets = useMemo(() => parseSnippets(snippetListText), [snippetListText]);
  const preflightComplete = useMemo(() => Object.values(preflight).every(Boolean), [preflight]);
  const targetGapSeconds = useMemo(
    () => removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds,
    [cueSeconds, findRecordSeconds, hostBufferSeconds, removeResleeveSeconds]
  );

  const load = async () => {
    const [eventRes, sessionRes] = await Promise.all([
      fetch("/api/games/name-that-tune/events"),
      fetch(`/api/games/name-that-tune/sessions${eventId ? `?eventId=${eventId}` : ""}`),
    ]);

    if (eventRes.ok) {
      const payload = await eventRes.json();
      setEvents(payload.data ?? []);
    }

    if (sessionRes.ok) {
      const payload = await sessionRes.json();
      setSessions(payload.data ?? []);
    }
  };

  useEffect(() => {
    load();
  }, [eventId]);

  const createSession = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/games/name-that-tune/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          title,
          round_count: roundCount,
          lock_in_rule: lockInRule,
          lock_in_window_seconds: lockInWindowSeconds,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_title: showTitle,
          show_rounds: showRounds,
          show_scoreboard: showScoreboard,
          team_names: teamNames,
          snippets,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      router.push(`/admin/games/name-that-tune/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const roundCountWarning = snippets.length < roundCount;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#3f1722,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-rose-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-rose-300">Brewery Floor Mode</p>
          <h1 className="mt-1 text-4xl font-black uppercase text-rose-100">Name That Tune Setup</h1>
          <p className="mt-2 text-sm text-stone-300">Single-DJ flow with lock-in answers and turntable pacing budget.</p>
        </header>

        <section className="rounded-3xl border border-rose-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-rose-100">Session Config</h2>
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

            <label className="text-sm">Rounds (8-15)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={8} max={15} value={roundCount} onChange={(e) => setRoundCount(Math.max(8, Math.min(15, Number(e.target.value) || 8)))} />
            </label>

            <label className="text-sm">Lock-In Rule
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={lockInRule} onChange={(e) => setLockInRule((e.target.value as "time_window" | "first_sheet_wins" | "hand_raise") ?? "time_window")}>
                {LOCK_IN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="text-sm">Lock-In Window (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={5} value={lockInWindowSeconds} onChange={(e) => setLockInWindowSeconds(Math.max(5, Number(e.target.value) || 5))} />
            </label>
          </div>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> Jumbotron title</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showRounds} onChange={(e) => setShowRounds(e.target.checked)} /> Jumbotron round status</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showScoreboard} onChange={(e) => setShowScoreboard(e.target.checked)} /> Jumbotron scoreboard</label>
          </div>
        </section>

        <section className="rounded-3xl border border-rose-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-rose-100">Pacing Budget</h2>
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
          <p className="mt-3 text-sm text-stone-300">Derived target gap: <span className="font-semibold text-rose-300">{targetGapSeconds}s</span></p>
        </section>

        <section className="rounded-3xl border border-rose-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-rose-100">Teams + Snippet Deck</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">Teams (one per line)
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
              <p className="mt-1 text-xs text-stone-400">Detected teams: {teamNames.length}</p>
            </label>

            <label className="text-sm">Snippets (one per line: Artist - Title | Optional source)
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={snippetListText} onChange={(e) => setSnippetListText(e.target.value)} />
              <p className={`mt-1 text-xs ${roundCountWarning ? "text-amber-300" : "text-stone-400"}`}>
                Valid snippets: {snippets.length}. Minimum required for current rounds: {roundCount}.
              </p>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-stone-700 bg-stone-950/80 p-3 text-sm">
            <p className="font-semibold uppercase tracking-wide text-rose-200">Preflight Checklist</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.snippetsPreCue} onChange={(e) => setPreflight((p) => ({ ...p, snippetsPreCue: e.target.checked }))} /> Snippets pre-cued by round</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.spareNeedleReady} onChange={(e) => setPreflight((p) => ({ ...p, spareNeedleReady: e.target.checked }))} /> Needle/backup cart ready</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.tieBreakSnippetReady} onChange={(e) => setPreflight((p) => ({ ...p, tieBreakSnippetReady: e.target.checked }))} /> Tie-break snippet staged</label>
            </div>
          </div>

          <button disabled={!preflightComplete || teamNames.length < 2 || roundCountWarning || creating} onClick={createSession} className="mt-5 rounded bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {creating ? "Creating..." : "Create Session"}
          </button>
        </section>

        <section className="rounded-3xl border border-rose-900/40 bg-black/45 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black uppercase text-rose-100">Existing Sessions</h2>
            <button onClick={load} className="rounded border border-stone-700 px-3 py-1 text-sm">Refresh</button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-stone-400">No sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-stone-700 bg-stone-950/70 p-3">
                  <div className="text-sm">{session.session_code} · {session.title} · Round {session.current_round} of {session.round_count} · Calls {session.calls_total}</div>
                  <div className="text-xs text-stone-400">Event: {session.event_title ?? "(none)"} · Lock-In: {session.lock_in_rule} · Status: {session.status}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/name-that-tune/host?sessionId=${session.id}`)}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/name-that-tune/assistant?sessionId=${session.id}`)}>Assistant</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/name-that-tune/jumbotron?sessionId=${session.id}`)}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push("/admin/games/name-that-tune/history")}>History</button>
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
