"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { downloadGamePullListPdf } from "src/lib/downloadGamePullListPdf";

type EventRow = {
  id: number;
  title: string;
  date: string;
};

type DeckRow = {
  id: number;
  title: string;
  status: "draft" | "ready" | "archived";
  item_total: number;
  item_locked_total: number;
};

type DeckDetail = {
  id: number;
  rules_payload: Record<string, unknown>;
  items: Array<{
    is_tiebreaker: boolean;
    round_number: number;
  }>;
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

function asNumber(value: unknown, fallback: number, min = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

function normalizeTeamNames(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split("\n")
        .map((name) => name.trim())
        .filter(Boolean)
    )
  );
}

function deriveCountsFromDeck(detail: DeckDetail | null): { round_count: number; questions_per_round: number; tie_breaker_count: number } {
  if (!detail) {
    return {
      round_count: 3,
      questions_per_round: 5,
      tie_breaker_count: 1,
    };
  }

  const rules = detail.rules_payload ?? {};
  const roundCount = asNumber((rules as Record<string, unknown>).round_count, 3, 1);
  const qpr = asNumber((rules as Record<string, unknown>).questions_per_round, 5, 1);
  const tie = Math.max(0, Number((rules as Record<string, unknown>).tie_breaker_count ?? 0));

  const mainItems = detail.items.filter((item) => !item.is_tiebreaker);
  const tieItems = detail.items.filter((item) => item.is_tiebreaker);

  const inferredRounds = Math.max(roundCount, mainItems.reduce((acc, item) => Math.max(acc, item.round_number), 1));
  const inferredQpr = Math.max(qpr, mainItems.length > 0 ? Math.ceil(mainItems.length / Math.max(1, inferredRounds)) : qpr);

  return {
    round_count: inferredRounds,
    questions_per_round: inferredQpr,
    tie_breaker_count: Math.max(tie, tieItems.length),
  };
}

export default function MusicTriviaSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [decks, setDecks] = useState<DeckRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [deckId, setDeckId] = useState<number | null>(null);
  const [title, setTitle] = useState("Music Trivia Session");
  const [teamNamesText, setTeamNamesText] = useState("Team A\nTeam B");

  const [roundCount, setRoundCount] = useState(3);
  const [questionsPerRound, setQuestionsPerRound] = useState(5);
  const [tieBreakerCount, setTieBreakerCount] = useState(1);

  const [creating, setCreating] = useState(false);

  const teamNames = useMemo(() => normalizeTeamNames(teamNamesText), [teamNamesText]);

  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.id === deckId) ?? null,
    [deckId, decks]
  );

  const requiredQuestions = useMemo(
    () => (roundCount * questionsPerRound) + tieBreakerCount,
    [roundCount, questionsPerRound, tieBreakerCount]
  );

  const load = useCallback(async () => {
    const [eventRes, deckRes, sessionRes] = await Promise.all([
      fetch("/api/games/trivia/events"),
      fetch("/api/games/trivia/decks?limit=200"),
      fetch(`/api/games/trivia/sessions${eventId ? `?eventId=${eventId}` : ""}`),
    ]);

    if (eventRes.ok) {
      const payload = await eventRes.json();
      setEvents(payload.data ?? []);
    }

    if (deckRes.ok) {
      const payload = await deckRes.json();
      setDecks(payload.data ?? []);
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
    if (!deckId) return;

    let cancelled = false;
    const loadDeckDetail = async () => {
      const res = await fetch(`/api/games/trivia/decks/${deckId}`);
      if (!res.ok || cancelled) return;
      const payload = (await res.json()) as DeckDetail;
      const counts = deriveCountsFromDeck(payload);
      if (cancelled) return;
      setRoundCount(counts.round_count);
      setQuestionsPerRound(counts.questions_per_round);
      setTieBreakerCount(counts.tie_breaker_count);
    };

    loadDeckDetail();
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const createSession = async () => {
    if (!deckId) {
      alert("Choose a deck first.");
      return;
    }
    if (teamNames.length < 2) {
      alert("At least 2 teams are required.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/games/trivia/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          deck_id: deckId,
          title: title.trim() || "Music Trivia Session",
          round_count: roundCount,
          questions_per_round: questionsPerRound,
          tie_breaker_count: tieBreakerCount,
          score_mode: "difficulty_bonus_static",
          remove_resleeve_seconds: 20,
          find_record_seconds: 12,
          cue_seconds: 12,
          host_buffer_seconds: 8,
          show_title: true,
          show_rounds: true,
          show_question_counter: true,
          show_leaderboard: true,
          show_cue_hints: false,
          team_names: teamNames,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      await load();
      router.push(`/admin/games/music-trivia/prep?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#0f2d3a,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-cyan-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Music Trivia</p>
          <h1 className="mt-1 text-4xl font-black uppercase text-cyan-100">Setup From Deck</h1>
          <p className="mt-2 text-sm text-stone-300">Create questions in Question Bank, build decks in Deck Builder, then start a game from a chosen deck.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Link href="/admin/games/music-trivia/bank" className="rounded border border-stone-700 px-3 py-1">Question Bank</Link>
            <Link href="/admin/games/music-trivia/decks" className="rounded border border-stone-700 px-3 py-1">Deck Builder</Link>
            <Link href="/admin/games/music-trivia/history" className="rounded border border-stone-700 px-3 py-1">History</Link>
          </div>
        </header>

        <section className="rounded-3xl border border-cyan-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-cyan-100">Create Session</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">Event (optional)
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={eventId ?? ""} onChange={(e) => setEventId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">No event selected</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{event.date} - {event.title}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">Deck (required)
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={deckId ?? ""} onChange={(e) => setDeckId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Choose a deck</option>
                {decks.filter((deck) => deck.status !== "archived").map((deck) => (
                  <option key={deck.id} value={deck.id}>{deck.title} ({deck.status}, {deck.item_total} items)</option>
                ))}
              </select>
            </label>

            <label className="text-sm">Session Title
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm">Rounds
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={1} value={roundCount} onChange={(e) => setRoundCount(asNumber(e.target.value, roundCount, 1))} />
            </label>

            <label className="text-sm">Questions / Round
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={1} value={questionsPerRound} onChange={(e) => setQuestionsPerRound(asNumber(e.target.value, questionsPerRound, 1))} />
            </label>

            <label className="text-sm">Tie-breakers
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={tieBreakerCount} onChange={(e) => setTieBreakerCount(Math.max(0, Number(e.target.value) || 0))} />
            </label>
          </div>

          <label className="mt-4 block text-sm">Teams (one per line)
            <textarea className="mt-1 h-32 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
            <p className={`mt-1 text-xs ${teamNames.length >= 2 ? "text-emerald-300" : "text-amber-300"}`}>
              {teamNames.length >= 2 ? `${teamNames.length} teams ready` : "At least 2 teams are required"}
            </p>
          </label>

          <div className="mt-4 rounded border border-stone-700 bg-stone-950/70 p-3 text-sm">
            <p>Selected Deck: <span className="font-semibold">{selectedDeck?.title ?? "(none)"}</span></p>
            <p className="mt-1 text-stone-300">Deck status: {selectedDeck?.status ?? "-"} - required questions this setup: {requiredQuestions}</p>
            {selectedDeck?.status === "draft" ? <p className="mt-1 text-amber-300">Draft deck selected. Locking deck first is recommended.</p> : null}
          </div>

          <button
            className="mt-5 rounded bg-cyan-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            disabled={!deckId || teamNames.length < 2 || creating}
            onClick={createSession}
          >
            {creating ? "Creating..." : "Create Session From Deck"}
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
                  <div className="text-sm">{session.session_code} - {session.title} - Round {session.current_round} of {session.round_count} - QPR {session.questions_per_round} - TB {session.tie_breaker_count}</div>
                  <div className="text-xs text-stone-400">Event: {session.event_title ?? "(none)"} - Deck: {session.deck_title ?? "(none)"} - Playlist: {session.playlist_name ?? "(none)"} - Status: {session.status}</div>
                  <div className="mt-1 text-xs text-cyan-300">Prep: Main {session.prep_main_ready}/{session.prep_main_total} - Tie-breaker {session.prep_tiebreaker_ready}/{session.prep_tiebreaker_total}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="rounded border border-cyan-700 px-2 py-1" onClick={() => router.push(`/admin/games/music-trivia/prep?sessionId=${session.id}`)}>Prep</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/music-trivia/host?sessionId=${session.id}`)}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/music-trivia/jumbotron?sessionId=${session.id}`)}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadGamePullListPdf({ gameSlug: "trivia", gameTitle: "Music Trivia", sessionId: session.id, sessionCode: session.session_code, accentRgb: [8, 145, 178] })}>Pull List PDF</button>
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
