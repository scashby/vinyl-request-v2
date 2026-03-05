"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type DeckStatus = "draft" | "ready" | "archived";
type DeckBuildMode = "manual" | "hybrid" | "rule";

type DeckListRow = {
  id: number;
  deck_code: string;
  title: string;
  status: DeckStatus;
  build_mode: DeckBuildMode;
  cooldown_days: number;
  item_total: number;
  item_locked_total: number;
  updated_at: string;
};

type DeckItemRow = {
  id: number;
  item_index: number;
  round_number: number;
  is_tiebreaker: boolean;
  question_id: number | null;
  snapshot_payload: {
    prompt_text?: string;
    question_type?: string;
    category?: string;
    difficulty?: string;
    cue_notes_text?: string | null;
  };
  locked: boolean;
};

type DeckDetail = {
  id: number;
  deck_code: string;
  title: string;
  status: DeckStatus;
  build_mode: DeckBuildMode;
  cooldown_days: number;
  rules_payload: Record<string, unknown>;
  locked_at: string | null;
  items: DeckItemRow[];
};

type QuestionPick = {
  id: number;
  question_code: string;
  prompt_text: string;
  default_category: string;
  default_difficulty: string;
};

type BuildFormState = {
  round_count: number;
  questions_per_round: number;
  tie_breaker_count: number;
  target_count: number;
  cooldown_days: number;
  seed: string;
  include_cooled_down: boolean;
  allow_partial: boolean;
  preserve_existing: boolean;
  categories_text: string;
  tags_text: string;
  difficulties_text: string;
  question_types_text: string;
  max_per_category: number;
  max_per_difficulty: number;
};

const DEFAULT_BUILD_FORM: BuildFormState = {
  round_count: 3,
  questions_per_round: 5,
  tie_breaker_count: 2,
  target_count: 15,
  cooldown_days: 90,
  seed: "",
  include_cooled_down: false,
  allow_partial: false,
  preserve_existing: true,
  categories_text: "",
  tags_text: "",
  difficulties_text: "",
  question_types_text: "",
  max_per_category: 0,
  max_per_difficulty: 0,
};

function fromCsv(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function toNumber(value: string, fallback: number, min = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

export default function MusicTriviaDecksPage() {
  const [decks, setDecks] = useState<DeckListRow[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [selectedDeck, setSelectedDeck] = useState<DeckDetail | null>(null);

  const [newTitle, setNewTitle] = useState("Trivia Deck");
  const [newBuildMode, setNewBuildMode] = useState<DeckBuildMode>("hybrid");
  const [newCooldownDays, setNewCooldownDays] = useState(90);

  const [buildForm, setBuildForm] = useState<BuildFormState>(DEFAULT_BUILD_FORM);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionResults, setQuestionResults] = useState<QuestionPick[]>([]);
  const [manualQuestionIdText, setManualQuestionIdText] = useState("");

  const [busy, setBusy] = useState(false);

  const loadDecks = useCallback(async () => {
    const res = await fetch("/api/games/trivia/decks?limit=200");
    if (!res.ok) return;
    const payload = await res.json();
    setDecks(payload.data ?? []);
  }, []);

  const loadDeck = useCallback(async (id: number) => {
    const res = await fetch(`/api/games/trivia/decks/${id}`);
    if (!res.ok) return;
    const payload = (await res.json()) as DeckDetail;
    setSelectedDeckId(payload.id);
    setSelectedDeck(payload);

    const rules = (payload.rules_payload ?? {}) as Record<string, unknown>;
    const filters = (rules.filters ?? {}) as Record<string, unknown>;
    const diversity = (rules.diversity ?? {}) as Record<string, unknown>;

    const categories = Array.isArray(filters.categories) ? filters.categories : [];
    const tags = Array.isArray(filters.tags) ? filters.tags : [];
    const difficulties = Array.isArray(filters.difficulties) ? filters.difficulties : [];
    const questionTypes = Array.isArray(filters.question_types) ? filters.question_types : [];

    setBuildForm({
      round_count: Number(rules.round_count ?? DEFAULT_BUILD_FORM.round_count),
      questions_per_round: Number(rules.questions_per_round ?? DEFAULT_BUILD_FORM.questions_per_round),
      tie_breaker_count: Number(rules.tie_breaker_count ?? DEFAULT_BUILD_FORM.tie_breaker_count),
      target_count: Number(rules.target_count ?? DEFAULT_BUILD_FORM.target_count),
      cooldown_days: Number(rules.cooldown_days ?? payload.cooldown_days ?? DEFAULT_BUILD_FORM.cooldown_days),
      seed: String(rules.seed ?? ""),
      include_cooled_down: Boolean(rules.include_cooled_down ?? DEFAULT_BUILD_FORM.include_cooled_down),
      allow_partial: Boolean(rules.allow_partial ?? DEFAULT_BUILD_FORM.allow_partial),
      preserve_existing: Boolean(rules.preserve_existing ?? DEFAULT_BUILD_FORM.preserve_existing),
      categories_text: categories.map((entry) => String(entry)).join(", "),
      tags_text: tags.map((entry) => String(entry)).join(", "),
      difficulties_text: difficulties.map((entry) => String(entry)).join(", "),
      question_types_text: questionTypes.map((entry) => String(entry)).join(", "),
      max_per_category: Number(diversity.max_per_category ?? DEFAULT_BUILD_FORM.max_per_category),
      max_per_difficulty: Number(diversity.max_per_difficulty ?? DEFAULT_BUILD_FORM.max_per_difficulty),
    });
  }, []);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  const sortedDecks = useMemo(
    () => [...decks].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [decks]
  );

  const updateBuildField = <K extends keyof BuildFormState>(key: K, value: BuildFormState[K]) => {
    setBuildForm((current) => ({ ...current, [key]: value }));
  };

  const createDeck = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/games/trivia/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim() || "Trivia Deck",
          build_mode: newBuildMode,
          cooldown_days: newCooldownDays,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to create deck");

      await loadDecks();
      if (Number.isFinite(Number(payload.id))) {
        await loadDeck(Number(payload.id));
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create deck");
    } finally {
      setBusy(false);
    }
  };

  const saveDeckMeta = async () => {
    if (!selectedDeck) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/games/trivia/decks/${selectedDeck.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedDeck.title,
          status: selectedDeck.status,
          build_mode: selectedDeck.build_mode,
          cooldown_days: selectedDeck.cooldown_days,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to save deck");

      await loadDecks();
      await loadDeck(selectedDeck.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save deck");
    } finally {
      setBusy(false);
    }
  };

  const applyItems = async (items: DeckItemRow[]) => {
    if (!selectedDeck) return;

    const payloadItems = items.map((item, index) => {
      const payloadItem: {
        item_index: number;
        round_number: number;
        is_tiebreaker: boolean;
        question_id: number | null;
        snapshot_payload?: DeckItemRow["snapshot_payload"];
      } = {
        item_index: index + 1,
        round_number: item.round_number,
        is_tiebreaker: item.is_tiebreaker,
        question_id: item.question_id,
      };

      const hasSnapshotCore =
        typeof item.snapshot_payload?.prompt_text === "string" &&
        item.snapshot_payload.prompt_text.trim().length > 0 &&
        typeof item.snapshot_payload?.question_type === "string";
      if (!item.question_id || hasSnapshotCore) {
        payloadItem.snapshot_payload = item.snapshot_payload;
      }
      return payloadItem;
    });

    const res = await fetch(`/api/games/trivia/decks/${selectedDeck.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replace_items: true,
        items: payloadItems,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error ?? "Failed to update deck items");

    await loadDeck(selectedDeck.id);
    await loadDecks();
  };

  const removeItem = async (itemId: number) => {
    if (!selectedDeck) return;

    const next = selectedDeck.items.filter((item) => item.id !== itemId);
    setBusy(true);
    try {
      await applyItems(next);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to remove item");
    } finally {
      setBusy(false);
    }
  };

  const moveItem = async (itemId: number, direction: -1 | 1) => {
    if (!selectedDeck) return;

    const current = [...selectedDeck.items];
    const index = current.findIndex((item) => item.id === itemId);
    if (index < 0) return;

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= current.length) return;

    [current[index], current[nextIndex]] = [current[nextIndex], current[index]];

    setBusy(true);
    try {
      await applyItems(current);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to reorder item");
    } finally {
      setBusy(false);
    }
  };

  const addManualByQuestionId = async (questionId: number) => {
    if (!selectedDeck) return;

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
      setManualQuestionIdText("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to add manual question");
    } finally {
      setBusy(false);
    }
  };

  const searchQuestions = async () => {
    const params = new URLSearchParams();
    if (questionSearch.trim()) params.set("q", questionSearch.trim());
    params.set("status", "published");
    params.set("limit", "40");

    const res = await fetch(`/api/games/trivia/questions?${params.toString()}`);
    if (!res.ok) return;
    const payload = await res.json();
    setQuestionResults(payload.data ?? []);
  };

  const buildDeck = async () => {
    if (!selectedDeck) return;

    setBusy(true);
    try {
      const body = {
        round_count: buildForm.round_count,
        questions_per_round: buildForm.questions_per_round,
        tie_breaker_count: buildForm.tie_breaker_count,
        target_count: buildForm.target_count,
        cooldown_days: buildForm.cooldown_days,
        seed: buildForm.seed,
        include_cooled_down: buildForm.include_cooled_down,
        allow_partial: buildForm.allow_partial,
        preserve_existing: buildForm.preserve_existing,
        filters: {
          categories: fromCsv(buildForm.categories_text),
          tags: fromCsv(buildForm.tags_text),
          difficulties: fromCsv(buildForm.difficulties_text),
          question_types: fromCsv(buildForm.question_types_text),
        },
        diversity: {
          max_per_category: buildForm.max_per_category,
          max_per_difficulty: buildForm.max_per_difficulty,
        },
      };

      const res = await fetch(`/api/games/trivia/decks/${selectedDeck.id}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const deficit = payload.deficit_report as Record<string, unknown> | undefined;
        if (deficit) {
          const shortfall = Number(deficit.shortfall_total ?? 0);
          const cooled = Number(deficit.cooled_down_available ?? 0);
          throw new Error(`Build shortfall: ${shortfall}. Cooled-down available: ${cooled}. Re-run with include cooled-down.`);
        }
        throw new Error(payload.error ?? "Failed to build deck");
      }

      await loadDeck(selectedDeck.id);
      await loadDecks();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to build deck");
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

  const selectedSummary = useMemo(() => {
    if (!selectedDeck) return null;
    const total = selectedDeck.items.length;
    const tie = selectedDeck.items.filter((item) => item.is_tiebreaker).length;
    const locked = selectedDeck.items.filter((item) => item.locked).length;
    return { total, tie, locked };
  }, [selectedDeck]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,#2f2b0d,transparent_45%),linear-gradient(180deg,#090909,#151515)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-amber-900/45 bg-black/45 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-amber-300">Trivia Decks</p>
              <h1 className="text-3xl font-black uppercase text-amber-100">Deck Builder</h1>
              <p className="mt-1 text-sm text-stone-300">Build immutable snapshot decks using manual picks + cooldown-aware rule fill.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link href="/admin/games/music-trivia" className="rounded border border-stone-700 px-3 py-1">Setup</Link>
              <Link href="/admin/games/music-trivia/bank" className="rounded border border-stone-700 px-3 py-1">Question Bank</Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[340px,1fr]">
          <aside className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Create Deck</p>
            <div className="mt-2 space-y-2 text-xs">
              <label className="block">
                Title
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </label>
              <label className="block">
                Build Mode
                <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={newBuildMode} onChange={(e) => setNewBuildMode((e.target.value as DeckBuildMode) ?? "hybrid")}>
                  <option value="manual">manual</option>
                  <option value="hybrid">hybrid</option>
                  <option value="rule">rule</option>
                </select>
              </label>
              <label className="block">
                Cooldown Days
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={0} value={newCooldownDays} onChange={(e) => setNewCooldownDays(toNumber(e.target.value, 90, 0))} />
              </label>
              <button className="rounded border border-amber-700 px-3 py-1" onClick={createDeck} disabled={busy}>{busy ? "Working..." : "Create"}</button>
            </div>

            <div className="mt-4 border-t border-stone-800 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Decks</p>
                <button className="rounded border border-stone-700 px-2 py-1 text-xs" onClick={loadDecks}>Refresh</button>
              </div>
              <div className="max-h-[60vh] space-y-2 overflow-auto pr-1 text-xs">
                {sortedDecks.map((deck) => (
                  <button
                    key={deck.id}
                    onClick={() => loadDeck(deck.id)}
                    className={`w-full rounded border p-2 text-left ${deck.id === selectedDeckId ? "border-amber-600 bg-amber-950/20" : "border-stone-800 bg-stone-950/70"}`}
                  >
                    <p className="font-semibold text-amber-200">{deck.deck_code} · {deck.status}</p>
                    <p className="mt-1 line-clamp-2 text-stone-200">{deck.title}</p>
                    <p className="mt-1 text-[11px] text-stone-500">{deck.item_total} items · {deck.item_locked_total} locked</p>
                  </button>
                ))}
                {sortedDecks.length === 0 ? <p className="text-stone-500">No decks yet.</p> : null}
              </div>
            </div>
          </aside>

          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            {!selectedDeck ? (
              <p className="text-sm text-stone-400">Select a deck to edit build rules and items.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-200">{selectedDeck.deck_code} · {selectedDeck.status}</p>
                    <p className="text-xs text-stone-400">{selectedDeck.locked_at ? `Locked at ${new Date(selectedDeck.locked_at).toLocaleString()}` : "Not locked"}</p>
                    <p className="mt-1 text-xs text-stone-300">Items: {selectedSummary?.total ?? 0} · Tie-breakers: {selectedSummary?.tie ?? 0} · Locked Items: {selectedSummary?.locked ?? 0}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button className="rounded border border-stone-700 px-3 py-1" onClick={saveDeckMeta} disabled={busy}>Save Meta</button>
                    <button className="rounded border border-amber-700 px-3 py-1" onClick={buildDeck} disabled={busy}>Build / Fill</button>
                    <button className="rounded border border-emerald-700 px-3 py-1" onClick={lockDeck} disabled={busy}>Lock Snapshot</button>
                  </div>
                </div>

                <div className="grid gap-3 text-xs lg:grid-cols-3">
                  <label className="block">
                    Deck Title
                    <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={selectedDeck.title} onChange={(e) => setSelectedDeck((current) => current ? { ...current, title: e.target.value } : current)} />
                  </label>
                  <label className="block">
                    Status
                    <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={selectedDeck.status} onChange={(e) => setSelectedDeck((current) => current ? { ...current, status: (e.target.value as DeckStatus) ?? "draft" } : current)}>
                      <option value="draft">draft</option>
                      <option value="ready">ready</option>
                      <option value="archived">archived</option>
                    </select>
                  </label>
                  <label className="block">
                    Build Mode
                    <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={selectedDeck.build_mode} onChange={(e) => setSelectedDeck((current) => current ? { ...current, build_mode: (e.target.value as DeckBuildMode) ?? "hybrid" } : current)}>
                      <option value="manual">manual</option>
                      <option value="hybrid">hybrid</option>
                      <option value="rule">rule</option>
                    </select>
                  </label>
                </div>

                <section className="rounded border border-amber-900/45 bg-amber-950/10 p-3 text-xs">
                  <p className="font-semibold text-amber-200">Build Rules</p>
                  <div className="mt-2 grid gap-2 lg:grid-cols-4">
                    <label className="block">Rounds
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={1} value={buildForm.round_count} onChange={(e) => updateBuildField("round_count", toNumber(e.target.value, buildForm.round_count, 1))} />
                    </label>
                    <label className="block">Q / Round
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={1} value={buildForm.questions_per_round} onChange={(e) => updateBuildField("questions_per_round", toNumber(e.target.value, buildForm.questions_per_round, 1))} />
                    </label>
                    <label className="block">Tie-breakers
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={0} value={buildForm.tie_breaker_count} onChange={(e) => updateBuildField("tie_breaker_count", toNumber(e.target.value, buildForm.tie_breaker_count, 0))} />
                    </label>
                    <label className="block">Main Target
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={1} value={buildForm.target_count} onChange={(e) => updateBuildField("target_count", toNumber(e.target.value, buildForm.target_count, 1))} />
                    </label>
                    <label className="block">Cooldown Days
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={0} value={buildForm.cooldown_days} onChange={(e) => updateBuildField("cooldown_days", toNumber(e.target.value, buildForm.cooldown_days, 0))} />
                    </label>
                    <label className="block">Seed (optional)
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={buildForm.seed} onChange={(e) => updateBuildField("seed", e.target.value)} />
                    </label>
                    <label className="block">Max / Category
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={0} value={buildForm.max_per_category} onChange={(e) => updateBuildField("max_per_category", toNumber(e.target.value, buildForm.max_per_category, 0))} />
                    </label>
                    <label className="block">Max / Difficulty
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={0} value={buildForm.max_per_difficulty} onChange={(e) => updateBuildField("max_per_difficulty", toNumber(e.target.value, buildForm.max_per_difficulty, 0))} />
                    </label>
                  </div>

                  <div className="mt-2 grid gap-2 lg:grid-cols-2">
                    <label className="block">Categories (comma)
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={buildForm.categories_text} onChange={(e) => updateBuildField("categories_text", e.target.value)} />
                    </label>
                    <label className="block">Tags (comma)
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={buildForm.tags_text} onChange={(e) => updateBuildField("tags_text", e.target.value)} />
                    </label>
                    <label className="block">Difficulties (comma)
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={buildForm.difficulties_text} onChange={(e) => updateBuildField("difficulties_text", e.target.value)} placeholder="easy, medium" />
                    </label>
                    <label className="block">Question Types (comma)
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={buildForm.question_types_text} onChange={(e) => updateBuildField("question_types_text", e.target.value)} placeholder="free_response, multiple_choice" />
                    </label>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={buildForm.preserve_existing} onChange={(e) => updateBuildField("preserve_existing", e.target.checked)} />
                      Preserve existing items
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={buildForm.include_cooled_down} onChange={(e) => updateBuildField("include_cooled_down", e.target.checked)} />
                      Include cooled-down questions
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={buildForm.allow_partial} onChange={(e) => updateBuildField("allow_partial", e.target.checked)} />
                      Allow partial build
                    </label>
                  </div>
                </section>

                <section className="rounded border border-cyan-900/45 bg-cyan-950/10 p-3 text-xs">
                  <p className="font-semibold text-cyan-200">Manual Picks</p>
                  <div className="mt-2 grid gap-2 lg:grid-cols-[180px,auto]">
                    <label className="block">
                      Add by Question ID
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={manualQuestionIdText} onChange={(e) => setManualQuestionIdText(e.target.value)} placeholder="123" />
                    </label>
                    <div className="pt-5">
                      <button className="rounded border border-cyan-700 px-3 py-1" disabled={busy} onClick={() => {
                        const id = Number(manualQuestionIdText);
                        if (!Number.isFinite(id) || id <= 0) {
                          alert("Enter a valid question id.");
                          return;
                        }
                        addManualByQuestionId(Math.floor(id));
                      }}>Add</button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 lg:grid-cols-[1fr,auto]">
                    <input className="rounded border border-stone-700 bg-stone-950 px-2 py-1" value={questionSearch} onChange={(e) => setQuestionSearch(e.target.value)} placeholder="Search published questions" />
                    <button className="rounded border border-stone-700 px-3 py-1" onClick={searchQuestions}>Search</button>
                  </div>

                  <div className="mt-2 max-h-48 space-y-1 overflow-auto pr-1">
                    {questionResults.map((row) => (
                      <div key={row.id} className="flex items-center justify-between rounded border border-stone-800 bg-stone-950/70 px-2 py-1">
                        <div>
                          <p className="text-stone-200">{row.question_code} · {row.default_category} · {row.default_difficulty}</p>
                          <p className="line-clamp-1 text-[11px] text-stone-500">{row.prompt_text}</p>
                        </div>
                        <button className="rounded border border-cyan-700 px-2 py-1" onClick={() => addManualByQuestionId(row.id)}>Add</button>
                      </div>
                    ))}
                    {questionResults.length === 0 ? <p className="text-stone-500">No search results loaded.</p> : null}
                  </div>
                </section>

                <section className="rounded border border-stone-700 bg-stone-950/40 p-3 text-xs">
                  <p className="font-semibold text-stone-200">Deck Items</p>
                  <div className="mt-2 max-h-[45vh] space-y-2 overflow-auto pr-1">
                    {selectedDeck.items.map((item, index) => (
                      <div key={item.id} className="rounded border border-stone-800 bg-stone-950/70 p-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-amber-200">#{index + 1} · {item.is_tiebreaker ? "Tie-Breaker" : `Round ${item.round_number}`}</p>
                            <p className="mt-1 text-stone-200">{item.snapshot_payload.prompt_text ?? "(snapshot missing prompt)"}</p>
                            <p className="mt-1 text-[11px] text-stone-500">
                              QID: {item.question_id ?? "custom"} · {item.snapshot_payload.category ?? "-"} · {String(item.snapshot_payload.difficulty ?? "-").toUpperCase()} · {item.snapshot_payload.question_type ?? "free_response"}
                            </p>
                            {item.snapshot_payload.cue_notes_text ? <p className="mt-1 text-[11px] text-cyan-300">Cue: {item.snapshot_payload.cue_notes_text}</p> : null}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <button className="rounded border border-stone-700 px-2 py-1" onClick={() => moveItem(item.id, -1)} disabled={busy}>Up</button>
                            <button className="rounded border border-stone-700 px-2 py-1" onClick={() => moveItem(item.id, 1)} disabled={busy}>Down</button>
                            <button className="rounded border border-red-700 px-2 py-1" onClick={() => removeItem(item.id)} disabled={busy}>Remove</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {selectedDeck.items.length === 0 ? <p className="text-stone-500">No items in deck yet.</p> : null}
                  </div>
                </section>
              </div>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}
