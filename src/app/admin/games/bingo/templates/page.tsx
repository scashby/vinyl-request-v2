"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BingoHeader from "../_components/BingoHeader";
import { Plus, ChevronRight } from "lucide-react";

type TemplateSummary = {
  id: number;
  name: string;
  source: string | null;
  setlist_mode: boolean;
};

export default function Page() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);

  const refreshTemplates = async () => {
    const response = await fetch("/api/game-templates");
    const payload = await response.json();
    setTemplates(payload.data ?? []);
  };

  useEffect(() => {
    void refreshTemplates();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <BingoHeader backHref="/admin/games/bingo" title="Playlists" />

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Your Custom Playlists</h1>
            <p className="text-sm text-slate-500">
              Vinyl-only playlists built from your collection and imports.
            </p>
          </div>
          <Link
            href="/admin/games/bingo/playlists/new"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            New Playlist
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {templates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No playlists yet. Build one from your vinyl collection or import a spreadsheet.
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">{template.name}</div>
                  <div className="text-xs text-slate-500">
                    {template.source ?? "custom"} · {template.setlist_mode ? "Setlist" : "Shuffle"}
                  </div>
                </div>
                <Link
                  href={`/admin/games/bingo/templates/${template.id}`}
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600"
                >
                  Edit
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
