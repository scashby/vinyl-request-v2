"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function NameThatTuneJumbotronScopePage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#5f112e,transparent_38%),linear-gradient(180deg,#020202,#0d0d0d)] p-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6 rounded-3xl border border-rose-700/40 bg-black/40 p-8">
        <h1 className="text-5xl font-black uppercase tracking-tight text-rose-200">Name That Tune</h1>
        <p className="text-xl text-stone-100">Session {Number.isFinite(sessionId) ? `#${sessionId}` : "(waiting for host)"}.</p>
        <ul className="list-disc space-y-2 pl-5 text-lg text-stone-200">
          <li>Audience-only scene: round, snippet number, lock-in timer, and simple status prompts.</li>
          <li>No answer leakage until host reveal.</li>
          <li>Compact top-5 scoreboard between calls to reduce cognitive load.</li>
        </ul>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/name-that-tune">Setup</Link>
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/name-that-tune/host">Host</Link>
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/name-that-tune/history">History</Link>
        </div>
      </div>
    </div>
  );
}
