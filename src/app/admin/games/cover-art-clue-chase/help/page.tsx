"use client";

import Link from "next/link";

export default function CoverArtClueChaseHelpPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0e1719,#060708)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-teal-900/50 bg-black/45 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-teal-100">Cover Art Clue Chase Instructions</h1>
          <Link href="/admin/games/cover-art-clue-chase" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">
            Back to Setup
          </Link>
        </div>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-200">How To Run A Round</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm text-stone-200">
            <li>Reveal stage 1 cover image.</li>
            <li>If needed, reveal stage 2 image.</li>
            <li>Reveal final image and optional audio clue only as fallback.</li>
            <li>Score teams with the configured 3/2/1 model (or override when needed).</li>
            <li>Advance to the next call and keep the gap timer visible.</li>
          </ol>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-200">Operational Checklist</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>All calls have 3 valid reveal URLs before session start.</li>
            <li>Reveal order is hardest-to-easiest for each call.</li>
            <li>Audio clues are staged for failure recovery, not default play.</li>
            <li>Use pause/resume when disputes threaten pacing.</li>
            <li>Session history should be filtered by event for post-night review.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Deep docs in repo:
          <div className="mt-2 space-y-1 font-mono text-xs text-teal-200">
            <p>docs/cover-art-clue-chase-host-runbook.md</p>
            <p>docs/cover-art-clue-chase-smoke-test.md</p>
          </div>
        </section>
      </div>
    </div>
  );
}
