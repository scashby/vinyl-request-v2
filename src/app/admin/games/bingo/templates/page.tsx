"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";

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
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/admin/games/bingo" className="text-slate-500 hover:text-slate-900">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Image src="/images/Skulllogo.png" alt="Dead Wax Dialogues" width={28} height={28} />
            <div className="text-center">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Dead Wax</div>
              <div className="text-sm font-semibold text-slate-900">Bingo</div>
            </div>
          </div>
          <div className="w-6" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Your Custom Playlists</h1>
            <p className="text-sm text-slate-500">Playlists you’ve imported and fine-tuned.</p>
          </div>
          <Link
            href="/admin/games/bingo/playlists/new"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            New Playlist
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4">
          {templates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No playlists yet. Build one from your vinyl collection or import a spreadsheet.
            </div>
          ) : (
            templates.map((template) => (
              <Link
                key={template.id}
                href={`/admin/games/bingo/templates/${template.id}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">{template.name}</div>
                  <div className="text-xs text-slate-500">
                    {template.source ?? "custom"} · {template.setlist_mode ? "Setlist" : "Shuffle"}
                  </div>
                </div>
                <span className="text-xs font-semibold text-indigo-600">Edit</span>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
