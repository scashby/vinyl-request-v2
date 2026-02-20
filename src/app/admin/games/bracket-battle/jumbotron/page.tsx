"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function BracketBattleJumbotronPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#050505)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-fuchsia-900/40 bg-black/55 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-fuchsia-100">Bracket Battle Jumbotron</h1>
          <Link href="/admin/games/bracket-battle" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-fuchsia-200">Jumbotron Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Show current matchup with seed labels and artist/title prompts.</li>
            <li>Display round stage and live bracket progression tree.</li>
            <li>Show vote countdown timer and lock state.</li>
            <li>Display winner reveal transition with automatic next-matchup standby.</li>
            <li>Optional standings ticker for top bracket scores.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Keep typography large and high-contrast for mixed lighting and long viewing distance in brewery rooms.
        </section>
      </div>
    </div>
  );
}
