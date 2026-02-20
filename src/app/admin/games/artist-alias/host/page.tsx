"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ArtistAliasHostPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#1c1130,#09090b)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-violet-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-violet-100">Artist Alias Host Console</h1>
          <Link href="/admin/games/artist-alias" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-200">Host Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>One-track action rail: stage 1 clue, stage 2 clue, stage 3 clue, score, advance.</li>
            <li>Fixed score presets (3/2/1) plus quick zero-point miss for noisy floor rounds.</li>
            <li>Visible pacing timer based on resleeve/find/cue/host buffer target.</li>
            <li>Alias acceptance helper so host can quickly validate known alternate names.</li>
            <li>No dependency on assistant controls for round progression.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
