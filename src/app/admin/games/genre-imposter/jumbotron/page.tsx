"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function GenreImposterJumbotronPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#050505)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-teal-900/40 bg-black/55 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-teal-100">Genre Imposter Jumbotron</h1>
          <Link href="/admin/games/genre-imposter" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-200">Jumbotron Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Display current category card and round number with high-contrast typography.</li>
            <li>Show spin progress (1 of 3, 2 of 3, 3 of 3) without revealing imposter early.</li>
            <li>After lock, run reveal state with imposter highlight and reason summary.</li>
            <li>Present scoreboard deltas for imposter hit and reason bonus.</li>
            <li>Keep standby slide with pacing timer while DJ resets the decks.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Use oversized category and round labels for readability at long distance in brewery lighting.
        </section>
      </div>
    </div>
  );
}
