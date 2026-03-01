import Link from "next/link";

export default function SampleDetectiveHelpPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-green-900/40 bg-black/45 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-green-100">Sample Detective Help</h1>
          <Link href="/admin/games/sample-detective" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">
          Testing build guidance for setup, host flow, and smoke testing.
        </p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-200">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-green-200">Primary Docs</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li><code>docs/sample-detective-instructions.md</code> for operator flow.</li>
            <li><code>docs/sample-detective-smoke-test.md</code> for validation checklist.</li>
            <li><code>docs/sample-detective-module-plan.md</code> for model and phase rationale.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-300">
          Runtime now includes host controls, call lifecycle actions, scoring, leaderboard, and live jumbotron updates.
        </section>
      </div>
    </div>
  );
}
