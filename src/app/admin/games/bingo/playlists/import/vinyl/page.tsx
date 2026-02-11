"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";

export default function Page() {
  const [isWorking, setIsWorking] = useState(false);

  const handleBuild = async () => {
    setIsWorking(true);
    try {
      const response = await fetch("/api/game-templates", { method: "POST" });
      const payload = await response.json();
      const templateId = payload.data?.id;
      if (templateId) {
        window.location.href = `/admin/games/bingo?templateId=${templateId}`;
      }
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
          <h1 className="text-xl font-semibold text-slate-900">Build from Vinyl Collection</h1>
          <p className="mt-2 text-sm text-slate-500">Generate a playlist directly from your collection.</p>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ready to build</div>
          <p className="mt-2 text-sm text-slate-600">
            We’ll pull tracks from your vinyl inventory and create a new playlist for bingo.
          </p>

          <button
            type="button"
            onClick={handleBuild}
            disabled={isWorking}
            className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {isWorking ? "Building..." : "Build Playlist"}
          </button>
        </div>
      </main>
    </div>
  );
}
