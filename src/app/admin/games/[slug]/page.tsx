import Link from "next/link";
import { notFound } from "next/navigation";
import PromptCopyButton from "src/components/PromptCopyButton";
import { gameBlueprints, getGameBuildPrompt } from "src/lib/gameBlueprints";

type GameSkeletonPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function GameSkeletonPage({ params }: GameSkeletonPageProps) {
  const { slug } = await params;
  const game = gameBlueprints.find((entry) => entry.slug === slug);

  if (!game) notFound();

  const statusLabel =
    game.status === "needs_workshopping"
      ? "Needs Workshopping"
      : game.status === "in_development"
        ? "In Development"
        : "Undeveloped";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_10%,#3f2f15,transparent_35%),radial-gradient(circle_at_85%_0%,#18383e,transparent_35%),linear-gradient(180deg,#111,#1b1b1b)] p-6 text-stone-100">
      <div className="mx-auto max-w-4xl rounded-3xl border border-stone-800 bg-black/40 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/games" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase tracking-[0.15em] text-stone-200 hover:border-amber-400 hover:text-amber-200">
            Back to Games
          </Link>
          <p className="rounded border border-stone-700 px-3 py-1 text-xs uppercase tracking-[0.15em] text-stone-300">{statusLabel}</p>
        </div>

        <h1 className="mt-5 text-4xl font-black text-amber-100">{game.title}</h1>
        {game.notes ? <p className="mt-2 text-sm text-amber-200/90">{game.notes}</p> : null}

        <div className="mt-8 space-y-4">
          <section className="rounded-xl border border-stone-700 bg-stone-950/70 p-4">
            <h2 className="text-xs uppercase tracking-[0.2em] text-stone-400">Core Mechanic</h2>
            <p className="mt-2 text-sm text-stone-100">{game.coreMechanic}</p>
          </section>
          <section className="rounded-xl border border-stone-700 bg-stone-950/70 p-4">
            <h2 className="text-xs uppercase tracking-[0.2em] text-stone-400">Setup</h2>
            <p className="mt-2 text-sm text-stone-100">{game.setup}</p>
          </section>
          <section className="rounded-xl border border-stone-700 bg-stone-950/70 p-4">
            <h2 className="text-xs uppercase tracking-[0.2em] text-stone-400">Scoring</h2>
            <p className="mt-2 text-sm text-stone-100">{game.scoring}</p>
          </section>
          <section className="rounded-xl border border-stone-700 bg-stone-950/70 p-4">
            <h2 className="text-xs uppercase tracking-[0.2em] text-stone-400">Why It Works</h2>
            <p className="mt-2 text-sm text-stone-100">{game.whyItWorks}</p>
          </section>
        </div>

        <section className="mt-8 rounded-xl border border-amber-800/60 bg-amber-950/20 p-4">
          <h2 className="text-xs uppercase tracking-[0.2em] text-amber-300">Prompt for Build/Plan</h2>
          <div className="mt-3">
            <PromptCopyButton prompt={getGameBuildPrompt(game)} />
          </div>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded border border-amber-700/60 bg-stone-950 p-3 text-xs leading-6 text-amber-100">
            {getGameBuildPrompt(game)}
          </pre>
        </section>
      </div>
    </div>
  );
}
