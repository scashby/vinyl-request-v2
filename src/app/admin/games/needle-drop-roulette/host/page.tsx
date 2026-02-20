"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function NeedleDropRouletteHostPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#140c09,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-orange-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-orange-100">Needle Drop Roulette Host</h1>
          <Link href="/admin/games/needle-drop-roulette" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-200">Host Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Single-action loop: start drop, lock answers, reveal key, score, advance round.</li>
            <li>Default countdown blocks for resleeve/find/cue before enabling next drop.</li>
            <li>Fast team scoring matrix with artist/title toggles and automatic 0/1/2 points.</li>
            <li>Emergency controls: pause timer, replay short drop, insert backup round.</li>
            <li>Keep host actions keyboard-first to reduce attention split on solo-DJ nights.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
