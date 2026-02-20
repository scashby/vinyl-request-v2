"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function DecadeDashJumbotronPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#040404)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-sky-900/40 bg-black/55 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-sky-100">Decade Dash Jumbotron</h1>
          <Link href="/admin/games/decade-dash" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">Jumbotron Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Show round number and state (listen, lock picks, reveal decade, score, reset).</li>
            <li>Display decade card options during lock window and hide result until reveal.</li>
            <li>Show scoring legend: exact {"=>"} 2, adjacent {"=>"} 1 (optional), miss {"=>"} 0.</li>
            <li>Include high-contrast countdown slide for vinyl reset buffer between spins.</li>
            <li>Prioritize large decade text and concise scoreboard for long-distance readability.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
