"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function NameThatTuneHostScopePage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#171717)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl space-y-4 rounded-3xl border border-stone-700 bg-black/50 p-6">
        <h1 className="text-3xl font-black uppercase text-rose-200">Name That Tune Host Scope</h1>
        <p className="text-sm text-stone-300">Session {Number.isFinite(sessionId) ? `#${sessionId}` : "(select from setup)"}.</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-stone-200">
          <li>Show current snippet, lock-in countdown, and pacing countdown.</li>
          <li>Single-action controls: start snippet, lock answers, reveal, score, advance.</li>
          <li>Quick score grid per team: artist correct, title correct, auto points (0/1/2).</li>
          <li>Emergency controls: pause, replay last snippet, insert backup call.</li>
        </ul>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/name-that-tune">Setup</Link>
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/name-that-tune/assistant">Assistant</Link>
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/name-that-tune/jumbotron">Jumbotron</Link>
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/name-that-tune/history">History</Link>
        </div>
      </div>
    </div>
  );
}
