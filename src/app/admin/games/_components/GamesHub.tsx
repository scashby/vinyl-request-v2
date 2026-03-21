"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PromptCopyButton from "src/components/PromptCopyButton";
import { getGameBuildPrompt, type GameBlueprint, type GameStatus } from "src/lib/gameBlueprints";

type EnrichedBlueprint = GameBlueprint & { hasConcreteModule: boolean };

const STATUS_LABELS: Record<GameStatus, string> = {
  in_production: "In Production",
  in_development: "In Development",
  needs_workshopping: "Needs Workshopping",
  undeveloped: "Undeveloped",
};

function EditGameModal({
  game,
  onClose,
  onSaved,
}: {
  game: EnrichedBlueprint;
  onClose: () => void;
  onSaved: (slug: string, changes: Partial<EnrichedBlueprint>) => void;
}) {
  const [title, setTitle] = useState(game.title);
  const [status, setStatus] = useState<GameStatus>(game.status);
  const [notes, setNotes] = useState(game.notes ?? "");
  const [pullSizeGuidance, setPullSizeGuidance] = useState(game.pullSizeGuidance);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/game-blueprints/${game.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status, notes, pullSizeGuidance }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? "Failed to save");
      }
      onSaved(game.slug, { title, status, notes, pullSizeGuidance });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60000] bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-[60001] flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-amber-800/60 bg-stone-950 p-6 text-stone-100 shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-400">Edit Game</p>
              <h3 className="mt-0.5 text-lg font-black text-amber-100">{game.slug}</h3>
            </div>
            <button onClick={onClose} className="rounded border border-stone-700 px-2 py-1 text-xs text-stone-400 hover:text-stone-200">✕</button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.12em] text-stone-400">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.12em] text-stone-400">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as GameStatus)}
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 focus:border-amber-600 focus:outline-none"
              >
                <option value="in_production">In Production</option>
                <option value="in_development">In Development</option>
                <option value="needs_workshopping">Needs Workshopping</option>
                <option value="undeveloped">Undeveloped</option>
              </select>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.12em] text-stone-400">Pull Size Guidance</label>
              <input
                type="text"
                value={pullSizeGuidance}
                onChange={(e) => setPullSizeGuidance(e.target.value)}
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.12em] text-stone-400">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 focus:border-amber-600 focus:outline-none"
                placeholder="Optional notes visible on the game card..."
              />
            </div>
          </div>

          {error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}

          <div className="mt-5 flex justify-end gap-2 text-xs">
            <button onClick={onClose} className="rounded border border-stone-700 px-3 py-1.5 text-stone-300 hover:border-stone-500">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded border border-amber-700 bg-amber-900/40 px-3 py-1.5 font-semibold text-amber-200 hover:bg-amber-900/60 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function GameCard({ game, onEdit }: { game: EnrichedBlueprint; onEdit: () => void }) {
  const isProduction = game.status === "in_production";
  const isDevelopment = game.status === "in_development";
  const isWorkshop = game.status === "needs_workshopping";

  const borderClass = isProduction
    ? "border-emerald-800/60 bg-emerald-950/20"
    : isDevelopment
      ? "border-amber-900/50 bg-amber-950/20"
      : isWorkshop
        ? "border-amber-900/50 bg-amber-950/20"
        : "border-stone-700 bg-stone-950/60";

  const badgeClass = isProduction
    ? "text-emerald-300"
    : isDevelopment
      ? "text-amber-300"
      : isWorkshop
        ? "text-amber-300"
        : "text-stone-400";

  const titleClass = isProduction ? "text-emerald-100" : isDevelopment || isWorkshop ? "text-amber-100" : "text-stone-100";

  const openLabel = isProduction || isDevelopment ? "Open Module" : "Open Skeleton";
  const badgeLabel = STATUS_LABELS[game.status];

  return (
    <section className={`rounded-2xl border p-5 ${borderClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-xs uppercase tracking-[0.2em] ${badgeClass}`}>{badgeLabel}</p>
          <h3 className={`text-2xl font-black ${titleClass}`}>{game.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="rounded border border-stone-600 px-2 py-1 text-xs text-stone-300 hover:border-amber-500 hover:text-amber-200"
            title="Edit game settings"
          >
            Edit
          </button>
          {game.hasConcreteModule ? (
            <Link
              className={`rounded border px-3 py-1 text-xs uppercase tracking-[0.15em] hover:text-amber-200 ${isProduction ? "border-emerald-700 hover:border-emerald-400" : "border-amber-700 hover:border-amber-400"}`}
              href={`/admin/games/${game.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {openLabel}
            </Link>
          ) : (
            <Link
              className="rounded border border-stone-600 px-3 py-1 text-xs uppercase tracking-[0.15em] hover:border-amber-400 hover:text-amber-200"
              href={`/admin/games/${game.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {openLabel}
            </Link>
          )}
        </div>
      </div>

      <p className={`mt-3 text-sm ${isProduction ? "text-emerald-100/90" : isDevelopment || isWorkshop ? "text-amber-100/90" : "text-stone-300"}`}>
        {game.setup}
      </p>
      <p className={`mt-2 text-xs ${isProduction ? "text-emerald-200/80" : isDevelopment || isWorkshop ? "text-amber-200/90" : "text-stone-400"}`}>
        Pull target: {game.pullSizeGuidance}
      </p>
      {game.notes ? (
        <p className="mt-2 text-xs italic text-stone-400">{game.notes}</p>
      ) : null}

      {!isProduction ? (
        <details className={`mt-4 rounded border p-3 ${isDevelopment ? "border-amber-900/50 bg-black/30" : isWorkshop ? "border-amber-800/70 bg-black/30" : "border-stone-700 bg-black/40"}`}>
          <summary className="cursor-pointer text-sm font-semibold text-amber-200">Prompt for Build/Plan</summary>
          <div className="mt-3">
            <PromptCopyButton prompt={getGameBuildPrompt(game)} />
          </div>
          <pre className={`mt-3 overflow-x-auto whitespace-pre-wrap rounded border p-3 text-xs leading-6 ${isDevelopment ? "border-amber-800/60 bg-stone-950 text-amber-100" : isWorkshop ? "border-amber-800/60 bg-stone-950 text-amber-100" : "border-stone-700 bg-stone-950 text-stone-200"}`}>
            {getGameBuildPrompt(game)}
          </pre>
        </details>
      ) : null}
    </section>
  );
}

export default function GamesHub({ initialGames }: { initialGames: EnrichedBlueprint[] }) {
  const [games, setGames] = useState<EnrichedBlueprint[]>(initialGames);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/game-blueprints", { cache: "no-store" });
    if (!res.ok) return;
    const payload = await res.json();
    setGames(payload.data ?? []);
  }, []);

  useEffect(() => {
    // Refresh on mount to pick up any changes made in other tabs
    refresh();
  }, [refresh]);

  const handleSaved = useCallback((slug: string, changes: Partial<EnrichedBlueprint>) => {
    setGames((prev) =>
      prev.map((game) => (game.slug === slug ? { ...game, ...changes } : game))
    );
  }, []);

  const editingGame = editingSlug ? (games.find((game) => game.slug === editingSlug) ?? null) : null;

  const inProduction = games.filter((game) => game.status === "in_production");
  const inDevelopment = games.filter((game) => game.status === "in_development");
  const needsWorkshop = games.filter((game) => game.status === "needs_workshopping");
  const undeveloped = games.filter((game) => game.status === "undeveloped");

  return (
    <>
      {editingGame ? (
        <EditGameModal
          game={editingGame}
          onClose={() => setEditingSlug(null)}
          onSaved={handleSaved}
        />
      ) : null}

      <h2 className="mt-10 text-xl font-black uppercase tracking-[0.08em] text-amber-200">In Production</h2>
      <div className="mt-4 grid gap-4">
        {inProduction.length === 0 ? (
          <div className="rounded-xl border border-stone-700 bg-stone-950/40 p-4 text-sm text-stone-300">
            No games are in production yet. Edit a game and set its status to&nbsp;<span className="font-semibold text-emerald-400">In Production</span> when it&apos;s ready.
          </div>
        ) : (
          inProduction.map((game) => (
            <GameCard key={game.slug} game={game} onEdit={() => setEditingSlug(game.slug)} />
          ))
        )}
      </div>

      <h2 className="mt-10 text-xl font-black uppercase tracking-[0.08em] text-amber-200">In Development</h2>
      <div className="mt-4 grid gap-4">
        {inDevelopment.length === 0 ? (
          <div className="rounded-xl border border-stone-700 bg-stone-950/40 p-4 text-sm text-stone-300">No games in development.</div>
        ) : (
          inDevelopment.map((game) => (
            <GameCard key={game.slug} game={game} onEdit={() => setEditingSlug(game.slug)} />
          ))
        )}
      </div>

      {needsWorkshop.length > 0 ? (
        <>
          <h2 className="mt-10 text-xl font-black uppercase tracking-[0.08em] text-amber-200">Needs Workshopping</h2>
          <div className="mt-4 grid gap-4">
            {needsWorkshop.map((game) => (
              <GameCard key={game.slug} game={game} onEdit={() => setEditingSlug(game.slug)} />
            ))}
          </div>
        </>
      ) : null}

      {undeveloped.length > 0 ? (
        <>
          <h2 className="mt-10 text-xl font-black uppercase tracking-[0.08em] text-amber-200">Undeveloped Games</h2>
          <div className="mt-4 grid gap-4">
            {undeveloped.map((game, index) => (
              <section key={game.slug} className="rounded-2xl border border-stone-700 bg-stone-950/60 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Game {index + 1}</p>
                    <h3 className="text-2xl font-black text-stone-100">{game.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingSlug(game.slug)}
                      className="rounded border border-stone-600 px-2 py-1 text-xs text-stone-300 hover:border-amber-500 hover:text-amber-200"
                    >
                      Edit
                    </button>
                    <Link
                      className="rounded border border-stone-600 px-3 py-1 text-xs uppercase tracking-[0.15em] hover:border-amber-400 hover:text-amber-200"
                      href={`/admin/games/${game.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Skeleton
                    </Link>
                  </div>
                </div>
                <p className="mt-3 text-sm text-stone-300">{game.coreMechanic}</p>
                <p className="mt-2 text-xs text-stone-400">Pull target: {game.pullSizeGuidance}</p>
                {game.notes ? <p className="mt-2 text-xs italic text-stone-400">{game.notes}</p> : null}
                <details className="mt-4 rounded border border-stone-700 bg-black/40 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-amber-200">Prompt for Build/Plan</summary>
                  <div className="mt-3">
                    <PromptCopyButton prompt={getGameBuildPrompt(game)} />
                  </div>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded border border-stone-700 bg-stone-950 p-3 text-xs leading-6 text-stone-200">
                    {getGameBuildPrompt(game)}
                  </pre>
                </details>
              </section>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
