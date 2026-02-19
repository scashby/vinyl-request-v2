"use client";

import Link from "next/link";

export default function GamesHomePage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(145deg,#f7efe2_0%,#efe3d4_100%)] p-6">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-stone-300 bg-[#fdf8f0] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">New Build</p>
          <h1 className="mt-2 text-4xl font-black text-stone-900">Game Admin Center</h1>
          <p className="mt-3 max-w-2xl text-sm text-stone-700">
            Fresh implementation. No legacy game routes or legacy game tables are used.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Link
              href="/admin/games/bingo"
              className="group rounded-2xl border border-stone-300 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <p className="text-xs uppercase tracking-wide text-stone-500">Active</p>
              <h2 className="mt-1 text-2xl font-bold text-stone-900">Vinyl Bingo</h2>
              <p className="mt-2 text-sm text-stone-700">
                Host, assistant, jumbotron, call-card verification, and printable cards.
              </p>
              <p className="mt-4 text-sm font-semibold text-rose-700">Open</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
