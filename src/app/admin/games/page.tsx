import Link from "next/link";
import PromptCopyButton from "src/components/PromptCopyButton";
import { gameBlueprints, getGameBuildPrompt } from "src/lib/gameBlueprints";

export default function GamesHomePage() {
  const needsWorkshop = gameBlueprints.filter((game) => game.status === "needs_workshopping");
  const undeveloped = gameBlueprints.filter((game) => game.status === "undeveloped");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#4a1f16,transparent_40%),radial-gradient(circle_at_80%_0%,#1f3c42,transparent_35%),linear-gradient(180deg,#121212,#1b1b1b)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-amber-900/50 bg-black/40 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-300">Analog Night Ops</p>
          <h1 className="mt-2 text-5xl font-black uppercase tracking-tight text-amber-100">Game Admin Center</h1>
          <p className="mt-3 max-w-2xl text-sm text-stone-300">
            Vinyl-first control room. Printed play, live host orchestration, and big-screen display scenes.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Link
              href="/admin/games/bingo"
              className="rounded-2xl border border-amber-700/60 bg-gradient-to-br from-amber-950/70 to-red-950/50 p-6 transition hover:-translate-y-0.5 hover:border-amber-400"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Live Module</p>
              <h2 className="mt-1 text-3xl font-black text-amber-100">Music Bingo</h2>
              <p className="mt-2 text-sm text-stone-200">Setup, host, assistant, jumbotron, print pack, and call verification.</p>
            </Link>
            <Link
              href="/admin/games/music-trivia"
              className="rounded-2xl border border-cyan-700/60 bg-gradient-to-br from-cyan-950/70 to-slate-950/60 p-6 transition hover:-translate-y-0.5 hover:border-cyan-400"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Live Module</p>
              <h2 className="mt-1 text-3xl font-black text-cyan-100">Music Trivia</h2>
              <p className="mt-2 text-sm text-stone-200">Paper-first setup, host console, scoring, and optional jumbotron.</p>
            </Link>
          </div>

          <h2 className="mt-10 text-xl font-black uppercase tracking-[0.08em] text-amber-200">Undeveloped Games</h2>
          <div className="mt-4 grid gap-4">
            {undeveloped.map((game, index) => (
              <section key={game.slug} className="rounded-2xl border border-stone-700 bg-stone-950/60 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Game {index + 1}</p>
                    <h3 className="text-2xl font-black text-stone-100">{game.title}</h3>
                  </div>
                  <Link className="rounded border border-stone-600 px-3 py-1 text-xs uppercase tracking-[0.15em] hover:border-amber-400 hover:text-amber-200" href={`/admin/games/${game.slug}`}>
                    Open Skeleton
                  </Link>
                </div>

                <p className="mt-3 text-sm text-stone-300">{game.coreMechanic}</p>

                <details className="mt-4 rounded border border-stone-700 bg-black/40 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-amber-200">Prompt for Build/Plan</summary>
                  <div className="mt-3">
                    <PromptCopyButton prompt={getGameBuildPrompt(game)} />
                  </div>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded border border-stone-700 bg-stone-950 p-3 text-xs leading-6 text-stone-200">
                    {getGameBuildPrompt(game)}
                  </pre>
                </details>
              </section>
            ))}
          </div>

          <h2 className="mt-10 text-xl font-black uppercase tracking-[0.08em] text-amber-200">Needs Workshopping</h2>
          <div className="mt-4 grid gap-4">
            {needsWorkshop.map((game, index) => (
              <section key={game.slug} className="rounded-2xl border border-amber-900/50 bg-amber-950/20 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Workshop {index + 1}</p>
                    <h3 className="text-2xl font-black text-amber-100">{game.title}</h3>
                  </div>
                  <Link className="rounded border border-amber-700 px-3 py-1 text-xs uppercase tracking-[0.15em] hover:border-amber-400 hover:text-amber-200" href={`/admin/games/${game.slug}`}>
                    Open Skeleton
                  </Link>
                </div>

                <p className="mt-3 text-sm text-amber-100/90">{game.coreMechanic}</p>

                <details className="mt-4 rounded border border-amber-800/70 bg-black/30 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-amber-200">Prompt for Build/Plan</summary>
                  <div className="mt-3">
                    <PromptCopyButton prompt={getGameBuildPrompt(game)} />
                  </div>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded border border-amber-800/60 bg-stone-950 p-3 text-xs leading-6 text-amber-100">
                    {getGameBuildPrompt(game)}
                  </pre>
                </details>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
