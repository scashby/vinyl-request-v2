"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlaylistOption = {
  id: number;
  name: string;
  is_smart: boolean;
  track_count: number;
};

type SampleQuestion = {
  category: string;
  question_type: string;
  prompt_text: string;
  answer_key: string;
  options_payload: string[];
  tags: string[];
};

type PreviewResult = {
  mode: "dry-run" | "apply";
  source: string;
  sourceLabel: string;
  trackCount: number;
  questionCount: number;
  questions: SampleQuestion[];
  insertedCount?: number;
};

type StatusState =
  | { type: "idle" }
  | { type: "loading"; message: string }
  | { type: "error"; message: string }
  | { type: "preview"; result: PreviewResult }
  | { type: "inserted"; result: PreviewResult };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

export default function GenerateTriviaFromCollectionPage() {
  // Playlists loaded once on mount
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);

  // Form state
  const [source, setSource] = useState<"collection" | "playlists">("collection");
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<number[]>([]);
  const [limit, setLimit] = useState(25);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [category, setCategory] = useState("Collection Generator");
  const [seed, setSeed] = useState("");
  const [createdBy, setCreatedBy] = useState("collection-trivia-generator");

  const [status, setStatus] = useState<StatusState>({ type: "idle" });

  // ---------------------------------------------------------------------------
  // Load playlists
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetch("/api/games/playlists")
      .then((r) => r.json())
      .then((payload) => {
        setPlaylists(payload.data ?? []);
        setPlaylistsLoaded(true);
      })
      .catch(() => setPlaylistsLoaded(true));
  }, []);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const call = useCallback(
    async (apply: boolean) => {
      if (source === "playlists" && selectedPlaylistIds.length === 0) {
        setStatus({ type: "error", message: "Select at least one playlist." });
        return;
      }
      setStatus({ type: "loading", message: apply ? "Generating and inserting…" : "Building preview…" });

      try {
        const res = await fetch("/api/games/trivia/generate-from-collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source,
            playlistIds: selectedPlaylistIds,
            limit,
            difficulty,
            category: category.trim() || "Collection Generator",
            seed: seed.trim() || undefined,
            createdBy: createdBy.trim() || "collection-trivia-generator",
            apply,
          }),
        });

        const payload = await res.json();
        if (!res.ok) {
          setStatus({ type: "error", message: payload.error ?? `HTTP ${res.status}` });
          return;
        }

        if (apply) {
          setStatus({ type: "inserted", result: payload as PreviewResult });
        } else {
          setStatus({ type: "preview", result: payload as PreviewResult });
        }
      } catch (err) {
        setStatus({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
      }
    },
    [source, selectedPlaylistIds, limit, difficulty, category, seed, createdBy]
  );

  const togglePlaylist = (id: number) => {
    setSelectedPlaylistIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isWorking = status.type === "loading";
  const previewResult = status.type === "preview" || status.type === "inserted" ? status.result : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#0f2d3a,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <header className="rounded-3xl border border-cyan-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Music Trivia</p>
          <h1 className="mt-1 text-4xl font-black uppercase text-cyan-100">Generate from Collection</h1>
          <p className="mt-2 text-sm text-stone-300">
            Create draft trivia questions from your vinyl collection or a chosen playlist.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Link href="/admin/games/music-trivia" className="rounded border border-stone-700 px-3 py-1">← Setup</Link>
            <Link href="/admin/games/music-trivia/bank" className="rounded border border-stone-700 px-3 py-1">Question Bank</Link>
            <Link href="/admin/games/music-trivia/decks" className="rounded border border-stone-700 px-3 py-1">Deck Builder</Link>
          </div>
        </header>

        {/* Configuration */}
        <section className="rounded-3xl border border-cyan-900/40 bg-black/45 p-6 space-y-6">
          <h2 className="text-xl font-black uppercase text-cyan-100">Configuration</h2>

          {/* Source */}
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-stone-300">Source</legend>
            <div className="flex gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="source"
                  value="collection"
                  checked={source === "collection"}
                  onChange={() => setSource("collection")}
                  className="accent-cyan-400"
                />
                Full collection
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="source"
                  value="playlists"
                  checked={source === "playlists"}
                  onChange={() => setSource("playlists")}
                  className="accent-cyan-400"
                />
                Selected playlists
              </label>
            </div>
          </fieldset>

          {/* Playlist picker */}
          {source === "playlists" && (
            <div>
              <p className="mb-2 text-sm font-semibold text-stone-300">
                Playlists{" "}
                {selectedPlaylistIds.length > 0 && (
                  <span className="ml-1 text-xs text-cyan-400">({selectedPlaylistIds.length} selected)</span>
                )}
              </p>
              {!playlistsLoaded ? (
                <p className="text-sm text-stone-500">Loading playlists…</p>
              ) : playlists.length === 0 ? (
                <p className="text-sm text-stone-500">No playlists found.</p>
              ) : (
                <div className="grid max-h-48 gap-1 overflow-y-auto rounded border border-stone-700 bg-stone-950 p-3 sm:grid-cols-2">
                  {playlists.map((pl) => (
                    <label key={pl.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-stone-800">
                      <input
                        type="checkbox"
                        checked={selectedPlaylistIds.includes(pl.id)}
                        onChange={() => togglePlaylist(pl.id)}
                        className="accent-cyan-400"
                      />
                      <span className="flex-1 truncate">{pl.name}</span>
                      <span className="shrink-0 text-xs text-stone-500">{pl.track_count}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Config grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              Questions to generate (tracks sampled)
              <input
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(e) => setLimit(Math.max(1, Math.min(200, Number(e.target.value) || 25)))}
                className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
              />
              <span className="mt-1 block text-xs text-stone-500">1–200 tracks; up to 4 questions per track</span>
            </label>

            <label className="text-sm">
              Difficulty
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>

            <label className="text-sm">
              Default category
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Collection Generator"
                className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Seed (optional, for reproducibility)
              <input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Leave blank for random"
                className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Created by
              <input
                type="text"
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
              />
            </label>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={isWorking}
              onClick={() => call(false)}
              className="rounded border border-cyan-700 bg-cyan-900/30 px-5 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-900/60 disabled:opacity-50"
            >
              {isWorking && status.type === "loading" && status.message.includes("preview") ? <Spinner /> : null}{" "}
              Preview
            </button>
            <button
              type="button"
              disabled={isWorking || previewResult === null}
              onClick={() => call(true)}
              className="rounded border border-green-700 bg-green-900/30 px-5 py-2 text-sm font-semibold text-green-200 hover:bg-green-900/60 disabled:opacity-50"
              title={previewResult === null ? "Run a preview first" : undefined}
            >
              {isWorking ? <Spinner /> : null}{" "}
              Insert as Drafts
            </button>
            {(status.type !== "idle") && (
              <button
                type="button"
                disabled={isWorking}
                onClick={() => setStatus({ type: "idle" })}
                className="rounded border border-stone-700 px-4 py-2 text-sm text-stone-400 hover:text-stone-200"
              >
                Reset
              </button>
            )}
          </div>
        </section>

        {/* Status / Results */}
        {status.type === "loading" && (
          <section className="rounded-3xl border border-cyan-900/40 bg-black/45 p-6">
            <p className="flex items-center gap-2 text-sm text-stone-300">
              <Spinner />
              {status.message}
            </p>
          </section>
        )}

        {status.type === "error" && (
          <section className="rounded-3xl border border-red-800/60 bg-black/45 p-6">
            <h2 className="text-sm font-bold text-red-400">Error</h2>
            <p className="mt-1 text-sm text-stone-300">{status.message}</p>
          </section>
        )}

        {status.type === "inserted" && (
          <section className="rounded-3xl border border-green-800/60 bg-black/45 p-6">
            <h2 className="text-xl font-black uppercase text-green-300">Inserted</h2>
            <p className="mt-2 text-sm text-stone-300">
              <strong className="text-green-200">{status.result.insertedCount}</strong> questions inserted as drafts from{" "}
              <em>{status.result.sourceLabel}</em> ({status.result.trackCount.toLocaleString()} tracks in pool, {status.result.questionCount} total candidates).
            </p>
            <p className="mt-3 text-sm">
              <Link href="/admin/games/music-trivia/bank" className="text-cyan-400 underline hover:text-cyan-200">
                Open Question Bank to review →
              </Link>
            </p>
          </section>
        )}

        {previewResult && (
          <section className="rounded-3xl border border-cyan-900/40 bg-black/45 p-6 space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-black uppercase text-cyan-100">
                {status.type === "inserted" ? "Sample Questions" : "Preview"}
              </h2>
              <div className="text-right text-xs text-stone-400">
                <span className="font-semibold text-stone-200">{previewResult.trackCount.toLocaleString()}</span> tracks in pool
                {" · "}
                <span className="font-semibold text-stone-200">{previewResult.questionCount}</span> questions to insert
                {" · "}
                showing {Math.min(20, previewResult.questions.length)} samples
              </div>
            </div>

            {previewResult.questions.length === 0 ? (
              <p className="text-sm text-stone-500">No questions could be generated from this source. The tracks may be missing artist, title, or label data.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-stone-800 text-left text-stone-400">
                      <th className="pb-2 pr-4 font-medium">Category</th>
                      <th className="pb-2 pr-4 font-medium">Type</th>
                      <th className="pb-2 pr-4 font-medium">Prompt</th>
                      <th className="pb-2 pr-4 font-medium">Answer</th>
                      <th className="pb-2 font-medium">Options / Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.questions.map((q, i) => (
                      <tr key={i} className="border-b border-stone-800/50 align-top">
                        <td className="py-2 pr-4 text-cyan-400 whitespace-nowrap">{q.category}</td>
                        <td className="py-2 pr-4 text-stone-400 whitespace-nowrap">{q.question_type === "multiple_choice" ? "MC" : "FR"}</td>
                        <td className="py-2 pr-4 text-stone-200 max-w-xs">{q.prompt_text}</td>
                        <td className="py-2 pr-4 text-green-300 whitespace-nowrap">{q.answer_key}</td>
                        <td className="py-2 text-stone-400">
                          {q.options_payload.length > 0 && (
                            <span>{q.options_payload.join(" / ")}</span>
                          )}
                          {q.tags.length > 0 && (
                            <span className="ml-2 text-stone-600">[{q.tags.join(", ")}]</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}
