"use client";

import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type DeckStatus = "draft" | "ready" | "archived";

type DeckListRow = {
  id: number;
  deck_code: string;
  title: string;
  status: DeckStatus;
  playlist_id?: number | null;
  crate_id?: number | null;
  item_total: number;
  item_locked_total: number;
  updated_at: string;
};

type PlaylistOption = { id: number; name: string };
type CrateOption = { id: number; name: string };

type DeckItemRow = {
  id: number;
  item_index: number;
  round_number: number;
  is_tiebreaker: boolean;
  question_id: number | null;
  snapshot_payload: {
    prompt_text?: string;
    answer_key?: string;
    category?: string;
    difficulty?: string;
    cue_notes_text?: string | null;
    tags?: string[];
  };
  locked: boolean;
};

type DeckDetail = {
  id: number;
  deck_code: string;
  title: string;
  status: DeckStatus;
  playlist_id: number | null;
  crate_id?: number | null;
  cooldown_days: number;
  rules_payload: Record<string, unknown>;
  locked_at: string | null;
  items: DeckItemRow[];
};

type QuestionPick = {
  id: number;
  question_code: string;
  prompt_text: string;
  answer_key?: string;
  default_category: string;
  default_difficulty: string;
  tags?: string[];
  facets: { has_required_cue?: boolean } | null;
};

type DeckConfig = {
  round_count: number;
  questions_per_round: number;
  tie_breaker_count: number;
  cooldown_days: number;
  include_recently_used: boolean;
};

function asPositiveInt(value: unknown, fallback: number, min = 1): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

function inferConfig(detail: DeckDetail): DeckConfig {
  const rules = detail.rules_payload ?? {};
  const mainItems = detail.items.filter((item) => !item.is_tiebreaker);
  const tieItems = detail.items.filter((item) => item.is_tiebreaker);

  const roundCountFromRules = asPositiveInt((rules as Record<string, unknown>).round_count, 1, 1);
  const qprFromRules = asPositiveInt((rules as Record<string, unknown>).questions_per_round, 5, 1);
  const tieFromRules = Math.max(0, Number((rules as Record<string, unknown>).tie_breaker_count ?? 0));

  const inferredRoundCount = Math.max(roundCountFromRules, mainItems.reduce((acc, item) => Math.max(acc, item.round_number), 1));
  const inferredQpr = Math.max(qprFromRules, mainItems.length > 0 ? Math.ceil(mainItems.length / Math.max(1, inferredRoundCount)) : qprFromRules);

  return {
    round_count: inferredRoundCount,
    questions_per_round: inferredQpr,
    tie_breaker_count: Math.max(tieFromRules, tieItems.length),
    cooldown_days: Math.max(0, Number((rules as Record<string, unknown>).cooldown_days ?? detail.cooldown_days ?? 90)),
    include_recently_used: Boolean((rules as Record<string, unknown>).include_cooled_down ?? false),
  };
}

// ---------------------------------------------------------------------------
// Sortable deck item
// ---------------------------------------------------------------------------

type SortableItemProps = {
  item: DeckItemRow;
  index: number;
  busy: boolean;
  onRemove: (id: number) => void;
};

function SortableDeckItem({ item, index, busy, onRemove }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const diffColor = {
    easy: "text-emerald-300",
    medium: "text-amber-300",
    hard: "text-rose-300",
  }[item.snapshot_payload.difficulty?.toLowerCase() ?? ""] ?? "text-stone-400";

  const hasCue = !!item.snapshot_payload.cue_notes_text;
  const tags = item.snapshot_payload.tags ?? [];

  return (
    <div ref={setNodeRef} style={style} className={`rounded border bg-stone-950/70 p-2 ${item.is_tiebreaker ? "border-amber-800/60" : "border-stone-800"}`}>
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab rounded p-1 text-stone-500 hover:text-stone-300 active:cursor-grabbing"
          title="Drag to reorder"
          disabled={busy}
        >
          <svg width="12" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="3" cy="2" r="1.3" /><circle cx="7" cy="2" r="1.3" />
            <circle cx="3" cy="7" r="1.3" /><circle cx="7" cy="7" r="1.3" />
            <circle cx="3" cy="12" r="1.3" /><circle cx="7" cy="12" r="1.3" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-stone-400">#{index + 1}</span>
            {item.is_tiebreaker
              ? <span className="rounded bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">Tie-breaker</span>
              : <span className="rounded bg-stone-900/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">Rd {item.round_number}</span>
            }
            {item.snapshot_payload.difficulty && (
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${diffColor}`}>{item.snapshot_payload.difficulty}</span>
            )}
            {item.snapshot_payload.category && (
              <span className="text-[10px] text-stone-500">{item.snapshot_payload.category}</span>
            )}
            {hasCue && (
              <span className="rounded bg-cyan-950/60 px-1.5 py-0.5 text-[10px] text-cyan-400">♪ cue</span>
            )}
            {tags.includes("trivia-api") && (
              <span className="rounded bg-fuchsia-950/50 px-1.5 py-0.5 text-[10px] text-fuchsia-400">trivia-api</span>
            )}
            {tags.includes("ai-generated") && (
              <span className="rounded bg-violet-950/50 px-1.5 py-0.5 text-[10px] text-violet-400">ai</span>
            )}
          </div>

          <p className="mt-1 text-[12px] text-stone-200 leading-snug">
            {item.snapshot_payload.prompt_text ?? "(no question text)"}
          </p>

          {item.snapshot_payload.answer_key && (
            <p className="mt-0.5 text-[11px] text-emerald-400/80">
              A: {item.snapshot_payload.answer_key}
            </p>
          )}
        </div>

        <button
          className="rounded border border-stone-700 px-2 py-1 text-[11px] text-stone-400 hover:border-red-700 hover:text-red-300"
          disabled={busy}
          onClick={() => onRemove(item.id)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MusicTriviaDecksPage() {
  const [decks, setDecks] = useState<DeckListRow[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [selectedDeck, setSelectedDeck] = useState<DeckDetail | null>(null);
  const [config, setConfig] = useState<DeckConfig>({
    round_count: 3,
    questions_per_round: 5,
    tie_breaker_count: 1,
    cooldown_days: 90,
    include_recently_used: false,
  });

  const [newDeckTitle, setNewDeckTitle] = useState("Trivia Deck");
  const [newDeckPlaylistId, setNewDeckPlaylistId] = useState("");
  const [newDeckCrateId, setNewDeckCrateId] = useState("");

  // Question picker filters
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionTagFilter, setQuestionTagFilter] = useState("");
  const [questionDiffFilter, setQuestionDiffFilter] = useState("");
  const [questionResults, setQuestionResults] = useState<QuestionPick[]>([]);

  const [playlistOptions, setPlaylistOptions] = useState<PlaylistOption[]>([]);
  const [crateOptions, setCrateOptions] = useState<CrateOption[]>([]);

  const [busy, setBusy] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadDecks = useCallback(async () => {
    const res = await fetch("/api/games/trivia/decks?limit=200");
    if (!res.ok) return;
    const payload = await res.json();
    setDecks(payload.data ?? []);
  }, []);

  const loadDeck = useCallback(async (deckId: number) => {
    const res = await fetch(`/api/games/trivia/decks/${deckId}`);
    if (!res.ok) return;
    const payload = (await res.json()) as DeckDetail;
    setSelectedDeckId(payload.id);
    setSelectedDeck(payload);
    setConfig(inferConfig(payload));
  }, []);

  const loadPlaylists = useCallback(async () => {
    const res = await fetch("/api/games/playlists");
    if (!res.ok) return;
    const payload = await res.json().catch(() => ({}));
    setPlaylistOptions(Array.isArray(payload.data)
      ? payload.data.map((row: { id: number; name: string }) => ({ id: Number(row.id), name: row.name }))
      : []);
  }, []);

  const loadCrates = useCallback(async () => {
    const res = await fetch("/api/games/trivia/crates");
    if (!res.ok) return;
    const payload = await res.json().catch(() => ({}));
    setCrateOptions(Array.isArray(payload.data)
      ? payload.data.map((row: { id: number; name: string }) => ({ id: Number(row.id), name: row.name }))
      : []);
  }, []);

  useEffect(() => { loadDecks(); }, [loadDecks]);
  useEffect(() => { loadPlaylists(); loadCrates(); }, [loadPlaylists, loadCrates]);

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const requiredMain = config.round_count * config.questions_per_round;
  const requiredTotal = requiredMain + config.tie_breaker_count;

  const selectedSummary = useMemo(() => {
    if (!selectedDeck) return null;
    const total = selectedDeck.items.length;
    const tie = selectedDeck.items.filter((item) => item.is_tiebreaker).length;
    return { total, tie, missing: Math.max(0, requiredTotal - total) };
  }, [requiredTotal, selectedDeck]);

  const sortedDecks = useMemo(
    () => [...decks].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [decks]
  );

  // Group deck items by round for visual display
  const groupedItems = useMemo(() => {
    if (!selectedDeck) return [];
    const mainItems = selectedDeck.items.filter((item) => !item.is_tiebreaker);
    const tieItems = selectedDeck.items.filter((item) => item.is_tiebreaker);

    const rounds: Array<{ label: string; items: DeckItemRow[]; isTie: boolean }> = [];
    for (let r = 1; r <= config.round_count; r++) {
      const roundItems = mainItems.filter((item) => item.round_number === r);
      rounds.push({ label: `Round ${r}`, items: roundItems, isTie: false });
    }
    // Include any items with rounds beyond config (e.g. stale data)
    const maxRound = mainItems.reduce((acc, item) => Math.max(acc, item.round_number), config.round_count);
    for (let r = config.round_count + 1; r <= maxRound; r++) {
      const roundItems = mainItems.filter((item) => item.round_number === r);
      if (roundItems.length > 0) rounds.push({ label: `Round ${r}`, items: roundItems, isTie: false });
    }
    if (tieItems.length > 0 || config.tie_breaker_count > 0) {
      rounds.push({ label: "Tie-breakers", items: tieItems, isTie: true });
    }
    return rounds;
  }, [config.round_count, config.tie_breaker_count, selectedDeck]);

  // ---------------------------------------------------------------------------
  // Deck item operations
  // ---------------------------------------------------------------------------

  const applyItems = useCallback(async (items: DeckItemRow[]) => {
    if (!selectedDeck) return;

    const normalizedItems = items.map((item, index) => {
      const itemIndex = index + 1;
      const isTieBreaker = itemIndex > requiredMain;
      const roundNumber = isTieBreaker
        ? (config.round_count + 1)
        : (Math.floor((itemIndex - 1) / config.questions_per_round) + 1);

      const payloadItem: {
        item_index: number;
        round_number: number;
        is_tiebreaker: boolean;
        question_id: number | null;
        snapshot_payload?: DeckItemRow["snapshot_payload"];
      } = {
        item_index: itemIndex,
        round_number: roundNumber,
        is_tiebreaker: isTieBreaker,
        question_id: item.question_id,
      };

      const hasSnapshotPrompt = typeof item.snapshot_payload?.prompt_text === "string" && item.snapshot_payload.prompt_text.trim().length > 0;
      if (!item.question_id || hasSnapshotPrompt) {
        payloadItem.snapshot_payload = item.snapshot_payload;
      }

      return payloadItem;
    });

    const res = await fetch(`/api/games/trivia/decks/${selectedDeck.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replace_items: true, items: normalizedItems }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error ?? "Failed to save deck items");

    await loadDeck(selectedDeck.id);
    await loadDecks();
  }, [config.questions_per_round, config.round_count, loadDeck, loadDecks, requiredMain, selectedDeck]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    if (!selectedDeck) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const items = [...selectedDeck.items];
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setBusy(true);
    try {
      await applyItems(reordered);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to reorder deck");
    } finally {
      setBusy(false);
    }
  }, [applyItems, selectedDeck]);

  // ---------------------------------------------------------------------------
  // CRUD operations
  // ---------------------------------------------------------------------------

  const createDeck = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/games/trivia/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newDeckTitle.trim() || "Trivia Deck",
          playlist_id: newDeckPlaylistId ? Number(newDeckPlaylistId) : null,
          crate_id: newDeckCrateId ? Number(newDeckCrateId) : null,
          build_mode: "hybrid",
          cooldown_days: config.cooldown_days,
          rules_payload: {
            round_count: config.round_count,
            questions_per_round: config.questions_per_round,
            tie_breaker_count: config.tie_breaker_count,
            target_count: config.round_count * config.questions_per_round,
            filters: { statuses: ["published"] },
          },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to create deck");
      await loadDecks();
      if (Number.isFinite(Number(payload.id))) await loadDeck(Number(payload.id));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create deck");
    } finally {
      setBusy(false);
    }
  };

  const saveConfig = async () => {
    if (!selectedDeck) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/games/trivia/decks/${selectedDeck.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedDeck.title,
          playlist_id: selectedDeck.playlist_id,
          crate_id: selectedDeck.crate_id ?? null,
          cooldown_days: config.cooldown_days,
          rules_payload: {
            round_count: config.round_count,
            questions_per_round: config.questions_per_round,
            tie_breaker_count: config.tie_breaker_count,
            target_count: config.round_count * config.questions_per_round,
            cooldown_days: config.cooldown_days,
            include_cooled_down: config.include_recently_used,
            filters: { statuses: ["published"] },
          },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to save config");
      await loadDeck(selectedDeck.id);
      await loadDecks();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save config");
    } finally {
      setBusy(false);
    }
  };

  const searchQuestions = async () => {
    const params = new URLSearchParams();
    if (questionSearch.trim()) params.set("q", questionSearch.trim());
    if (questionTagFilter.trim()) params.set("tag", questionTagFilter.trim());
    if (questionDiffFilter) params.set("difficulty", questionDiffFilter);
    params.set("status", "published");
    params.set("limit", "60");

    const res = await fetch(`/api/games/trivia/questions?${params.toString()}`);
    if (!res.ok) return;
    const payload = await res.json();
    setQuestionResults(payload.data ?? []);
  };

  const addQuestion = async (questionId: number) => {
    if (!selectedDeck) return;
    if (selectedDeck.items.some((item) => item.question_id === questionId)) {
      alert("That question is already in this deck.");
      return;
    }

    const nextItems = [...selectedDeck.items, {
      id: -Date.now(),
      item_index: selectedDeck.items.length + 1,
      round_number: 1,
      is_tiebreaker: false,
      question_id: questionId,
      snapshot_payload: {},
      locked: false,
    } satisfies DeckItemRow];

    setBusy(true);
    try {
      await applyItems(nextItems);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to add question");
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: number) => {
    if (!selectedDeck) return;
    const nextItems = selectedDeck.items.filter((item) => item.id !== itemId);
    setBusy(true);
    try {
      await applyItems(nextItems);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to remove item");
    } finally {
      setBusy(false);
    }
  };

  const autofillRemaining = async () => {
    if (!selectedDeck) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/games/trivia/decks/${selectedDeck.id}/autofill-simple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          include_recently_used: config.include_recently_used,
          round_count: config.round_count,
          questions_per_round: config.questions_per_round,
          tie_breaker_count: config.tie_breaker_count,
          target_count: config.round_count * config.questions_per_round,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to autofill deck");
      await loadDeck(selectedDeck.id);
      await loadDecks();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to autofill");
    } finally {
      setBusy(false);
    }
  };

  const lockDeck = async () => {
    if (!selectedDeck) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/games/trivia/decks/${selectedDeck.id}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force_refresh_snapshots: false }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to lock deck");
      await loadDeck(selectedDeck.id);
      await loadDecks();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to lock deck");
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const diffBtnClass = (value: string) =>
    questionDiffFilter === value
      ? "border-amber-600 bg-amber-950/40 text-amber-200"
      : "border-stone-700 text-stone-400 hover:text-stone-200";

  const QUICK_TAGS = ["trivia-api", "ai-generated", "tiebreaker"];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,#2f2b0d,transparent_45%),linear-gradient(180deg,#090909,#151515)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">

        <header className="rounded-3xl border border-amber-900/45 bg-black/45 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-amber-300">Deck Builder</p>
              <h1 className="text-3xl font-black uppercase text-amber-100">Build Trivia Decks</h1>
              <p className="mt-1 text-sm text-stone-300">Pick questions, drag to reorder, autofill remaining slots, then lock.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link href="/admin/games/music-trivia" className="rounded border border-stone-700 px-3 py-1">Setup</Link>
              <Link href="/admin/games/music-trivia/bank" className="rounded border border-stone-700 px-3 py-1">Question Bank</Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[320px,1fr]">

          {/* Sidebar: new deck + deck list */}
          <aside className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">New Deck</p>
            <div className="mt-2 space-y-2 text-xs">
              <label className="block">Title
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={newDeckTitle} onChange={(e) => setNewDeckTitle(e.target.value)} />
              </label>
              <label className="block">Playlist Target
                <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={newDeckPlaylistId} onChange={(e) => setNewDeckPlaylistId(e.target.value)}>
                  <option value="">Any playlist</option>
                  {playlistOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="block">Crate Target
                <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={newDeckCrateId} onChange={(e) => setNewDeckCrateId(e.target.value)}>
                  <option value="">Any crate</option>
                  {crateOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <button className="rounded border border-amber-700 px-3 py-1" disabled={busy} onClick={createDeck}>{busy ? "Working..." : "Create Deck"}</button>
            </div>

            <div className="mt-4 border-t border-stone-800 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Decks</p>
                <button className="rounded border border-stone-700 px-2 py-1 text-xs" onClick={loadDecks}>Refresh</button>
              </div>
              <div className="max-h-[60vh] space-y-2 overflow-auto pr-1 text-xs">
                {sortedDecks.map((deck) => (
                  <button key={deck.id} onClick={() => loadDeck(deck.id)}
                    className={`w-full rounded border p-2 text-left ${deck.id === selectedDeckId ? "border-amber-600 bg-amber-950/20" : "border-stone-800 bg-stone-950/70"}`}>
                    <p className="font-semibold text-amber-200">{deck.deck_code}
                      <span className={`ml-2 text-[10px] uppercase ${deck.status === "ready" ? "text-emerald-400" : deck.status === "archived" ? "text-stone-500" : "text-amber-400"}`}>
                        {deck.status}
                      </span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-stone-200">{deck.title}</p>
                    <p className="mt-0.5 text-[11px] text-stone-500">{deck.item_total} items · {deck.item_locked_total} locked</p>
                  </button>
                ))}
                {sortedDecks.length === 0 && <p className="text-stone-500">No decks yet.</p>}
              </div>
            </div>
          </aside>

          {/* Main: deck editor */}
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            {!selectedDeck ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-stone-500">Select a deck from the sidebar to begin building.</p>
              </div>
            ) : (
              <div className="space-y-4">

                {/* Deck header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-200">
                      {selectedDeck.deck_code}
                      <span className={`ml-2 text-xs font-normal ${selectedDeck.status === "ready" ? "text-emerald-400" : selectedDeck.status === "archived" ? "text-stone-500" : "text-amber-400"}`}>
                        {selectedDeck.status}
                      </span>
                    </p>
                    <p className="text-xs text-stone-400">{selectedDeck.locked_at ? `Locked ${new Date(selectedDeck.locked_at).toLocaleString()}` : "Not locked"}</p>
                    <p className="mt-1 text-xs text-stone-300">
                      {requiredMain} main + {config.tie_breaker_count} tie-breaker{config.tie_breaker_count !== 1 ? "s" : ""} = {requiredTotal} total
                      {" · "}
                      <span className={selectedSummary?.missing ? "text-rose-300" : "text-emerald-300"}>
                        {selectedSummary?.total ?? 0} filled{selectedSummary?.missing ? `, ${selectedSummary.missing} missing` : " ✓"}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button className="rounded border border-stone-700 px-3 py-1" disabled={busy} onClick={saveConfig}>Save Config</button>
                    <button className="rounded border border-amber-700 px-3 py-1" disabled={busy} onClick={autofillRemaining}>Autofill Remaining</button>
                    <button className="rounded border border-emerald-700 px-3 py-1" disabled={busy} onClick={lockDeck}>Lock Deck</button>
                  </div>
                </div>

                {/* Config grid */}
                <div className="grid gap-3 text-xs lg:grid-cols-5">
                  <label className="lg:col-span-2">Deck Title
                    <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={selectedDeck.title}
                      onChange={(e) => setSelectedDeck((c) => c ? { ...c, title: e.target.value } : c)} />
                  </label>
                  <label>Playlist Target
                    <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={selectedDeck.playlist_id ?? ""}
                      onChange={(e) => setSelectedDeck((c) => c ? { ...c, playlist_id: e.target.value ? Number(e.target.value) : null } : c)}>
                      <option value="">Any playlist</option>
                      {playlistOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                  <label>Crate Target
                    <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={selectedDeck.crate_id ?? ""}
                      onChange={(e) => setSelectedDeck((c) => c ? { ...c, crate_id: e.target.value ? Number(e.target.value) : null } : c)}>
                      <option value="">Any crate</option>
                      {crateOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label>Rounds
                    <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={1}
                      value={config.round_count}
                      onChange={(e) => setConfig((c) => ({ ...c, round_count: asPositiveInt(e.target.value, c.round_count, 1) }))} />
                  </label>
                  <label>Q / Round
                    <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={1}
                      value={config.questions_per_round}
                      onChange={(e) => setConfig((c) => ({ ...c, questions_per_round: asPositiveInt(e.target.value, c.questions_per_round, 1) }))} />
                  </label>
                  <label>Tie-breakers
                    <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={0}
                      value={config.tie_breaker_count}
                      onChange={(e) => setConfig((c) => ({ ...c, tie_breaker_count: Math.max(0, Number(e.target.value) || 0) }))} />
                  </label>
                  <label>Cooldown Days
                    <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={0}
                      value={config.cooldown_days}
                      onChange={(e) => setConfig((c) => ({ ...c, cooldown_days: Math.max(0, Number(e.target.value) || 0) }))} />
                  </label>
                </div>

                <label className="inline-flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={config.include_recently_used}
                    onChange={(e) => setConfig((c) => ({ ...c, include_recently_used: e.target.checked }))} />
                  Include recently used questions when autofilling
                </label>

                {/* Question picker */}
                <section className="rounded border border-cyan-900/45 bg-cyan-950/10 p-3 text-xs">
                  <p className="font-semibold text-cyan-200">Add Questions From Bank</p>

                  <div className="mt-2 space-y-2">
                    <div className="grid gap-2 lg:grid-cols-[1fr,auto]">
                      <input className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                        value={questionSearch}
                        onChange={(e) => setQuestionSearch(e.target.value)}
                        placeholder="Search by question text or code…"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchQuestions(); } }} />
                      <button className="rounded border border-cyan-700 px-3 py-1" onClick={searchQuestions}>Search</button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Difficulty filter */}
                      <div className="flex gap-1">
                        {["", "easy", "medium", "hard"].map((d) => (
                          <button key={d} onClick={() => setQuestionDiffFilter(d)}
                            className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${diffBtnClass(d)}`}>
                            {d || "Any"}
                          </button>
                        ))}
                      </div>
                      {/* Tag filter */}
                      <div className="flex flex-wrap gap-1">
                        {QUICK_TAGS.map((tag) => (
                          <button key={tag} onClick={() => setQuestionTagFilter(questionTagFilter === tag ? "" : tag)}
                            className={`rounded border px-2 py-0.5 text-[10px] ${questionTagFilter === tag ? "border-fuchsia-600 bg-fuchsia-950/40 text-fuchsia-200" : "border-stone-700 text-stone-400"}`}>
                            {tag}
                          </button>
                        ))}
                        {questionTagFilter && !QUICK_TAGS.includes(questionTagFilter) && (
                          <span className="rounded border border-fuchsia-600 bg-fuchsia-950/40 px-2 py-0.5 text-[10px] text-fuchsia-200">{questionTagFilter}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 max-h-52 space-y-1 overflow-auto pr-1">
                    {questionResults.map((row) => {
                      const alreadyAdded = selectedDeck.items.some((item) => item.question_id === row.id);
                      const diffColor = { easy: "text-emerald-400", medium: "text-amber-400", hard: "text-rose-400" }[row.default_difficulty] ?? "text-stone-400";
                      return (
                        <div key={row.id} className={`flex items-center justify-between rounded border px-2 py-1.5 ${alreadyAdded ? "border-stone-800 bg-stone-950/40 opacity-50" : "border-stone-800 bg-stone-950/70"}`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-mono text-stone-500">{row.question_code}</span>
                              <span className={`text-[10px] font-semibold uppercase ${diffColor}`}>{row.default_difficulty}</span>
                              <span className="text-[10px] text-stone-500">{row.default_category}</span>
                              {row.facets?.has_required_cue && <span className="text-[10px] text-cyan-400">♪</span>}
                              {row.tags?.includes("trivia-api") && <span className="text-[10px] text-fuchsia-400">trivia-api</span>}
                              {row.tags?.includes("ai-generated") && <span className="text-[10px] text-violet-400">ai</span>}
                            </div>
                            <p className="line-clamp-2 text-[11px] text-stone-200 leading-snug">{row.prompt_text}</p>
                          </div>
                          <button
                            className={`ml-2 rounded border px-2 py-1 ${alreadyAdded ? "border-stone-800 text-stone-600 cursor-not-allowed" : "border-cyan-700 text-cyan-300 hover:bg-cyan-950/30"}`}
                            disabled={busy || alreadyAdded}
                            onClick={() => addQuestion(row.id)}
                          >
                            {alreadyAdded ? "✓" : "Add"}
                          </button>
                        </div>
                      );
                    })}
                    {questionResults.length === 0 && (
                      <p className="py-2 text-center text-stone-500">Search for questions above to add them to the deck.</p>
                    )}
                  </div>
                </section>

                {/* Deck items with drag-and-drop */}
                <section className="rounded border border-stone-700 bg-stone-950/40 p-3 text-xs">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-semibold text-stone-200">Deck Items</p>
                    <p className="text-[11px] text-stone-500">Drag rows to reorder</p>
                  </div>

                  {selectedDeck.items.length === 0 ? (
                    <p className="py-4 text-center text-stone-500">No items yet — search above or use Autofill.</p>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={selectedDeck.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-3">
                          {groupedItems.map((group) => (
                            <div key={group.label}>
                              {/* Round header */}
                              <div className={`mb-1.5 flex items-center gap-2 rounded px-2 py-1 ${group.isTie ? "bg-amber-950/30" : "bg-stone-900/60"}`}>
                                <span className={`text-[11px] font-semibold uppercase tracking-wide ${group.isTie ? "text-amber-300" : "text-stone-300"}`}>
                                  {group.label}
                                </span>
                                <span className="text-[10px] text-stone-500">
                                  {group.items.length}
                                  {!group.isTie && ` / ${config.questions_per_round}`}
                                  {!group.isTie && group.items.length < config.questions_per_round && (
                                    <span className="ml-1 text-rose-400">({config.questions_per_round - group.items.length} missing)</span>
                                  )}
                                </span>
                              </div>
                              {/* Round items */}
                              <div className="space-y-1.5">
                                {group.items.map((item) => {
                                  const globalIndex = selectedDeck.items.findIndex((i) => i.id === item.id);
                                  return (
                                    <SortableDeckItem
                                      key={item.id}
                                      item={item}
                                      index={globalIndex}
                                      busy={busy}
                                      onRemove={removeItem}
                                    />
                                  );
                                })}
                                {group.items.length === 0 && (
                                  <p className="py-1 pl-2 text-[11px] text-stone-600 italic">No questions in this round yet.</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </section>

              </div>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}
