"use client";

import { useMemo, useState } from "react";

type GamePublicCopy = {
  tagline: string;
  playerExperience: string;
  whatYouDo: string[];
  exampleRound: string[];
  howYouWin: string;
  scoring?: string;
  whatYouNeed?: string;
  bestFor?: string;
};

type ComingSoonGame = {
  slug: string;
  title: string;
  coreMechanic: string;
  scoring: string;
  whyItWorks: string;
  notes?: string;
  publicCopy?: GamePublicCopy;
};

type ComingSoonSelectorProps = {
  games: ComingSoonGame[];
};

export default function ComingSoonSelector({
  games,
}: ComingSoonSelectorProps) {
  const [selectedSlug, setSelectedSlug] = useState(games[0]?.slug ?? "");

  const selectedGame = useMemo(
    () => games.find((game) => game.slug === selectedSlug) ?? games[0],
    [games, selectedSlug]
  );

  if (!selectedGame) {
    return null;
  }

  const publicCopy = selectedGame.publicCopy;

  return (
    <div className="rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-6">
      <label
        htmlFor="coming-soon-game"
        className="block text-xs uppercase tracking-[0.18em] text-zinc-400"
      >
        Select an in-development game
      </label>
      <select
        id="coming-soon-game"
        value={selectedSlug}
        onChange={(event) => setSelectedSlug(event.target.value)}
        className="mt-3 w-full rounded-xl bg-black/40 ring-1 ring-white/15 px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#00c4ff]/50"
      >
        {games.map((game) => (
          <option key={game.slug} value={game.slug}>
            {game.title}
          </option>
        ))}
      </select>

      <div className="mt-6 rounded-xl bg-black/30 ring-1 ring-white/10 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h4 className="text-2xl font-bold tracking-tight">{selectedGame.title}</h4>
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30">
            In development
          </span>
        </div>

        <p className="mt-3 text-zinc-300/90 leading-relaxed">
          {publicCopy?.tagline ?? selectedGame.coreMechanic}
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl bg-black/25 ring-1 ring-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
              Player experience
            </div>
            <p className="mt-2 text-sm text-zinc-200/90 leading-relaxed">
              {publicCopy?.playerExperience ??
                "This format is currently in development and being refined for live play."}
            </p>
          </div>

          <div className="rounded-xl bg-black/25 ring-1 ring-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
              Booker notes
            </div>
            {publicCopy?.howYouWin ? (
              <p className="mt-2 text-sm text-zinc-200/90 leading-relaxed">
                <span className="font-semibold text-zinc-200">How you win:</span>{" "}
                {publicCopy.howYouWin}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-zinc-200/90 leading-relaxed">
              <span className="font-semibold text-zinc-200">Scoring:</span>{" "}
              {publicCopy?.scoring ?? selectedGame.scoring}
            </p>
            <p className="mt-2 text-sm text-zinc-200/90 leading-relaxed">
              <span className="font-semibold text-zinc-200">Why it works:</span>{" "}
              {selectedGame.whyItWorks}
            </p>
            {selectedGame.notes ? (
              <p className="mt-2 text-sm text-zinc-300/75 leading-relaxed">
                <span className="font-semibold text-zinc-200">Note:</span>{" "}
                {selectedGame.notes}
              </p>
            ) : null}
          </div>
        </div>

        {publicCopy?.whatYouDo?.length ? (
          <div className="mt-4 rounded-xl bg-black/25 ring-1 ring-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
              What you do
            </div>
            <ul className="mt-3 space-y-2 text-sm text-zinc-200/90 leading-relaxed list-disc list-inside">
              {publicCopy.whatYouDo.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
