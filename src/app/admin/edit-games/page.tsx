// src/app/admin/edit-games/page.tsx
// Admin editor for the public Games catalog page (src/app/games/page.tsx):
// title, status, and short description for current and future games.
//
// This is deliberately NOT the old Game Admin Center (src/app/admin/games) —
// that's a production control room (playlist decks, host/assistant/jumbotron
// screens) for actually running games live. Game development itself now
// happens on a separate site; this page exists purely to promote what's
// live or coming, the same way edit-home/edit-about/edit-merch edit their
// own public pages.

"use client";

import { useEffect, useState } from "react";
import type { GameStatus } from "src/lib/gameBlueprints";

type EditableGame = {
  slug: string;
  title: string;
  status: GameStatus;
  tagline: string;
  notes?: string;
  isCustom: boolean;
};

const STATUS_LABELS: Record<GameStatus, string> = {
  in_production: "Live",
  in_development: "In development",
  needs_workshopping: "Needs workshopping",
  undeveloped: "Undeveloped",
};

const STATUS_BADGE_CLASS: Record<GameStatus, string> = {
  in_production: "bg-emerald-100 text-emerald-700",
  in_development: "bg-amber-100 text-amber-700",
  needs_workshopping: "bg-orange-100 text-orange-700",
  undeveloped: "bg-gray-100 text-gray-600",
};

const inputClass =
  "w-full bg-white text-gray-900 border border-gray-300 px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none";
const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

function GameFormFields({
  title,
  status,
  tagline,
  notes,
  onTitleChange,
  onStatusChange,
  onTaglineChange,
  onNotesChange,
}: {
  title: string;
  status: GameStatus;
  tagline: string;
  notes: string;
  onTitleChange: (v: string) => void;
  onStatusChange: (v: GameStatus) => void;
  onTaglineChange: (v: string) => void;
  onNotesChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Title</label>
        <input className={inputClass} value={title} onChange={(e) => onTitleChange(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Status</label>
        <select
          className={inputClass}
          value={status}
          onChange={(e) => onStatusChange(e.target.value as GameStatus)}
        >
          <option value="in_production">Live (shown as available now)</option>
          <option value="in_development">In development (shown as coming soon)</option>
          <option value="needs_workshopping">Needs workshopping (hidden from site)</option>
          <option value="undeveloped">Undeveloped (hidden from site)</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Only &ldquo;Live&rdquo; and &ldquo;In development&rdquo; games appear on the public Games page.
        </p>
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          className={inputClass}
          rows={3}
          value={tagline}
          onChange={(e) => onTaglineChange(e.target.value)}
          placeholder="Short, public-facing description shown on the game's card and page."
        />
      </div>
      <div>
        <label className={labelClass}>Internal notes (not shown on the site)</label>
        <textarea
          className={inputClass}
          rows={2}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function EditGameModal({
  game,
  onClose,
  onSaved,
  onDeleted,
}: {
  game: EditableGame;
  onClose: () => void;
  onSaved: (slug: string, changes: Partial<EditableGame>) => void;
  onDeleted: (slug: string) => void;
}) {
  const [title, setTitle] = useState(game.title);
  const [status, setStatus] = useState<GameStatus>(game.status);
  const [tagline, setTagline] = useState(game.tagline);
  const [notes, setNotes] = useState(game.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/game-blueprints/${game.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status, tagline, notes }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? "Failed to save");
      }
      onSaved(game.slug, { title, status, tagline, notes });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${game.title}"? This can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/game-blueprints/${game.slug}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? "Failed to delete");
      }
      onDeleted(game.slug);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-gray-900/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Edit {game.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <GameFormFields
            title={title}
            status={status}
            tagline={tagline}
            notes={notes}
            onTitleChange={setTitle}
            onStatusChange={setStatus}
            onTaglineChange={setTagline}
            onNotesChange={setNotes}
          />
          {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-6 py-4">
          {game.isCustom ? (
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete game"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddGameModal({ onClose, onCreated }: { onClose: () => void; onCreated: (game: EditableGame) => void }) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<GameStatus>("undeveloped");
  const [tagline, setTagline] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/game-blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status, tagline, notes }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as { error?: string }).error ?? "Failed to create");
      onCreated({ slug: (payload as { slug: string }).slug, title, status, tagline, notes, isCustom: true });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-gray-900/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Add a new game</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5">
          <GameFormFields
            title={title}
            status={status}
            tagline={tagline}
            notes={notes}
            onTitleChange={setTitle}
            onStatusChange={setStatus}
            onTaglineChange={setTagline}
            onNotesChange={setNotes}
          />
          {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add game"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditGamesPage() {
  const [games, setGames] = useState<EditableGame[] | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/game-blueprints")
      .then((res) => res.json())
      .then((payload) => setGames((payload.data ?? []) as EditableGame[]))
      .catch(() => setLoadError("Could not load games."));
  }, []);

  const editingGame = games?.find((g) => g.slug === editingSlug) ?? null;

  const handleSaved = (slug: string, changes: Partial<EditableGame>) => {
    setGames((prev) => prev?.map((g) => (g.slug === slug ? { ...g, ...changes } : g)) ?? prev);
  };

  const handleDeleted = (slug: string) => {
    setGames((prev) => prev?.filter((g) => g.slug !== slug) ?? prev);
  };

  const handleCreated = (game: EditableGame) => {
    setGames((prev) => (prev ? [...prev, game] : [game]));
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2 text-gray-900">Games</h1>
          <p className="text-sm text-gray-600">
            Title, status, and description for the public Games page — current formats and ones you&rsquo;re
            planning. Actual game development happens elsewhere; this just controls what visitors see.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Add Game
        </button>
      </div>

      {loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : !games ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-3">
          {games.map((game) => (
            <div
              key={game.slug}
              className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900">{game.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASS[game.status]}`}>
                    {STATUS_LABELS[game.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{game.tagline || <span className="italic text-gray-400">No description yet</span>}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSlug(game.slug)}
                className="shrink-0 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {editingGame ? (
        <EditGameModal
          game={editingGame}
          onClose={() => setEditingSlug(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}

      {adding ? <AddGameModal onClose={() => setAdding(false)} onCreated={handleCreated} /> : null}
    </div>
  );
}
