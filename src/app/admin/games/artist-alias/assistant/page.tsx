"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ArtistAliasAssistantPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#120d24,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-violet-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-violet-100">Artist Alias Assistant</h1>
          <Link href="/admin/games/artist-alias" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-200">Assistant Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Optional entry-only lane for team guesses and dispute notes.</li>
            <li>No clue reveal or transport controls to keep host timing centralized.</li>
            <li>Next-round readiness check for clue cards while host scores current round.</li>
            <li>Can be omitted entirely for solo-host operation.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
