"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function OriginalOrCoverHostPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#1f1608,#0b0907)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-amber-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-amber-100">Original or Cover Host Console</h1>
          <Link href="/admin/games/original-or-cover" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Host Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Single flow per round: start call, lock original vs cover answer, score, and advance.</li>
            <li>Scoring presets: +2 correct call, +1 original-artist bonus, and all-miss fallback.</li>
            <li>Pinned pacing timer to hold resleeve/find/cue target gap every round.</li>
            <li>Dispute lane with accepted-alt original artist override without leaving host screen.</li>
            <li>Auto warning when remaining backup rounds are below two.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Solo-host default: this console must cover full lifecycle with zero assistant dependencies.
        </section>
      </div>
    </div>
  );
}
