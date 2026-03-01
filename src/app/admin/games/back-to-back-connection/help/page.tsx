import Link from "next/link";

export default function BackToBackConnectionHelpPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl space-y-4 rounded-3xl border border-amber-900/40 bg-black/45 p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber-300">Operator Guide</p>
            <h1 className="text-3xl font-black uppercase text-amber-100">Back-to-Back Connection Help</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/admin/games/back-to-back-connection" className="rounded border border-stone-600 px-3 py-1">Setup</Link>
            <Link href="/admin/games/back-to-back-connection/host" className="rounded border border-stone-600 px-3 py-1">Host</Link>
            <Link href="/admin/games/back-to-back-connection/history" className="rounded border border-stone-600 px-3 py-1">History</Link>
          </div>
        </header>

        <section className="rounded-xl border border-stone-700 bg-stone-950/65 p-4 text-sm">
          <h2 className="text-base font-semibold text-amber-200">Quick Start</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-stone-200">
            <li>Select event and playlist bank, set rounds, and confirm pacing budget.</li>
            <li>Enter teams and pair deck lines in `Track A | Track B | Connection | Optional detail` format.</li>
            <li>Complete preflight, create session, then open host + jumbotron screens.</li>
            <li>Use `Advance Pair` to start each round, then run Track A / Track B / Discussion / Reveal.</li>
            <li>Score each team with connection/detail checkboxes and save scores.</li>
          </ol>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/65 p-4 text-sm">
          <h2 className="text-base font-semibold text-amber-200">Host Control Sequence</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-stone-200">
            <li>`Advance Pair` moves to the next prepared pair and marks track A as started.</li>
            <li>`Track A Played` and `Track B Played` mark progress for audience cues.</li>
            <li>`Open Discussion` starts table debate mode.</li>
            <li>`Reveal Answer` shows accepted connection/detail on jumbotron.</li>
            <li>`Save Scores for Current Pair` writes or updates team scoring rows.</li>
          </ol>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/65 p-4 text-sm">
          <h2 className="text-base font-semibold text-amber-200">Scoring Rules</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-200">
            <li>Connection correct: base points (`connection_points`, default 2).</li>
            <li>Specific detail correct: bonus points (`detail_bonus_points`, default 1).</li>
            <li>Manual point override is allowed during scoring entry.</li>
            <li>Scores are idempotent per `(session_id, team_id, call_id)` and can be updated.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/65 p-4 text-sm">
          <h2 className="text-base font-semibold text-amber-200">Testing References</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-200">
            <li>Module plan: `docs/back-to-back-connection-plan.md`</li>
            <li>Operator instructions: `docs/back-to-back-connection-instructions.md`</li>
            <li>Smoke test checklist: `docs/back-to-back-connection-smoke-test.md`</li>
            <li>DB migration: `sql/create-back-to-back-connection-core.sql`</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
