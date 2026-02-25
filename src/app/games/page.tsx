import Link from "next/link";
import { Container } from "components/ui/Container";
import { gameBlueprints, type GameBlueprint } from "src/lib/gameBlueprints";

export const metadata = {
  title: "Games | Dead Wax Dialogues",
  description:
    "A vinyl-first catalog of Dead Wax Dialogues games: what they are and how to play.",
};

type StatusMeta = { label: string; className: string };

type GamePublicCopy = {
  tagline: string;
  runthrough: string[];
  whatYouNeed?: string;
  bestFor?: string;
};

const getStatusMeta = (status: GameBlueprint["status"]): StatusMeta => {
  switch (status) {
    case "in_development":
      return {
        label: "In development",
        className:
          "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30",
      };
    case "needs_workshopping":
      return {
        label: "Needs workshopping",
        className: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30",
      };
    default:
      return {
        label: "Undeveloped",
        className: "bg-zinc-500/15 text-zinc-200 ring-1 ring-white/15",
      };
  }
};

const publicCopyBySlug: Record<string, GamePublicCopy> = {
  bingo: {
    tagline:
      "The classic: listen for songs, mark your card, and race to hit the pattern first.",
    runthrough: [
      "You get a printed bingo card (artist + title or title-only).",
      "The DJ spins songs and calls them out—mark matches as you hear them.",
      "First team to complete the night’s win pattern shouts BINGO and gets checked.",
    ],
    bestFor: "Big rooms, mixed crowds, easy entry.",
    whatYouNeed: "Printed cards + pens/daubers, teams at tables.",
  },
  "music-trivia": {
    tagline:
      "Fast, fun questions with music between rounds—teams write answers and turn them in.",
    runthrough: [
      "Teams pick a name and settle in with an answer slip.",
      "The host asks questions (often with a quick music moment between).",
      "Answers are revealed and scored—leaderboard stays tight all night.",
    ],
    bestFor: "Crowds that love laughing, arguing, and shouting answers.",
    whatYouNeed: "Answer slips/pens (or whiteboards), a host mic if available.",
  },
  "name-that-tune": {
    tagline:
      "Short snippets, quick instincts—identify artist + title before the reveal.",
    runthrough: [
      "The DJ plays a tiny slice of a track (a few seconds).",
      "Teams lock in artist/title using the night’s rule (time window, first sheet, or hand raise).",
      "Reveal, score, repeat—momentum stays high and the room stays loud.",
    ],
    bestFor: "High-energy nights with lots of recognizable music.",
    whatYouNeed: "Answer slips/whiteboards; a clear lock-in rule.",
  },
  "needle-drop-roulette": {
    tagline:
      "A blind needle drop game—tiny clips, zero warning, pure chaos (in a good way).",
    runthrough: [
      "The DJ needle-drops a random spot and lets it ride for 5–10 seconds.",
      "Teams write artist + title as fast as possible.",
      "Reveal and score immediately—then the next drop hits.",
    ],
    bestFor: "Party crowds, quick rounds, lots of replay value.",
    whatYouNeed: "Answer slips/whiteboards; tight pacing.",
  },
  "bracket-battle": {
    tagline:
      "A tournament of tracks—head-to-head matchups where the room decides who advances.",
    runthrough: [
      "A bracket is set (4/8/16 entries) with seeded matchups.",
      "Each matchup gets played and the crowd/teams vote (hands or slips).",
      "Winners advance until one champion takes the crown.",
    ],
    bestFor: "Theme nights, decade battles, label/showdown energy.",
    whatYouNeed: "A bracket list, a voting method, and a hype host voice.",
  },
  "decade-dash": {
    tagline:
      "Hear a track, pick the decade—quick decisions with big ‘aha’ moments.",
    runthrough: [
      "The DJ plays a track; teams choose the decade they think it’s from.",
      "Optionally, close guesses can still score (adjacent-decade rule).",
      "Reveal the year/decade and keep moving—fast rounds, easy to follow.",
    ],
    bestFor: "Mixed-age rooms and low-barrier competition.",
    whatYouNeed: "Decade cards/paddles or answer slips.",
  },
  "genre-imposter": {
    tagline:
      "Two songs fit the category—one is the imposter. Find it and defend your pick.",
    runthrough: [
      "The host announces a category (or hands out a category card).",
      "Three songs are played; teams decide which one doesn’t belong.",
      "Reveal the imposter and (optionally) award a bonus for the best reason.",
    ],
    bestFor: "Talkative tables and ‘prove it’ debates.",
    whatYouNeed: "Prepared 3-song sets per round, category prompts.",
  },
  "cover-art-clue-chase": {
    tagline:
      "Guess the album from visuals—art reveals get clearer as the points drop.",
    runthrough: [
      "A heavily cropped/blurred cover image appears (Reveal 1).",
      "If no one nails it, the image becomes clearer (Reveal 2, then 3).",
      "Optional audio clue for the final push—then the big reveal and scoring.",
    ],
    bestFor: "Screens-on venues and visual ‘game show’ vibes.",
    whatYouNeed: "A screen + prepared reveal images for each round.",
  },
  "crate-categories": {
    tagline:
      "A flexible ‘shell’ game: each round has a category prompt and a few spins to solve it.",
    runthrough: [
      "The host declares the round prompt (odd-one-out, identify the thread, mood match, etc.).",
      "A short set of tracks gets played from the crates/tag pool.",
      "Teams submit a summary (and sometimes a rationale) for scoring.",
    ],
    bestFor: "Repeat bookings—easy to remix into new nights.",
    whatYouNeed: "Category prompts + a small stack of ready-to-play tracks.",
  },
  "wrong-lyric-challenge": {
    tagline:
      "Pick the real lyric from decoys—then scream when everyone realizes they’ve been singing it wrong.",
    runthrough: [
      "The host reads lyric options while the DJ cues the track.",
      "Teams pick the lyric they think is correct (optionally name the song for bonus).",
      "Play the moment, reveal the right lyric, score, repeat.",
    ],
    bestFor: "Two-operator nights (host + DJ) and crowd-pleasers.",
    whatYouNeed: "Prepared lyric options; a clear answer/reveal moment.",
  },
  "sample-detective": {
    tagline:
      "Connect the sample to the source—music nerd heaven with a clean, scoreable format.",
    runthrough: [
      "You hear a sampled track and its source (order depends on the round).",
      "Teams identify the pair and (optionally) name both artists for bonus.",
      "Reveal the connection and keep the pace moving.",
    ],
    bestFor: "Special nights and crowds that love discovery.",
    whatYouNeed: "Curated sample/source pairs (prep-heavy, worth it).",
  },
  "artist-alias": {
    tagline:
      "A clue ladder game: guess the artist early for more points—wait for clues if you need them.",
    runthrough: [
      "Stage 1 clue drops (era/vibe). Teams can guess immediately for max points.",
      "If needed, Stage 2 adds a collaborator clue; Stage 3 adds label/region.",
      "Final reveal locks it in and scoring rewards early confidence.",
    ],
    bestFor: "Rooms that like a little mystery and suspense.",
    whatYouNeed: "Prepared clue cards per artist; optional audio clue.",
  },
  "original-or-cover": {
    tagline:
      "Hear a version—call it original or cover, then (optional) name the original artist for bonus.",
    runthrough: [
      "A track plays and teams decide: original or cover?",
      "Teams lock in their call, then optionally name the original artist.",
      "Reveal the original and score—simple rules, lots of ‘no way’ moments.",
    ],
    bestFor: "Sing-along crowds and broad music knowledge.",
    whatYouNeed: "A curated list of originals + covers.",
  },
  "back-to-back-connection": {
    tagline:
      "Two tracks in a row—teams figure out the connection (and can earn a detail bonus).",
    runthrough: [
      "Track A plays, then Track B plays.",
      "Teams discuss and write the connection (same sample, same producer, same city, etc.).",
      "Reveal the intended link and award bonus for a specific detail if used.",
    ],
    bestFor: "Table-talk nights and ‘detective work’ energy.",
    whatYouNeed: "Prepared track pairs with one accepted connection per pair.",
  },
  "lyric-gap-relay": {
    tagline:
      "The room sings the missing line—teams race to write what comes next.",
    runthrough: [
      "The DJ plays up to a known lyric cue, then stops right before the next line.",
      "Teams write the next lyric (exact or close-enough based on the night’s rule).",
      "Reveal, score, and keep the relay moving.",
    ],
    bestFor: "Sing-y crowds and throwback-heavy playlists.",
    whatYouNeed: "An answer key to keep disputes low.",
  },
  "odd-one-out-era-edition": {
    tagline:
      "Three tracks, one era window—spot the one that doesn’t belong.",
    runthrough: [
      "An era window is announced (e.g., ‘1976–1982’).",
      "Three tracks play; teams pick the one outside the window.",
      "Reveal the years and score (optional bonus for naming the correct decade).",
    ],
    bestFor: "One-off specials when you’ve got great prep.",
    whatYouNeed: "Verified release years (prep matters).",
  },
};

export default function GamesPage() {
  const games = [...gameBlueprints].sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="relative w-full h-[280px] flex items-center justify-center bg-[url('/images/event-header-still.jpg')] bg-cover bg-center">
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 w-full">
          <Container size="xl">
            <div className="py-10 text-center">
              <div className="barcode-font text-white/70 mb-4">GAMES</div>
              <h1 className="font-serif-display text-4xl md:text-6xl font-bold tracking-tight">
                Vinyl-First Game Library
              </h1>
              <p className="mt-4 text-zinc-200/80 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
                Quick, booker-friendly rundowns of what happens in each game—so
                you can picture the night before you book it.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/events/events-page"
                  className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors ring-1 ring-white/10 text-sm font-semibold"
                >
                  See upcoming events
                </Link>
                <Link
                  href="/about"
                  className="px-5 py-2.5 rounded-full bg-[#00c4ff]/15 hover:bg-[#00c4ff]/20 transition-colors ring-1 ring-[#00c4ff]/30 text-sm font-semibold text-[#b8efff]"
                >
                  Book a games night
                </Link>
              </div>
            </div>
          </Container>
        </div>
      </header>

      <main className="py-12">
        <Container size="xl">
          <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Pick your vibe
              </h2>
              <p className="mt-2 text-zinc-300/80 max-w-2xl">
                Each game below has a short “what it feels like” + a quick
                runthrough (setup → play → reveal/score).
              </p>
            </div>
            <div className="text-sm text-zinc-300/70">
              {games.length} games in the library
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {games.map((game) => {
              const status = getStatusMeta(game.status);
              const publicCopy = publicCopyBySlug[game.slug];

              return (
                <article
                  key={game.slug}
                  className="group relative overflow-hidden rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:ring-[#00c4ff]/30 transition-colors"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_30%_20%,rgba(0,196,255,0.18),transparent_55%)]" />
                  <div className="relative p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-xl font-bold tracking-tight truncate">
                          {game.title}
                        </h3>
                        <p className="mt-2 text-zinc-300/85 leading-relaxed">
                          {publicCopy?.tagline ?? game.coreMechanic}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4">
                      <div className="rounded-xl bg-black/30 ring-1 ring-white/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                          Run of show
                        </div>
                        {publicCopy?.runthrough?.length ? (
                          <ol className="mt-3 space-y-2 text-sm text-zinc-200/90 leading-relaxed list-decimal list-inside">
                            {publicCopy.runthrough.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                        ) : (
                          <ol className="mt-3 space-y-2 text-sm text-zinc-200/90 leading-relaxed list-decimal list-inside">
                            <li>
                              <span className="text-zinc-300/70">Setup:</span>{" "}
                              {game.setup}
                            </li>
                            <li>
                              <span className="text-zinc-300/70">Play:</span>{" "}
                              {game.coreMechanic}
                            </li>
                            <li>
                              <span className="text-zinc-300/70">Score:</span>{" "}
                              {game.scoring}
                            </li>
                          </ol>
                        )}
                      </div>

                      <div className="rounded-xl bg-black/30 ring-1 ring-white/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                          Booker notes
                        </div>
                        {publicCopy?.bestFor ? (
                          <p className="mt-2 text-sm text-zinc-200/90 leading-relaxed">
                            <span className="font-semibold text-zinc-200">
                              Best for:
                            </span>{" "}
                            {publicCopy.bestFor}
                          </p>
                        ) : null}
                        {publicCopy?.whatYouNeed ? (
                          <p className="mt-2 text-sm text-zinc-200/90 leading-relaxed">
                            <span className="font-semibold text-zinc-200">
                              What we bring/need:
                            </span>{" "}
                            {publicCopy.whatYouNeed}
                          </p>
                        ) : null}
                        <p className="mt-3 text-sm text-zinc-200/90 leading-relaxed">
                          <span className="font-semibold text-zinc-200">
                            Why it works:
                          </span>{" "}
                          {game.whyItWorks}
                        </p>
                        {game.notes ? (
                          <p className="mt-3 text-sm text-zinc-300/75 leading-relaxed">
                            <span className="font-semibold text-zinc-200">
                              Note:
                            </span>{" "}
                            {game.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Container>
      </main>
    </div>
  );
}
