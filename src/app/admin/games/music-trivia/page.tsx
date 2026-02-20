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
  questions_per_round: number;
  event_title: string | null;
};

const CATEGORY_OPTIONS = [
  "General Music",
  "Classic Rock",
  "Soul & Funk",
  "Hip-Hop",
  "80s",
  "90s",
  "2000s",
  "One-Hit Wonders",
  "Soundtracks",
  "Local Legends",
] as const;

export default function MusicTriviaSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [title, setTitle] = useState("Music Trivia Session");
  const [roundCount, setRoundCount] = useState(3);
  const [questionsPerRound, setQuestionsPerRound] = useState(5);
  const [scoreMode, setScoreMode] = useState<"standard" | "difficulty_bonus_static">("difficulty_bonus_static");

  const [showTitle, setShowTitle] = useState(true);
  const [showRounds, setShowRounds] = useState(true);
  const [showQuestionCounter, setShowQuestionCounter] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(true);

  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(8);

  const [categories, setCategories] = useState<string[]>(["General Music", "Classic Rock", "Soul & Funk"]);
  const [difficultyEasy, setDifficultyEasy] = useState(2);
  const [difficultyMedium, setDifficultyMedium] = useState(2);
  const [difficultyHard, setDifficultyHard] = useState(1);

  const [teamNamesText, setTeamNamesText] = useState("Team A\nTeam B");
  const [maxTeams, setMaxTeams] = useState(0);
  const [slipsBatchSize, setSlipsBatchSize] = useState(0);

  const [preflight, setPreflight] = useState({
    backupQuestions: false,
    answerSlips: false,
    pencilsMarkers: false,
    tieBreaker: false,
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

  const targetGapSeconds = useMemo(
    () => removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds,
    [cueSeconds, findRecordSeconds, hostBufferSeconds, removeResleeveSeconds]
  );

  const callStackPreview = Math.max(1, roundCount) * Math.max(1, questionsPerRound);
  const preflightComplete = Object.values(preflight).every(Boolean);

  const load = async () => {
    const [eventRes, sessionRes] = await Promise.all([
      fetch("/api/games/trivia/events"),
      fetch(`/api/games/trivia/sessions${eventId ? `?eventId=${eventId}` : ""}`),
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

  const toggleCategory = (category: string) => {
    setCategories((current) => {
      if (current.includes(category)) return current.filter((value) => value !== category);
      return [...current, category];
    });
  };

  const createSession = async () => {
    if (teamNames.length < 2) return;
    setCreating(true);
    try {
      const res = await fetch("/api/games/trivia/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          title,
          round_count: roundCount,
          questions_per_round: questionsPerRound,
          score_mode: scoreMode,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_title: showTitle,
          show_rounds: showRounds,
          show_question_counter: showQuestionCounter,
          show_leaderboard: showLeaderboard,
          categories,
          difficulty_targets: {
            easy: difficultyEasy,
            medium: difficultyMedium,
            hard: difficultyHard,
          },
          max_teams: maxTeams > 0 ? maxTeams : null,
          slips_batch_size: slipsBatchSize > 0 ? slipsBatchSize : null,
          team_names: teamNames,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      router.push(`/admin/games/music-trivia/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#0f2d3a,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-cyan-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Brewery Floor Mode</p>
          <h1 className="mt-1 text-4xl font-black uppercase text-cyan-100">Music Trivia Setup</h1>
          <p className="mt-2 text-sm text-stone-300">Paper-first scoring, solo-host pacing, optional jumbotron.</p>
        </header>

        <section className="rounded-3xl border border-cyan-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-cyan-100">Session Config</h2>
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

            <label className="text-sm">Score Mode
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={scoreMode} onChange={(e) => setScoreMode((e.target.value as "standard" | "difficulty_bonus_static") ?? "difficulty_bonus_static")}>
                <option value="difficulty_bonus_static">Difficulty Bonus (Static)</option>
                <option value="standard">Standard</option>
              </select>
            </label>

            <label className="text-sm">Rounds
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={1} value={roundCount} onChange={(e) => setRoundCount(Math.max(1, Number(e.target.value) || 1))} />
            </label>

            <label className="text-sm">Questions / Round
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={1} value={questionsPerRound} onChange={(e) => setQuestionsPerRound(Math.max(1, Number(e.target.value) || 1))} />
            </label>
          </div>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> Jumbotron title</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showRounds} onChange={(e) => setShowRounds(e.target.checked)} /> Jumbotron round status</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showQuestionCounter} onChange={(e) => setShowQuestionCounter(e.target.checked)} /> Jumbotron question counter</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showLeaderboard} onChange={(e) => setShowLeaderboard(e.target.checked)} /> Jumbotron leaderboard</label>
          </div>
        </section>

        <section className="rounded-3xl border border-cyan-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-cyan-100">Pacing Budget</h2>
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
          <p className="mt-3 text-sm text-stone-300">Derived target gap: <span className="font-semibold text-cyan-300">{targetGapSeconds}s</span></p>
        </section>

        <section className="rounded-3xl border border-cyan-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-cyan-100">Question Deck</h2>
          <p className="mt-1 text-xs text-stone-400">Generate call stack preview: {callStackPreview} questions.</p>

          <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {CATEGORY_OPTIONS.map((category) => (
              <label key={category} className="inline-flex items-center gap-2 rounded border border-stone-700 bg-stone-950/80 px-3 py-2 text-sm">
                <input type="checkbox" checked={categories.includes(category)} onChange={() => toggleCategory(category)} />
                {category}
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm">Easy target
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={difficultyEasy} onChange={(e) => setDifficultyEasy(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-sm">Medium target
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={difficultyMedium} onChange={(e) => setDifficultyMedium(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-sm">Hard target
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={difficultyHard} onChange={(e) => setDifficultyHard(Math.max(0, Number(e.target.value) || 0))} />
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-cyan-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-cyan-100">Team Setup</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">Teams (one per line)
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
              <p className="mt-1 text-xs text-stone-400">Detected teams: {teamNames.length}</p>
            </label>

            <div className="grid gap-4">
              <label className="text-sm">Max teams (optional)
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={maxTeams} onChange={(e) => setMaxTeams(Math.max(0, Number(e.target.value) || 0))} />
              </label>
              <label className="text-sm">Slips batch size (optional)
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={slipsBatchSize} onChange={(e) => setSlipsBatchSize(Math.max(0, Number(e.target.value) || 0))} />
              </label>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-stone-700 bg-stone-950/80 p-3 text-sm">
            <p className="font-semibold uppercase tracking-wide text-cyan-200">Preflight Checklist</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.backupQuestions} onChange={(e) => setPreflight((p) => ({ ...p, backupQuestions: e.target.checked }))} /> Backup questions ready</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.answerSlips} onChange={(e) => setPreflight((p) => ({ ...p, answerSlips: e.target.checked }))} /> Answer slips ready</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.pencilsMarkers} onChange={(e) => setPreflight((p) => ({ ...p, pencilsMarkers: e.target.checked }))} /> Pencils/markers ready</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.tieBreaker} onChange={(e) => setPreflight((p) => ({ ...p, tieBreaker: e.target.checked }))} /> Tie-breaker ready</label>
            </div>
          </div>

          <button disabled={!preflightComplete || teamNames.length < 2 || creating} onClick={createSession} className="mt-5 rounded bg-cyan-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {creating ? "Creating..." : "Create Session"}
          </button>
        </section>

        <section className="rounded-3xl border border-cyan-900/40 bg-black/45 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black uppercase text-cyan-100">Existing Sessions</h2>
            <button onClick={load} className="rounded border border-stone-700 px-3 py-1 text-sm">Refresh</button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-stone-400">No trivia sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-stone-700 bg-stone-950/70 p-3">
                  <div className="text-sm">{session.session_code} · {session.title} · Round {session.current_round} of {session.round_count} · QPR {session.questions_per_round}</div>
                  <div className="text-xs text-stone-400">Event: {session.event_title ?? "(none)"} · Status: {session.status}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/music-trivia/host?sessionId=${session.id}`)}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/music-trivia/jumbotron?sessionId=${session.id}`)}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push("/admin/games/music-trivia/history")}>History</button>
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
