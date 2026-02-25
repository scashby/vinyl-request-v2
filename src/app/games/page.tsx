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
  roundFlow: string[];
  howYouWin: string;
  scoring?: string;
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
    roundFlow: [
      "You get a printed card (each square is a song title, or title + artist).",
      "The DJ plays a song and calls it out; you mark it if it’s on your card.",
      "When you complete the night’s win pattern, you shout “Bingo!” and we verify it.",
    ],
    howYouWin: "Be the first team to complete the selected pattern (or final pattern).",
    scoring:
      "Winners per round/pattern (single line → corners → blackout, etc.), depending on the night.",
    bestFor: "Big rooms, mixed crowds, easy entry.",
    whatYouNeed: "Printed cards + pens/daubers, teams at tables.",
  },
  "music-trivia": {
    tagline:
      "A hosted quiz night with a vinyl heart: questions, table talk, reveals, points.",
    roundFlow: [
      "Host reads a question (sometimes with a quick music clip or vinyl moment).",
      "Teams talk it out and write one final answer on their slip/whiteboard.",
      "Time’s up: answers get locked, the correct answer is revealed, and points are awarded.",
    ],
    howYouWin:
      "Stack the most points across all rounds (or win the final round if we run a closer).",
    scoring:
      "Usually 1 point per correct answer; optional bonuses for harder questions/categories.",
    bestFor: "Crowds that love laughing, arguing, and shouting answers.",
    whatYouNeed: "Answer slips/pens (or whiteboards), a host mic if available.",
  },
  "name-that-tune": {
    tagline:
      "Short snippets, quick instincts—identify artist + title before the reveal.",
    roundFlow: [
      "The DJ plays a short snippet (just a few seconds).",
      "Teams lock in artist and song title using the night’s rule (time window, first sheet wins, or hand raise).",
      "We reveal the answer and score the round—then immediately go again.",
    ],
    howYouWin: "Earn the most points after the final snippet.",
    scoring: "2 points for artist + title; 1 point for either one (if enabled).",
    bestFor: "High-energy nights with lots of recognizable music.",
    whatYouNeed: "Answer slips/whiteboards; a clear lock-in rule.",
  },
  "needle-drop-roulette": {
    tagline:
      "A blind needle drop game—tiny clips, zero warning, pure chaos (in a good way).",
    roundFlow: [
      "The DJ needle-drops a random spot in a record and plays 5–10 seconds.",
      "Teams write their best guess: artist and song title.",
      "Answer is revealed and points are awarded on the spot—next drop starts right away.",
    ],
    howYouWin: "Most points after the last needle drop.",
    scoring: "2 points for artist + title; 1 point for either one (if enabled).",
    bestFor: "Party crowds, quick rounds, lots of replay value.",
    whatYouNeed: "Answer slips/whiteboards; tight pacing.",
  },
  "bracket-battle": {
    tagline:
      "A tournament of tracks—head-to-head matchups where the room decides who advances.",
    roundFlow: [
      "A themed bracket is posted (4/8/16 entries).",
      "For each matchup, we play both tracks; the room votes for the winner (hands or slips).",
      "Winners advance until a final champion is crowned.",
    ],
    howYouWin:
      "Pick winners correctly (team bracket) or simply help your favorites win (crowd mode).",
    scoring:
      "Either crowd-vote only (no teams), or bracket-pick scoring for teams (more points deeper in the bracket).",
    bestFor: "Theme nights, decade battles, label/showdown energy.",
    whatYouNeed: "A bracket list, a voting method, and a hype host voice.",
  },
  "decade-dash": {
    tagline:
      "Hear a track, pick the decade—quick decisions with big ‘aha’ moments.",
    roundFlow: [
      "The DJ plays a track (usually a short slice, but it can be longer).",
      "Teams choose the decade they think it’s from (cards/paddles or written).",
      "We reveal the year/decade and award points—then the next track starts.",
    ],
    howYouWin: "Most points after the final track.",
    scoring: "2 points for the exact decade; optional 1 point for an adjacent decade.",
    bestFor: "Mixed-age rooms and low-barrier competition.",
    whatYouNeed: "Decade cards/paddles or answer slips.",
  },
  "genre-imposter": {
    tagline:
      "Two songs fit the category—one is the imposter. Find it and defend your pick.",
    roundFlow: [
      "Host announces the category (e.g., “Disco”, “Three-chord punk”, “Motown energy”).",
      "Three tracks play; two belong, one is the imposter.",
      "Teams pick the imposter (and optionally write why), then we reveal and score.",
    ],
    howYouWin: "Most correct imposters (and bonus reasons) across the night.",
    scoring: "2 points for the correct imposter; optional +1 for the best/accepted reason.",
    bestFor: "Talkative tables and ‘prove it’ debates.",
    whatYouNeed: "Prepared 3-song sets per round, category prompts.",
  },
  "cover-art-clue-chase": {
    tagline:
      "Guess the album from visuals—art reveals get clearer as the points drop.",
    roundFlow: [
      "A mystery album cover appears (Reveal 1: hardest). Teams can guess for max points.",
      "No winner yet? The image becomes clearer (Reveal 2, then Reveal 3).",
      "Final chance: optional audio clue, then the full reveal and scoring.",
    ],
    howYouWin: "Rack up points by guessing earlier in the reveal ladder.",
    scoring: "3 points on Reveal 1, 2 points on Reveal 2, 1 point on Reveal 3/final (typical).",
    bestFor: "Screens-on venues and visual ‘game show’ vibes.",
    whatYouNeed: "A screen + prepared reveal images for each round.",
  },
  "crate-categories": {
    tagline:
      "A flexible ‘shell’ game: each round has a category prompt and a few spins to solve it.",
    roundFlow: [
      "Host announces the round prompt (e.g., “identify the thread” or “odd one out”).",
      "We play a short set of tracks (usually 3–5).",
      "Teams submit their answer (and sometimes a quick rationale), then we reveal and score.",
    ],
    howYouWin: "Accumulate the most points across prompts/rounds.",
    scoring:
      "Depends on the prompt type (correct thread/odd-one-out/etc.), with optional bonus points for stronger rationales.",
    bestFor: "Repeat bookings—easy to remix into new nights.",
    whatYouNeed: "Category prompts + a small stack of ready-to-play tracks.",
  },
  "wrong-lyric-challenge": {
    tagline:
      "Pick the real lyric from decoys—then scream when everyone realizes they’ve been singing it wrong.",
    roundFlow: [
      "Host presents 3–4 lyric options for an upcoming moment in a song.",
      "Teams pick the option they believe is the real lyric (optional: name the song/artist).",
      "DJ plays the lyric moment, we reveal the correct option, and points get awarded.",
    ],
    howYouWin: "Most correct lyrics (plus optional song-name bonuses) by the end.",
    scoring: "2 points for the correct lyric; optional +1 for naming the song (typical).",
    bestFor: "Two-operator nights (host + DJ) and crowd-pleasers.",
    whatYouNeed: "Prepared lyric options; a clear answer/reveal moment.",
  },
  "sample-detective": {
    tagline:
      "Connect the sample to the source—music nerd heaven with a clean, scoreable format.",
    roundFlow: [
      "We play a sampled track and a possible source track (order depends on the round).",
      "Teams decide which two belong together and write the connection.",
      "We reveal the correct pairing/source and award points (with optional bonus).",
    ],
    howYouWin: "Most correctly identified sample/source pairs across the night.",
    scoring:
      "2 points for the correct pair; optional +1 for naming both artists (typical).",
    bestFor: "Special nights and crowds that love discovery.",
    whatYouNeed: "Curated sample/source pairs (prep-heavy, worth it).",
  },
  "artist-alias": {
    tagline:
      "A clue ladder game: guess the artist early for more points—wait for clues if you need them.",
    roundFlow: [
      "Stage 1 clue is revealed (broad: era/vibe). Teams can guess for max points.",
      "No correct guess? Stage 2 adds a stronger clue (e.g., collaborator).",
      "Still no? Stage 3 adds label/region—then the final reveal and scoring.",
    ],
    howYouWin: "Score early guesses; the earlier you nail it, the more you earn.",
    scoring:
      "Typically 3 points at Stage 1, 2 points at Stage 2, 1 point at final reveal.",
    bestFor: "Rooms that like a little mystery and suspense.",
    whatYouNeed: "Prepared clue cards per artist; optional audio clue.",
  },
  "original-or-cover": {
    tagline:
      "Hear a version—call it original or cover, then (optional) name the original artist for bonus.",
    roundFlow: [
      "We play a track (a version you might know).",
      "Teams lock in: “Original” or “Cover” (optional: name the original artist).",
      "We reveal the truth and award points—then the next track starts.",
    ],
    howYouWin: "Most points after the final track.",
    scoring:
      "2 points for correct original/cover call; optional +1 for naming the original artist (typical).",
    bestFor: "Sing-along crowds and broad music knowledge.",
    whatYouNeed: "A curated list of originals + covers.",
  },
  "back-to-back-connection": {
    tagline:
      "Two tracks in a row—teams figure out the connection (and can earn a detail bonus).",
    roundFlow: [
      "Track A plays, then Track B plays.",
      "Teams discuss and write the connection (same producer, same sample, same city, same band member, etc.).",
      "We reveal the intended connection and score; optional bonus for a specific detail.",
    ],
    howYouWin: "Most correct connections (plus detail bonuses) by the end.",
    scoring: "2 points for the correct connection; optional +1 for the detail bonus.",
    bestFor: "Table-talk nights and ‘detective work’ energy.",
    whatYouNeed: "Prepared track pairs with one accepted connection per pair.",
  },
  "lyric-gap-relay": {
    tagline:
      "The room sings the missing line—teams race to write what comes next.",
    roundFlow: [
      "The DJ plays up to a known lyric cue, then stops right before the next line.",
      "Teams write the very next lyric line (exact, or close-enough if enabled).",
      "We reveal the line (often by playing it), then award points and move on.",
    ],
    howYouWin: "Most points after the final lyric gap.",
    scoring: "2 points exact; 1 point close-enough; 0 for a miss (typical).",
    bestFor: "Sing-y crowds and throwback-heavy playlists.",
    whatYouNeed: "An answer key to keep disputes low.",
  },
  "odd-one-out-era-edition": {
    tagline:
      "Three tracks, one era window—spot the one that doesn’t belong.",
    roundFlow: [
      "Host announces an era window (e.g., “1976–1982”).",
      "Three tracks play; teams pick the one that falls outside the window.",
      "We reveal the years/decades and award points (optional bonus).",
    ],
    howYouWin: "Most correct odd-one-out picks (plus optional bonuses) by the end.",
    scoring: "2 points for the correct odd-one-out; optional +1 for an extra detail (typical).",
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
                          Round flow (what you do)
                        </div>
                        {publicCopy?.roundFlow?.length ? (
                          <ol className="mt-3 space-y-2 text-sm text-zinc-200/90 leading-relaxed list-decimal list-inside">
                            {publicCopy.roundFlow.map((step) => (
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
                        {publicCopy?.howYouWin ? (
                          <p className="mt-2 text-sm text-zinc-200/90 leading-relaxed">
                            <span className="font-semibold text-zinc-200">
                              How you win:
                            </span>{" "}
                            {publicCopy.howYouWin}
                          </p>
                        ) : null}
                        <p className="mt-2 text-sm text-zinc-200/90 leading-relaxed">
                          <span className="font-semibold text-zinc-200">
                            Scoring:
                          </span>{" "}
                          {publicCopy?.scoring ?? game.scoring}
                        </p>
                        {publicCopy?.bestFor ? (
                          <p className="mt-3 text-sm text-zinc-200/90 leading-relaxed">
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
