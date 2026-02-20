"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function GenreImposterAssistantPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#1d1610,#140f0a)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-amber-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-amber-100">Genre Imposter Assistant</h1>
          <Link href="/admin/games/genre-imposter" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Assistant Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Fast table-by-table pick capture (imposter slot + reason summary).</li>
            <li>Flag disputed reasons before host locks scoring.</li>
            <li>Apply reason bonus overrides with explicit note for audit trail.</li>
            <li>Track missing picks and late submissions in real time.</li>
            <li>Mirror host status so handoffs remain stable if solo host gets interrupted.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Solo-host mode: this scope collapses into a compact drawer on the host page until a second operator is available.
        </section>
      </div>
    </div>
  );
}
