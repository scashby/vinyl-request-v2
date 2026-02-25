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
  playerExperience: string;
  whatYouDo: string[];
  exampleRound: string[];
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
    playerExperience:
      "You’re at a table with friends, drinks in hand, listening to real vinyl. Every time a song is played, you check your card. When you’re close, the whole table starts leaning in—and when you hit the pattern, you get that ‘WAIT—WE’VE GOT IT!’ moment.",
    whatYouDo: [
      "Grab a bingo card + pen/dauber and pick a team name.",
      "Listen for songs as the DJ plays them; mark the matching squares on your card.",
      "When you complete the night’s pattern, shout “Bingo!” and hold up your card to be checked.",
    ],
    exampleRound: [
      "DJ spins a song and calls it: “If you’ve got ‘Dreams — Fleetwood Mac’, mark it!”",
      "Your table scans cards and marks the square if it’s there.",
      "Someone hits the pattern, yells “Bingo!”, and the host verifies the winning marks.",
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
    playerExperience:
      "It feels like a bar trivia night—but tuned for music people. You argue at the table, commit to one answer, and then get that instant payoff when the host reveals the truth and the room either cheers or groans together.",
    whatYouDo: [
      "Form a team and keep one answer slip/whiteboard for your table.",
      "For each question, talk it out and write ONE final answer before time is called.",
      "Turn it in / hold it up, then watch the reveal and score update.",
    ],
    exampleRound: [
      "Host: “This chorus line starts with ‘…don’t stop believin’’ — who is it?”",
      "Teams whisper, debate, then write: “Journey”.",
      "Host reveals the answer, calls out a few teams, and points get added to the leaderboard.",
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
    playerExperience:
      "This is the ‘I KNOW THIS!’ game. You hear 3–8 seconds, your brain lights up, and your table races to write it down before the reveal. It’s quick, punchy, and keeps the room moving.",
    whatYouDo: [
      "Listen to a very short snippet (no full chorus needed).",
      "Lock in your guess (artist + title) using the night’s rule.",
      "Cheer/cope during the reveal, then reset instantly for the next snippet.",
    ],
    exampleRound: [
      "DJ plays 6 seconds of a riff and cuts it.",
      "Tables scribble fast: “Nirvana — Smells Like Teen Spirit”.",
      "Answer is revealed; points are awarded; next snippet starts immediately.",
    ],
    howYouWin: "Earn the most points after the final snippet.",
    scoring: "2 points for artist + title; 1 point for either one (if enabled).",
    bestFor: "High-energy nights with lots of recognizable music.",
    whatYouNeed: "Answer slips/whiteboards; a clear lock-in rule.",
  },
  "needle-drop-roulette": {
    tagline:
      "A blind needle drop game—tiny clips, zero warning, pure chaos (in a good way).",
    playerExperience:
      "You don’t get the intro. You don’t get context. You get a random 7 seconds—so it’s all instinct and recognition. When you nail one, it feels like a superpower.",
    whatYouDo: [
      "Hear a random needle drop (5–10 seconds) from a record.",
      "Write your best guess (artist + title).",
      "Immediate reveal and points—then right into the next drop.",
    ],
    exampleRound: [
      "Needle drops mid-verse for 7 seconds, then stops.",
      "Your table blurts ideas, then commits: “Outkast — Ms. Jackson”.",
      "Host reveals the answer and scores it on the spot; next record is already cued.",
    ],
    howYouWin: "Most points after the last needle drop.",
    scoring: "2 points for artist + title; 1 point for either one (if enabled).",
    bestFor: "Party crowds, quick rounds, lots of replay value.",
    whatYouNeed: "Answer slips/whiteboards; tight pacing.",
  },
  "bracket-battle": {
    tagline:
      "A tournament of tracks—head-to-head matchups where the room decides who advances.",
    playerExperience:
      "It’s a musical cage match. Every matchup is an argument starter: which track wins, right now, in this room? Voting gets loud, and by the finals the whole place is invested.",
    whatYouDo: [
      "See the bracket theme and the entries (posted or announced).",
      "For each matchup, listen to Track A vs Track B and vote for your winner.",
      "Watch the bracket advance until a champion is crowned.",
    ],
    exampleRound: [
      "Host: “Matchup 3: Prince vs Michael. Listen up.”",
      "Both tracks play (snippets or full, depending on time).",
      "Room votes; winner advances on the bracket; next matchup begins.",
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
    playerExperience:
      "This one is pure vibe-check. You listen for production clues, vocal style, and era feel—then commit. It’s easy to play even if you’re not a music trivia expert.",
    whatYouDo: [
      "Listen to the track (often a short clip).",
      "Choose the decade you think it’s from.",
      "Reveal + points + next track—fast pace.",
    ],
    exampleRound: [
      "A track plays and your table debates: 70s or early 80s?",
      "You lock in “1980s”.",
      "Year is revealed; points are awarded; next track starts right away.",
    ],
    howYouWin: "Most points after the final track.",
    scoring: "2 points for the exact decade; optional 1 point for an adjacent decade.",
    bestFor: "Mixed-age rooms and low-barrier competition.",
    whatYouNeed: "Decade cards/paddles or answer slips.",
  },
  "genre-imposter": {
    tagline:
      "Two songs fit the category—one is the imposter. Find it and defend your pick.",
    playerExperience:
      "Your table turns into a jury. Everyone has an opinion. You’re not just guessing—you’re making a case. The reveal is the best part because you immediately get to argue about it.",
    whatYouDo: [
      "Hear the category prompt for the round.",
      "Listen to three tracks and decide which one doesn’t belong.",
      "Optionally write a one-sentence ‘why’, then watch the reveal and scoring.",
    ],
    exampleRound: [
      "Host: “Category: 90s West Coast. One track is the imposter.”",
      "Three tracks play; your table argues the middle one feels wrong.",
      "Reveal confirms (or crushes) your pick; points are awarded; next category begins.",
    ],
    howYouWin: "Most correct imposters (and bonus reasons) across the night.",
    scoring: "2 points for the correct imposter; optional +1 for the best/accepted reason.",
    bestFor: "Talkative tables and ‘prove it’ debates.",
    whatYouNeed: "Prepared 3-song sets per round, category prompts.",
  },
  "cover-art-clue-chase": {
    tagline:
      "Guess the album from visuals—art reveals get clearer as the points drop.",
    playerExperience:
      "It plays like a mini game show: you’re squinting at a blurry cover, shouting guesses, and deciding whether to swing early for big points or wait for safer clues. The reveal is a crowd moment every time.",
    whatYouDo: [
      "Look at a blurred/cropped album cover (Reveal 1).",
      "If needed, get clearer reveals (2 → 3) and decide when to lock in your guess.",
      "Answer is revealed; points depend on how early you got it.",
    ],
    exampleRound: [
      "Reveal 1 pops up: it’s mostly colors and a corner of text.",
      "Your table waits… Reveal 2 hits and someone finally recognizes it.",
      "You lock in; full cover is revealed; points get awarded based on reveal level.",
    ],
    howYouWin: "Rack up points by guessing earlier in the reveal ladder.",
    scoring: "3 points on Reveal 1, 2 points on Reveal 2, 1 point on Reveal 3/final (typical).",
    bestFor: "Screens-on venues and visual ‘game show’ vibes.",
    whatYouNeed: "A screen + prepared reveal images for each round.",
  },
  "crate-categories": {
    tagline:
      "A flexible ‘shell’ game: each round has a category prompt and a few spins to solve it.",
    playerExperience:
      "This is the ‘table talk’ format: you’re listening to a mini-set and solving a puzzle together. It feels like a playlist with a point—because you’re hunting for the connection while the music plays.",
    whatYouDo: [
      "Hear the prompt for the round (thread, odd-one-out, mood match, etc.).",
      "Listen to a short set of tracks (3–5).",
      "Submit your answer, then watch the reveal and scoring.",
    ],
    exampleRound: [
      "Prompt: “Identify the thread.”",
      "Four tracks play; your table notices they all mention a city in the chorus.",
      "You write the thread; host reveals the intended connection; points are awarded.",
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
    playerExperience:
      "This is built for big reactions. Your table picks an option, the DJ hits the lyric moment, and the whole room instantly finds out who was confident and wrong. It’s hilarious and super shareable.",
    whatYouDo: [
      "Hear 3–4 lyric options for a famous line.",
      "Pick the real lyric (optional: name the song/artist).",
      "DJ plays the lyric moment, then we reveal the correct option and score it.",
    ],
    exampleRound: [
      "Host reads options for the next line in a well-known chorus.",
      "Your table locks in Option B.",
      "The DJ plays it—turns out it was Option D—and the room loses it.",
    ],
    howYouWin: "Most correct lyrics (plus optional song-name bonuses) by the end.",
    scoring: "2 points for the correct lyric; optional +1 for naming the song (typical).",
    bestFor: "Two-operator nights (host + DJ) and crowd-pleasers.",
    whatYouNeed: "Prepared lyric options; a clear answer/reveal moment.",
  },
  "sample-detective": {
    tagline:
      "Connect the sample to the source—music nerd heaven with a clean, scoreable format.",
    playerExperience:
      "It feels like solving a musical mystery. You hear a familiar drum break or riff, and your table gets that ‘I’ve heard this before…’ spark. When the source is revealed, it’s a genuine discovery moment.",
    whatYouDo: [
      "Hear the sampled track and the source track (or multiple options, depending on the night).",
      "Decide which track sampled which, and write your pairing/answer.",
      "Reveal the source and score the round.",
    ],
    exampleRound: [
      "A modern track plays; your table recognizes a classic horn stab.",
      "The source track plays and the sample becomes obvious.",
      "Reveal confirms the connection; points are awarded; next pair starts.",
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
    playerExperience:
      "This one is suspense. You’re deciding whether to risk an early guess for big points or wait for a stronger clue. The room slowly narrows it down together, and the final reveal always lands.",
    whatYouDo: [
      "Read/hear a broad clue (era/vibe) and decide if you want to guess now.",
      "If you wait, get a stronger clue (collaborator, label/region, etc.).",
      "Lock in your guess before the final reveal, then score based on when you got it.",
    ],
    exampleRound: [
      "Clue 1: “Late 70s to early 80s, NYC.” Your table debates a few names.",
      "Clue 2: “Frequent collaborator: Nile Rodgers.” Now you’re confident and lock in.",
      "Reveal + points (more for earlier guesses), then next artist begins.",
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
    playerExperience:
      "It’s a ‘wait… is this the original?’ game. You think you know it, then you realize you might know a different version. The reveal is instant validation (or instant embarrassment).",
    whatYouDo: [
      "Listen to the version that’s played.",
      "Lock in: Original or Cover (optional: name the original artist).",
      "Reveal the original and score it, then move on.",
    ],
    exampleRound: [
      "A track plays and half the table says ‘This is the original’ while the other half disagrees.",
      "You lock in “Cover” + original artist guess.",
      "Host reveals the truth and awards points; next track starts.",
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
    playerExperience:
      "It’s a ‘wait… why did they play those back-to-back?’ puzzle. Your table notices clues, throws theories around, and then the reveal teaches you something you’ll repeat later.",
    whatYouDo: [
      "Listen to Track A, then Track B.",
      "Write the connection (and optionally a specific detail).",
      "Reveal the intended link and score it.",
    ],
    exampleRound: [
      "Two tracks play; your table spots the same drum break in both.",
      "You write: “Same sample source” and add the specific track used.",
      "Reveal confirms; points + bonus are awarded; next pair begins.",
    ],
    howYouWin: "Most correct connections (plus detail bonuses) by the end.",
    scoring: "2 points for the correct connection; optional +1 for the detail bonus.",
    bestFor: "Table-talk nights and ‘detective work’ energy.",
    whatYouNeed: "Prepared track pairs with one accepted connection per pair.",
  },
  "lyric-gap-relay": {
    tagline:
      "The room sings the missing line—teams race to write what comes next.",
    playerExperience:
      "This one turns the room into a choir. Everyone knows the song… until the music stops and you have to produce the next line yourself. When the track resumes, the whole place either celebrates or facepalms together.",
    whatYouDo: [
      "Listen as the DJ plays up to a lyric cue, then stops before the next line.",
      "Write the very next lyric line.",
      "Reveal by playing the real line and award points.",
    ],
    exampleRound: [
      "DJ stops right before a famous lyric.",
      "Tables scramble to write the next line from memory.",
      "Song resumes and the room hears the truth; points are awarded.",
    ],
    howYouWin: "Most points after the final lyric gap.",
    scoring: "2 points exact; 1 point close-enough; 0 for a miss (typical).",
    bestFor: "Sing-y crowds and throwback-heavy playlists.",
    whatYouNeed: "An answer key to keep disputes low.",
  },
  "odd-one-out-era-edition": {
    tagline:
      "Three tracks, one era window—spot the one that doesn’t belong.",
    playerExperience:
      "It’s a vibe trap. Two tracks feel right for the era… one feels ‘off’. You’re listening for telltale production and writing your pick before the reveal proves you right (or wrecks you).",
    whatYouDo: [
      "Hear the era window for the round.",
      "Listen to three tracks and pick the one outside the window.",
      "Reveal the years and score it.",
    ],
    exampleRound: [
      "Window announced: “1976–1982”.",
      "Three tracks play; the third one sounds way more modern to your table.",
      "Years are revealed; points are awarded; next window begins.",
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
                runthrough that shows exactly what you do at your table and how
                the reveal/scoring works.
              </p>
            </div>
            <div className="text-sm text-zinc-300/70">
              {games.length} games in the library
            </div>
          </div>

          <section className="mb-10 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                You Play In Teams
              </div>
              <p className="mt-2 text-sm text-zinc-200/90 leading-relaxed">
                Bring friends or join a table. Pick a team name, then play each
                round together—no solo pressure.
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                You Lock In Answers
              </div>
              <p className="mt-2 text-sm text-zinc-200/90 leading-relaxed">
                Most games use simple “lock it in” moments: write an answer,
                pick an option, or vote—then it’s final.
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                Fast Reveals
              </div>
              <p className="mt-2 text-sm text-zinc-200/90 leading-relaxed">
                The best part: the room learns the answer together. Cheers,
                groans, and “NO WAY” moments included.
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-950/70 ring-1 ring-white/10 p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                Score Stays Tight
              </div>
              <p className="mt-2 text-sm text-zinc-200/90 leading-relaxed">
                Points add up round-by-round, so even if you miss early, you’re
                still in it. Comebacks happen.
              </p>
            </div>
          </section>

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
                          Player experience (what it feels like)
                        </div>
                        <p className="mt-3 text-sm text-zinc-200/90 leading-relaxed">
                          {publicCopy?.playerExperience ??
                            "You play in teams at tables, lock in answers, and get fast reveals with score updates."}
                        </p>
                        <div className="mt-4 grid grid-cols-1 gap-4">
                          <div className="rounded-xl bg-black/25 ring-1 ring-white/10 p-4">
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                              What you do
                            </div>
                            {publicCopy?.whatYouDo?.length ? (
                              <ul className="mt-3 space-y-2 text-sm text-zinc-200/90 leading-relaxed list-disc list-inside">
                                {publicCopy.whatYouDo.map((step) => (
                                  <li key={step}>{step}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                          <div className="rounded-xl bg-black/25 ring-1 ring-white/10 p-4">
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                              Example round
                            </div>
                            {publicCopy?.exampleRound?.length ? (
                              <ul className="mt-3 space-y-2 text-sm text-zinc-200/90 leading-relaxed list-disc list-inside">
                                {publicCopy.exampleRound.map((step) => (
                                  <li key={step}>{step}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </div>
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
