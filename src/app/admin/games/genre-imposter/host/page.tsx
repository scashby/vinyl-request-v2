"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function GenreImposterHostPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0f1e1b,#0a120f)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-emerald-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-emerald-100">Genre Imposter Host Console</h1>
          <Link href="/admin/games/genre-imposter" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">Host Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Advance round and display category card before first spin.</li>
            <li>Track 3-spin flow per round with call index and quick status markers.</li>
            <li>Lock picks after spin three, then run reveal and imposter confirmation.</li>
            <li>Award 2 points for correct imposter and optional +1 reason bonus per team.</li>
            <li>Show pacing countdown buffer for resleeve/find/cue before next round.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Solo-host default: keep this page one-column, keyboard-first, with a single next-action control always visible.
        </section>
      </div>
    </div>
  );
}
