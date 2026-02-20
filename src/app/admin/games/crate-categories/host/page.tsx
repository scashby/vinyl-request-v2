"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function CrateCategoriesHostPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#2a1a11,#0c0a08)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-amber-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-amber-100">Crate Categories Host Console</h1>
          <Link href="/admin/games/crate-categories" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Host Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Single-run lane: open round, play track stack, lock answer window, score, advance.</li>
            <li>Round card pinned with category + prompt type so host never context-switches mid-spin.</li>
            <li>Per-round score shortcuts tied to prompt type to reduce manual entry during busy floor noise.</li>
            <li>Always-on reset timer using remove/resleeve/find/cue/buffer inputs from session setup.</li>
            <li>Fast skip action for damaged vinyl or mis-cued track without breaking round progression.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Solo-host default: host controls all timing, scoring, and progression without assistant dependency.
        </section>
      </div>
    </div>
  );
}
