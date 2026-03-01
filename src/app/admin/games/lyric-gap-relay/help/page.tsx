import Link from "next/link";

const deckLineExample = "Artist - Title | Cue lyric text >>> Official answer text ;; Optional alternate answer | Source note";

export default function LyricGapRelayHelpPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0f0a12,#08080a)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl space-y-4 rounded-3xl border border-fuchsia-900/40 bg-black/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-fuchsia-200">Lyric Gap Relay Help</h1>
          <div className="flex gap-2 text-xs">
            <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/lyric-gap-relay">Setup</Link>
            <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/lyric-gap-relay/history">History</Link>
          </div>
        </div>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">Quick Start</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-stone-200">
            <li>Create a session from setup with 10-15 lyric gaps and at least 2 teams.</li>
            <li>Open host view and click `Advance Gap` to move into the next call.</li>
            <li>Use `Mark Asked` when cue lyric is live, then `Lock Answers` and `Reveal`.</li>
            <li>Score each team as exact/close/miss and save scores.</li>
            <li>Use pause/resume during deck reset delays.</li>
          </ol>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">Deck Input Format</h2>
          <p className="mt-2 text-stone-300">One lyric gap per line in setup:</p>
          <pre className="mt-2 overflow-x-auto rounded border border-stone-700 bg-black/40 p-3 text-xs text-stone-200">
            {deckLineExample}
          </pre>
          <p className="mt-2 text-stone-400">Use `;;` to add accepted alternate phrasings after the official line.</p>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">Scoring Rules</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-200">
            <li>Exact lyric line: 2 points.</li>
            <li>Close-enough lyric: 1 point.</li>
            <li>Miss/no answer: 0 points.</li>
            <li>Keep official answer key visible in host view to resolve disputes quickly.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          For full repository docs, see `docs/lyric-gap-relay-instructions.md` and `docs/lyric-gap-relay-smoke-test.md`.
        </section>
      </div>
    </div>
  );
}
