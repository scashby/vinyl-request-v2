"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlaylistOption = { id: number; name: string; track_count: number };
type CrateOption = { id: number; name: string };

type ScopeType =
  | "collection"
  | "playlist"
  | "crate"
  | "artist"
  | "album"
  | "format"
  | "decade"
  | "genre";

type TriviaFact = {
  id: number;
  fact_code: string;
  entity_type: string;
  entity_ref: string;
  fact_text: string;
  fact_kind: string;
  status: "draft" | "approved" | "archived";
  confidence: string;
  trivia_source_records?: { source_url?: string | null; source_title?: string | null; source_domain?: string | null } | null;
};

type FetchResult = { run_id: number; facts_fetched: number; entities_processed: number; skipped_duplicates: number; api_errors?: string[] };
type GenerateResult = { generated_count: number; facts_processed: number; question_ids: number[] };

// Classic template generator types (legacy mode)
type SampleQuestion = {
  category: string; question_type: string; prompt_text: string;
  answer_key: string; options_payload: string[]; tags: string[];
};
type PreviewResult = {
  mode: "dry-run" | "apply"; source: string; sourceLabel: string;
  trackCount: number; questionCount: number; questions: SampleQuestion[]; insertedCount?: number;
};

const FACT_KIND_LABELS: Record<string, string> = {
  bio: "Bio", recording_context: "Recording", chart_fact: "Chart",
  production_note: "Production", cultural_context: "Cultural", critical_reception: "Review",
  name_origin: "Name Origin", connection: "Connection", pre_fame: "Pre-Fame",
  collaboration: "Collab", personal: "Personal", song_history: "Song History",
  band_history: "Band History", unusual_skill: "Unusual Skill", other: "Other",
};
const ENTITY_TYPE_LABELS: Record<string, string> = {
  artist: "Artist", master: "Album", recording: "Track", label: "Label",
};
const FORMAT_OPTIONS = ["Vinyl", '12"', '10"', '7"', "CD", "Cassette"];
const DECADE_OPTIONS = ["1950s","1960s","1970s","1980s","1990s","2000s","2010s","2020s"];

// ---------------------------------------------------------------------------
// Typeahead search component for artists and albums
// ---------------------------------------------------------------------------

type SearchResult = { id: number; label: string };

function EntitySearch({
  apiPath,
  placeholder,
  onSelect,
  selectedLabel,
}: {
  apiPath: string;
  placeholder: string;
  onSelect: (id: number, label: string) => void;
  selectedLabel: string;
}) {
  const [query, setQuery] = useState(selectedLabel);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync display when parent resets selection
  useEffect(() => { setQuery(selectedLabel); }, [selectedLabel]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleChange(val: string) {
    setQuery(val);
    if (timer.current) clearTimeout(timer.current);
    if (val.length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${apiPath}?q=${encodeURIComponent(val)}`);
        const json = await res.json();
        setResults(json.data ?? []);
        setOpen(true);
      } catch { setResults([]); }
    }, 250);
  }

  function handleSelect(r: SearchResult) {
    setQuery(r.label);
    setOpen(false);
    setResults([]);
    onSelect(r.id, r.label);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        placeholder={placeholder}
        className="w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder-stone-500"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded border border-stone-700 bg-stone-900 shadow-xl">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseDown={() => handleSelect(r)}
                className="w-full px-3 py-2 text-left text-sm text-stone-200 hover:bg-stone-700"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="inline-block h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GenerateTriviaPage() {
  const [mode, setMode] = useState<"api" | "wizard" | "classic">("api");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#0f2d3a,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-3xl border border-cyan-900/40 bg-black/45 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Music Trivia</p>
          <h1 className="mt-1 text-3xl font-black uppercase text-cyan-100">Generate Questions</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Link href="/admin/games/music-trivia" className="rounded border border-stone-700 px-3 py-1">← Setup</Link>
            <Link href="/admin/games/music-trivia/facts" className="rounded border border-stone-700 px-3 py-1">Fact Library</Link>
            <Link href="/admin/games/music-trivia/bank" className="rounded border border-stone-700 px-3 py-1">Question Bank</Link>
            <Link href="/admin/games/music-trivia/decks" className="rounded border border-stone-700 px-3 py-1">Deck Builder</Link>
          </div>
          <div className="mt-4 flex gap-2 text-xs">
            <button onClick={() => setMode("api")} className={`rounded px-3 py-1 ${mode === "api" ? "bg-cyan-800 text-cyan-100" : "border border-stone-700 text-stone-400 hover:text-stone-200"}`}>
              Trivia API Import
            </button>
            <button onClick={() => setMode("wizard")} className={`rounded px-3 py-1 ${mode === "wizard" ? "bg-fuchsia-800 text-fuchsia-100" : "border border-stone-700 text-stone-400 hover:text-stone-200"}`}>
              AI Fact Generator
            </button>
            <button onClick={() => setMode("classic")} className={`rounded px-3 py-1 ${mode === "classic" ? "bg-stone-700 text-stone-100" : "border border-stone-700 text-stone-400 hover:text-stone-200"}`}>
              Classic Templates
            </button>
          </div>
        </header>

        {mode === "api" ? <TriviaApiMode /> : mode === "wizard" ? <WizardMode /> : <ClassicMode />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trivia API Import Mode — pulls real curated trivia from the-trivia-api.com
// ---------------------------------------------------------------------------

type ApiImportResult = { imported: number; skipped: number; total_fetched: number; message: string };

function TriviaApiMode() {
  const [scopeType, setScopeType] = useState<"collection" | "decade" | "genre">("collection");
  const [scopeValue, setScopeValue] = useState("");
  const [difficulties, setDifficulties] = useState<string[]>(["easy", "medium", "hard"]);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiImportResult | null>(null);
  const [error, setError] = useState("");

  function toggleDifficulty(d: string) {
    setDifficulties((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  async function handleImport() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const body: Record<string, unknown> = { limit, created_by: "trivia-api-import" };
      if (difficulties.length < 3) body.difficulties = difficulties;
      if (scopeType !== "collection" && scopeValue.trim()) {
        body.scope_type = scopeType;
        body.scope_value = scopeValue.trim();
      }
      const res = await fetch("/api/games/trivia/import-trivia-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Import failed"); return; }
      setResult(json as ApiImportResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-cyan-900/40 bg-black/45 p-5 space-y-5">
      <div>
        <h2 className="text-lg font-black uppercase text-cyan-100">Trivia API Import</h2>
        <p className="mt-1 text-xs text-stone-400">
          Pulls real curated music trivia questions from{" "}
          <span className="text-stone-300">the-trivia-api.com</span> — already formatted with
          correct answer + 3 wrong options. Questions land in the Question Bank as drafts for review.
        </p>
      </div>

      {/* Scope */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Filter by</p>
        <div className="flex gap-2 text-xs">
          {(["collection", "decade", "genre"] as const).map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-1.5 rounded border border-stone-700 px-2 py-1.5 capitalize hover:border-cyan-700">
              <input type="radio" name="api-scope" checked={scopeType === s} onChange={() => { setScopeType(s); setScopeValue(""); }} className="accent-cyan-400" />
              {s === "collection" ? "All Music" : s}
            </label>
          ))}
        </div>

        {scopeType === "decade" && (
          <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className="mt-2 rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-200">
            <option value="">— Select decade —</option>
            {DECADE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {scopeType === "genre" && (
          <input type="text" value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} placeholder="e.g. Rock, Pop, Hip Hop" className="mt-2 rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-200 placeholder-stone-500 w-64" />
        )}
      </div>

      {/* Difficulty */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Difficulty</p>
        <div className="flex gap-2 text-xs">
          {["easy", "medium", "hard"].map((d) => (
            <label key={d} className="flex cursor-pointer items-center gap-1.5 rounded border border-stone-700 px-2 py-1.5 capitalize hover:border-cyan-700">
              <input type="checkbox" checked={difficulties.includes(d)} onChange={() => toggleDifficulty(d)} className="accent-cyan-400" />
              {d}
            </label>
          ))}
        </div>
      </div>

      {/* Limit */}
      <div>
        <label className="text-xs font-semibold text-stone-400">
          Questions to import <span className="font-normal text-stone-500">(fetched in batches of 50)</span>
        </label>
        <input type="number" min={1} max={500} value={limit} onChange={(e) => setLimit(Math.max(1, Math.min(500, Number(e.target.value) || 50)))} className="mt-1 w-24 rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-200" />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/30 p-4 space-y-2">
          <p className="text-sm font-semibold text-emerald-300">{result.message}</p>
          <div className="flex gap-4 text-xs text-stone-400">
            <span>Fetched: <strong className="text-stone-200">{result.total_fetched}</strong></span>
            <span>New: <strong className="text-emerald-300">{result.imported}</strong></span>
            <span>Already existed: <strong className="text-stone-400">{result.skipped}</strong></span>
          </div>
          <Link href="/admin/games/music-trivia/bank?tag=trivia-api" className="inline-block text-xs text-cyan-400 underline hover:text-cyan-200">
            Review imported questions in Question Bank →
          </Link>
        </div>
      )}

      <button
        onClick={handleImport}
        disabled={loading || difficulties.length === 0 || (scopeType !== "collection" && !scopeValue.trim())}
        className="rounded border border-cyan-700 bg-cyan-900/30 px-5 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-900/60 disabled:opacity-50"
      >
        {loading ? <><Spinner /> Importing…</> : "Import Questions →"}
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Wizard Mode — 4-step AI-powered generator
// ---------------------------------------------------------------------------

function WizardMode() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 state
  const [scopeType, setScopeType] = useState<ScopeType>("collection");
  const [scopeRefId, setScopeRefId] = useState<number | null>(null);
  const [scopeValue, setScopeValue] = useState("");
  const [entityLimit, setEntityLimit] = useState(20);
  const [selectedEntityLabel, setSelectedEntityLabel] = useState("");
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [crates, setCrates] = useState<CrateOption[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  // Step 2 state
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);
  const [fetchError, setFetchError] = useState("");

  // Step 3 state
  const [facts, setFacts] = useState<TriviaFact[]>([]);
  const [factsLoading, setFactsLoading] = useState(false);
  const [pendingPatches, setPendingPatches] = useState<Record<number, boolean>>({});

  // Step 4 state
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [genError, setGenError] = useState("");

  // Load playlists + crates for scope selector
  useEffect(() => {
    Promise.all([
      fetch("/api/games/playlists").then((r) => r.json()).catch(() => ({ data: [] })),
      fetch("/api/games/trivia/crates").then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([pl, cr]) => {
      setPlaylists(pl.data ?? []);
      setCrates(cr.data ?? []);
      setOptionsLoaded(true);
    });
  }, []);

  // Load facts for step 3 when run_id is available
  const loadFacts = useCallback(async (runId: number) => {
    setFactsLoading(true);
    try {
      const res = await fetch(`/api/games/trivia/facts?run_id=${runId}&limit=100`);
      const json = await res.json();
      setFacts(json.data ?? []);
    } finally {
      setFactsLoading(false);
    }
  }, []);

  // Step 1 → 2: fetch facts
  async function handleFetch() {
    setFetching(true);
    setFetchError("");
    setFetchResult(null);
    try {
      const body: Record<string, unknown> = { scope_type: scopeType, entity_limit: entityLimit };
      if (scopeRefId) body.scope_ref_id = scopeRefId;
      if (scopeValue) body.scope_value = scopeValue;

      const res = await fetch("/api/games/trivia/facts/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setFetchError(json.error ?? "Fetch failed"); return; }
      setFetchResult(json as FetchResult);
      setStep(2);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setFetching(false);
    }
  }

  // Step 2 → 3: load facts for review
  async function handleReview() {
    if (!fetchResult) return;
    await loadFacts(fetchResult.run_id);
    setStep(3);
  }

  // Approve / archive fact inline
  async function patchFact(id: number, status: "approved" | "archived") {
    setPendingPatches((p) => ({ ...p, [id]: true }));
    try {
      await fetch(`/api/games/trivia/facts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setFacts((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    } finally {
      setPendingPatches((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  }

  async function approveAll() {
    for (const f of facts.filter((f) => f.status === "draft")) {
      await patchFact(f.id, "approved");
    }
  }

  // Step 3 → 4: generate questions from approved
  async function handleGenerate() {
    const approvedIds = facts.filter((f) => f.status === "approved").map((f) => f.id);
    if (!approvedIds.length) return;
    setGenerating(true);
    setGenError("");
    setGenResult(null);
    try {
      const res = await fetch("/api/games/trivia/facts/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact_ids: approvedIds }),
      });
      const json = await res.json();
      if (!res.ok) { setGenError(json.error ?? "Generation failed"); return; }
      setGenResult(json as GenerateResult);
      setStep(4);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }

  function reset() {
    setStep(1);
    setFetchResult(null);
    setFetchError("");
    setFacts([]);
    setGenResult(null);
    setGenError("");
    setScopeType("collection");
    setScopeRefId(null);
    setScopeValue("");
    setEntityLimit(20);
    setSelectedEntityLabel("");
  }

  const approvedCount = facts.filter((f) => f.status === "approved").length;

  // Step indicator
  const steps = ["1. Scope", "2. Fetching", "3. Review Facts", "4. Questions"];

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex gap-1 text-xs">
        {steps.map((label, i) => (
          <div key={i} className={`flex-1 rounded py-1.5 text-center ${step === i + 1 ? "bg-cyan-800 text-cyan-100 font-semibold" : step > i + 1 ? "bg-stone-700 text-stone-300" : "bg-stone-900 text-stone-500"}`}>
            {label}
          </div>
        ))}
      </div>

      {/* Step 1: Scope selection */}
      {step === 1 && (
        <section className="rounded-3xl border border-cyan-900/40 bg-black/45 p-5 space-y-5">
          <h2 className="text-lg font-black uppercase text-cyan-100">Select Scope</h2>
          <p className="text-xs text-stone-400">Choose which part of your collection to generate trivia facts for.</p>

          {/* Scope type */}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Scope Type</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["collection","playlist","crate","artist","album","format","decade","genre"] as ScopeType[]).map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 rounded border border-stone-700 px-2 py-1.5 text-xs capitalize hover:border-cyan-700">
                  <input type="radio" name="scope" value={s} checked={scopeType === s} onChange={() => { setScopeType(s); setScopeRefId(null); setScopeValue(""); setSelectedEntityLabel(""); }} className="accent-cyan-400" />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Secondary selector */}
          {scopeType === "playlist" && (
            <div>
              <label className="text-xs font-semibold text-stone-400">Playlist</label>
              {!optionsLoaded ? <p className="text-xs text-stone-500 mt-1">Loading…</p> : (
                <select value={scopeRefId ?? ""} onChange={(e) => setScopeRefId(Number(e.target.value) || null)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm">
                  <option value="">— Select playlist —</option>
                  {playlists.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.track_count})</option>)}
                </select>
              )}
            </div>
          )}

          {scopeType === "crate" && (
            <div>
              <label className="text-xs font-semibold text-stone-400">Crate</label>
              {!optionsLoaded ? <p className="text-xs text-stone-500 mt-1">Loading…</p> : (
                <select value={scopeRefId ?? ""} onChange={(e) => setScopeRefId(Number(e.target.value) || null)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm">
                  <option value="">— Select crate —</option>
                  {crates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
          )}

          {scopeType === "format" && (
            <div>
              <label className="text-xs font-semibold text-stone-400">Format</label>
              <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm">
                <option value="">— Select format —</option>
                {FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}

          {scopeType === "decade" && (
            <div>
              <label className="text-xs font-semibold text-stone-400">Decade</label>
              <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm">
                <option value="">— Select decade —</option>
                {DECADE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          {scopeType === "genre" && (
            <div>
              <label className="text-xs font-semibold text-stone-400">Genre</label>
              <input type="text" value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} placeholder="e.g. Jazz, Rock, Soul" className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm" />
            </div>
          )}

          {scopeType === "artist" && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-400">Artist</label>
              <EntitySearch
                apiPath="/api/games/trivia/search-artists"
                placeholder="Type to search artists…"
                selectedLabel={selectedEntityLabel}
                onSelect={(id, label) => { setScopeRefId(id); setSelectedEntityLabel(label); }}
              />
              {scopeRefId && <p className="mt-1 text-[10px] text-stone-500">Selected: {selectedEntityLabel} (id {scopeRefId})</p>}
            </div>
          )}

          {scopeType === "album" && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-400">Album</label>
              <EntitySearch
                apiPath="/api/games/trivia/search-albums"
                placeholder="Type to search albums…"
                selectedLabel={selectedEntityLabel}
                onSelect={(id, label) => { setScopeRefId(id); setSelectedEntityLabel(label); }}
              />
              {scopeRefId && <p className="mt-1 text-[10px] text-stone-500">Selected: {selectedEntityLabel} (id {scopeRefId})</p>}
            </div>
          )}

          {/* Entity limit */}
          <div>
            <label className="text-xs font-semibold text-stone-400">
              Max entities to process
              <span className="ml-2 font-normal text-stone-500">(albums or artists; 1–100)</span>
            </label>
            <input type="number" min={1} max={100} value={entityLimit} onChange={(e) => setEntityLimit(Math.max(1, Math.min(100, Number(e.target.value) || 20)))} className="mt-1 w-32 rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm" />
          </div>

          {fetchError && <p className="text-xs text-red-400">{fetchError}</p>}

          <button
            onClick={handleFetch}
            disabled={fetching || (scopeType === "playlist" && !scopeRefId) || (scopeType === "crate" && !scopeRefId) || (scopeType === "artist" && !scopeRefId) || (scopeType === "album" && !scopeRefId) || (scopeType === "format" && !scopeValue) || (scopeType === "decade" && !scopeValue)}
            className="rounded border border-cyan-700 bg-cyan-900/30 px-5 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-900/60 disabled:opacity-50"
          >
            {fetching ? <><Spinner /> Fetching facts…</> : "Fetch Facts →"}
          </button>
        </section>
      )}

      {/* Step 2: Fetch result summary */}
      {step === 2 && fetchResult && (
        <section className="rounded-3xl border border-cyan-900/40 bg-black/45 p-5 space-y-4">
          <h2 className="text-lg font-black uppercase text-cyan-100">Facts Fetched</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-stone-700 p-3">
              <div className="text-2xl font-black text-cyan-200">{fetchResult.facts_fetched}</div>
              <div className="mt-1 text-xs text-stone-400">New facts</div>
            </div>
            <div className="rounded-lg border border-stone-700 p-3">
              <div className="text-2xl font-black text-stone-200">{fetchResult.entities_processed}</div>
              <div className="mt-1 text-xs text-stone-400">Entities processed</div>
            </div>
            <div className="rounded-lg border border-stone-700 p-3">
              <div className="text-2xl font-black text-stone-500">{fetchResult.skipped_duplicates}</div>
              <div className="mt-1 text-xs text-stone-400">Duplicates skipped</div>
            </div>
          </div>
          {fetchResult.api_errors?.length ? (
            <div className="rounded border border-red-700 bg-red-950/40 p-3 text-xs text-red-300 space-y-1">
              <p className="font-semibold">API errors — Claude could not be reached:</p>
              {fetchResult.api_errors.map((e, i) => <p key={i} className="font-mono">{e}</p>)}
            </div>
          ) : fetchResult.facts_fetched === 0 ? (
            <p className="text-xs text-amber-400">No new facts found. Facts for these entities may already exist in the library.</p>
          ) : null}
          <div className="flex gap-3">
            <button onClick={handleReview} disabled={fetchResult.facts_fetched === 0} className="rounded border border-cyan-700 bg-cyan-900/30 px-5 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-900/60 disabled:opacity-50">
              Review Facts →
            </button>
            <button onClick={reset} className="rounded border border-stone-700 px-4 py-2 text-sm text-stone-400 hover:text-stone-200">
              Start Over
            </button>
          </div>
        </section>
      )}

      {/* Step 3: Fact review */}
      {step === 3 && (
        <section className="rounded-3xl border border-cyan-900/40 bg-black/45 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black uppercase text-cyan-100">Review Facts</h2>
            <div className="flex gap-2">
              <button onClick={approveAll} className="rounded border border-emerald-700 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-900/30">
                Approve All
              </button>
              <Link href="/admin/games/music-trivia/facts" target="_blank" className="rounded border border-stone-700 px-3 py-1 text-xs text-stone-400 hover:text-stone-200">
                Open Full Fact Library ↗
              </Link>
            </div>
          </div>

          {factsLoading ? (
            <div className="py-8 text-center text-xs text-stone-500"><Spinner /> Loading facts…</div>
          ) : facts.length === 0 ? (
            <p className="text-xs text-stone-500">No facts found for this run.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {facts.map((fact) => (
                <div key={fact.id} className={`rounded-lg border p-2.5 ${fact.status === "approved" ? "border-emerald-800 bg-emerald-950/20" : fact.status === "archived" ? "border-stone-800 opacity-40" : "border-stone-700 bg-stone-950/40"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="rounded border border-fuchsia-800 px-1.5 py-0.5 text-fuchsia-300">{ENTITY_TYPE_LABELS[fact.entity_type] ?? fact.entity_type}</span>
                      <span className="font-semibold text-stone-100">{fact.entity_ref}</span>
                      <span className="rounded border border-stone-600 px-1.5 py-0.5 text-stone-400">{FACT_KIND_LABELS[fact.fact_kind] ?? fact.fact_kind}</span>
                    </div>
                    <div className="flex gap-1">
                      {fact.status !== "approved" && (
                        <button onClick={() => patchFact(fact.id, "approved")} disabled={!!pendingPatches[fact.id]} className="rounded border border-emerald-700 px-1.5 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-40">Approve</button>
                      )}
                      {fact.status !== "archived" && (
                        <button onClick={() => patchFact(fact.id, "archived")} disabled={!!pendingPatches[fact.id]} className="rounded border border-stone-700 px-1.5 py-0.5 text-[10px] text-stone-500 hover:bg-stone-800 disabled:opacity-40">Skip</button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-stone-200">{fact.fact_text}</p>
                </div>
              ))}
            </div>
          )}

          {genError && <p className="text-xs text-red-400">{genError}</p>}

          <div className="flex flex-wrap items-center gap-3">
            {approvedCount > 0 && <span className="text-xs text-emerald-400">{approvedCount} fact{approvedCount !== 1 ? "s" : ""} approved</span>}
            <button
              onClick={handleGenerate}
              disabled={generating || approvedCount === 0}
              className="rounded border border-fuchsia-700 bg-fuchsia-900/30 px-5 py-2 text-sm font-semibold text-fuchsia-200 hover:bg-fuchsia-900/60 disabled:opacity-50"
            >
              {generating ? <><Spinner /> Generating…</> : `Generate Questions from ${approvedCount} Fact${approvedCount !== 1 ? "s" : ""} →`}
            </button>
            <button onClick={reset} className="rounded border border-stone-700 px-4 py-2 text-sm text-stone-400 hover:text-stone-200">Start Over</button>
          </div>
        </section>
      )}

      {/* Step 4: Results */}
      {step === 4 && genResult && (
        <section className="rounded-3xl border border-fuchsia-900/40 bg-black/45 p-5 space-y-4">
          <h2 className="text-lg font-black uppercase text-fuchsia-200">Questions Generated</h2>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg border border-fuchsia-800 p-3">
              <div className="text-3xl font-black text-fuchsia-200">{genResult.generated_count}</div>
              <div className="mt-1 text-xs text-stone-400">Questions created</div>
            </div>
            <div className="rounded-lg border border-stone-700 p-3">
              <div className="text-3xl font-black text-stone-200">{genResult.facts_processed}</div>
              <div className="mt-1 text-xs text-stone-400">Facts used</div>
            </div>
          </div>
          <p className="text-xs text-stone-400">Questions are saved as drafts. Review and publish them in the Question Bank before adding to a deck.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/games/music-trivia/bank" className="rounded border border-fuchsia-700 bg-fuchsia-900/30 px-5 py-2 text-sm font-semibold text-fuchsia-200 hover:bg-fuchsia-900/60">
              Open Question Bank →
            </Link>
            <button onClick={reset} className="rounded border border-stone-700 px-4 py-2 text-sm text-stone-400 hover:text-stone-200">
              Generate More
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Classic Template Mode — original collection-based generator
// ---------------------------------------------------------------------------

function ClassicMode() {
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const [source, setSource] = useState<"collection" | "playlists">("collection");
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<number[]>([]);
  const [limit, setLimit] = useState(25);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [category, setCategory] = useState("Collection Generator");
  const [seed, setSeed] = useState("");
  const [createdBy, setCreatedBy] = useState("collection-trivia-generator");
  type StatusState = { type: "idle" } | { type: "loading"; message: string } | { type: "error"; message: string } | { type: "preview"; result: PreviewResult } | { type: "inserted"; result: PreviewResult };
  const [status, setStatus] = useState<StatusState>({ type: "idle" });

  useEffect(() => {
    fetch("/api/games/playlists").then((r) => r.json()).then((p) => { setPlaylists(p.data ?? []); setPlaylistsLoaded(true); }).catch(() => setPlaylistsLoaded(true));
  }, []);

  const call = useCallback(async (apply: boolean) => {
    if (source === "playlists" && selectedPlaylistIds.length === 0) { setStatus({ type: "error", message: "Select at least one playlist." }); return; }
    setStatus({ type: "loading", message: apply ? "Inserting…" : "Building preview…" });
    try {
      const res = await fetch("/api/games/trivia/generate-from-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, playlistIds: selectedPlaylistIds, limit, difficulty, category: category.trim() || "Collection Generator", seed: seed.trim() || undefined, createdBy: createdBy.trim() || "collection-trivia-generator", apply }),
      });
      const payload = await res.json();
      if (!res.ok) { setStatus({ type: "error", message: payload.error ?? `HTTP ${res.status}` }); return; }
      setStatus({ type: apply ? "inserted" : "preview", result: payload as PreviewResult });
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
  }, [source, selectedPlaylistIds, limit, difficulty, category, seed, createdBy]);

  const isWorking = status.type === "loading";
  const previewResult = status.type === "preview" || status.type === "inserted" ? status.result : null;

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-stone-700 bg-black/45 p-5 space-y-5">
        <h2 className="text-lg font-black uppercase text-stone-200">Template Generator</h2>
        <p className="text-xs text-stone-500">Generates "who sang / what year / what label" questions directly from inventory metadata. Fast, no AI, no external calls.</p>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-stone-300">Source</legend>
          <div className="flex gap-6">
            {(["collection","playlists"] as const).map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2 text-sm capitalize">
                <input type="radio" name="classicSource" value={s} checked={source === s} onChange={() => setSource(s)} className="accent-cyan-400" />
                {s === "collection" ? "Full collection" : "Selected playlists"}
              </label>
            ))}
          </div>
        </fieldset>

        {source === "playlists" && (
          <div className="grid max-h-48 gap-1 overflow-y-auto rounded border border-stone-700 bg-stone-950 p-3 sm:grid-cols-2">
            {!playlistsLoaded ? <p className="text-sm text-stone-500">Loading…</p> : playlists.map((pl) => (
              <label key={pl.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-stone-800">
                <input type="checkbox" checked={selectedPlaylistIds.includes(pl.id)} onChange={() => setSelectedPlaylistIds((p) => p.includes(pl.id) ? p.filter((x) => x !== pl.id) : [...p, pl.id])} className="accent-cyan-400" />
                <span className="flex-1 truncate">{pl.name}</span>
                <span className="text-xs text-stone-500">{pl.track_count}</span>
              </label>
            ))}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">Tracks to sample
            <input type="number" min={1} max={200} value={limit} onChange={(e) => setLimit(Math.max(1, Math.min(200, Number(e.target.value) || 25)))} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          <label className="text-sm">Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2">
              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select>
          </label>
          <label className="text-sm">Category
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          <label className="text-sm">Seed
            <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          <label className="text-sm">Created by
            <input type="text" value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <button type="button" disabled={isWorking} onClick={() => call(false)} className="rounded border border-stone-600 px-5 py-2 text-sm text-stone-200 hover:bg-stone-800 disabled:opacity-50">
            {isWorking ? <Spinner /> : null} Preview
          </button>
          <button type="button" disabled={isWorking || previewResult === null} onClick={() => call(true)} className="rounded border border-green-700 bg-green-900/30 px-5 py-2 text-sm font-semibold text-green-200 hover:bg-green-900/60 disabled:opacity-50">
            {isWorking ? <Spinner /> : null} Insert as Drafts
          </button>
          {status.type !== "idle" && <button type="button" disabled={isWorking} onClick={() => setStatus({ type: "idle" })} className="rounded border border-stone-700 px-4 py-2 text-sm text-stone-400">Reset</button>}
        </div>
      </section>

      {status.type === "loading" && <div className="rounded border border-stone-700 p-4 text-sm text-stone-300 flex items-center gap-2"><Spinner />{status.message}</div>}
      {status.type === "error" && <div className="rounded border border-red-800 p-4 text-sm text-red-300">{status.message}</div>}
      {status.type === "inserted" && (
        <div className="rounded border border-green-800 p-4 text-sm text-green-300">
          Inserted <strong>{status.result.insertedCount}</strong> questions from {status.result.trackCount} tracks.{" "}
          <Link href="/admin/games/music-trivia/bank" className="underline">Open Question Bank →</Link>
        </div>
      )}
      {previewResult && previewResult.questions.length > 0 && (
        <div className="overflow-x-auto rounded border border-stone-700 bg-stone-950/40 p-3">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-stone-800 text-left text-stone-400">
              <th className="pb-2 pr-4">Category</th><th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Prompt</th><th className="pb-2 pr-4">Answer</th>
            </tr></thead>
            <tbody>
              {previewResult.questions.slice(0, 20).map((q, i) => (
                <tr key={i} className="border-b border-stone-800/50 align-top">
                  <td className="py-1.5 pr-4 text-cyan-400 whitespace-nowrap">{q.category}</td>
                  <td className="py-1.5 pr-4 text-stone-400">{q.question_type === "multiple_choice" ? "MC" : "FR"}</td>
                  <td className="py-1.5 pr-4 text-stone-200 max-w-xs">{q.prompt_text}</td>
                  <td className="py-1.5 pr-4 text-green-300">{q.answer_key}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
