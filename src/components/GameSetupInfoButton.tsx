"use client";

import { useMemo, useState } from "react";

type GameSlug =
  | "bingo"
  | "artist-alias"
  | "back-to-back-connection"
  | "bracket-battle"
  | "cover-art-clue-chase"
  | "crate-categories"
  | "decade-dash"
  | "genre-imposter"
  | "lyric-gap-relay"
  | "music-trivia"
  | "name-that-tune"
  | "needle-drop-roulette"
  | "original-or-cover"
  | "sample-detective"
  | "wrong-lyric-challenge";

type GameHelpMeta = {
  title: string;
  accent: string;
  quickTip: string;
  details: string[];
  sections?: Array<{
    heading: string;
    ordered?: boolean;
    items: string[];
  }>;
};

const HELP_META: Record<GameSlug, GameHelpMeta> = {
  bingo: {
    title: "Vinyl Bingo Setup Help",
    accent: "#f59e0b",
    quickTip: "Pick an event, playlist, and pacing budget, then run preflight before creating.",
    details: [
      "Link an event first when possible so history stays event-filtered.",
      "Use playlist minimum guidance and print cards/call sheet before host start.",
      "Confirm Sonos delay and next-call timing budget with a one-round dry run.",
      "Open Prep immediately after session create to stage crate pull order.",
    ],
  },
  "artist-alias": {
    title: "Artist Alias Setup Help",
    accent: "#a855f7",
    quickTip: "Prepare all clue stages per round and validate reveal order before live play.",
    details: [
      "Every call needs era, collaborator, and label/region clues.",
      "Keep accepted aliases ready to avoid scoring disputes.",
      "Stage optional audio clues only as fallback, not primary flow.",
      "Run a tie-break card check before creating the session.",
    ],
  },
  "back-to-back-connection": {
    title: "Back-to-Back Connection Setup Help",
    accent: "#d97706",
    quickTip: "Pre-stage two-track pairs and the accepted connection key for each round.",
    details: [
      "Each pair should have one canonical connection answer.",
      "Keep one tie-break pair loaded and labeled in advance.",
      "Use pacing budget to preserve cue buffer between track A and B.",
      "If detail bonus is enabled, define what counts as specific detail.",
    ],
  },
  "bracket-battle": {
    title: "Bracket Battle Setup Help",
    accent: "#3b82f6",
    quickTip: "Ensure seed list matches bracket size and voting method is staged on tables.",
    details: [
      "Entry count must match selected bracket size (4/8/16).",
      "Print bracket sheets before start for host and audience references.",
      "Prepare tie-break process (hands/slips) in case of dead heat.",
      "Keep a pacing timer visible between matchup transitions.",
    ],
  },
  "cover-art-clue-chase": {
    title: "Cover Art Clue Chase Setup Help",
    accent: "#14b8a6",
    quickTip: "Verify three reveal assets per call and preserve hardest-to-easiest sequence.",
    details: [
      "Each call needs stage 1/2/3 image URLs before session create.",
      "Keep optional audio clue only as backup if reveal assets fail.",
      "Use the same scoring rubric throughout the night (3/2/1).",
      "Check image readability from jumbotron distance during preflight.",
    ],
  },
  "crate-categories": {
    title: "Crate Categories Setup Help",
    accent: "#84cc16",
    quickTip: "Lock rounds + calls together so each category has a complete track pack.",
    details: [
      "Build rounds first, then ensure calls map to each round number.",
      "Keep prompt type consistent per round to reduce host overhead.",
      "Mark crate pull order and backup category pack before start.",
      "Use event linkage for cleaner session retrospectives by night.",
    ],
  },
  "decade-dash": {
    title: "Decade Dash Setup Help",
    accent: "#0ea5e9",
    quickTip: "Year data quality drives scoring accuracy; validate all release years upfront.",
    details: [
      "Each call should include a trusted release year.",
      "If adjacent scoring is on, state rule clearly at round 1.",
      "Keep tie-break record staged for deadlock endings.",
      "Place decade cards on tables before opening host screen.",
    ],
  },
  "genre-imposter": {
    title: "Genre Imposter Setup Help",
    accent: "#10b981",
    quickTip: "Round packs require 3 calls + one imposter index with reason key.",
    details: [
      "Verify imposter index points to exactly one call each round.",
      "Keep reason-mode policy fixed for full session consistency.",
      "Preload tie-break round in case team scores converge late.",
      "Use reveal timing that matches your solo-host pacing comfort.",
    ],
    sections: [
      {
        heading: "Solo-Host Workflow",
        ordered: true,
        items: [
          "Setup page: pick event + playlist bank, then either paste manual rounds or leave rounds blank for auto-generation.",
          "Complete preflight checks before creating the session.",
          "Host runtime: advance spins 1-3, save picks, then score the round.",
          "Assistant runtime (optional): capture team picks during playback while host manages reveal timing.",
          "Jumbotron stays read-only and mirrors current reveal/scoreboard state.",
        ],
      },
      {
        heading: "Smoke Test Checklist",
        ordered: true,
        items: [
          "Create one session with manual rounds and one with auto-generated rounds.",
          "Verify host controls: advance, pause, resume, and call status transitions.",
          "Save picks and score a round; confirm +2 imposter and conditional +1 reason bonus.",
          "Confirm jumbotron hides answer pre-reveal and updates leaderboard after scoring.",
          "Check history view and event filter return expected sessions.",
        ],
      },
    ],
  },
  "lyric-gap-relay": {
    title: "Lyric Gap Relay Setup Help",
    accent: "#d946ef",
    quickTip: "Use official answer key mode for cleaner scoring in noisy rooms.",
    details: [
      "Each call needs cue lyric and accepted answer lines.",
      "Define close-match policy before live rounds begin.",
      "Keep one tie-break lyric gap prepared and tested.",
      "Use short, readable prompts on jumbotron to reduce confusion.",
    ],
  },
  "music-trivia": {
    title: "Music Trivia Setup Help",
    accent: "#06b6d4",
    quickTip: "Balance category coverage and difficulty targets before session create.",
    details: [
      "Confirm rounds x questions per round matches your runtime window.",
      "Prepare backup questions and answer slip batches ahead of host start.",
      "Keep tie-break question reserved outside primary question count.",
      "Use event linkage for clean history filtering after the event.",
    ],
  },
  "name-that-tune": {
    title: "Name That Tune Setup Help",
    accent: "#f43f5e",
    quickTip: "Pull snippets at rounds + backup reserve to survive dropouts and tie-breaks.",
    details: [
      "Recommended pull target is shown under snippet deck validation.",
      "Keep lock-in rule and timing consistent across full session.",
      "Stage one tie-break snippet and backup stylus before create.",
      "Use host/jumbotron views from the same session id during run.",
    ],
  },
  "needle-drop-roulette": {
    title: "Needle Drop Roulette Setup Help",
    accent: "#f97316",
    quickTip: "Prepare drops in exact play order and stage answer tools at every table.",
    details: [
      "Keep snippet duration in 5-10s range for pacing consistency.",
      "Preflight answer mode materials (slips/boards) before host open.",
      "Reserve one tie-break drop that is easy to verify quickly.",
      "Use event linkage to keep setup list and history aligned.",
    ],
  },
  "original-or-cover": {
    title: "Original or Cover Setup Help",
    accent: "#eab308",
    quickTip: "Verify original artist keys and keep quick-swap backup pairs ready.",
    details: [
      "Every call should include explicit original vs cover answer.",
      "Use consistent bonus policy for original-artist naming.",
      "Check pair key order before creating session.",
      "Keep backup pair crate ready for damaged or missing records.",
    ],
  },
  "sample-detective": {
    title: "Sample Detective Setup Help",
    accent: "#22c55e",
    quickTip: "Curation quality matters most: verify sample-source pairs and cue points early.",
    details: [
      "Confirm sampled and source tracks are both available physically.",
      "Add sample timestamp when possible to speed host verification.",
      "Keep crate order prepared so transitions stay smooth.",
      "Use bonus scoring only if both artists can be judged reliably.",
    ],
  },
  "wrong-lyric-challenge": {
    title: "Wrong Lyric Challenge Setup Help",
    accent: "#ef4444",
    quickTip: "Validate decoy quality and answer slot integrity before the session goes live.",
    details: [
      "Each call needs one correct lyric and enough valid decoys.",
      "If song bonus is enabled, define what counts as acceptable naming.",
      "Keep reveal mode consistent to avoid audience confusion.",
      "Stage cue hints for host recovery when timing slips.",
    ],
  },
};

type GameSetupInfoButtonProps = {
  gameSlug: GameSlug;
};

export default function GameSetupInfoButton({ gameSlug }: GameSetupInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const meta = HELP_META[gameSlug];

  const accentStyles = useMemo(
    () => ({
      borderColor: meta.accent,
      color: meta.accent,
      backgroundColor: `${meta.accent}1f`,
    }),
    [meta.accent]
  );

  return (
    <>
      <div className="group relative inline-flex items-center gap-2">
        <button
          type="button"
          aria-label="Open setup help"
          onClick={() => setOpen(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black transition hover:brightness-110"
          style={accentStyles}
        >
          i
        </button>
        <p className="text-xs text-stone-400">Setup Help</p>

        <div
          className="pointer-events-none absolute right-0 top-10 z-20 hidden w-80 rounded-xl border bg-stone-950/95 p-3 text-left shadow-[0_12px_35px_rgba(0,0,0,0.45)] group-hover:block"
          style={{ borderColor: `${meta.accent}66` }}
        >
          <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: meta.accent }}>
            Quick Tip
          </p>
          <p className="mt-1 text-xs text-stone-200">{meta.quickTip}</p>
        </div>
      </div>

      {open ? (
        <>
          <div className="fixed inset-0 z-[60000] bg-black/70" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 z-[60001] flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border bg-stone-950 p-5 text-stone-100 shadow-[0_18px_50px_rgba(0,0,0,0.6)]" style={{ borderColor: `${meta.accent}99` }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em]" style={{ color: meta.accent }}>
                    Setup Guide
                  </p>
                  <h3 className="mt-1 text-xl font-black">{meta.title}</h3>
                </div>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs uppercase"
                  style={{ borderColor: `${meta.accent}99`, color: meta.accent }}
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>

              <p className="mt-3 text-sm text-stone-300">{meta.quickTip}</p>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-stone-200">
                {meta.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>

              {meta.sections?.map((section) => {
                const ListTag = section.ordered ? "ol" : "ul";
                const listClasses = section.ordered ? "mt-2 list-decimal space-y-1 pl-5 text-sm text-stone-200" : "mt-2 list-disc space-y-1 pl-5 text-sm text-stone-200";

                return (
                  <section key={section.heading} className="mt-4">
                    <h4 className="text-xs uppercase tracking-[0.16em] text-stone-300">{section.heading}</h4>
                    <ListTag className={listClasses}>
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ListTag>
                  </section>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
