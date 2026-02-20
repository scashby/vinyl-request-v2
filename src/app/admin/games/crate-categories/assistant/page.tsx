"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function CrateCategoriesAssistantPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#22170f,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-amber-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-amber-100">Crate Categories Assistant</h1>
          <Link href="/admin/games/crate-categories" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Assistant Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Optional support only: answer aggregation and tie verification after each round.</li>
            <li>No transport controls; track playback remains host-owned to protect cue timing.</li>
            <li>Prep queue helper for next round crate pulls and sleeve order checks.</li>
            <li>Live scratchpad for disputed calls while host keeps game cadence moving.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
