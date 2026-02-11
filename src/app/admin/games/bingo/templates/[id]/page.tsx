"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import BingoHeader from "../../_components/BingoHeader";
import { Download, Pencil, Trash2, X } from "lucide-react";

const COLOR_SWATCHES = [
  "#3b82f6",
  "#22c55e",
  "#2563eb",
  "#f59e0b",
  "#d946ef",
  "#7c3aed",
  "#f43f5e",
  "#14b8a6",
  "#eab308",
];

type Template = {
  id: number;
  name: string;
  setlist_mode: boolean;
};

type TemplateItem = {
  id: number;
  title: string;
  artist: string;
  side: string | null;
  position: string | null;
  sort_order?: number | null;
};

type SearchResult = {
  inventory_id: number;
  recording_id: number | null;
  title: string;
  artist: string;
  side: string | null;
  position: string | null;
};

export default function Page() {
  const params = useParams();
  const templateId = Number(params.id);
  const [template, setTemplate] = useState<Template | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [name, setName] = useState("");
  const [setlistMode, setSetlistMode] = useState(false);
  const [accent, setAccent] = useState(COLOR_SWATCHES[5]);
  const [defaultVideo, setDefaultVideo] = useState("");
  const [preGameVideo, setPreGameVideo] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const loadTemplate = async () => {
    const response = await fetch(`/api/game-templates/${templateId}`);
    const payload = await response.json();
    setTemplate(payload.data?.template ?? null);
    setItems(payload.data?.items ?? []);
    setName(payload.data?.template?.name ?? "");
    setSetlistMode(Boolean(payload.data?.template?.setlist_mode));
  };

  useEffect(() => {
    if (!templateId || Number.isNaN(templateId)) return;
    void loadTemplate();
  }, [templateId]);

  const trackCount = items.length;

  const handleSave = async () => {
    setIsWorking(true);
    try {
      await fetch(`/api/game-templates/${templateId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, setlistMode }),
        }
      );
      await loadTemplate();
      setShowDetails(false);
    } finally {
      setIsWorking(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    setIsWorking(true);
    try {
      await fetch(`/api/game-template-items/${itemId}`, { method: "DELETE" });
      await loadTemplate();
    } finally {
      setIsWorking(false);
    }
  };

  const handleExport = () => {
    const payload = {
      name,
      tracks: items.map((item) => ({ title: item.title, artist: item.artist })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "playlist"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(`/api/vinyl-search?q=${encodeURIComponent(searchTerm)}`);
      const payload = await response.json();
      setSearchResults(payload.data ?? []);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddTrack = async (result: SearchResult) => {
    setIsWorking(true);
    try {
      await fetch("/api/game-template-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          inventoryId: result.inventory_id,
          recordingId: result.recording_id,
          title: result.title,
          artist: result.artist,
          side: result.side,
          position: result.position,
        }),
      });
      await loadTemplate();
    } finally {
      setIsWorking(false);
    }
  };

  if (!template) {
    return (
      <div className="min-h-screen bg-slate-50">
        <BingoHeader backHref="/admin/games/bingo/templates" title="Edit Playlist" />
        <div className="mx-auto w-full max-w-4xl px-6 py-10 text-sm text-slate-500">Loading playlist...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/admin/games/bingo/templates" className="text-slate-400 hover:text-white">
            ←
          </Link>
          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Playlist Editor</div>
            <div className="text-sm font-semibold">Edit Playlist</div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-full border border-slate-700 p-2 text-slate-300 hover:text-white"
            aria-label="Export playlist"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-xs text-slate-300">
          <span className="mr-2 rounded-full border border-rose-500 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-300">
            Warning
          </span>
          This playlist is not compatible with automatic playback. It will need to be managed manually.
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">{name}</div>
            <div className="text-xs text-slate-400">{trackCount} songs</div>
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="mt-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-300"
            >
              <Pencil className="h-3 w-3" />
              Edit Details
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:border-slate-500"
          >
            Copy Link
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="border-b border-slate-800 px-5 py-4 text-sm font-semibold">Songs</div>
          {items.length === 0 ? (
            <div className="px-5 py-6 text-sm text-slate-400">No tracks in this playlist.</div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b border-slate-800 px-5 py-3 last:border-b-0">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                  <div className="text-xs text-slate-400">{item.artist}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"
                  aria-label="Remove track"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="text-sm font-semibold">Add Tracks</div>
          <p className="mt-1 text-xs text-slate-400">Search your vinyl collection and add tracks.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by song or artist..."
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearching || !searchTerm.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Search
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {isSearching ? (
              <p className="text-sm text-slate-400">Searching...</p>
            ) : searchResults.length === 0 ? (
              <p className="text-sm text-slate-400">No results yet.</p>
            ) : (
              searchResults.map((result, index) => (
                <div
                  key={`${result.recording_id ?? "track"}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{result.title}</div>
                    <div className="text-xs text-slate-400">{result.artist}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddTrack(result)}
                    disabled={isWorking}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
                  >
                    Add
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isWorking}
          className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Save Changes
        </button>
      </main>

      {showDetails ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 p-6 text-slate-100 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="text-lg font-semibold">Edit Details</div>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="rounded-full border border-slate-700 p-2 text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5">
              <label className="text-xs uppercase tracking-wide text-slate-400">Title</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-5">
              <label className="text-xs uppercase tracking-wide text-slate-400">Color</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAccent(color)}
                    className={`h-8 w-8 rounded-md border ${
                      accent === color ? "border-white" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Setlist Mode</div>
                <div className="text-xs text-slate-400">Keep the songs in order when creating a game.</div>
              </div>
              <button
                type="button"
                onClick={() => setSetlistMode((prev) => !prev)}
                className={`h-6 w-11 rounded-full p-1 transition ${
                  setlistMode ? "bg-indigo-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white transition ${
                    setlistMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="mt-5">
              <div className="text-sm font-semibold">Jumbotron Videos</div>
              <p className="text-xs text-slate-400">Provide video URLs for the large screen display.</p>
              <div className="mt-3 space-y-3">
                <input
                  value={defaultVideo}
                  onChange={(event) => setDefaultVideo(event.target.value)}
                  placeholder="Default video URL"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  value={preGameVideo}
                  onChange={(event) => setPreGameVideo(event.target.value)}
                  placeholder="Pre-game video URL"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isWorking}
              className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
