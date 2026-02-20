"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function CoverArtClueChaseHostPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#102126,#09090b)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-cyan-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-cyan-100">Cover Art Clue Chase Host Console</h1>
          <Link href="/admin/games/cover-art-clue-chase" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Host Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Single action stack: reveal stage 1, reveal stage 2, reveal final or audio clue, score, advance.</li>
            <li>One-tap scoring presets for 3/2/1 points with optional all-miss fallback during noisy rounds.</li>
            <li>Pinned pacing timer to protect resleeve/find/cue budget between rounds.</li>
            <li>Fast correction lane with short dispute notes to avoid host context switching.</li>
            <li>Deck completeness warning if any round is missing one of three reveal assets.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Solo-host default: host can complete full round lifecycle without assistant actions.
        </section>
      </div>
    </div>
  );
}
