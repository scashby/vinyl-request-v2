"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Download, Pencil, X, Trash2 } from "lucide-react";

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
};

export default function Page() {
  const params = useParams();
  const templateId = Number(params.id);
  const [template, setTemplate] = useState<Template | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [name, setName] = useState("");
  const [setlistMode, setSetlistMode] = useState(false);
  const [accent, setAccent] = useState(COLOR_SWATCHES[5]);
  const [isWorking, setIsWorking] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

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

  const handleSave = async () => {
    setIsWorking(true);
    try {
      await fetch(`/api/game-templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, setlistMode }),
      });
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

  if (!template) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 text-sm text-slate-500">Loading playlist...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/admin/games/bingo" className="text-slate-500 hover:text-slate-900">←</Link>
          <div className="flex items-center gap-2">
            <Image src="/images/Skulllogo.png" alt="Dead Wax Dialogues" width={28} height={28} />
            <div className="text-center leading-tight">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Dead Wax</div>
              <div className="text-sm font-semibold text-slate-900">Edit Playlist</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-full border border-slate-300 p-2 text-slate-600 hover:text-slate-900"
            aria-label="Export playlist"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">
          <span className="mr-2 rounded-full border border-amber-300 px-2 py-0.5 text-[10px] uppercase tracking-wide">
            Warning
          </span>
          This playlist may not be compatible with automatic playback and might need to be managed manually.
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold text-slate-900">{name}</div>
            <div className="text-xs text-slate-500">{items.length} songs</div>
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="mt-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600"
            >
              <Pencil className="h-3 w-3" />
              Edit Details
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700"
          >
            Copy Link
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-900">Songs</div>
          {items.length === 0 ? (
            <div className="px-5 py-6 text-sm text-slate-500">No tracks in this playlist.</div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b border-slate-100 px-5 py-3 last:border-b-0">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                  <div className="text-xs text-slate-500">{item.artist}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-rose-600"
                  aria-label="Remove song"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="text-lg font-semibold text-slate-900">Edit Details</div>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5">
              <label className="text-xs uppercase tracking-wide text-slate-400">Title</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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
                    className={`h-8 w-8 rounded-md border ${accent === color ? "border-slate-900" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Setlist Mode</div>
                <div className="text-xs text-slate-500">Keep song order when creating a game.</div>
              </div>
              <button
                type="button"
                onClick={() => setSetlistMode((prev) => !prev)}
                className={`h-6 w-11 rounded-full p-1 transition ${setlistMode ? "bg-indigo-500" : "bg-slate-200"}`}
              >
                <span className={`block h-4 w-4 rounded-full bg-white transition ${setlistMode ? "translate-x-5" : "translate-x-0"}`} />
              </button>
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
