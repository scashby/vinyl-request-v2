"use client";

import { useMemo, useState } from "react";

type HelpContent = {
  quick: string;
  title: string;
  details: string[];
};

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveHelp(label: string): HelpContent {
  const normalized = normalizeLabel(label);

  if (normalized.includes("event")) {
    return {
      title: "Event Link Help",
      quick: "Link sessions to an event so setup lists/history stay organized by night.",
      details: [
        "Use event linking whenever possible for cleaner post-event reporting.",
        "If event details are missing, create one inline and select it immediately.",
        "Event filters in setup/history rely on this value to group sessions.",
      ],
    };
  }

  if (normalized.includes("session title")) {
    return {
      title: "Session Title Help",
      quick: "Use a clear title so host/jumbotron/history are easy to identify in real time.",
      details: [
        "Include date or theme if you run multiple sessions in one night.",
        "Keep it short enough for host header readability.",
        "Titles are used in history and control-room context switching.",
      ],
    };
  }

  if (normalized.includes("round")) {
    return {
      title: "Round Count Help",
      quick: "Round count drives session length and minimum deck/pull requirements.",
      details: [
        "Confirm your deck/call list has enough valid rows for selected rounds.",
        "Keep 1-2 backups staged for ties, damaged records, or tempo recovery.",
        "Adjust rounds to match runtime and brewery pacing windows.",
      ],
    };
  }

  if (normalized.includes("lock-in rule")) {
    return {
      title: "Lock-In Rule Help",
      quick: "Pick one lock policy and keep it consistent for the full session.",
      details: [
        "Time window: easiest for solo host pacing.",
        "First slip/hand raise: faster resolution but can trigger disputes in noisy rooms.",
        "Announce rule clearly before round 1.",
      ],
    };
  }

  if (normalized.includes("lock-in window")) {
    return {
      title: "Lock-In Window Help",
      quick: "This sets answer window length before reveal/score transitions.",
      details: [
        "Short windows keep pace high but increase miss rate.",
        "Longer windows improve accessibility and reduce appeals.",
        "Tune window to room noise and table distance.",
      ],
    };
  }

  if (normalized.includes("answer mode")) {
    return {
      title: "Answer Mode Help",
      quick: "Choose the input method that your room can support without delays.",
      details: [
        "Slips are precise for scoring audits.",
        "Whiteboards are faster but can be harder to verify in crowds.",
        "Mixed mode works if table logistics vary.",
      ],
    };
  }

  if (normalized.includes("snippet seconds")) {
    return {
      title: "Snippet Length Help",
      quick: "Snippet length controls difficulty and session velocity.",
      details: [
        "Short snippets increase challenge and energy.",
        "Longer snippets reduce ambiguity and scoring disputes.",
        "Keep consistent unless you announce a special round change.",
      ],
    };
  }

  if (
    normalized.includes("remove + resleeve") ||
    normalized.includes("find record") ||
    normalized.includes("cue") ||
    normalized.includes("host buffer") ||
    normalized.includes("place new vinyl") ||
    normalized.includes("start + slide") ||
    normalized.includes("sonos output delay")
  ) {
    return {
      title: "Pacing Budget Help",
      quick: "These timing knobs set the target gap between active calls/round actions.",
      details: [
        "Tune from live rehearsal, not guesses.",
        "Add buffer for solo-host nights and high table counts.",
        "Use stable values across a full event so host rhythm is predictable.",
      ],
    };
  }

  if (normalized.includes("team")) {
    return {
      title: "Team Setup Help",
      quick: "One team per line; keep names short and distinct for scoreboard legibility.",
      details: [
        "Use unique names to avoid scoring collisions.",
        "Keep minimum team count enforced before session create.",
        "Lock team list before host starts round flow.",
      ],
    };
  }

  if (
    normalized.includes("snippets") ||
    normalized.includes("needle drops") ||
    normalized.includes("pair") ||
    normalized.includes("call list") ||
    normalized.includes("calls") ||
    normalized.includes("entries") ||
    normalized.includes("deck") ||
    normalized.includes("clue cards")
  ) {
    return {
      title: "Deck Input Help",
      quick: "Use one row per playable item and validate count + format before creating session.",
      details: [
        "Follow the format shown in each field placeholder/help text.",
        "Pre-validate required columns (artist/title/answer keys).",
        "Keep backup rows staged for tie-breaks and recovery.",
      ],
    };
  }

  if (normalized.includes("jumbotron")) {
    return {
      title: "Jumbotron Toggle Help",
      quick: "Toggle only the elements you want visible to audience during gameplay.",
      details: [
        "Hide answer-sensitive fields until reveal stage.",
        "Keep layout clean for distance readability.",
        "Use stable toggles per session to avoid audience confusion.",
      ],
    };
  }

  if (
    normalized.includes("preflight") ||
    normalized.includes("staged") ||
    normalized.includes("ready") ||
    normalized.includes("printed")
  ) {
    return {
      title: "Preflight Help",
      quick: "Preflight checks protect pacing and reduce in-round interruptions.",
      details: [
        "Treat these as hard requirements before Create Session.",
        "Stage tie-break and backup assets before host launch.",
        "If one box is unclear, verify physically at deck/table level.",
      ],
    };
  }

  return {
    title: "Field Help",
    quick: `Configure "${label}" to match your host flow and room constraints.`,
    details: [
      "Use this value consistently for the full session.",
      "Prioritize settings that reduce host context-switching.",
      "Validate with one dry-run round before live play when possible.",
    ],
  };
}

type InlineFieldHelpProps = {
  label: string;
};

export default function InlineFieldHelp({ label }: InlineFieldHelpProps) {
  const [open, setOpen] = useState(false);
  const help = useMemo(() => resolveHelp(label), [label]);

  return (
    <>
      <span className="group relative inline-flex align-middle">
        <button
          type="button"
          aria-label={`Help for ${label}`}
          onClick={() => setOpen(true)}
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-[10px] font-black leading-none text-white hover:bg-sky-500"
        >
          i
        </button>
        <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-64 -translate-x-1/2 rounded border border-sky-800 bg-sky-950/95 p-2 text-left text-[11px] text-sky-100 shadow-[0_10px_30px_rgba(0,0,0,0.45)] group-hover:block">
          {help.quick}
        </span>
      </span>

      {open ? (
        <>
          <div className="fixed inset-0 z-[60010] bg-black/70" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 z-[60011] flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl border border-sky-800 bg-slate-950 p-5 text-stone-100 shadow-[0_20px_60px_rgba(0,0,0,0.65)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Field Guidance</p>
                  <h3 className="mt-1 text-xl font-black">{help.title}</h3>
                </div>
                <button
                  type="button"
                  className="rounded border border-sky-700 px-2 py-1 text-xs uppercase text-sky-300"
                  onClick={() => setOpen(false)}
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
        </>
      ) : null}
    </>
  );
}
