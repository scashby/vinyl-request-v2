"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function Page() {
  const [colorMode, setColorMode] = useState<"auto" | "light" | "dark">("light");
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("sessionId");

  const sessionSuffix = sessionId ? `?sessionId=${sessionId}` : "";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Link href={`/admin/games/bingo/host${sessionSuffix}`} className="text-slate-500 hover:text-slate-900">←</Link>
          <div className="text-center">
            <div className="text-sm font-semibold text-slate-900">Game Settings</div>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-slate-500 hover:text-slate-900"
          >
            ×
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl px-6 py-10 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Sidekicks View</div>
              <div className="text-xs text-slate-500">Share this link with co-hosts so they can see the playlist.</div>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className="rounded-lg border border-indigo-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600"
            >
              Copy Link
            </button>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Jumbotron View</div>
              <div className="text-xs text-slate-500">Display lyrics or videos on a large screen.</div>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className="rounded-lg border border-indigo-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600"
            >
              Copy Link
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4 text-sm font-semibold text-slate-900">Gameplay</div>
          <Link
            href={`/admin/games/bingo/setup${sessionSuffix}`}
            className="flex items-center justify-between border-b border-slate-200 px-6 py-4 text-sm text-slate-700 hover:bg-slate-50"
          >
            Manage how guests experience the game.
            <span className="text-slate-400">›</span>
          </Link>
          <Link
            href={`/admin/games/bingo/settings/join${sessionSuffix}`}
            className="flex items-center justify-between border-b border-slate-200 px-6 py-4 text-sm text-slate-700 hover:bg-slate-50"
          >
            Join Screen URL
            <span className="text-slate-400">›</span>
          </Link>
          <Link
            href={`/admin/games/bingo/settings/branding${sessionSuffix}`}
            className="flex items-center justify-between border-b border-slate-200 px-6 py-4 text-sm text-slate-700 hover:bg-slate-50"
          >
            Branding Settings
            <span className="text-slate-400">›</span>
          </Link>
          <Link
            href={`/admin/games/bingo/settings/venue${sessionSuffix}`}
            className="flex items-center justify-between px-6 py-4 text-sm text-slate-700 hover:bg-slate-50"
          >
            Venues
            <span className="text-slate-400">›</span>
          </Link>
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

        <button
          type="button"
          onClick={() => router.back()}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Done
        </button>
      </main>
    </div>
  );
}
