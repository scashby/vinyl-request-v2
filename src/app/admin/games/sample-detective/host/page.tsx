"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function SampleDetectiveHostPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#1a2012,#09090b)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-emerald-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-emerald-100">Sample Detective Host Console</h1>
          <Link href="/admin/games/sample-detective" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">Host Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>One-path round flow: play sample, capture team calls, reveal source, score 2 + optional 1 bonus.</li>
            <li>Show source answer card only after lock to keep table fairness in noisy rooms.</li>
            <li>Include visible pacing timer for resleeve/find/cue buffer before next spin.</li>
            <li>Support quick mark-all-miss when no team has pair match to avoid dead air.</li>
            <li>Keep edits lightweight: one correction action with note rather than deep rollback controls.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Solo-host default: all critical actions (ask/reveal/score/advance) must be available on one screen.
        </section>
      </div>
    </div>
  );
}
