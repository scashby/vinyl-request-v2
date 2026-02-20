"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function BackToBackConnectionJumbotronPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#040404)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-amber-900/40 bg-black/55 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-amber-100">Back-to-Back Connection Jumbotron</h1>
          <Link href="/admin/games/back-to-back-connection" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Jumbotron Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Display only prompt and countdown while teams discuss; hide answer key until reveal.</li>
            <li>Keep large round marker and scoreboard visible at brewery distance.</li>
            <li>Show pacing timer between rounds to support record handling buffer.</li>
            <li>Connection + detail scoring legend always visible: 2 + 1.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
