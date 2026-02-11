"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";

type TemplateItem = {
  id: number;
  title: string;
  artist: string;
};

type ImportResult = {
  templateId: number;
  name: string;
  matched: number;
  unmatched: number;
  items: TemplateItem[];
};

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setIsWorking(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/game-templates/import-json", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Failed to import JSON.");
        return;
      }
      setResult({
        templateId: payload.data.template.id,
        name: payload.data.template.name,
        matched: payload.data.matched,
        unmatched: payload.data.unmatched,
        items: payload.data.items ?? [],
      });
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/admin/games/bingo/playlists/new" className="text-slate-500 hover:text-slate-900">
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

      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900">Import a JSON File</h1>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Required Format</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">JSON playlist</div>
          <p className="mt-2 text-xs text-slate-500">
            Expected format: an array of objects with "title" and "artist" keys. We will match those against your vinyl collection.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="file"
              accept="application/json"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || isWorking}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {isWorking ? "Loading..." : "Upload JSON"}
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600">
              {error}
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Ready for Import</h2>
                <div className="mt-1 text-xs text-slate-500">{result.name}</div>
              </div>
              <div className="text-xs text-slate-500">
                Matched: {result.matched} · Missing: {result.unmatched}
              </div>
            </div>

            <div className="mt-4 max-h-64 overflow-auto rounded-xl border border-slate-200">
              {result.items.map((item) => (
                <div key={item.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                  <div className="text-xs text-slate-500">{item.artist}</div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => (window.location.href = `/admin/games/bingo?templateId=${result.templateId}`)}
              className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Continue
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
