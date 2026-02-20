"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function LyricGapRelayHostPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#1a1120,#09090b)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-fuchsia-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-fuchsia-100">Lyric Gap Relay Host Console</h1>
          <Link href="/admin/games/lyric-gap-relay" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-fuchsia-200">Host Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Single next-action flow: ask gap, lock answers, reveal official line, score 2/1/0, advance.</li>
            <li>Keep official answer key visible for each call to reduce disputes and speed rulings.</li>
            <li>Display pacing timer budget between calls for resleeve/find/cue.</li>
            <li>Support one-tap miss for all teams when no close answers are plausible.</li>
            <li>Defer advanced edits; favor fast corrections with a brief dispute note field.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Solo-host default: do not require second-screen controls to finish a round.
        </section>
      </div>
    </div>
  );
}
