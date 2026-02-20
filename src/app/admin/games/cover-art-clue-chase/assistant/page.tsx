"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function CoverArtClueChaseAssistantPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#111c20,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-cyan-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-cyan-100">Cover Art Clue Chase Assistant</h1>
          <Link href="/admin/games/cover-art-clue-chase" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Assistant Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Optional score-entry helper and tie-check only.</li>
            <li>No reveal transport controls so host pacing stays centralized.</li>
            <li>Queue next round image deck readiness check while host scores current round.</li>
            <li>Solo fallback: this view remains optional and non-blocking.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
