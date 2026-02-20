"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ArtistAliasJumbotronPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#040404)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-violet-900/40 bg-black/55 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-violet-100">Artist Alias Jumbotron</h1>
          <Link href="/admin/games/artist-alias" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-200">Jumbotron Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Large clue stage presentation: Era, then Collaborator, then Label/Region.</li>
            <li>Persistent stage badge so teams know when scoring drops from 3 to 2 to 1.</li>
            <li>Optional countdown block during vinyl reset windows.</li>
            <li>Scoreboard strip remains visible only when host enables it.</li>
            <li>High-contrast typography for brewery viewing distance.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
