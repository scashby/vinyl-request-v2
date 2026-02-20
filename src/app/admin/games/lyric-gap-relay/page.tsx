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
  judge_mode: "official_key" | "crowd_check";
  calls_total: number;
  event_title: string | null;
};

type CallDraft = {
  artist: string;
  title: string;
  cue_lyric: string;
  answer_lyric: string;
  source_label?: string;
  accepted_answers?: string[];
};

const JUDGE_OPTIONS = [
  { value: "official_key", label: "Official Key (recommended)" },
  { value: "crowd_check", label: "Crowd Check" },
] as const;

const CLOSE_MATCH_OPTIONS = [
  { value: "host_discretion", label: "Host Discretion" },
  { value: "strict_key", label: "Strict Key" },
] as const;

function parseCalls(lines: string): CallDraft[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [metaPart, lyricPart, sourceLabel] = line.split("|").map((part) => part.trim());
      const [artist, title] = (metaPart ?? "").split(" - ").map((part) => part.trim());
      const [cueLyric, answerLyricRaw] = (lyricPart ?? "").split(">>>").map((part) => part.trim());
      const acceptedAnswers = (answerLyricRaw ?? "")
        .split(";;")
        .map((entry) => entry.trim())
        .filter(Boolean);

      return {
        artist: artist ?? "",
        title: title ?? "",
        cue_lyric: cueLyric ?? "",
        answer_lyric: acceptedAnswers[0] ?? "",
        source_label: sourceLabel || undefined,
        accepted_answers: acceptedAnswers,
      };
    })
    .filter((call) => call.artist && call.title && call.cue_lyric && call.answer_lyric);
}

export default function LyricGapRelaySetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [title, setTitle] = useState("Lyric Gap Relay Session");
  const [roundCount, setRoundCount] = useState(10);
  const [judgeMode, setJudgeMode] = useState<"official_key" | "crowd_check">("official_key");
  const [closeMatchPolicy, setCloseMatchPolicy] = useState<"host_discretion" | "strict_key">("host_discretion");

  const [showTitle, setShowTitle] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);
  const [showAnswerMode, setShowAnswerMode] = useState(true);

  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(10);

  const [teamNamesText, setTeamNamesText] = useState("Team A\nTeam B");
  const [callListText, setCallListText] = useState(
    "Queen - We Are The Champions | We are the champions, my friends >>> and we'll keep on fighting till the end | LP side A\nWhitney Houston - I Wanna Dance with Somebody | Oh, I wanna dance with somebody >>> I wanna feel the heat with somebody | 12in"
  );

  const [preflight, setPreflight] = useState({
    answerKeyPrinted: false,
    gapsPreCueByRound: false,
    tieBreakGapReady: false,
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

  const calls = useMemo(() => parseCalls(callListText), [callListText]);
  const preflightComplete = useMemo(() => Object.values(preflight).every(Boolean), [preflight]);
  const targetGapSeconds = useMemo(
    () => removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds,
    [cueSeconds, findRecordSeconds, hostBufferSeconds, removeResleeveSeconds]
  );

  const load = useCallback(async () => {
    const [eventRes, sessionRes] = await Promise.all([
      fetch("/api/games/lyric-gap-relay/events"),
      fetch(`/api/games/lyric-gap-relay/sessions${eventId ? `?eventId=${eventId}` : ""}`),
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
      const res = await fetch("/api/games/lyric-gap-relay/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          title,
          round_count: roundCount,
          judge_mode: judgeMode,
          close_match_policy: closeMatchPolicy,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_title: showTitle,
          show_round: showRound,
          show_scoreboard: showScoreboard,
          show_answer_mode: showAnswerMode,
          team_names: teamNames,
          calls,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      router.push(`/admin/games/lyric-gap-relay/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const roundCountWarning = calls.length < roundCount;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#3a1b2f,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-fuchsia-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-fuchsia-300">Brewery Floor Mode</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-4xl font-black uppercase text-fuchsia-100">Lyric Gap Relay Setup</h1>
            <div className="flex gap-2">
              <Link href="/admin/games/lyric-gap-relay/history" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">History</Link>
              <Link href="/admin/games/lyric-gap-relay/jumbotron" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Jumbotron Scope</Link>
            </div>
          </div>
          <p className="mt-2 text-sm text-stone-300">Play to a lyric, stop, and teams fill the next line. Scoring is 2 exact, 1 close-enough, 0 miss.</p>
        </header>

        <section className="rounded-3xl border border-fuchsia-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-fuchsia-100">Session Config</h2>
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

            <label className="text-sm">Rounds (10-15)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={10} max={15} value={roundCount} onChange={(e) => setRoundCount(Math.max(10, Math.min(15, Number(e.target.value) || 10)))} />
            </label>

            <label className="text-sm">Judge Mode
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={judgeMode} onChange={(e) => setJudgeMode((e.target.value as "official_key" | "crowd_check") ?? "official_key")}>
                {JUDGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="text-sm">Close-Match Policy
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={closeMatchPolicy} onChange={(e) => setCloseMatchPolicy((e.target.value as "host_discretion" | "strict_key") ?? "host_discretion")}>
                {CLOSE_MATCH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> Jumbotron title</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showRound} onChange={(e) => setShowRound(e.target.checked)} /> Jumbotron round</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showScoreboard} onChange={(e) => setShowScoreboard(e.target.checked)} /> Jumbotron scoreboard</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showAnswerMode} onChange={(e) => setShowAnswerMode(e.target.checked)} /> Show scoring mode</label>
          </div>
        </section>

        <section className="rounded-3xl border border-fuchsia-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-fuchsia-100">Pacing Budget</h2>
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
          <p className="mt-3 text-sm text-stone-300">Derived target gap: <span className="font-semibold text-fuchsia-300">{targetGapSeconds}s</span></p>
        </section>

        <section className="rounded-3xl border border-fuchsia-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-fuchsia-100">Teams + Lyric Gap Deck</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">Teams (one per line)
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
              <p className="mt-1 text-xs text-stone-400">Detected teams: {teamNames.length}</p>
            </label>

            <label className="text-sm">Lyric gaps (Artist - Title | cue lyric {'>>>'} accepted answers separated by ;; | source)
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={callListText} onChange={(e) => setCallListText(e.target.value)} />
              <p className={`mt-1 text-xs ${roundCountWarning ? "text-amber-300" : "text-stone-400"}`}>
                Valid lyric gaps: {calls.length}. Minimum required for current rounds: {roundCount}.
              </p>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-stone-700 bg-stone-950/80 p-3 text-sm">
            <p className="font-semibold uppercase tracking-wide text-fuchsia-200">Preflight Checklist</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.answerKeyPrinted} onChange={(e) => setPreflight((p) => ({ ...p, answerKeyPrinted: e.target.checked }))} /> Official answer key printed and marked</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.gapsPreCueByRound} onChange={(e) => setPreflight((p) => ({ ...p, gapsPreCueByRound: e.target.checked }))} /> Gap moments pre-cued by round order</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.tieBreakGapReady} onChange={(e) => setPreflight((p) => ({ ...p, tieBreakGapReady: e.target.checked }))} /> Tie-break lyric gap staged</label>
            </div>
          </div>

          <button disabled={!preflightComplete || teamNames.length < 2 || roundCountWarning || creating} onClick={createSession} className="mt-5 rounded bg-fuchsia-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {creating ? "Creating..." : "Create Session"}
          </button>
        </section>

        <section className="rounded-3xl border border-fuchsia-900/40 bg-black/45 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black uppercase text-fuchsia-100">Existing Sessions</h2>
            <button onClick={load} className="rounded border border-stone-700 px-3 py-1 text-sm">Refresh</button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-stone-400">No sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-stone-700 bg-stone-950/70 p-3">
                  <div className="text-sm">{session.session_code} · {session.title} · Round {session.current_round} of {session.round_count} · Calls {session.calls_total}</div>
                  <div className="text-xs text-stone-400">Event: {session.event_title ?? "(none)"} · Judge: {session.judge_mode} · Status: {session.status}</div>
                  <div className="mt-2 flex gap-2">
                    <Link href={`/admin/games/lyric-gap-relay/host?sessionId=${session.id}`} className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Host</Link>
                    <Link href={`/admin/games/lyric-gap-relay/assistant?sessionId=${session.id}`} className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Assistant</Link>
                    <Link href={`/admin/games/lyric-gap-relay/jumbotron?sessionId=${session.id}`} className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Jumbotron</Link>
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
