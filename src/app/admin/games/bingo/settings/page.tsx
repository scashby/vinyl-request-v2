"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Page() {
  const [colorMode, setColorMode] = useState<"auto" | "light" | "dark">("light");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/admin/games/bingo" className="text-slate-500 hover:text-slate-900">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="text-center">
            <div className="text-sm font-semibold text-slate-900">Settings</div>
          </div>
          <div className="w-6" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl px-6 py-10 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Spotify Connection</div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-200" />
            <div>
              <div className="text-sm font-semibold text-slate-900">Dead Wax Dialogues</div>
              <div className="text-xs text-slate-500">Connected</div>
            </div>
          </div>
          <button
            type="button"
            className="mt-4 w-full rounded-lg border border-indigo-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600"
          >
            Disconnect Spotify
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Color Mode</div>
          <div className="mt-3 grid grid-cols-3 rounded-xl border border-slate-200 text-xs font-semibold">
            {["auto", "light", "dark"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setColorMode(mode as "auto" | "light" | "dark")}
                className={`px-3 py-2 ${
                  colorMode === mode ? "bg-indigo-600 text-white" : "text-slate-600"
                }`}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Link
            href="/admin/games/bingo/settings/jumbotron"
            className="flex items-center justify-between border-b border-slate-200 px-6 py-4 text-sm text-slate-700 hover:bg-slate-50"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">Jumbotron</div>
              <div className="text-xs text-slate-500">Customize a page intended as a large video screen display.</div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>
          <Link
            href="/admin/games/bingo/settings/branding"
            className="flex items-center justify-between border-b border-slate-200 px-6 py-4 text-sm text-slate-700 hover:bg-slate-50"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">Branding Settings</div>
              <div className="text-xs text-slate-500">Customize how your brand appears throughout the application.</div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>
          <Link
            href="/admin/games/bingo/settings/join"
            className="flex items-center justify-between border-b border-slate-200 px-6 py-4 text-sm text-slate-700 hover:bg-slate-50"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">Join Screen URL</div>
              <div className="text-xs text-slate-500">Customize the web address guests join games from.</div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>
          <Link
            href="/admin/games/bingo/settings/venue"
            className="flex items-center justify-between px-6 py-4 text-sm text-slate-700 hover:bg-slate-50"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">Venues</div>
              <div className="text-xs text-slate-500">Manage the locations you host games at.</div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>
        </div>

        <button
          type="button"
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Done
        </button>
      </main>
    </div>
  );
}
