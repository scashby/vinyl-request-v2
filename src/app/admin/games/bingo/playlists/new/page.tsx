"use client";

import Link from "next/link";
import { useState } from "react";
import BingoHeader from "../../_components/BingoHeader";
import { ChevronRight } from "lucide-react";

export default function Page() {
  const [isBuilding, setIsBuilding] = useState(false);

  const handleBuildFromCollection = async () => {
    setIsBuilding(true);
    try {
      const response = await fetch("/api/game-templates", { method: "POST" });
      const payload = await response.json();
      const templateId = payload.data?.id;
      if (templateId) {
        window.location.href = `/admin/games/bingo?templateId=${templateId}`;
      }
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <BingoHeader backHref="/admin/games/bingo" title="Create Playlist" />

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900">Create a Custom Playlist</h1>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={handleBuildFromCollection}
            disabled={isBuilding}
            className="flex w-full items-center justify-between border-b border-slate-200 px-6 py-5 text-left hover:bg-slate-50"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">Build from Vinyl Collection</div>
              <div className="text-xs text-slate-500">
                Pull songs directly from your collection and generate a fresh playlist.
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>

          <Link
            href="/admin/games/bingo/playlists/import/csv"
            className="flex items-center justify-between border-b border-slate-200 px-6 py-5 text-left hover:bg-slate-50"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">Import a Spreadsheet</div>
              <div className="text-xs text-slate-500">
                Upload a CSV document to import songs in bulk.
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>

          <Link
            href="/admin/games/bingo/playlists/import/json"
            className="flex items-center justify-between px-6 py-5 text-left hover:bg-slate-50"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">Import a JSON File</div>
              <div className="text-xs text-slate-500">Upload a playlist in JSON format.</div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>
        </div>

        <div className="mt-10 text-center text-xs text-slate-400">
          By continuing, I acknowledge and confirm that I have read the terms of service and agree to be bound by such terms.
        </div>
      </main>
    </div>
  );
}
