import Link from "next/link";

export default function MusicTriviaHelpPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0f0a12,#08080a)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl space-y-4 rounded-3xl border border-fuchsia-900/40 bg-black/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-fuchsia-200">Music Trivia Help</h1>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/music-trivia">Setup</Link>
            <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/music-trivia/bank">Question Bank</Link>
            <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/music-trivia/decks">Decks</Link>
            <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/music-trivia/history">History</Link>
          </div>
        </div>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">Quick Start</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-stone-200">
            <li>Build or import questions into the <Link className="underline" href="/admin/games/music-trivia/bank">Question Bank</Link>.</li>
            <li>Create a <Link className="underline" href="/admin/games/music-trivia/decks">Deck</Link>, add questions, and lock it when ready.</li>
            <li>Go to <Link className="underline" href="/admin/games/music-trivia">Setup</Link> — pick an event, name your teams, select the deck, and create a session.</li>
            <li>Open <strong>Prep</strong> to review and approve each question before the event.</li>
            <li>On game night: open <strong>Host</strong> on your device and <strong>Jumbotron</strong> on the display screen.</li>
            <li>Advance questions, mark asked, reveal answers, and score teams.</li>
            <li>Review completed sessions in <Link className="underline" href="/admin/games/music-trivia/history">History</Link>.</li>
          </ol>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">Question Bank</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-300">
            <li>Questions live in the bank permanently — they are reusable across sessions.</li>
            <li>Supported types: <strong>Free Response</strong>, <strong>Multiple Choice</strong>, <strong>True/False</strong>, <strong>Ordering</strong>.</li>
            <li>Set <strong>category</strong> and <strong>difficulty</strong> (easy / medium / hard) on each question — these drive deck rules and optional bonus scoring.</li>
            <li>Add <strong>accepted answers</strong> for free response questions to handle common alternate phrasings.</li>
            <li>Attach <strong>assets</strong> (cover art, label scans, audio clips) to questions that have a visual or audio cue element.</li>
            <li>Mark questions <strong>published</strong> before adding them to a deck. Draft questions are excluded from deck builds.</li>
            <li>Use <strong>Archive</strong> to retire questions without deleting them.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">Building a Deck</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-300">
            <li>A deck defines how many rounds, questions per round, and tie-breakers a session will use.</li>
            <li>Use <strong>Auto-fill</strong> to populate the deck automatically by difficulty distribution.</li>
            <li>Use <strong>Build</strong> to manually curate questions from the bank.</li>
            <li>Mark tie-breaker questions explicitly — they only appear if scores are tied.</li>
            <li><strong>Lock</strong> the deck when it is ready. Locked decks cannot be edited and are safe to attach to sessions.</li>
            <li>Target deck size: <code>rounds × questions_per_round + 3 tie-breakers</code>.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">Session Setup</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-300">
            <li>Link the session to an <strong>event</strong> (optional but recommended for history tracking).</li>
            <li>Enter at least two team names — teams cannot be added after the session is created.</li>
            <li>Select a <strong>locked deck</strong> to draw questions from.</li>
            <li>Configure timing buffers (resleeve, find, cue seconds) to match your pacing between spins.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">Prep Flow</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-300">
            <li>Prep lets you review and edit each question <em>for this session</em> without touching the bank.</li>
            <li>Set the <strong>display element type</strong> (song title, artist, album, cover art, vinyl label) — this controls what the jumbotron shows alongside the question.</li>
            <li>Mark each question <strong>ready</strong> once reviewed. A soft-gate warning appears on the host until all questions are prep-ready.</li>
            <li>Prep is optional but strongly recommended for events with a display screen.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">Host Controls</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-300">
            <li><strong>Advance Question</strong> — moves to the next question in the round.</li>
            <li><strong>Mark Asked</strong> — locks the question as live; jumbotron enters answer-collection state.</li>
            <li><strong>Reveal Answer</strong> — shows the answer on the jumbotron.</li>
            <li><strong>Save Scores</strong> — enter points per team and save. Scores are idempotent — re-saving updates existing values.</li>
            <li><strong>Pause / Resume</strong> — freezes the countdown timer during deck changes or interruptions.</li>
            <li><strong>Advance Tie-Breaker</strong> — only appears when scores are tied at end of final round.</li>
            <li>The leaderboard updates live after each score save.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">Scoring Rules</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-300">
            <li>Standard: <strong>1 point</strong> per correct answer.</li>
            <li>Optional bonus: <strong>+1 point</strong> for hard-difficulty questions (configurable per session).</li>
            <li>Tie-breakers are scored the same way — first correct answer wins, or host judges.</li>
            <li>Free response questions: accepted answers list handles alternate phrasings. Host has final say.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">Jumbotron</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-300">
            <li>Open on a separate screen or browser tab pointed at the display.</li>
            <li>Shows the current question, round/question counters, and any attached image asset.</li>
            <li>Answer is hidden until the host clicks Reveal.</li>
            <li>Leaderboard panel can be toggled on/off from session settings.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">Solo-Host Tips (Single DJ Setting)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-300">
            <li>Set generous resleeve/find/cue buffers in session settings — questions fill that dead air.</li>
            <li>Keep host view on your phone or a tablet behind the decks.</li>
            <li>Pre-stage answer slips between rounds so scoring doesn&apos;t interrupt spin time.</li>
            <li>Run 3-4 questions per round max to avoid over-running your vinyl timing window.</li>
            <li>Use Pause liberally — no penalty, and it keeps the jumbotron from sitting idle.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-stone-700 bg-stone-950/60 p-4 text-sm text-stone-400">
          For full testing instructions, see <code>docs/trivia-smoke-test.md</code>.
        </section>
      </div>
    </div>
  );
}
