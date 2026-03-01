import Link from "next/link";

export default function WrongLyricChallengeHelpPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl space-y-4 rounded-3xl border border-red-900/40 bg-black/45 p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-red-300">Operator Guide</p>
            <h1 className="text-3xl font-black uppercase text-red-100">Wrong Lyric Challenge Help</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/admin/games/wrong-lyric-challenge" className="rounded border border-stone-600 px-3 py-1">Setup</Link>
            <Link href="/admin/games/wrong-lyric-challenge/host" className="rounded border border-stone-600 px-3 py-1">Host</Link>
            <Link href="/admin/games/wrong-lyric-challenge/history" className="rounded border border-stone-600 px-3 py-1">History</Link>
          </div>
        </header>

        <section className="rounded-xl border border-stone-700 bg-stone-950/65 p-4 text-sm">
          <h2 className="text-base font-semibold text-red-200">Quick Start</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-stone-200">
            <li>Select event + playlist bank, set rounds/scoring, and confirm pacing budget.</li>
            <li>Enter teams and call rows in `Artist - Title | correct lyric | decoys` format.</li>
            <li>Create session, then open host and jumbotron views.</li>
            <li>Run lifecycle: ask, lock picks, reveal, score, advance.</li>
            <li>Use pause/resume whenever vinyl reset timing slips.</li>
          </ol>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/65 p-4 text-sm">
          <h2 className="text-base font-semibold text-red-200">Host Control Sequence</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-stone-200">
            <li>`Advance Call` starts the next prepared row.</li>
            <li>`Lock Picks` closes team choices.</li>
            <li>`Reveal` displays the correct lyric slot.</li>
            <li>`Save Scores for Current Call` writes or updates all team scores.</li>
            <li>Repeat until session completes.</li>
          </ol>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/65 p-4 text-sm">
          <h2 className="text-base font-semibold text-red-200">Scoring Rules</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-200">
            <li>Correct lyric: base points (`lyric_points`, default 2).</li>
            <li>Song naming bonus: optional bonus points (`song_bonus_points`, default 1).</li>
            <li>Manual point override is available in host/assistant entry forms.</li>
            <li>Scoring is idempotent per `(session_id, team_id, call_id)` and can be corrected.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/65 p-4 text-sm">
          <h2 className="text-base font-semibold text-red-200">Testing References</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-200">
            <li>Module plan: `docs/wrong-lyric-challenge-plan.md`</li>
            <li>Host instructions: `docs/wrong-lyric-challenge-host-instructions.md`</li>
            <li>Smoke test checklist: `docs/wrong-lyric-challenge-smoke-test.md`</li>
            <li>DB migration: `sql/create-wrong-lyric-challenge-core.sql`</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
