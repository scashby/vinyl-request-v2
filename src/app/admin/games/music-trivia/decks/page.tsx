"use client";

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

type PlaylistOption = {
  id: number;
  name: string;
};
type CrateOption = {
  id: number;
  name: string;
};

type DeckItemRow = {
  id: number;
  item_index: number;
  round_number: number;
  is_tiebreaker: boolean;
  question_id: number | null;
  snapshot_payload: {
    prompt_text?: string;
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
  default_category: string;
  default_difficulty: string;
  facets: {
    has_required_cue?: boolean;
  } | null;
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
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionResults, setQuestionResults] = useState<QuestionPick[]>([]);
  const [playlistOptions, setPlaylistOptions] = useState<PlaylistOption[]>([]);
  const [crateOptions, setCrateOptions] = useState<CrateOption[]>([]);

  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  useEffect(() => {
    loadPlaylists();
    loadCrates();
  }, [loadPlaylists, loadCrates]);

  const requiredMain = config.round_count * config.questions_per_round;
  const requiredTotal = requiredMain + config.tie_breaker_count;

  const selectedSummary = useMemo(() => {
    if (!selectedDeck) return null;
    const total = selectedDeck.items.length;
    const tie = selectedDeck.items.filter((item) => item.is_tiebreaker).length;
    return {
      total,
      tie,
      missing: Math.max(0, requiredTotal - total),
    };
  }, [requiredTotal, selectedDeck]);

  const sortedDecks = useMemo(
    () => [...decks].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [decks]
  );

  const applyItems = useCallback(async (items: DeckItemRow[]) => {
    if (!selectedDeck) return;

    const normalizedItems = items.map((item, index) => {
      const itemIndex = index + 1;
      const isTieBreaker = itemIndex > requiredMain;
      const roundNumber = isTieBreaker ? (config.round_count + 1) : (Math.floor((itemIndex - 1) / config.questions_per_round) + 1);

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
      body: JSON.stringify({
        replace_items: true,
        items: normalizedItems,
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error ?? "Failed to save deck items");

    await loadDeck(selectedDeck.id);
    await loadDecks();
  }, [config.questions_per_round, config.round_count, loadDeck, loadDecks, requiredMain, selectedDeck]);

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
            filters: {
              statuses: ["published"],
              has_required_cue: true,
            },
          },
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
            filters: {
              statuses: ["published"],
              has_required_cue: true,
            },
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
    params.set("status", "published");
    params.set("has_required_cue", "true");
    params.set("limit", "60");

    const res = await fetch(`/api/games/trivia/questions?${params.toString()}`);
    if (!res.ok) return;

    const payload = await res.json();
    setQuestionResults(payload.data ?? []);
  };

  const addQuestion = async (questionId: number) => {
    if (!selectedDeck) return;

    const exists = selectedDeck.items.some((item) => item.question_id === questionId);
    if (exists) {
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
      alert(error instanceof Error ? error.message : "Failed to reorder deck");
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,#2f2b0d,transparent_45%),linear-gradient(180deg,#090909,#151515)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-amber-900/45 bg-black/45 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-amber-300">Deck Builder</p>
              <h1 className="text-3xl font-black uppercase text-amber-100">Build Trivia Decks</h1>
              <p className="mt-1 text-sm text-stone-300">Pick questions from the bank, reorder, autofill remaining slots, then lock.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link href="/admin/games/music-trivia" className="rounded border border-stone-700 px-3 py-1">Setup</Link>
              <Link href="/admin/games/music-trivia/bank" className="rounded border border-stone-700 px-3 py-1">Question Bank</Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[320px,1fr]">
          <aside className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">New Deck</p>
            <div className="mt-2 space-y-2 text-xs">
              <label className="block">Title
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={newDeckTitle} onChange={(e) => setNewDeckTitle(e.target.value)} />
              </label>
              <label className="block">Playlist Target
                <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={newDeckPlaylistId} onChange={(e) => setNewDeckPlaylistId(e.target.value)}>
                  <option value="">Any playlist</option>
                  {playlistOptions.map((playlist) => (
                    <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">Crate Target
                <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={newDeckCrateId} onChange={(e) => setNewDeckCrateId(e.target.value)}>
                  <option value="">Any crate</option>
                  {crateOptions.map((crate) => (
                    <option key={crate.id} value={crate.id}>{crate.name}</option>
                  ))}
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
                  <button key={deck.id} onClick={() => loadDeck(deck.id)} className={`w-full rounded border p-2 text-left ${deck.id === selectedDeckId ? "border-amber-600 bg-amber-950/20" : "border-stone-800 bg-stone-950/70"}`}>
                    <p className="font-semibold text-amber-200">{deck.deck_code} - {deck.status}</p>
                    <p className="mt-1 line-clamp-2 text-stone-200">{deck.title}</p>
                    <p className="mt-1 text-[11px] text-stone-500">{deck.item_total} items - {deck.item_locked_total} locked</p>
                  </button>
                ))}
                {sortedDecks.length === 0 ? <p className="text-stone-500">No decks yet.</p> : null}
              </div>
            </div>
          </aside>

          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            {!selectedDeck ? (
              <p className="text-sm text-stone-400">Select a deck to build.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-200">{selectedDeck.deck_code} - {selectedDeck.status}</p>
                    <p className="text-xs text-stone-400">{selectedDeck.locked_at ? `Locked at ${new Date(selectedDeck.locked_at).toLocaleString()}` : "Not locked"}</p>
                    <p className="mt-1 text-xs text-stone-300">
                      Required: {requiredTotal} ({requiredMain} main + {config.tie_breaker_count} tie-breakers) - Filled: {selectedSummary?.total ?? 0} - Missing: {selectedSummary?.missing ?? 0}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button className="rounded border border-stone-700 px-3 py-1" disabled={busy} onClick={saveConfig}>Save Config</button>
                    <button className="rounded border border-amber-700 px-3 py-1" disabled={busy} onClick={autofillRemaining}>Autofill Remaining</button>
                    <button className="rounded border border-emerald-700 px-3 py-1" disabled={busy} onClick={lockDeck}>Lock Deck</button>
                  </div>
                </div>

                <div className="grid gap-3 text-xs lg:grid-cols-5">
                  <label>Deck Title
                    <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={selectedDeck.title} onChange={(e) => setSelectedDeck((current) => current ? { ...current, title: e.target.value } : current)} />
                  </label>
                  <label>Playlist Target
                    <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={selectedDeck.playlist_id ?? ""} onChange={(e) => setSelectedDeck((current) => current ? { ...current, playlist_id: e.target.value ? Number(e.target.value) : null } : current)}>
                      <option value="">Any playlist</option>
                      {playlistOptions.map((playlist) => (
                        <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>Crate Target
                    <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={selectedDeck.crate_id ?? ""} onChange={(e) => setSelectedDeck((current) => current ? { ...current, crate_id: e.target.value ? Number(e.target.value) : null } : current)}>
                      <option value="">Any crate</option>
                      {crateOptions.map((crate) => (
                        <option key={crate.id} value={crate.id}>{crate.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>Rounds
                    <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={1} value={config.round_count} onChange={(e) => setConfig((current) => ({ ...current, round_count: asPositiveInt(e.target.value, current.round_count, 1) }))} />
                  </label>
                  <label>Q / Round
                    <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={1} value={config.questions_per_round} onChange={(e) => setConfig((current) => ({ ...current, questions_per_round: asPositiveInt(e.target.value, current.questions_per_round, 1) }))} />
                  </label>
                  <label>Tie-breakers
                    <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={0} value={config.tie_breaker_count} onChange={(e) => setConfig((current) => ({ ...current, tie_breaker_count: Math.max(0, Number(e.target.value) || 0) }))} />
                  </label>
                  <label>Cooldown Days
                    <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" type="number" min={0} value={config.cooldown_days} onChange={(e) => setConfig((current) => ({ ...current, cooldown_days: Math.max(0, Number(e.target.value) || 0) }))} />
                  </label>
                </div>

                <label className="inline-flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={config.include_recently_used} onChange={(e) => setConfig((current) => ({ ...current, include_recently_used: e.target.checked }))} />
                  Include recently used questions when autofilling
                </label>

                <section className="rounded border border-cyan-900/45 bg-cyan-950/10 p-3 text-xs">
                  <p className="font-semibold text-cyan-200">Add Questions From Bank</p>
                  <div className="mt-2 grid gap-2 lg:grid-cols-[1fr,auto]">
                    <input className="rounded border border-stone-700 bg-stone-950 px-2 py-1" value={questionSearch} onChange={(e) => setQuestionSearch(e.target.value)} placeholder="Search published cue-ready questions" onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        searchQuestions();
                      }
                    }} />
                    <button className="rounded border border-cyan-700 px-3 py-1" onClick={searchQuestions}>Search</button>
                  </div>

                  <div className="mt-2 max-h-48 space-y-1 overflow-auto pr-1">
                    {questionResults.map((row) => (
                      <div key={row.id} className="flex items-center justify-between rounded border border-stone-800 bg-stone-950/70 px-2 py-1">
                        <div>
                          <p className="text-stone-200">{row.question_code} - {row.default_category} - {row.default_difficulty}</p>
                          <p className="line-clamp-1 text-[11px] text-stone-500">{row.prompt_text}</p>
                        </div>
                        <button className="rounded border border-cyan-700 px-2 py-1" onClick={() => addQuestion(row.id)}>Add</button>
                      </div>
                    ))}
                    {questionResults.length === 0 ? <p className="text-stone-500">No results yet.</p> : null}
                  </div>
                </section>

                <section className="rounded border border-stone-700 bg-stone-950/40 p-3 text-xs">
                  <p className="font-semibold text-stone-200">Deck Items</p>
                  <div className="mt-2 max-h-[45vh] space-y-2 overflow-auto pr-1">
                    {selectedDeck.items.map((item, index) => (
                      <div key={item.id} className="rounded border border-stone-800 bg-stone-950/70 p-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-amber-200">#{index + 1} - {item.is_tiebreaker ? "Tie-breaker" : `Round ${item.round_number}`}</p>
                            <p className="mt-1 text-stone-200">{item.snapshot_payload.prompt_text ?? "(snapshot missing prompt)"}</p>
                            <p className="mt-1 text-[11px] text-stone-500">QID: {item.question_id ?? "custom"} - {item.snapshot_payload.category ?? "-"} - {String(item.snapshot_payload.difficulty ?? "-").toUpperCase()}</p>
                            {item.snapshot_payload.cue_notes_text ? <p className="mt-1 text-[11px] text-cyan-300">Cue: {item.snapshot_payload.cue_notes_text}</p> : null}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <button className="rounded border border-stone-700 px-2 py-1" disabled={busy} onClick={() => moveItem(item.id, -1)}>Up</button>
                            <button className="rounded border border-stone-700 px-2 py-1" disabled={busy} onClick={() => moveItem(item.id, 1)}>Down</button>
                            <button className="rounded border border-red-700 px-2 py-1" disabled={busy} onClick={() => removeItem(item.id)}>Remove</button>
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
