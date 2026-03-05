"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { downloadGamePullListPdf } from "src/lib/downloadGamePullListPdf";
import { formatSecondsClock, parseCueTimeToSeconds } from "src/lib/triviaBank";

type EventRow = {
  id: number;
  title: string;
  date: string;
};

type SessionRow = {
  id: number;
  session_code: string;
  title: string;
  status: string;
  current_round: number;
  round_count: number;
  questions_per_round: number;
  tie_breaker_count: number;
  playlist_name: string | null;
  prep_main_ready: number;
  prep_main_total: number;
  prep_tiebreaker_ready: number;
  prep_tiebreaker_total: number;
  event_title: string | null;
  deck_title?: string | null;
};

type InventoryTrackResult = {
  inventory_id: number;
  release_id: number | null;
  release_track_id: number | null;
  artist: string;
  album: string;
  title: string;
  side: string | null;
  position: string | null;
  track_key: string | null;
  score: number | null;
};

type QuestionCardDraft = {
  id: string;
  question_text: string;
  correct_answer: string;
  alternate_answers_text: string;
  category: string;
  tags_text: string;
  cue_start_text: string;
  cue_end_text: string;
  cue_instruction: string;
  cue_notes_text: string;
  inventory_query: string;
  inventory_results: InventoryTrackResult[];
  selected_track: InventoryTrackResult | null;
  searching: boolean;
};

type TimerProfileKey = "fast" | "balanced" | "relaxed";

type TimerProfile = {
  label: string;
  remove_resleeve_seconds: number;
  find_record_seconds: number;
  cue_seconds: number;
  host_buffer_seconds: number;
};

const TIMER_PROFILES: Record<TimerProfileKey, TimerProfile> = {
  fast: {
    label: "Fast",
    remove_resleeve_seconds: 15,
    find_record_seconds: 8,
    cue_seconds: 10,
    host_buffer_seconds: 6,
  },
  balanced: {
    label: "Balanced",
    remove_resleeve_seconds: 20,
    find_record_seconds: 12,
    cue_seconds: 12,
    host_buffer_seconds: 8,
  },
  relaxed: {
    label: "Relaxed",
    remove_resleeve_seconds: 25,
    find_record_seconds: 15,
    cue_seconds: 15,
    host_buffer_seconds: 10,
  },
};

function createEmptyQuestionCard(id: string): QuestionCardDraft {
  return {
    id,
    question_text: "",
    correct_answer: "",
    alternate_answers_text: "",
    category: "General Music",
    tags_text: "",
    cue_start_text: "0:30",
    cue_end_text: "",
    cue_instruction: "",
    cue_notes_text: "",
    inventory_query: "",
    inventory_results: [],
    selected_track: null,
    searching: false,
  };
}

function parseDelimitedText(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function validateQuestionCard(question: QuestionCardDraft): string | null {
  if (!question.question_text.trim()) return "Question text is required.";
  if (!question.correct_answer.trim()) return "Correct answer is required.";
  if (!question.selected_track) return "Pick a vinyl track for cue source.";

  const startSeconds = parseCueTimeToSeconds(question.cue_start_text);
  if (startSeconds === null) return "Cue start time is required (use m:ss).";

  const endSeconds = question.cue_end_text.trim() ? parseCueTimeToSeconds(question.cue_end_text) : null;
  if (question.cue_end_text.trim() && endSeconds === null) return "Cue end time is invalid.";
  if (startSeconds !== null && endSeconds !== null && endSeconds < startSeconds) {
    return "Cue end time must be after cue start time.";
  }

  return null;
}

function formatTrackLabel(track: InventoryTrackResult | null): string {
  if (!track) return "No vinyl track selected";
  const sidePos = [track.side, track.position].filter(Boolean).join(" ");
  return `${track.artist} - ${track.album} - ${track.title}${sidePos ? ` (${sidePos})` : ""}`;
}

export default function MusicTriviaSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const cardCounterRef = useRef(1);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [title, setTitle] = useState("Vinyl Trivia Night");
  const [roundCount, setRoundCount] = useState(2);
  const [questionsPerRound, setQuestionsPerRound] = useState(5);
  const [tieBreakerCount, setTieBreakerCount] = useState(1);
  const [timerProfile, setTimerProfile] = useState<TimerProfileKey>("balanced");
  const [scoreMode, setScoreMode] = useState<"standard" | "difficulty_bonus_static">("difficulty_bonus_static");
  const [teamNamesText, setTeamNamesText] = useState("Team A\nTeam B");

  const [questions, setQuestions] = useState<QuestionCardDraft[]>([
    createEmptyQuestionCard(String(cardCounterRef.current++)),
  ]);

  const [creating, setCreating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const requiredQuestionCount = useMemo(
    () => Math.max(1, roundCount) * Math.max(1, questionsPerRound) + Math.max(0, tieBreakerCount),
    [roundCount, questionsPerRound, tieBreakerCount]
  );

  const mainQuestionCount = useMemo(
    () => Math.max(1, roundCount) * Math.max(1, questionsPerRound),
    [roundCount, questionsPerRound]
  );

  const selectedQuestions = useMemo(
    () => questions.slice(0, requiredQuestionCount),
    [questions, requiredQuestionCount]
  );

  const questionValidationErrors = useMemo(
    () => selectedQuestions.map((question) => validateQuestionCard(question)),
    [selectedQuestions]
  );

  const invalidQuestionCount = useMemo(
    () => questionValidationErrors.filter((error) => Boolean(error)).length,
    [questionValidationErrors]
  );

  const missingCueCount = useMemo(
    () => selectedQuestions.filter((question) => !question.selected_track || parseCueTimeToSeconds(question.cue_start_text) === null).length,
    [selectedQuestions]
  );

  const reviewReady = teamNames.length >= 2 && invalidQuestionCount === 0;

  const load = useCallback(async () => {
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
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setQuestions((current) => {
      if (current.length === requiredQuestionCount) return current;
      if (current.length > requiredQuestionCount) return current.slice(0, requiredQuestionCount);

      const next = [...current];
      while (next.length < requiredQuestionCount) {
        next.push(createEmptyQuestionCard(String(cardCounterRef.current++)));
      }
      return next;
    });
  }, [requiredQuestionCount]);

  const updateQuestion = useCallback((id: string, patch: Partial<QuestionCardDraft>) => {
    setQuestions((current) => current.map((question) => (question.id === id ? { ...question, ...patch } : question)));
  }, []);

  const searchInventory = useCallback(async (questionId: string) => {
    const question = questions.find((entry) => entry.id === questionId);
    if (!question) return;

    const query = question.inventory_query.trim();
    if (!query) {
      updateQuestion(questionId, { inventory_results: [] });
      return;
    }

    updateQuestion(questionId, { searching: true });
    try {
      const res = await fetch(`/api/games/trivia/inventory-search?q=${encodeURIComponent(query)}&limit=8`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Inventory search failed");

      updateQuestion(questionId, {
        inventory_results: Array.isArray(payload.data) ? payload.data : [],
      });
    } catch {
      updateQuestion(questionId, { inventory_results: [] });
    } finally {
      updateQuestion(questionId, { searching: false });
    }
  }, [questions, updateQuestion]);

  const addQuestionCard = useCallback(() => {
    setQuestions((current) => [...current, createEmptyQuestionCard(String(cardCounterRef.current++))]);
  }, []);

  const removeQuestionCard = useCallback((id: string) => {
    setQuestions((current) => {
      if (current.length <= 1) return current;
      const next = current.filter((question) => question.id !== id);
      return next.length === 0 ? [createEmptyQuestionCard(String(cardCounterRef.current++))] : next;
    });
  }, []);

  const timerConfig = TIMER_PROFILES[timerProfile];

  const saveQuestionCard = useCallback(async (question: QuestionCardDraft) => {
    const validationError = validateQuestionCard(question);
    if (validationError) throw new Error(validationError);

    const cueStartSeconds = parseCueTimeToSeconds(question.cue_start_text);
    const cueEndSeconds = question.cue_end_text.trim() ? parseCueTimeToSeconds(question.cue_end_text) : null;
    if (cueStartSeconds === null) throw new Error("Cue start time is required.");

    const alternateAnswers = parseDelimitedText(question.alternate_answers_text);
    const tags = parseDelimitedText(question.tags_text);

    const inventoryTrack = question.selected_track;
    if (!inventoryTrack) throw new Error("Pick a vinyl track for cue source.");

    const cueInstruction = question.cue_instruction.trim() || `Cue ${inventoryTrack.title} at ${formatSecondsClock(cueStartSeconds)}`;

    const res = await fetch("/api/games/trivia/questions/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_text: question.question_text,
        correct_answer: question.correct_answer,
        alternate_answers: alternateAnswers,
        category: question.category,
        tags,
        cue_source_type: "inventory_track",
        cue_source_payload: {
          inventory_id: inventoryTrack.inventory_id,
          release_id: inventoryTrack.release_id,
          release_track_id: inventoryTrack.release_track_id,
          artist: inventoryTrack.artist,
          album: inventoryTrack.album,
          title: inventoryTrack.title,
          side: inventoryTrack.side,
          position: inventoryTrack.position,
        },
        primary_cue_start_seconds: cueStartSeconds,
        primary_cue_end_seconds: cueEndSeconds,
        primary_cue_instruction: cueInstruction,
        cue_notes_text: question.cue_notes_text,
        source_note: `Wizard cue source: ${formatTrackLabel(inventoryTrack)}`,
        publish: true,
      }),
    });

    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload.error ?? "Failed to save question");
    }

    return Number(payload.id);
  }, []);

  const saveAllQuestionsAsDraftDeck = useCallback(async () => {
    setErrorMessage(null);
    setSavingDraft(true);
    try {
      const ids: number[] = [];
      for (let index = 0; index < selectedQuestions.length; index += 1) {
        const question = selectedQuestions[index];
        try {
          const questionId = await saveQuestionCard(question);
          ids.push(questionId);
        } catch (error) {
          throw new Error(`Question ${index + 1}: ${error instanceof Error ? error.message : "Invalid question"}`);
        }
      }

      const createDeckRes = await fetch("/api/games/trivia/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${title} Question Deck`,
          build_mode: "manual",
          status: "draft",
          rules_payload: {
            round_count: roundCount,
            questions_per_round: questionsPerRound,
            tie_breaker_count: tieBreakerCount,
            target_count: roundCount * questionsPerRound,
            filters: {
              statuses: ["published"],
              has_required_cue: true,
            },
          },
          items: ids.map((questionId, index) => ({
            item_index: index + 1,
            round_number: index < mainQuestionCount ? (Math.floor(index / questionsPerRound) + 1) : (roundCount + 1),
            is_tiebreaker: index >= mainQuestionCount,
            question_id: questionId,
          })),
        }),
      });
      const createDeckPayload = await createDeckRes.json();
      if (!createDeckRes.ok) throw new Error(createDeckPayload.error ?? "Failed to create draft deck");

      alert(`Draft deck created: ${createDeckPayload.deck_code ?? createDeckPayload.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save draft deck");
    } finally {
      setSavingDraft(false);
    }
  }, [mainQuestionCount, questionsPerRound, roundCount, saveQuestionCard, selectedQuestions, tieBreakerCount, title]);

  const createSessionFromWizard = useCallback(async () => {
    if (creating) return;

    setErrorMessage(null);
    setCreating(true);

    try {
      const questionIds: number[] = [];
      for (let index = 0; index < selectedQuestions.length; index += 1) {
        const question = selectedQuestions[index];
        try {
          const questionId = await saveQuestionCard(question);
          questionIds.push(questionId);
        } catch (error) {
          throw new Error(`Question ${index + 1}: ${error instanceof Error ? error.message : "Invalid question"}`);
        }
      }

      const res = await fetch("/api/games/trivia/wizard/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          title,
          deck_title: `${title} Deck`,
          round_count: roundCount,
          questions_per_round: questionsPerRound,
          tie_breaker_count: tieBreakerCount,
          score_mode: scoreMode,
          remove_resleeve_seconds: timerConfig.remove_resleeve_seconds,
          find_record_seconds: timerConfig.find_record_seconds,
          cue_seconds: timerConfig.cue_seconds,
          host_buffer_seconds: timerConfig.host_buffer_seconds,
          show_title: true,
          show_rounds: true,
          show_question_counter: true,
          show_leaderboard: true,
          show_cue_hints: false,
          team_names: teamNames,
          question_ids: questionIds,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      const sessionId = Number(payload?.session?.id);
      if (!Number.isFinite(sessionId)) throw new Error("Session created but response was missing session id.");

      await load();
      router.push(`/admin/games/music-trivia/prep?sessionId=${sessionId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  }, [creating, eventId, load, questionsPerRound, roundCount, router, saveQuestionCard, scoreMode, selectedQuestions, teamNames, tieBreakerCount, timerConfig, title]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_20%,#1d4d44,transparent_45%),linear-gradient(180deg,#0f1312,#060807)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-emerald-900/40 bg-black/45 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-300">Consumer Mode</p>
              <h1 className="mt-1 text-4xl font-black uppercase text-emerald-100">Create Vinyl Trivia Game</h1>
              <p className="mt-2 text-sm text-stone-300">
                Every question requires a playable vinyl cue. Fill out the wizard and start hosting.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link href="/admin/games/music-trivia/bank" className="rounded border border-stone-700 px-3 py-1">Studio: Question Bank</Link>
              <Link href="/admin/games/music-trivia/decks" className="rounded border border-stone-700 px-3 py-1">Studio: Deck Builder</Link>
              <Link href="/admin/games/music-trivia/history" className="rounded border border-stone-700 px-3 py-1">History</Link>
            </div>
          </div>

          <div className="mt-5 grid gap-2 text-xs md:grid-cols-3">
            <div className={`rounded border px-3 py-2 ${step === 1 ? "border-emerald-400 bg-emerald-950/30" : "border-stone-700 bg-stone-950/60"}`}>1. Game Basics</div>
            <div className={`rounded border px-3 py-2 ${step === 2 ? "border-emerald-400 bg-emerald-950/30" : "border-stone-700 bg-stone-950/60"}`}>2. Questions + Vinyl Cues</div>
            <div className={`rounded border px-3 py-2 ${step === 3 ? "border-emerald-400 bg-emerald-950/30" : "border-stone-700 bg-stone-950/60"}`}>3. Review + Start</div>
          </div>
        </header>

        {step === 1 ? (
          <section className="rounded-3xl border border-emerald-900/40 bg-black/45 p-6">
            <h2 className="text-xl font-black uppercase text-emerald-100">Step 1: Game Basics</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm">Game Name
                <input
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <label className="text-sm">Event (optional)
                <select
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                  value={eventId ?? ""}
                  onChange={(e) => setEventId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">No event selected</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.date} - {event.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">Score Mode
                <select
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                  value={scoreMode}
                  onChange={(e) => setScoreMode((e.target.value as "standard" | "difficulty_bonus_static") ?? "difficulty_bonus_static")}
                >
                  <option value="difficulty_bonus_static">Difficulty Bonus</option>
                  <option value="standard">Standard</option>
                </select>
              </label>

              <label className="text-sm">Rounds
                <input
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                  type="number"
                  min={1}
                  value={roundCount}
                  onChange={(e) => setRoundCount(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>

              <label className="text-sm">Questions per Round
                <input
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                  type="number"
                  min={1}
                  value={questionsPerRound}
                  onChange={(e) => setQuestionsPerRound(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>

              <label className="text-sm">Tie-breakers
                <input
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                  type="number"
                  min={0}
                  value={tieBreakerCount}
                  onChange={(e) => setTieBreakerCount(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-stone-700 bg-stone-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Timer Profile</p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {(Object.keys(TIMER_PROFILES) as TimerProfileKey[]).map((profileKey) => {
                  const profile = TIMER_PROFILES[profileKey];
                  const active = profileKey === timerProfile;
                  return (
                    <button
                      key={profileKey}
                      onClick={() => setTimerProfile(profileKey)}
                      className={`rounded border px-3 py-3 text-left text-sm ${active ? "border-emerald-400 bg-emerald-950/40" : "border-stone-700 bg-stone-900/70"}`}
                    >
                      <p className="font-semibold">{profile.label}</p>
                      <p className="mt-1 text-xs text-stone-300">Resleeve {profile.remove_resleeve_seconds}s - Find {profile.find_record_seconds}s - Cue {profile.cue_seconds}s - Buffer {profile.host_buffer_seconds}s</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="mt-4 block text-sm">Teams (one per line)
              <textarea
                className="mt-1 h-32 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                value={teamNamesText}
                onChange={(e) => setTeamNamesText(e.target.value)}
              />
              <p className={`mt-1 text-xs ${teamNames.length >= 2 ? "text-emerald-300" : "text-amber-300"}`}>
                {teamNames.length >= 2 ? `${teamNames.length} teams ready` : "At least 2 teams are required"}
              </p>
            </label>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-stone-300">
                Total required questions: <span className="font-semibold text-emerald-300">{requiredQuestionCount}</span>
              </p>
              <button
                onClick={() => setStep(2)}
                disabled={teamNames.length < 2}
                className="rounded bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Continue to Questions
              </button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="rounded-3xl border border-emerald-900/40 bg-black/45 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-black uppercase text-emerald-100">Step 2: Questions + Vinyl Cues</h2>
              <p className="text-xs text-stone-300">Media is required for every question.</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <button onClick={() => setStep(1)} className="rounded border border-stone-700 px-3 py-1">Back to Basics</button>
              <button onClick={addQuestionCard} className="rounded border border-emerald-700 px-3 py-1">Add Extra Question Card</button>
              <button
                onClick={() => setStep(3)}
                className="rounded bg-emerald-700 px-3 py-1 font-semibold text-white"
              >
                Review & Start
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {questions.map((question, index) => {
                const isRequired = index < requiredQuestionCount;
                const isTieBreaker = isRequired && index >= mainQuestionCount;
                const validationError = validateQuestionCard(question);
                const cueStartSeconds = parseCueTimeToSeconds(question.cue_start_text);

                return (
                  <article key={question.id} className={`rounded-2xl border p-4 ${isRequired ? "border-emerald-800/70 bg-emerald-950/10" : "border-stone-700 bg-stone-950/60"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-emerald-200">
                        Q{index + 1} {isTieBreaker ? "(Tie-breaker)" : ""} {isRequired ? "" : "(Extra)"}
                      </p>
                      <button
                        onClick={() => removeQuestionCard(question.id)}
                        className="rounded border border-stone-700 px-2 py-1 text-xs"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="text-sm">Question text
                        <textarea
                          className="mt-1 h-20 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                          value={question.question_text}
                          onChange={(e) => updateQuestion(question.id, { question_text: e.target.value })}
                        />
                      </label>

                      <label className="text-sm">Correct answer
                        <input
                          className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                          value={question.correct_answer}
                          onChange={(e) => updateQuestion(question.id, { correct_answer: e.target.value })}
                        />
                      </label>

                      <label className="text-sm">Alternate answers (comma or new line)
                        <textarea
                          className="mt-1 h-20 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                          value={question.alternate_answers_text}
                          onChange={(e) => updateQuestion(question.id, { alternate_answers_text: e.target.value })}
                        />
                      </label>

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="text-sm">Category
                          <input
                            className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                            value={question.category}
                            onChange={(e) => updateQuestion(question.id, { category: e.target.value })}
                          />
                        </label>
                        <label className="text-sm">Tags
                          <input
                            className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                            value={question.tags_text}
                            onChange={(e) => updateQuestion(question.id, { tags_text: e.target.value })}
                            placeholder="70s, soul, vocals"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Cue Source (Required)</p>
                      <div className="mt-2 grid gap-3 md:grid-cols-[1fr,auto]">
                        <input
                          className="rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm"
                          placeholder="Search vinyl inventory: artist, album, track"
                          value={question.inventory_query}
                          onChange={(e) => updateQuestion(question.id, { inventory_query: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              searchInventory(question.id);
                            }
                          }}
                        />
                        <button
                          onClick={() => searchInventory(question.id)}
                          className="rounded border border-cyan-700 px-3 py-2 text-sm"
                          disabled={question.searching}
                        >
                          {question.searching ? "Searching..." : "Search"}
                        </button>
                      </div>

                      {question.inventory_results.length > 0 ? (
                        <div className="mt-2 max-h-44 overflow-y-auto rounded border border-stone-700 bg-stone-950/70 p-2 text-xs">
                          {question.inventory_results.map((result) => (
                            <button
                              key={`${result.inventory_id}-${result.side ?? ""}-${result.position ?? ""}-${result.title}`}
                              onClick={() => {
                                updateQuestion(question.id, {
                                  selected_track: result,
                                  cue_instruction: question.cue_instruction.trim() || `Cue ${result.title}`,
                                });
                              }}
                              className="block w-full rounded px-2 py-1 text-left hover:bg-stone-800"
                            >
                              {result.artist} - {result.album} - {result.title}
                              {(result.side || result.position) ? ` (${[result.side, result.position].filter(Boolean).join(" ")})` : ""}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <label className="text-sm">Cue start (m:ss)
                          <input
                            className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                            value={question.cue_start_text}
                            onChange={(e) => updateQuestion(question.id, { cue_start_text: e.target.value })}
                          />
                        </label>
                        <label className="text-sm">Cue end (optional)
                          <input
                            className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                            value={question.cue_end_text}
                            onChange={(e) => updateQuestion(question.id, { cue_end_text: e.target.value })}
                          />
                        </label>
                        <label className="text-sm">Cue instruction
                          <input
                            className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                            value={question.cue_instruction}
                            onChange={(e) => updateQuestion(question.id, { cue_instruction: e.target.value })}
                            placeholder="Start at chorus"
                          />
                        </label>
                      </div>

                      <label className="mt-3 block text-sm">Extra cue notes
                        <textarea
                          className="mt-1 h-16 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                          value={question.cue_notes_text}
                          onChange={(e) => updateQuestion(question.id, { cue_notes_text: e.target.value })}
                          placeholder="Play any song on album, start at 2:30"
                        />
                      </label>

                      <div className="mt-3 rounded border border-cyan-800/70 bg-cyan-950/30 p-3 text-xs">
                        <p className="font-semibold uppercase tracking-wide text-cyan-200">Host Pull Card Preview</p>
                        <p className="mt-1 text-stone-100">{formatTrackLabel(question.selected_track)}</p>
                        <p className="mt-1 text-stone-200">Cue: {cueStartSeconds !== null ? formatSecondsClock(cueStartSeconds) : "--:--"}</p>
                        {question.cue_instruction.trim() ? <p className="mt-1 text-stone-300">Instruction: {question.cue_instruction.trim()}</p> : null}
                      </div>
                    </div>

                    {isRequired && validationError ? <p className="mt-2 text-xs text-amber-300">{validationError}</p> : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="rounded-3xl border border-emerald-900/40 bg-black/45 p-6">
            <h2 className="text-xl font-black uppercase text-emerald-100">Step 3: Review & Start</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded border border-stone-700 bg-stone-950/70 p-3 text-sm">
                <p className="font-semibold text-emerald-200">Game Summary</p>
                <p className="mt-1">Title: {title}</p>
                <p>Rounds: {roundCount}</p>
                <p>Questions per round: {questionsPerRound}</p>
                <p>Tie-breakers: {tieBreakerCount}</p>
                <p>Teams: {teamNames.length}</p>
                <p>Timer profile: {timerConfig.label}</p>
              </div>

              <div className="rounded border border-stone-700 bg-stone-950/70 p-3 text-sm">
                <p className="font-semibold text-emerald-200">Validation</p>
                <p className={invalidQuestionCount === 0 ? "mt-1 text-emerald-300" : "mt-1 text-amber-300"}>
                  Questions ready: {selectedQuestions.length - invalidQuestionCount}/{selectedQuestions.length}
                </p>
                <p className={missingCueCount === 0 ? "text-emerald-300" : "text-amber-300"}>
                  Questions missing cue source/time: {missingCueCount}
                </p>
                <p className={teamNames.length >= 2 ? "text-emerald-300" : "text-amber-300"}>
                  Teams ready: {teamNames.length}
                </p>
              </div>
            </div>

            {errorMessage ? (
              <p className="mt-3 rounded border border-red-700/60 bg-red-950/30 px-3 py-2 text-sm text-red-200">{errorMessage}</p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button onClick={() => setStep(2)} className="rounded border border-stone-700 px-3 py-2 text-sm">Back to Questions</button>
              <button
                onClick={saveAllQuestionsAsDraftDeck}
                disabled={savingDraft || creating || !reviewReady}
                className="rounded border border-emerald-700 px-3 py-2 text-sm disabled:opacity-50"
              >
                {savingDraft ? "Saving Draft Deck..." : "Save Draft Deck"}
              </button>
              <button
                onClick={createSessionFromWizard}
                disabled={!reviewReady || creating || savingDraft}
                className="rounded bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {creating ? "Creating Game..." : "Create & Start Game"}
              </button>
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-emerald-900/40 bg-black/45 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black uppercase text-emerald-100">Existing Sessions</h2>
            <button onClick={load} className="rounded border border-stone-700 px-3 py-1 text-sm">Refresh</button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-stone-400">No trivia sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-stone-700 bg-stone-950/70 p-3">
                  <div className="text-sm">{session.session_code} - {session.title} - Round {session.current_round} of {session.round_count} - QPR {session.questions_per_round} - TB {session.tie_breaker_count}</div>
                  <div className="text-xs text-stone-400">Event: {session.event_title ?? "(none)"} - Deck: {session.deck_title ?? "(none)"} - Playlist: {session.playlist_name ?? "(none)"} - Status: {session.status}</div>
                  <div className="mt-1 text-xs text-emerald-300">
                    Prep: Main {session.prep_main_ready}/{session.prep_main_total} - Tie-breaker {session.prep_tiebreaker_ready}/{session.prep_tiebreaker_total}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="rounded border border-emerald-700 px-2 py-1" onClick={() => router.push(`/admin/games/music-trivia/prep?sessionId=${session.id}`)}>Prep</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/music-trivia/host?sessionId=${session.id}`)}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/music-trivia/jumbotron?sessionId=${session.id}`)}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadGamePullListPdf({ gameSlug: "trivia", gameTitle: "Music Trivia", sessionId: session.id, sessionCode: session.session_code, accentRgb: [22, 163, 74] })}>Pull List PDF</button>
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
