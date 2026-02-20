"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function OriginalOrCoverJumbotronPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#040404)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-amber-900/40 bg-black/55 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-amber-100">Original or Cover Jumbotron</h1>
          <Link href="/admin/games/original-or-cover" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Jumbotron Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Large binary prompt each round: ORIGINAL or COVER.</li>
            <li>Persistent scoring legend: +2 correct call, +1 original artist.</li>
            <li>Visible pacing countdown during vinyl reset windows.</li>
            <li>Clear reveal state: accepting guesses, scoring, round complete.</li>
            <li>High-contrast typography for noisy brewery sightlines.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
