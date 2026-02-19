"use client";

import Link from "next/link";

export default function GamesHomePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#4a1f16,transparent_40%),radial-gradient(circle_at_80%_0%,#1f3c42,transparent_35%),linear-gradient(180deg,#121212,#1b1b1b)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-amber-900/50 bg-black/40 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-300">Analog Night Ops</p>
          <h1 className="mt-2 text-5xl font-black uppercase tracking-tight text-amber-100">Game Admin Center</h1>
          <p className="mt-3 max-w-2xl text-sm text-stone-300">
            Vinyl-first control room. Printed play, live host orchestration, and big-screen display scenes.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Link
              href="/admin/games/bingo"
              className="rounded-2xl border border-amber-700/60 bg-gradient-to-br from-amber-950/70 to-red-950/50 p-6 transition hover:-translate-y-0.5 hover:border-amber-400"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Live Module</p>
              <h2 className="mt-1 text-3xl font-black text-amber-100">Music Bingo</h2>
              <p className="mt-2 text-sm text-stone-200">Setup, host, assistant, jumbotron, print pack, and call verification.</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
