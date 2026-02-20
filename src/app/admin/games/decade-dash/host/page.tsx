"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function DecadeDashHostPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#101628,#07090f)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-sky-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-sky-100">Decade Dash Host Console</h1>
          <Link href="/admin/games/decade-dash" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">Host Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Single-tap round flow: spin prompt, lock decade picks, reveal decade, score exact/adjacent, advance.</li>
            <li>Display a decade cheat strip to speed rulings during brewery noise.</li>
            <li>Keep a pacing timer visible between rounds for resleeve/find/cue buffer.</li>
            <li>Provide quick all-miss and all-adjacent shortcuts for solo-host throughput.</li>
            <li>Allow simple correction with audit note instead of destructive score rewrites.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Solo-host default: every required control lives here without assistant dependency.
        </section>
      </div>
    </div>
  );
}
