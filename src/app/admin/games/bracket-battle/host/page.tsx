"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function BracketBattleHostPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0e1620,#090d12)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-cyan-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-cyan-100">Bracket Battle Host Console</h1>
          <Link href="/admin/games/bracket-battle" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Host Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Advance bracket round/matchup and announce contenders.</li>
            <li>Start and lock voting windows by method: hands or slips.</li>
            <li>Capture winner, auto-advance bracket node, and trigger score refresh.</li>
            <li>Show pacing countdown buffer for resleeve/find/cue before the next spin.</li>
            <li>Trigger tie-breaker matchup flow when votes are tied.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          MVP implementation note: keep this screen keyboard-first and one-column so solo host operation stays reliable under brewery-floor constraints.
        </section>
      </div>
    </div>
  );
}
