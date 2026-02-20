"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function NeedleDropRouletteJumbotronPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_45%_0%,#6b2f00,transparent_40%),linear-gradient(180deg,#020202,#0a0a0a)] p-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6 rounded-3xl border border-orange-700/40 bg-black/40 p-8">
        <h1 className="text-5xl font-black uppercase tracking-tight text-orange-200">Needle Drop Roulette</h1>
        <p className="text-xl text-stone-100">Session {sessionId ?? "(waiting for host)"}.</p>
        <ul className="list-disc space-y-2 pl-5 text-lg text-stone-200">
          <li>Display round number, answer lock status, and next-drop standby countdown.</li>
          <li>No answer leakage until reveal state is active.</li>
          <li>Large, high-contrast scoreboard snapshots between rounds.</li>
          <li>Optional prompt banner: artist + title scoring rubric (2/1/0).</li>
        </ul>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/needle-drop-roulette">Setup</Link>
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/needle-drop-roulette/host">Host</Link>
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/needle-drop-roulette/history">History</Link>
        </div>
      </div>
    </div>
  );
}
