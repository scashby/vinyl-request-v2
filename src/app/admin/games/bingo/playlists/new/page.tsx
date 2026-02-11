"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Page() {
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

      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900">Create a Custom Playlist</h1>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Link
            href="/admin/games/bingo/playlists/import/vinyl"
            className="flex items-center justify-between border-b border-slate-200 px-6 py-5 text-left hover:bg-slate-50"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">Import from Vinyl Collection</div>
              <div className="text-xs text-slate-500">
                Build a playlist from your collection, then customize the titles and playback notes.
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>

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
