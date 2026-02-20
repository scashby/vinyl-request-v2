export type GameStatus = "in_development" | "undeveloped" | "needs_workshopping";

export type GameBlueprint = {
  slug: string;
  title: string;
  status: GameStatus;
  notes?: string;
  coreMechanic: string;
  setup: string;
  scoring: string;
  whyItWorks: string;
};

const DJ_CONTEXT =
  "Environment constraints: single DJ, two turntables, brewery setting, limited tech, and enough pacing buffer for resleeve/find/cue between spins.";
const EVENT_LINK_REQUIREMENT =
  "Event linkage is required for all game modules: include session-level event association (event_id -> public.events(id), nullable with ON DELETE SET NULL) plus event-aware filtering in admin setup/history views.";

export const gameBlueprints: GameBlueprint[] = [
  {
    slug: "music-trivia",
    title: "Music Trivia",
    status: "in_development",
    coreMechanic: "Host asks music questions between spins; teams submit answers.",
    setup: "Question deck by category/difficulty, answer slips, and 2+ teams.",
    scoring: "1 point per correct answer, optional bonus for harder categories.",
    whyItWorks: "Familiar format with flexible pacing and low technical overhead.",
    notes: "Additive rollout only. Do not use destructive DB reset scripts unless explicitly requested.",
  },
  {
    slug: "name-that-tune",
    title: "Name That Tune",
    status: "undeveloped",
    coreMechanic: "Play short snippets; teams identify artist/title.",
    setup: "Curated snippet list, lock-in rule, and 8-15 rounds.",
    scoring: "2 points for artist+title, 1 for either one.",
    whyItWorks: "High recognition and fast engagement.",
  },
  {
    slug: "bracket-battle",
    title: "Bracket Battle",
    status: "undeveloped",
    coreMechanic: "Seeded head-to-head matchups where teams or crowd vote winners.",
    setup: "Prebuilt bracket, matchup list, and vote method (hands/slips).",
    scoring: "Bracket pick scoring based on correct advances.",
    whyItWorks: "Tournament format creates repeatable event energy.",
  },
  {
    slug: "needle-drop-roulette",
    title: "Needle Drop Roulette",
    status: "undeveloped",
    coreMechanic: "Blind needle drop, 5-10 second play, teams guess artist + song.",
    setup: "2+ teams, answer slips/whiteboards, and 8-12 rounds.",
    scoring: "2 points for artist+title, 1 for either one.",
    whyItWorks: "Almost no cue precision with high excitement and fast resets.",
  },
  {
    slug: "lyric-gap-relay",
    title: "Lyric Gap Relay",
    status: "undeveloped",
    coreMechanic: "Play to a lyric, stop, and teams fill the next line.",
    setup: "Prebuilt list of lyric gap moments and 10-15 rounds.",
    scoring: "2 exact, 1 close-enough, 0 miss.",
    whyItWorks: "Strong crowd participation with predictable round flow.",
    notes: "Use an official answer key to reduce lyric disputes.",
  },
  {
    slug: "genre-imposter",
    title: "Genre Imposter",
    status: "undeveloped",
    coreMechanic: "3-song set where 2 fit category and 1 does not; teams pick imposter.",
    setup: "Each round uses one category card and three prepared records.",
    scoring: "2 for correct imposter, +1 for correct reason.",
    whyItWorks: "Debate-heavy social gameplay that works well at tables.",
  },
  {
    slug: "decade-dash",
    title: "Decade Dash",
    status: "undeveloped",
    coreMechanic: "Spin track, teams pick decade card.",
    setup: "Decade paddles/cards for tables and 12-20 quick rounds.",
    scoring: "2 exact decade, optional 1 adjacent decade.",
    whyItWorks: "Super accessible for mixed-skill crowds.",
  },
  {
    slug: "cover-art-clue-chase",
    title: "Cover Art Clue Chase",
    status: "undeveloped",
    coreMechanic: "Reveal album art in stages with optional audio clue.",
    setup: "Image deck with 3 reveal levels prepared ahead of time.",
    scoring: "3 early reveal, 2 second reveal, 1 final/audio reveal.",
    whyItWorks: "Strong visual hook and crowd-friendly reveal moments.",
    notes: "Prep load is heavier than most formats.",
  },
  {
    slug: "crate-categories",
    title: "Crate Categories",
    status: "undeveloped",
    coreMechanic: "Category-led rounds sourced from crates/tags.",
    setup: "Pick category, spin 3-5 tracks, and keep one prompt type per round.",
    scoring: "Per-round scoring aligned to prompt type.",
    whyItWorks: "Reusable shell with high replay value.",
  },
  {
    slug: "wrong-lyric-challenge",
    title: "Wrong Lyric Challenge (Co-host)",
    status: "undeveloped",
    coreMechanic: "Host gives lyric options while DJ cues track; teams pick real lyric.",
    setup: "Host + DJ split plus curated lyric option deck.",
    scoring: "2 correct lyric, optional +1 for naming song.",
    whyItWorks: "Great crowd moments when run by two operators.",
  },
  {
    slug: "sample-detective",
    title: "Sample Detective (Lower priority)",
    status: "undeveloped",
    coreMechanic: "Teams connect sampled song with source track.",
    setup: "Curated sample-source pairs and 6-10 rounds.",
    scoring: "2 for correct pair, +1 for naming both artists.",
    whyItWorks: "High-impact special format for selective nights.",
    notes: "High prep and lower implementation priority.",
  },
  {
    slug: "artist-alias",
    title: "Artist Alias (Hidden-clue version)",
    status: "undeveloped",
    coreMechanic: "Teams identify artist from staged clues (era > collaborator > label/region).",
    setup: "Clue cards per artist with staged reveals.",
    scoring: "More points for early answers, fewer for later clue stages.",
    whyItWorks: "Balances challenge and accessibility.",
  },
  {
    slug: "original-or-cover",
    title: "Original or Cover",
    status: "undeveloped",
    coreMechanic: "Spin track and teams call original vs cover.",
    setup: "Prebuilt original/cover pair list and 8-12 rounds.",
    scoring: "2 for correct call, +1 for naming original artist.",
    whyItWorks: "Simple rules and high recognition value.",
  },
  {
    slug: "back-to-back-connection",
    title: "Back-to-Back Connection",
    status: "undeveloped",
    coreMechanic: "Play two tracks; teams identify the connection.",
    setup: "Prepared two-track pairs with one accepted connection per pair.",
    scoring: "2 for correct connection, +1 for specific detail.",
    whyItWorks: "Table discussion game that fits two-turntable pacing.",
  },
  {
    slug: "odd-one-out-era-edition",
    title: "Odd One Out: Era Edition",
    status: "needs_workshopping",
    coreMechanic: "Play three tracks where one is outside declared era window.",
    setup: "Prebuilt era trios with verified dating.",
    scoring: "2 for correct odd one, optional +1 for naming actual decade.",
    whyItWorks: "Strong one-off potential when prep quality is high.",
    notes: "Needs workshopping due to prep load.",
  },
];

export const getGameBuildPrompt = (game: GameBlueprint): string => {
  const statusLabel =
    game.status === "needs_workshopping"
      ? "needs_workshopping"
      : game.status === "in_development"
        ? "in_development"
        : "undeveloped";

  return [
    `Build and/or plan this game module: ${game.title}.`,
    `Status: ${statusLabel}.`,
    DJ_CONTEXT,
    EVENT_LINK_REQUIREMENT,
    `Core mechanic: ${game.coreMechanic}`,
    `Setup: ${game.setup}`,
    `Scoring: ${game.scoring}`,
    `Why it works: ${game.whyItWorks}`,
    game.notes ? `Notes: ${game.notes}` : null,
    "Deliverables:",
    "- Admin setup page skeleton",
    "- Host/assistant/jumbotron scope recommendation",
    "- Data model proposal (sessions, rounds, calls, scoring)",
    "- Ensure event_id is part of the session model and exposed in create/list/get APIs",
    "- Include event selector in setup flow and event filter in session history/list views",
    "- API route skeleton plan",
    "- Development phases (MVP -> polish)",
    "- Risks and mitigations for vinyl pacing and solo-host operation",
  ]
    .filter(Boolean)
    .join("\n");
};
