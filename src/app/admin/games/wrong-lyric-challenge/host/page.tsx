"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function WrongLyricChallengeHostPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#1a1410,#09090b)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-amber-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-amber-100">Wrong Lyric Challenge Host Console</h1>
          <Link href="/admin/games/wrong-lyric-challenge" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Host Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Single next-action flow: present options, lock picks, play clip, reveal correct lyric, score, advance.</li>
            <li>Keep one-call deck card visible with answer slot hidden until reveal.</li>
            <li>Run pacing timer against target gap to protect resleeve/find/cue transitions.</li>
            <li>Support one-tap round skip for deck quality issues or cue misses.</li>
            <li>Allow quick score overrides with required note for audit trail.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Solo-host fallback: this page must remain operable without assistant presence.
        </section>
      </div>
    </div>
  );
}
