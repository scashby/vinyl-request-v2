"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type HelpContent = {
  quick: string;
  title: string;
  details: string[];
};

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function content(title: string, quick: string, details: string[]): HelpContent {
  return { title, quick, details };
}

function resolveHelp(label: string): HelpContent {
  const normalized = normalizeLabel(label);

  const exact: Record<string, HelpContent> = {
    "event (optional)": content(
      "Event Link",
      "Attach this session to a real event so history and reporting stay grouped correctly.",
      [
        "Select an existing event when this is part of a scheduled night.",
        "Use + Create New Event when details are not yet in the system.",
        "Event-linked sessions are easier to filter in setup/history screens later.",
      ]
    ),
    playlist: content(
      "Playlist Source",
      "This playlist becomes your call pool, so count and quality here drive everything downstream.",
      [
        "Confirm the playlist meets the minimum pull size shown on the page.",
        "Use one playlist per game style so runtime is predictable.",
        "Avoid duplicate-heavy lists unless the format expects repeats.",
      ]
    ),
    "session title": content(
      "Session Naming",
      "Choose a title hosts can identify instantly during live control.",
      [
        "Include theme or date when running multiple sessions in one event.",
        "Keep it short enough to display cleanly on host and jumbotron headers.",
        "This title appears in recent session lists and history views.",
      ]
    ),
    "game mode": content(
      "Bingo Win Pattern",
      "Game mode defines how players win and how many tracks you should stage.",
      [
        "Simpler patterns (single line) run faster than blackout/death rounds.",
        "Harder patterns need bigger call pools and longer event windows.",
        "Announce mode at round start so disputes are prevented.",
      ]
    ),
    "card count": content(
      "Card Print Quantity",
      "Set this to your expected player count plus backups.",
      [
        "Add extras for walk-ins, damaged sheets, and late arrivals.",
        "Higher card count increases print time and paper usage.",
        "If card count is too low, table reassignment slows the room.",
      ]
    ),
    "score mode": content(
      "Trivia Scoring Model",
      "Pick your scoring model before the session starts and keep it fixed.",
      [
        "Difficulty-bonus mode rewards harder questions and spreads standings.",
        "Standard mode is easier to explain to new teams.",
        "Changing score mode mid-session creates fairness issues in tie scenarios.",
      ]
    ),
    "questions / round": content(
      "Questions Per Round",
      "This controls pacing pressure and answer slip volume each round.",
      [
        "Higher count improves score separation but extends runtime.",
        "Lower count is better when bar service is slow or the room is noisy.",
        "Cross-check rounds x questions against your total prepared deck.",
      ]
    ),
    "lock-in rule": content(
      "Lock-In Rule",
      "This decides when an answer is final and cannot be revised.",
      [
        "Time-window lock-in is easiest to police consistently.",
        "First-sheet/hand-raise rewards speed but can increase disputes.",
        "Read this rule to the room before round one.",
      ]
    ),
    "lock-in window (sec)": content(
      "Lock-In Window",
      "Set how long teams have before answers are frozen.",
      [
        "Short windows keep energy high but raise miss/appeal rates.",
        "Longer windows improve accessibility in louder rooms.",
        "Tune this against host cadence and table distance.",
      ]
    ),
    "answer mode": content(
      "Answer Collection",
      "Choose one answer method your floor staff can enforce quickly.",
      [
        "Slips are auditable and easiest for post-round disputes.",
        "Whiteboards are fast but harder to verify in crowded layouts.",
        "Use one method per session unless explicitly announced otherwise.",
      ]
    ),
    "snippet seconds (5-10)": content(
      "Needle Drop Length",
      "Snippet length is the main difficulty lever in tune-identification games.",
      [
        "Five seconds is high difficulty and fastest pacing.",
        "Longer snippets reduce ambiguity and lower protest volume.",
        "Keep length stable unless you call out a special challenge round.",
      ]
    ),
    "bracket size": content(
      "Bracket Capacity",
      "Bracket size must match the number of seeded entries you can support.",
      [
        "Choose 4/8/16 based on available runtime and audience patience.",
        "Larger brackets require more transitions and clear tie policy.",
        "Confirm your entry list meets or exceeds this count before create.",
      ]
    ),
    "vote method": content(
      "Voting Method",
      "Pick how winners are decided each matchup.",
      [
        "Hands are fast and low setup, but less auditable.",
        "Slips are slower but cleaner when votes are close.",
        "Keep method consistent through the full bracket.",
      ]
    ),
    "judge mode": content(
      "Lyric Judging",
      "Judge mode determines how strict lyric scoring is during relays.",
      [
        "Official-key mode is strongest for fairness and consistency.",
        "Crowd-check mode is higher energy but less objective.",
        "State the mode before first lyric gap is played.",
      ]
    ),
    "close-match policy": content(
      "Close Match Rule",
      "Define what happens when an answer is almost correct.",
      [
        "Host-discretion is flexible, but document decisions quickly.",
        "Strict-key reduces debate but may feel harsh in noisy rooms.",
        "Use one policy all night to avoid inconsistency claims.",
      ]
    ),
    "reason mode": content(
      "Imposter Reason Rule",
      "This controls whether teams must explain why a pick is the imposter.",
      [
        "Require reason when you want higher difficulty and tie separation.",
        "Disable reason for faster rounds and less writing overhead.",
        "If reason is required, publish accepted reason standards upfront.",
      ]
    ),
    "song bonus": content(
      "Song Bonus Toggle",
      "Enable this only if hosts can verify song titles quickly and reliably.",
      [
        "Bonus adds skill depth but increases judging complexity.",
        "Use with clear spelling/partial-match rules.",
        "Disable when running lean staff or high-volume nights.",
      ]
    ),
    "song bonus points": content(
      "Song Bonus Value",
      "Set bonus weight so it matters without overpowering core answers.",
      [
        "Too high can flip standings from one lucky bonus.",
        "Keep bonus lower than primary lyric points in most formats.",
        "Document the value on host cheat sheets.",
      ]
    ),
    "option count": content(
      "Answer Options",
      "Option count changes both difficulty and board readability.",
      [
        "Three options keeps turns quick and legible at distance.",
        "Four options increases challenge and decision time.",
        "Ensure decoy quality scales with the option count.",
      ]
    ),
    "reveal mode": content(
      "Reveal Style",
      "Reveal mode controls how answers are shown and paced.",
      [
        "Host-reads works better when screens are limited.",
        "Board-choice reveal works better for large crowds with a jumbotron.",
        "Use one reveal style consistently per session.",
      ]
    ),
    "adjacent decade scoring enabled": content(
      "Adjacent Scoring Toggle",
      "This allows near-miss decade guesses to earn points.",
      [
        "Enable when your crowd is casual and you want closer standings.",
        "Disable for stricter, quiz-like competition.",
        "If enabled, announce exact adjacent-point value before round one.",
      ]
    ),
    "max teams (optional)": content(
      "Team Cap",
      "Use this to prevent oversubscription beyond what your scoring flow can handle.",
      [
        "Leave blank/zero when you want open entry.",
        "Set a hard cap for constrained seating or limited answer materials.",
        "Match this cap with table count and staff capacity.",
      ]
    ),
    "slips batch size (optional)": content(
      "Slip Print Batch",
      "Batch size controls how many answer sheets you prepare per run.",
      [
        "Larger batches reduce interruption but increase paper waste.",
        "Smaller batches save materials but require mid-session refills.",
        "Tune to expected team count and round count.",
      ]
    ),
    "default tracks/round (3-5)": content(
      "Default Round Track Count",
      "This sets baseline track load when a round row omits an explicit value.",
      [
        "Use lower counts for faster rotation-heavy nights.",
        "Use higher counts when category depth matters more than speed.",
        "Keep defaults aligned with actual crate pull bandwidth.",
      ]
    ),
    "snippets pre-cued by round": content(
      "Snippet Cue Check",
      "Verify all snippet start points before opening host mode.",
      [
        "Pre-cueing prevents dead air between rounds.",
        "Mark fallback snippets for failed needles or noisy intros.",
        "Re-test cue points after any last-minute deck edits.",
      ]
    ),
    "pair list order and answer key verified": content(
      "Pair Key Verification",
      "Double-check pair ordering so host prompts match scoring keys.",
      [
        "Mismatch here causes immediate scoring disputes.",
        "Confirm both original/cover direction and accepted wording.",
        "Keep a printed copy for fast adjudication.",
      ]
    ),
    "source pairs verified": content(
      "Sample Source Validation",
      "Make sure every sampled track is correctly paired to its source.",
      [
        "Wrong source data undermines trust in scoring.",
        "Spot-check artist/title spellings before launch.",
        "Include year/timestamp when available for quick host checks.",
      ]
    ),
  };

  if (exact[normalized]) return exact[normalized];

  if (
    normalized.startsWith("rounds") ||
    normalized === "round" ||
    normalized.includes("rounds (one per line)")
  ) {
    return content(
      "Round Count",
      "Round count sets runtime, pull size, and scoring variance for this session.",
      [
        "Verify your call deck has at least one valid item per planned round.",
        "Keep one tie-break and one contingency round in reserve.",
        "Adjust rounds first when you need to hit strict end times.",
      ]
    );
  }

  if (
    normalized.includes("stage 1 points") ||
    normalized.includes("stage 2 points") ||
    normalized.includes("stage 3 points") ||
    normalized.includes("lyric points") ||
    normalized.includes("connection points") ||
    normalized.includes("exact points") ||
    normalized.includes("adjacent points") ||
    normalized.includes("imposter points") ||
    normalized.includes("points: correct call") ||
    normalized.includes("correct pair points") ||
    normalized.includes("bonus")
  ) {
    return content(
      "Scoring Weight",
      "Point values here define strategy, so lock them before the first live round.",
      [
        "Higher base points reward speed and certainty.",
        "Bonus values should separate close teams without dominating core play.",
        "Print or display the final scoring matrix for host consistency.",
      ]
    );
  }

  if (normalized.includes("remove + resleeve")) {
    return content(
      "Reset Handling Time",
      "Estimate true sleeve/reset overhead after each play.",
      [
        "Underestimating this causes compounding round delays.",
        "Measure with real record handling, not ideal-case assumptions.",
        "Increase on crowded nights when host movement is slower.",
      ]
    );
  }

  if (normalized.includes("find record")) {
    return content(
      "Crate Search Time",
      "Set expected time to locate the next record in your pull flow.",
      [
        "If crates are not pre-sorted, this should be higher.",
        "Use visible crate markers to keep this value realistic.",
        "Re-evaluate after the first two rounds if pacing slips.",
      ]
    );
  }

  if (normalized === "cue (sec)" || normalized.includes("cue track")) {
    return content(
      "Cue Time",
      "This should include needle drop checks, volume confidence, and clean start timing.",
      [
        "Add extra seconds when songs have hard-to-find intros.",
        "Keep cue points documented for backup hosts.",
        "If cue variance is high, reduce rounds instead of rushing transitions.",
      ]
    );
  }

  if (normalized.includes("place new vinyl")) {
    return content(
      "Vinyl Swap Time",
      "Time needed to physically place and stabilize the next record.",
      [
        "Include any quick clean/wipe steps you do per swap.",
        "Increase if your table area is tight or shared.",
        "This value should be separate from crate-find and cue time.",
      ]
    );
  }

  if (normalized.includes("press start + slide")) {
    return content(
      "Host Trigger Delay",
      "This is the operator delay between audio start and board transition.",
      [
        "Include manual actions: play, glance, and screen advance.",
        "Use a conservative value for solo-host operation.",
        "Consistent timing here makes the show feel polished.",
      ]
    );
  }

  if (normalized.includes("host buffer")) {
    return content(
      "Safety Buffer",
      "A small buffer absorbs real-world delays without breaking cadence.",
      [
        "Keep at least a few seconds for host interruptions.",
        "Increase for larger rooms with more adjudication overhead.",
        "If rounds are running late, tune this with measured data only.",
      ]
    );
  }

  if (normalized.includes("sonos output delay")) {
    return content(
      "Speaker Output Delay",
      "Compensate for audio latency between host trigger and room playback.",
      [
        "Measure once in the venue and keep a known-good baseline.",
        "Wireless speaker paths usually need non-zero delay compensation.",
        "Incorrect values desync visual prompts and heard audio.",
      ]
    );
  }

  if (normalized.includes("team names") || normalized.includes("teams (one per line)") || normalized.includes("team names (one per line)")) {
    return content(
      "Team Roster Input",
      "Use one distinct team name per line for clean scoring.",
      [
        "Avoid duplicate or near-duplicate team names.",
        "Short names render better on the jumbotron scoreboard.",
        "Lock roster before create to prevent score mapping errors.",
      ]
    );
  }

  if (
    normalized.includes("clue cards") ||
    normalized.includes("call list") ||
    normalized.includes("calls (") ||
    normalized === "calls" ||
    normalized.includes("lyric gaps") ||
    normalized.includes("needle drops") ||
    normalized.includes("snippets (one per line") ||
    normalized.includes("pairs (track a") ||
    normalized.includes("bracket entries")
  ) {
    return content(
      "Deck Format",
      `Use the exact line format for "${label}" so parser and scoring keys stay aligned.`,
      [
        "Keep one playable item per line with required separators.",
        "Validate parsed count before creating the session.",
        "Stage a few reserve rows for ties or bad media.",
      ]
    );
  }

  if (normalized.startsWith("jumbotron ")) {
    if (normalized.includes("title")) {
      return content(
        "Board: Title",
        "Shows the session title on audience screens.",
        [
          "Enable when running multiple games in the same venue window.",
          "Disable if you need maximum space for score/answer content.",
          "Title visibility helps late arrivals orient quickly.",
        ]
      );
    }
    if (normalized.includes("scoreboard") || normalized.includes("leaderboard")) {
      return content(
        "Board: Scores",
        "Displays live team standings to the audience.",
        [
          "Enable for competitive nights where momentum matters.",
          "Disable if score reveals are intended to be delayed.",
          "Keep team names short for readability at distance.",
        ]
      );
    }
    if (normalized.includes("round")) {
      return content(
        "Board: Round Status",
        "Shows round progress so teams know current phase.",
        [
          "Useful for games with many short rounds.",
          "Pair with question counter in trivia for clarity.",
          "Hide only if board space is constrained.",
        ]
      );
    }
    if (normalized.includes("prompt")) {
      return content(
        "Board: Prompt",
        "Shows round/category prompt text on screen.",
        [
          "Enable when instructions change per round.",
          "Disable for secret-info phases.",
          "Keep prompt copy concise to avoid clutter.",
        ]
      );
    }
    if (normalized.includes("question counter")) {
      return content(
        "Board: Question Counter",
        "Displays current question index within a round.",
        [
          "Helps teams pace answer slip usage.",
          "Especially useful in trivia sessions with many questions.",
          "Ensure counter syncs with host actions.",
        ]
      );
    }
    if (normalized.includes("bracket")) {
      return content(
        "Board: Bracket View",
        "Shows tournament progression visually.",
        [
          "Enable for audience engagement during eliminations.",
          "Update promptly after each matchup result.",
          "Disable only when screen space is needed for voting prompts.",
        ]
      );
    }
    if (normalized.includes("category card")) {
      return content(
        "Board: Category Card",
        "Shows the active category for imposter rounds.",
        [
          "Enable so teams anchor their reasoning quickly.",
          "Hide if category is part of the challenge itself.",
          "Use clear, short category names for legibility.",
        ]
      );
    }
  }

  if (normalized.startsWith("show ")) {
    return content(
      "Board Visibility Toggle",
      `Use this toggle to control whether "${label}" appears live.`,
      [
        "Enable for clarity when the value helps teams decide faster.",
        "Disable when the information could leak answer intent.",
        "Keep visibility consistent once a round has started.",
      ]
    );
  }

  if (normalized.includes("audio clue fallback")) {
    return content(
      "Audio Fallback",
      "Fallback audio should recover stalled rounds, not replace your primary clue flow.",
      [
        "Queue fallback clips by round order before start.",
        "Use only when visual/text clues fail to separate teams.",
        "Keep fallback usage policy consistent for fairness.",
      ]
    );
  }

  if (normalized.includes("answer slips")) {
    return content(
      "Answer Slip Readiness",
      "Confirm enough slips are cut/sorted for all teams and rounds.",
      [
        "Include extras for rewrites and tie-breaks.",
        "Pre-batch slips to avoid mid-round interruptions.",
        "Keep collection process assigned to one role.",
      ]
    );
  }

  if (normalized.includes("pencils") || normalized.includes("markers")) {
    return content(
      "Writing Tools",
      "Teams need working pens/markers before round one.",
      [
        "Distribute extras to high-turnover tables.",
        "Replace weak markers before lights go down.",
        "No writing tools means avoidable pacing delays.",
      ]
    );
  }

  if (normalized.includes("backup questions")) {
    return content(
      "Backup Question Pool",
      "Hold reserve questions for ties, voided rounds, or timing recovery.",
      [
        "Keep backups outside the primary round count.",
        "Use the same difficulty mix as the main deck.",
        "Mark backups clearly so they are not double-used.",
      ]
    );
  }

  if (normalized.includes("tie-break") || normalized.includes("tiebreak")) {
    return content(
      "Tie-Break Readiness",
      `This check confirms "${label}" is ready before live play starts.`,
      [
        "Prepare tie-break assets physically, not just in notes.",
        "Keep answer key and host prompt for tie-breaks together.",
        "Do not start session until tie-break path is immediately runnable.",
      ]
    );
  }

  if (normalized.includes("printed")) {
    return content(
      "Printed Material Check",
      `This verifies "${label}" has been physically printed and staged.`,
      [
        "Confirm print legibility at actual room lighting.",
        "Keep one spare copy at host station.",
        "Mark latest revision to avoid stale copies at tables.",
      ]
    );
  }

  if (normalized.includes("pre-cued") || normalized.includes("cue points marked")) {
    return content(
      "Cue Preparation",
      `Use this to confirm "${label}" is complete before create.`,
      [
        "Pre-cue in round order to minimize track hunting.",
        "Re-check cue marks if deck order changes late.",
        "Keep one alternate cue for tracks with long intros.",
      ]
    );
  }

  if (normalized.includes("crate")) {
    return content(
      "Crate Workflow Check",
      "This confirms physical crate order supports the planned round flow.",
      [
        "Mark crate sections by round to avoid search delays.",
        "Keep backup records near the current round cluster.",
        "Validate crate path with one dry-run before doors open.",
      ]
    );
  }

  if (normalized.includes("verified") || normalized.includes("ready") || normalized.includes("staged")) {
    return content(
      "Preflight Confirmation",
      `Treat "${label}" as a hard readiness gate, not a soft reminder.`,
      [
        "Physically verify the item at the station/table where it is used.",
        "If uncertain, resolve now; in-round fixes cost momentum.",
        "Keep one person accountable for each preflight domain.",
      ]
    );
  }

  return content(
    "Field Guidance",
    `Use "${label}" to match the room format, staffing, and pacing you actually have tonight.`,
    [
      "Pick a value you can enforce consistently for the full session.",
      "Test one dry-run sequence if this field affects scoring or timing.",
      "When in doubt, choose the option that reduces host context-switching.",
    ]
  );
}

type InlineFieldHelpProps = {
  label: string;
};

export default function InlineFieldHelp({ label }: InlineFieldHelpProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const help = useMemo(() => resolveHelp(label), [label]);
  const id = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const modal = open && mounted
    ? createPortal(
      <>
        <div className="fixed inset-0 z-[60010] bg-black/70" onClick={() => setOpen(false)} />
        <div className="fixed inset-0 z-[60011] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-sky-800 bg-slate-950 p-5 text-stone-100 shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Field Guidance</p>
                <h3 className="mt-1 text-xl font-black">{help.title}</h3>
              </div>
              <button
                type="button"
                className="rounded border border-sky-700 px-2 py-1 text-xs uppercase text-sky-300"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(false);
                }}
              >
                Close
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-200">{help.quick}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {help.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </div>
        </div>
      </>,
      document.body
    )
    : null;

  return (
    <>
      <span className="group relative inline-flex align-middle">
        <button
          type="button"
          aria-label={`Help for ${label}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={id}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }}
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-[10px] font-black leading-none text-white hover:bg-sky-500"
        >
          i
        </button>
        <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-64 -translate-x-1/2 rounded border border-sky-800 bg-sky-950/95 p-2 text-left text-[11px] text-sky-100 shadow-[0_10px_30px_rgba(0,0,0,0.45)] group-hover:block">
          {help.quick}
        </span>
      </span>

      <span id={id} className="sr-only" />
      {modal}
    </>
  );
}
