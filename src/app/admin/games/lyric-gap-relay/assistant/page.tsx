"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function LyricGapRelayAssistantPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#17101b,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-fuchsia-900/50 bg-black/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-fuchsia-100">Lyric Gap Relay Assistant</h1>
          <div className="flex gap-2">
            <Link href="/admin/games/lyric-gap-relay/help" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Help</Link>
            <Link href="/admin/games/lyric-gap-relay" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
          </div>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-fuchsia-200">Assistant Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Optional scorer helper only: team-by-team 2/1/0 entry and dispute notes.</li>
            <li>No transport or round-advance controls; host owns timing and reveals.</li>
            <li>Provide quick tally checks against host totals before lock.</li>
            <li>Solo fallback: assistant features should collapse into host-side drawer.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
