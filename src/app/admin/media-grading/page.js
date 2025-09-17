"use client";

import React, { useState, useMemo, useCallback } from "react";
import "styles/media-grading.css";

/**
 * Systematic Media Grading Tool (Admin)
 * - Next.js App Router client page
 * - Single-file vanilla React + a single global CSS import
 *
 * Key rules implemented:
 *  • Only 8 grades: M, NM, VG+, VG, G+, G, F/P
 *  • M is only achievable when the item is Sealed (and flawless in the allowed scope)
 *  • NM is the ceiling when not sealed
 *  • Scores start at 100; fixed penalties per spec; sealed adds +5 to packaging (cap 100)
 *  • Media grade for multi-disc = average of each disc/tape/CD (missing item counts as 0 / P)
 *  • Overall score = (mediaAvg + packagingScore)/2 normally
 *      - If media or packaging is completely missing, overall = (mediaAvg + packagingScore)/4
 *  • Overall letter comes from the averaged numeric score, but M is only assigned
 *    when Sealed rules permit it.
 *
 *  Per-format logic:
 *   - Vinyl: Media side shows vinyl-specific copy; when Sealed, only “Warping present” is evaluable;
 *            packaging allows only external wear (minor shelf, corner wear, creases/crushing).
 *   - Cassette: Media uses cassette mechanics/audio; no spindle marks; no “scratches” on tape media.
 *               Sealed cassette => Media is M unless "Missing" is checked.
 *   - CD: Media uses CD surface issues (scuffs/scratches), label-side/bronzing/pinholes,
 *         “read errors corrected” and “unreadable sectors”; Sealed CD => Media is M unless missing.
 *
 *  Side/track annotations:
 *   - Vinyl & Cassette: For most media defects (except warping/wobble), each item can be annotated
 *     with Side A and/or Side B; audio defects can also carry a per-defect “tracks affected” integer (>=0).
 *   - CD: no sides; audio defects can mark “tracks affected”.
 *
 *  Explanation:
 *   - Lists the top 3 deductions for media (across all discs) and packaging.
 *   - Explains overall formula, including sealed gates and missing-component logic.
 */

// Numeric thresholds for NM→F/P (M handled by sealed gate)
function numericToBaseGrade(score) {
  if (score >= 97) return "NM";
  if (score >= 85) return "VG+";
  if (score >= 75) return "VG";
  if (score >= 65) return "G+";
  if (score >= 50) return "G";
  return "F/P";
}

// Penalty catalog (exact defaults requested)
const MEDIA_PENALTIES = {
  lightScuffs: 3, // −3
  scratches: 8, // −8
  grooveWearOrAlt: 12, // −12 (vinyl groove wear; cassette shell scuffs; CD laser-rot/pinholes)
  warpingOrWobble: 10, // −10 (vinyl warping; CD wobble)
  surfaceNoise: 6, // −6 (tape hiss / surface noise)
  popsClicksOrReadErrors: 4, // −4 (pops/clicks; CD corrected read errors)
  skippingOrUnreadable: 30, // −30 (skipping/repeating; CD unreadable sectors)
  labelShellHubMinor: 3, // −3 each (label writing/stickers/spindle for vinyl; shell/hub label for others)
  perTrack: 1, // −1 per track affected (only when an audio defect is selected)
};

const SLEEVE_PENALTIES = {
  minorShelfWear: 3, // −3
  cornerWear: 4, // −4
  ringWearOrBookletRing: 5, // −5
  spineWear: 3, // −3
  seamSplitOrCaseCracked: 12, // −12
  tears: 8, // −8
  writing: 4, // −4
  stickers: 3, // −3
  sealedBonus: 5, // +5 bonus (cap at 100)
};

const MEDIA_TYPES = [
  { key: "vinyl", label: "Vinyl Records", icon: "🎵" },
  { key: "cassette", label: "Cassette Tapes", icon: "📼" },
  { key: "cd", label: "Compact Discs", icon: "💿" },
];

// -------- Helpers to build per-format label sets --------
function getMediaLabels(mediaType) {
  if (mediaType === "vinyl") {
    return {
      mediaHeading: "Vinyl Record Condition Assessment",
      itemWord: "Record",
      sidesWord: "Side",
      mediaVisual: [
        {
          key: "glossy",
          label: "Record has glossy, like-new appearance",
          type: "check",
          penalty: 0,
          sideable: false,
          tracks: false,
          hint: "Shiny, no visible defects under strong light.",
        },
        {
          key: "lightScuffs",
          label: "Light scuffs visible",
          type: "check+sub",
          sub: ["Very light, barely visible", "Visible but not deep", "Obvious, multiple scuffs"],
          penalty: MEDIA_PENALTIES.lightScuffs,
          sideable: true,
          tracks: false,
        },
        {
          key: "scratches",
          label: "Scratches present",
          type: "check+sub",
          sub: ["Hairline scratches only", "Can feel with fingernail", "Deep, visible grooves"],
          penalty: MEDIA_PENALTIES.scratches,
          sideable: true,
          tracks: false,
        },
        {
          key: "grooveWear",
          label: "Groove wear visible",
          type: "check+sub",
          sub: ["Light", "Moderate", "Heavy"],
          penalty: MEDIA_PENALTIES.grooveWearOrAlt,
          sideable: true,
          tracks: false,
        },
        {
          key: "warping",
          label: "Warping present",
          type: "check+sub",
          sub: [
            "Slight dish/edge warp (plays fine)",
            "Moderate warp (minor tracking issues)",
            "Severe warp (affects play)",
          ],
          penalty: MEDIA_PENALTIES.warpingOrWobble,
          sideable: false,
          tracks: false,
        },
      ],
      mediaAudio: [
        {
          key: "playsClean",
          label: "Plays with no surface noise",
          type: "check",
          penalty: 0,
          sideable: false,
          tracks: false,
        },
        {
          key: "surfaceNoise",
          label: "Surface noise when played",
          type: "check+sub",
          sub: ["Minimal", "Noticeable", "Significant"],
          penalty: MEDIA_PENALTIES.surfaceNoise,
          sideable: true,
          tracks: true,
        },
        {
          key: "popsClicks",
          label: "Occasional pops or clicks",
          type: "check+sub",
          sub: ["Occasional", "Frequent"],
          penalty: MEDIA_PENALTIES.popsClicksOrReadErrors,
          sideable: true,
          tracks: true,
        },
        {
          key: "skipping",
          label: "Skipping or repeating",
          type: "check",
          penalty: MEDIA_PENALTIES.skippingOrUnreadable,
          sideable: true,
          tracks: true,
        },
      ],
      mediaLabelArea: [
        {
          key: "labelClean",
          label: "Label is clean and bright",
          type: "check",
          penalty: 0,
          sideable: false,
          tracks: false,
        },
        {
          key: "spindleMarks",
          label: "Spindle marks present",
          type: "check",
          penalty: MEDIA_PENALTIES.labelShellHubMinor,
          sideable: false,
          tracks: false,
        },
        {
          key: "writingOnLabel",
          label: "Writing on label",
          type: "check",
          penalty: MEDIA_PENALTIES.labelShellHubMinor,
          sideable: false,
          tracks: false,
        },
        {
          key: "stickersOnLabel",
          label: "Stickers or tape on label",
          type: "check",
          penalty: MEDIA_PENALTIES.labelShellHubMinor,
          sideable: false,
          tracks: false,
        },
      ],
    };
  }

  if (mediaType === "cassette") {
    return {
      mediaHeading: "Cassette Condition Assessment",
      itemWord: "Tape",
      sidesWord: "Side",
      mediaVisual: [
        // No "scratches" on tape media; use shell scuffs instead.
        {
          key: "shellScuffs",
          label: "Shell scuffs present",
          type: "check+sub",
          sub: ["Light", "Moderate", "Heavy"],
          penalty: MEDIA_PENALTIES.grooveWearOrAlt, // −12 bucket
          sideable: false,
          tracks: false,
        },
        {
          key: "windowHaze",
          label: "Window/clouding or discoloration",
          type: "check",
          penalty: MEDIA_PENALTIES.lightScuffs,
          sideable: false,
          tracks: false,
        },
      ],
      mediaAudio: [
        {
          key: "playsClean",
          label: "Plays with no audible issues",
          type: "check",
          penalty: 0,
          sideable: false,
          tracks: false,
        },
        {
          key: "tapeHiss",
          label: "Hiss/noise when played",
          type: "check+sub",
          sub: ["Minimal", "Noticeable", "Significant"],
          penalty: MEDIA_PENALTIES.surfaceNoise,
          sideable: true,
          tracks: true,
        },
        {
          key: "dropouts",
          label: "Dropouts/clicks",
          type: "check+sub",
          sub: ["Occasional", "Frequent"],
          penalty: MEDIA_PENALTIES.popsClicksOrReadErrors,
          sideable: true,
          tracks: true,
        },
        {
          key: "squealFlutter",
          label: "Squeal / wow–flutter audible",
          type: "check",
          penalty: MEDIA_PENALTIES.surfaceNoise,
          sideable: true,
          tracks: true,
        },
        {
          key: "unplayableJam",
          label: "Jams/unplayable sections",
          type: "check",
          penalty: MEDIA_PENALTIES.skippingOrUnreadable,
          sideable: true,
          tracks: true,
        },
      ],
      mediaLabelArea: [
        // No spindle marks for cassette
        {
          key: "labelClean",
          label: "Shell/label clean and bright",
          type: "check",
          penalty: 0,
          sideable: false,
          tracks: false,
        },
        {
          key: "writingOnShell",
          label: "Writing on shell/label",
          type: "check",
          penalty: MEDIA_PENALTIES.labelShellHubMinor,
          sideable: false,
          tracks: false,
        },
        {
          key: "stickersOnShell",
          label: "Stickers or tape on shell",
          type: "check",
          penalty: MEDIA_PENALTIES.labelShellHubMinor,
          sideable: false,
          tracks: false,
        },
        {
          key: "pressurePad",
          label: "Pressure pad missing or degraded",
          type: "check",
          penalty: MEDIA_PENALTIES.scratches, // reasonable mid penalty bucket
          sideable: false,
          tracks: false,
        },
      ],
    };
  }

  // CD
  return {
    mediaHeading: "Compact Disc Condition Assessment",
    itemWord: "Disc",
    sidesWord: "Side", // not shown for CD
    mediaVisual: [
      {
        key: "lightScuffs",
        label: "Light scuffs visible",
        type: "check+sub",
        sub: ["Very light", "Visible, minor", "Multiple light scuffs"],
        penalty: MEDIA_PENALTIES.lightScuffs,
        sideable: false,
        tracks: false,
      },
      {
        key: "scratches",
        label: "Scratches present",
        type: "check+sub",
        sub: ["Few light", "Some deeper", "Many/deep"],
        penalty: MEDIA_PENALTIES.scratches,
        sideable: false,
        tracks: false,
      },
      {
        key: "laserRot",
        label: "Laser-rot / pinholes visible (label/top coat)",
        type: "check+sub",
        sub: ["Minimal", "Noticeable", "Significant"],
        penalty: MEDIA_PENALTIES.grooveWearOrAlt,
        sideable: false,
        tracks: false,
      },
      {
        key: "wobble",
        label: "Disc wobble present",
        type: "check+sub",
        sub: ["Slight", "Moderate", "Severe"],
        penalty: MEDIA_PENALTIES.warpingOrWobble,
        sideable: false,
        tracks: false,
      },
    ],
    mediaAudio: [
      {
        key: "playsClean",
        label: "Plays with no read errors",
        type: "check",
        penalty: 0,
        sideable: false,
        tracks: false,
      },
      {
        key: "correctedErrors",
        label: "Occasional read errors corrected",
        type: "check",
        penalty: MEDIA_PENALTIES.popsClicksOrReadErrors,
        sideable: false,
        tracks: true,
      },
      {
        key: "unreadable",
        label: "Unreadable sectors / skipping",
        type: "check",
        penalty: MEDIA_PENALTIES.skippingOrUnreadable,
        sideable: false,
        tracks: true,
      },
    ],
    mediaLabelArea: [
      {
        key: "hubClean",
        label: "Hub/face clean and bright",
        type: "check",
        penalty: 0,
        sideable: false,
        tracks: false,
      },
      {
        key: "writingOnFace",
        label: "Writing on disc face",
        type: "check",
        penalty: MEDIA_PENALTIES.labelShellHubMinor,
        sideable: false,
        tracks: false,
      },
      {
        key: "stickersOnFace",
        label: "Stickers or tape on disc face",
        type: "check",
        penalty: MEDIA_PENALTIES.labelShellHubMinor,
        sideable: false,
        tracks: false,
      },
    ],
  };
}

function getPackagingLabels(mediaType) {
  if (mediaType === "vinyl") {
    return {
      title: "Jacket & Packaging Condition Assessment",
      overall: [
        { key: "looksNew", label: "Looks like new, no flaws", penalty: 0 },
        { key: "minorShelfWear", label: "Minor shelf wear only", penalty: SLEEVE_PENALTIES.minorShelfWear },
        { key: "cornerWear", label: "Corner wear present", penalty: SLEEVE_PENALTIES.cornerWear },
        { key: "ringWear", label: "Ring wear visible", penalty: SLEEVE_PENALTIES.ringWearOrBookletRing },
      ],
      seams: [
        { key: "allSeamsIntact", label: "All seams intact", penalty: 0 },
        { key: "seamSplits", label: "Seam splits present", penalty: SLEEVE_PENALTIES.seamSplitOrCaseCracked },
        { key: "spineWear", label: "Spine shows wear", penalty: SLEEVE_PENALTIES.spineWear },
      ],
      damage: [
        { key: "creases", label: "Creases / crushing present", penalty: SLEEVE_PENALTIES.cornerWear },
        { key: "tears", label: "Tears present", penalty: SLEEVE_PENALTIES.tears },
        { key: "writing", label: "Writing present", penalty: SLEEVE_PENALTIES.writing },
        { key: "stickers", label: "Stickers or tape", penalty: SLEEVE_PENALTIES.stickers },
      ],
      notes: [
        { key: "originalShrinkOpened", label: "Original shrinkwrap (opened)" },
        { key: "promoCopy", label: "Promotional copy" },
        { key: "gatefold", label: "Gatefold sleeve" },
        { key: "innerSleeve", label: "Original inner sleeve" },
        { key: "cutOut", label: "Cut-out hole/notch/corner cut" },
        { key: "hypeSticker", label: "Hype sticker present" },
        { key: "priceSticker", label: "Price sticker/tag" },
        { key: "genericSleeve", label: "Generic/company sleeve" },
        { key: "firstPressing", label: "First pressing" },
      ],
    };
  }

  if (mediaType === "cassette") {
    return {
      title: "J-Card & Packaging Condition Assessment",
      overall: [
        { key: "looksNew", label: "Looks like new, no flaws", penalty: 0 },
        { key: "minorShelfWear", label: "Minor shelf wear only", penalty: SLEEVE_PENALTIES.minorShelfWear },
        { key: "cornerWear", label: "Corner wear present", penalty: SLEEVE_PENALTIES.cornerWear },
      ],
      seams: [
        { key: "allIntact", label: "J-card intact", penalty: 0 },
        { key: "foldTears", label: "J-card creases/tears", penalty: SLEEVE_PENALTIES.tears },
      ],
      damage: [
        { key: "creases", label: "Creases / crushing present", penalty: SLEEVE_PENALTIES.cornerWear },
        { key: "writing", label: "Writing present", penalty: SLEEVE_PENALTIES.writing },
        { key: "stickers", label: "Stickers or tape", penalty: SLEEVE_PENALTIES.stickers },
      ],
      notes: [
        { key: "standardCaseCracked", label: "Standard Norelco case cracked (replaceable)" },
        { key: "originalShrinkOpened", label: "Original shrinkwrap (opened)" },
        { key: "obi", label: "OBI present" },
        { key: "promoCopy", label: "Promotional copy" },
        { key: "shellColor", label: "Shell color variant" },
        { key: "limited", label: "Limited edition" },
        { key: "customCase", label: "Custom/collectible case" },
        { key: "stickeredCase", label: "Stickered case" },
      ],
    };
  }

  // CD
  return {
    title: "Inlay/Booklet & Packaging Condition Assessment",
    overall: [
      { key: "looksNew", label: "Looks like new, no flaws", penalty: 0 },
      { key: "minorShelfWear", label: "Minor shelf wear only", penalty: SLEEVE_PENALTIES.minorShelfWear },
      { key: "cornerWear", label: "Corner wear present (insert/digipak)", penalty: SLEEVE_PENALTIES.cornerWear },
    ],
    seams: [
      { key: "allIntact", label: "Booklet/tray insert intact", penalty: 0 },
      { key: "trayTeethBroken", label: "Tray teeth broken/missing (replaceable)", penalty: 0 },
    ],
    damage: [
      { key: "creases", label: "Creases / crushing present", penalty: SLEEVE_PENALTIES.cornerWear },
      { key: "writing", label: "Writing present", penalty: SLEEVE_PENALTIES.writing },
      { key: "stickers", label: "Stickers or tape", penalty: SLEEVE_PENALTIES.stickers },
    ],
    notes: [
      { key: "stdJewelCracked", label: "Standard jewel case cracked (replaceable)" },
      { key: "trayTeethBrokenNote", label: "Tray teeth broken (replaceable)" },
      { key: "customCase", label: "Custom case / box / digipak" },
      { key: "obi", label: "OBI present" },
      { key: "promoCopy", label: "Promotional copy" },
      { key: "slipcase", label: "Slipcase included" },
      { key: "specialLimited", label: "Special/limited edition" },
    ],
  };
}

// Disc/tape/disc initial state for media defects
function makeInitialMediaState(mediaType) {
  const labels = getMediaLabels(mediaType);
  const fold = (arr) =>
    arr.map((cfg) => ({
      key: cfg.key,
      checked: false,
      sub: cfg.sub ? 0 : null,
      sides: cfg.sideable ? { A: false, B: false } : null,
      tracks: cfg.tracks ? 0 : null,
      penalty: cfg.penalty || 0,
      label: cfg.label,
    }));
  return {
    missing: false,
    sections: {
      visual: fold(labels.mediaVisual),
      audio: fold(labels.mediaAudio),
      labelArea: fold(labels.mediaLabelArea),
    },
  };
}

const MAX_ITEMS = 6;

export default function MediaGradingPage() {
  const [mediaType, setMediaType] = useState("vinyl");
  const [sealed, setSealed] = useState(false);

  // Media (multi-disc) array
  const [items, setItems] = useState([makeInitialMediaState("vinyl")]);

  // Packaging
  const [packagingMissing, setPackagingMissing] = useState(false);
  const [packagingChecks, setPackagingChecks] = useState({});
  const [additionalNotes, setAdditionalNotes] = useState({});
  const [customNotes, setCustomNotes] = useState("");

  // When mediaType changes, regenerate structures while attempting to keep item count
  const labels = useMemo(() => getMediaLabels(mediaType), [mediaType]);
  const pkgLabels = useMemo(() => getPackagingLabels(mediaType), [mediaType]);

  // Reset/transform when type toggles
  function onSelectType(next) {
    setMediaType(next);
    setItems((prev) => prev.map(() => makeInitialMediaState(next)));
    setPackagingMissing(false);
    setPackagingChecks({});
    setAdditionalNotes({});
    // Keep sealed as user choice
  }

  function addAnotherItem() {
    if (items.length >= MAX_ITEMS) return;
    setItems((prev) => [...prev, makeInitialMediaState(mediaType)]);
  }

  function updateItem(idx, updater) {
    setItems((prev) => prev.map((it, i) => (i === idx ? updater(it) : it)));
  }

  // ----- Calculation helpers (wrapped in useCallback for stable identity) -----
  const computeMediaScoreForItem = useCallback(
    (item) => {
      if (item.missing) return { score: 0, deductions: [{ label: "Item missing", amount: 100 }] };

      // Sealed rules
      const deductions = [];
      let score = 100;

      const evaluateRow = (row) => {
        row.forEach((entry) => {
          if (!entry.checked) return;
          // In sealed mode, vinyl media only allows warping; cassette/CD media auto M unless missing
          if (sealed) {
            if (mediaType === "vinyl" && entry.key !== "warping") return; // ignore other vinyl media defects when sealed
            if (mediaType !== "vinyl") return; // cassette/CD sealed media: ignore all defects (media = M)
          }
          const p = entry.penalty || 0;
          if (p > 0) {
            score -= p;
            deductions.push({ label: entry.label, amount: p });
          }
          // Per-defect tracks penalty only for audio defects and when relevant
          if (
            entry.tracks &&
            (entry.key === "surfaceNoise" ||
              entry.key === "popsClicks" ||
              entry.key === "tapeHiss" ||
              entry.key === "dropouts" ||
              entry.key === "squealFlutter" ||
              entry.key === "unplayableJam" ||
              entry.key === "correctedErrors" ||
              entry.key === "unreadable")
          ) {
            const t = Math.max(0, parseInt(entry.tracks || 0, 10));
            if (t > 0) {
              score -= t * MEDIA_PENALTIES.perTrack;
              deductions.push({
                label: `Tracks affected (${entry.label})`,
                amount: t * MEDIA_PENALTIES.perTrack,
              });
            }
          }
        });
      };

      evaluateRow(item.sections.visual);
      evaluateRow(item.sections.audio);
      evaluateRow(item.sections.labelArea);

      score = Math.max(0, Math.min(100, score));
      return { score, deductions };
    },
    [sealed, mediaType]
  );

  const computePackagingScore = useCallback(() => {
    if (packagingMissing) {
      return { score: 0, deductions: [{ label: "Packaging missing", amount: 100 }], sealedM: false };
    }
    let score = 100;
    const deductions = [];
    let totalDeduction = 0;

    // When sealed, only exterior wear should be evaluated:
    // Vinyl: minor shelf wear, corner wear, creases/crushing
    // Cassette: minor shelf wear, corner wear, j-card creases
    // CD: minor shelf wear, corner wear, creases/crushing (digipak/inlay)
    const allowedWhenSealed = new Set(["minorShelfWear", "cornerWear", "creases"]);

    const applyBlock = (blockArr) => {
      blockArr.forEach((cfg) => {
        const on = !!packagingChecks[cfg.key];
        if (!on) return;
        if (sealed) {
          // Ignore disallowed keys while sealed
          if (!allowedWhenSealed.has(cfg.key)) return;
        }
        if (cfg.penalty && cfg.penalty > 0) {
          totalDeduction += cfg.penalty;
          deductions.push({ label: cfg.label, amount: cfg.penalty });
        }
      });
    };

    applyBlock(pkgLabels.overall);
    applyBlock(pkgLabels.seams);
    applyBlock(pkgLabels.damage);

    // Sealed bonus (+5) with cap at 100
    if (sealed) {
      score = Math.min(100, score - totalDeduction + SLEEVE_PENALTIES.sealedBonus);
    } else {
      score = Math.max(0, 100 - totalDeduction);
    }
    return { score, deductions, sealedM: sealed && totalDeduction === 0 };
  }, [packagingChecks, packagingMissing, sealed, pkgLabels]);

  // Media aggregate across discs
  const mediaAgg = useMemo(() => {
    let total = 0;
    let allDeductions = [];

    const perItem = items.map((it) => computeMediaScoreForItem(it));
    perItem.forEach((r) => {
      total += r.score;
      allDeductions = allDeductions.concat(r.deductions);
    });

    // Determine if media can be M under sealed rules:
    let mediaAllM = false;
    if (sealed) {
      if (mediaType === "vinyl") {
        // Media is M only if NO warping selected on any item AND no item is missing
        const anyWarp = items.some((it) =>
          it.sections.visual.some((e) => e.key === "warping" && e.checked)
        );
        const anyMissing = items.some((it) => it.missing);
        mediaAllM = !anyWarp && !anyMissing;
      } else {
        // Cassette/CD: sealed => media M if none missing
        mediaAllM = !items.some((it) => it.missing);
      }
    }

    const avg = items.length ? total / items.length : 0;
    return { avg: Math.max(0, Math.min(100, avg)), deductions: allDeductions, sealedAllM: mediaAllM };
  }, [items, sealed, mediaType, computeMediaScoreForItem]);

  const packagingAgg = useMemo(() => computePackagingScore(), [computePackagingScore]);

  // Base grade from numeric (NM..F/P), with M gate handling
  function scoreToGrade(score, opts) {
    const { isMedia, mediaSealedAllM, packagingSealedM, isSealed } = opts;
    if (isSealed) {
      if (isMedia && mediaSealedAllM) return "M";
      if (!isMedia && packagingSealedM) return "M";
    }
    return numericToBaseGrade(score);
  }

  // Overall
  const overall = useMemo(() => {
    const mediaScore = mediaAgg.avg;
    const mediaGrade = scoreToGrade(mediaScore, {
      isMedia: true,
      mediaSealedAllM: mediaAgg.sealedAllM,
      packagingSealedM: false,
      isSealed: sealed,
    });

    const pkgScore = packagingAgg.score;
    const pkgGrade = scoreToGrade(pkgScore, {
      isMedia: false,
      mediaSealedAllM: false,
      packagingSealedM: packagingAgg.sealedM,
      isSealed: sealed,
    });

    // If either component is completely missing → divide by 4 (as requested)
    const componentMissing = packagingMissing || items.every((it) => it.missing);
    const denom = componentMissing ? 4 : 2;
    const overallScore = Math.max(0, Math.min(100, (mediaScore + pkgScore) / denom));

    // If both truly Mint under sealed rules and denom===2 => overall M
    let overallGrade;
    if (sealed) {
      const bothMint = mediaGrade === "M" && pkgGrade === "M";
      overallGrade = bothMint ? "M" : numericToBaseGrade(overallScore);
    } else {
      overallGrade = numericToBaseGrade(overallScore);
    }

    // Explanation (top 3 deductions on each side)
    const mediaTop = [...mediaAgg.deductions].sort((a, b) => b.amount - a.amount).slice(0, 3);
    const pkgTop = [...packagingAgg.deductions].sort((a, b) => b.amount - a.amount).slice(0, 3);

    const details = [];
    if (mediaTop.length === 0) details.push("Media: No deductions.");
    else details.push(`Media deductions: ${mediaTop.map((d) => `${d.label} (−${d.amount})`).join("; ")}.`);

    if (pkgTop.length === 0) details.push("Packaging: No deductions.");
    else details.push(`Packaging deductions: ${pkgTop.map((d) => `${d.label} (−${d.amount})`).join("; ")}.`);

    const formula =
      componentMissing
        ? "Overall = (Media + Packaging) ÷ 4 because a core component is missing."
        : "Overall = (Media + Packaging) ÷ 2.";

    return {
      mediaScore,
      mediaGrade,
      pkgScore,
      pkgGrade,
      overallScore,
      overallGrade,
      explanation: `${formula} ${details.join(" ")}`,
    };
  }, [mediaAgg, packagingAgg, sealed, packagingMissing, items]);

  // ---- UI helpers ----
  function togglePackaging(key) {
    setPackagingChecks((p) => ({ ...p, [key]: !p[key] }));
  }
  function toggleNote(key) {
    setAdditionalNotes((p) => ({ ...p, [key]: !p[key] }));
  }

  const typeTabs = (
    <div className="mg-type-tabs" role="tablist" aria-label="Media type">
      {MEDIA_TYPES.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={mediaType === t.key}
          className={`pill ${mediaType === t.key ? "selected" : ""}`}
          onClick={() => onSelectType(t.key)}
          type="button"
        >
          <span className="icon">{t.icon}</span> {t.label}
        </button>
      ))}
    </div>
  );

  const sealedBanner = (
    <div className="mg-sealed">
      <label htmlFor="sealedToggle" className="checkbox-row">
        <input
          id="sealedToggle"
          type="checkbox"
          checked={sealed}
          onChange={(e) => setSealed(e.target.checked)}
        />
        <span>Sealed (factory shrink intact)</span>
      </label>
      <p className="help">
        When <strong>Sealed</strong> is on: Vinyl allows evaluating only <em>Warping present</em> for media, and packaging
        exterior wear (<em>Minor shelf wear</em>, <em>Corner wear</em>, <em>Creases/crushing</em>). Cassettes/CDs default to <strong>Mint</strong> for media unless missing.
        Packaging gets a +5 bonus (capped at 100). <strong>Mint (M)</strong> is only assigned when sealed and flawless in the allowed scope.
      </p>
    </div>
  );

  const Header = (
    <header className="mg-header">
      <h1>🔍 Systematic Media Grading Tool</h1>
      <p className="subtitle">Detailed condition assessment with automatic grading calculation</p>
      {typeTabs}
      {sealedBanner}
    </header>
  );

  // Render one media item card
  function MediaItemCard({ item, index }) {
    const idxLabel = `${labels.itemWord} #${index + 1}`;

    const setEntry = (sectionKey, entryKey, updates) => {
      updateItem(index, (it) => {
        const next = { ...it, sections: { ...it.sections } };
        const arr = next.sections[sectionKey].map((e) =>
          e.key === entryKey ? { ...e, ...updates } : e
        );
        next.sections[sectionKey] = arr;
        return next;
      });
    };

    const setMissing = (val) => updateItem(index, (it) => ({ ...it, missing: val }));

    const sectionBlock = (title, keyName, arr) => {
      // In Sealed+Vinyl media, show only Warping row in visual
      const filtered = arr.filter((row) => {
        if (!sealed) return true;
        if (mediaType !== "vinyl") return true;
        if (title.toLowerCase().includes("visual")) {
          return row.key === "warping";
        }
        if (title.toLowerCase().includes("audio")) {
          return false;
        }
        return true;
      });

      if (
        sealed &&
        (mediaType === "cassette" || mediaType === "cd") &&
        (title.toLowerCase().includes("visual") || title.toLowerCase().includes("audio"))
      ) {
        // Hide entire media sections for cassette/CD when sealed
        return null;
      }

      if (filtered.length === 0) return null;

      return (
        <fieldset className="mg-fieldset">
          <legend>{title}</legend>
          {filtered.map((entry) => {
            const id = `${keyName}-${entry.key}-${index}`;
            const onToggle = (checked) => setEntry(keyName, entry.key, { checked });
            return (
              <div key={entry.key} className={`row ${entry.checked ? "active" : ""}`}>
                <label htmlFor={id} className="checkbox-row">
                  <input
                    id={id}
                    type="checkbox"
                    checked={entry.checked}
                    onChange={(e) => onToggle(e.target.checked)}
                  />
                  <span>{entry.label}</span>
                </label>

                {/* Sub-gradation radios (descriptive) */}
                {entry.checked && entry.sub && (
                  <div className="subradios" role="group" aria-label={`${entry.label} severity`}>
                    {entry.sub.map((slabel, i) => {
                      const rid = `${id}-sub-${i}`;
                      return (
                        <label key={rid} htmlFor={rid} className="radio-row">
                          <input
                            id={rid}
                            type="radio"
                            name={`${id}-sub`}
                            checked={entry.sub !== null && entry.sub === i}
                            onChange={() => setEntry(keyName, entry.key, { sub: i })}
                          />
                          <span>{slabel}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Side selectors for Vinyl/Cassette where applicable */}
                {entry.checked && entry.sides && (mediaType === "vinyl" || mediaType === "cassette") && (
                  <div className="sides" role="group" aria-label="Which sides affected">
                    <span className="sides-label">Which side(s) affected</span>
                    {["A", "B"].map((s) => {
                      const sid = `${id}-side-${s}`;
                      return (
                        <label key={sid} htmlFor={sid} className="checkbox-row side">
                          <input
                            id={sid}
                            type="checkbox"
                            checked={!!entry.sides[s]}
                            onChange={(e) =>
                              setEntry(keyName, entry.key, {
                                sides: { ...entry.sides, [s]: e.target.checked },
                              })
                            }
                          />
                          <span>{labels.sidesWord} {s}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Tracks affected (for audio defects or when defined) */}
                {entry.checked && typeof entry.tracks === "number" && (
                  <div className="tracks">
                    <label htmlFor={`${id}-tracks`}>Tracks affected</label>
                    <input
                      id={`${id}-tracks`}
                      type="number"
                      min="0"
                      value={entry.tracks}
                      onChange={(e) =>
                        setEntry(keyName, entry.key, {
                          tracks: Math.max(0, parseInt(e.target.value || "0", 10)),
                        })
                      }
                    />
                    <span className="hint">−1 per track, only for audio defects.</span>
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>
      );
    };

    return (
      <section className="panel">
        <div className="panel-title">
          <h3>{idxLabel}</h3>
          <div className="title-actions">
            <label htmlFor={`missing-${index}`} className="checkbox-row">
              <input
                id={`missing-${index}`}
                type="checkbox"
                checked={item.missing}
                onChange={(e) => setMissing(e.target.checked)}
              />
              <span>Mark this media as Missing (auto P)</span>
            </label>
          </div>
        </div>

        {/* Visual / Audio / Label */}
        {sectionBlock("Visual Appearance", "visual", item.sections.visual)}
        {sectionBlock(mediaType === "cassette" ? "Playback & Transport" : "Audio Performance", "audio", item.sections.audio)}
        {sectionBlock(mediaType === "vinyl" ? "Label / Center" : mediaType === "cd" ? "Hub / Face" : "Shell / Label", "labelArea", item.sections.labelArea)}
      </section>
    );
  }

  const PackagingPanel = (
    <section className="panel">
      <div className="panel-title">
        <h3>{pkgLabels.title}</h3>
        <div className="title-actions">
          <label htmlFor="pkg-missing" className="checkbox-row">
            <input
              id="pkg-missing"
              type="checkbox"
              checked={packagingMissing}
              onChange={(e) => setPackagingMissing(e.target.checked)}
            />
            <span>Mark packaging as Missing (auto P)</span>
          </label>
        </div>
      </div>

      {/* Overall Appearance */}
      <fieldset className="mg-fieldset">
        <legend>Overall Appearance</legend>
        {pkgLabels.overall.map((cfg) => (
          <label key={cfg.key} htmlFor={`pkg-${cfg.key}`} className="checkbox-row">
            <input
              id={`pkg-${cfg.key}`}
              type="checkbox"
              checked={!!packagingChecks[cfg.key]}
              onChange={() => togglePackaging(cfg.key)}
              disabled={sealed && !["minorShelfWear", "cornerWear"].includes(cfg.key)}
            />
            <span>{cfg.label}</span>
          </label>
        ))}
        {mediaType !== "vinyl" && (
          <p className="help">
            Standard plastic cases are <strong>not graded</strong> as they are replaceable. Evaluate the J-card/inlay/booklet/digipak.
          </p>
        )}
        {sealed && (
          <p className="help">
            Sealed adds +5 (cap 100). <strong>M</strong> only if sealed &amp; flawless (no allowed deductions).
          </p>
        )}
      </fieldset>

      {/* Structure */}
      <fieldset className="mg-fieldset">
        <legend>{mediaType === "vinyl" ? "Seams & Structure" : mediaType === "cassette" ? "J-card Structure" : "Insert/Tray Structure"}</legend>
        {pkgLabels.seams.map((cfg) => (
          <label key={cfg.key} htmlFor={`pkg-${cfg.key}`} className="checkbox-row">
            <input
              id={`pkg-${cfg.key}`}
              type="checkbox"
              checked={!!packagingChecks[cfg.key]}
              onChange={() => togglePackaging(cfg.key)}
              disabled={sealed && cfg.key !== "allIntact"} /* when sealed, ignore structure issues except allowing "intact" */
            />
            <span>{cfg.label}</span>
          </label>
        ))}
      </fieldset>

      {/* Damage */}
      <fieldset className="mg-fieldset">
        <legend>Damage &amp; Markings</legend>
        {pkgLabels.damage.map((cfg) => (
          <label key={cfg.key} htmlFor={`pkg-${cfg.key}`} className="checkbox-row">
            <input
              id={`pkg-${cfg.key}`}
              type="checkbox"
              checked={!!packagingChecks[cfg.key]}
              onChange={() => togglePackaging(cfg.key)}
              disabled={sealed && cfg.key !== "creases"} /* sealed: permit only creases/crushing from exterior */
            />
            <span>{cfg.label}</span>
          </label>
        ))}
      </fieldset>

      {/* Additional notes */}
      <fieldset className="mg-fieldset">
        <legend>Additional notes (don’t affect score)</legend>
        <div className="notes-grid">
          {pkgLabels.notes.map((n) => (
            <label key={n.key} htmlFor={`note-${n.key}`} className="checkbox-row note">
              <input
                id={`note-${n.key}`}
                type="checkbox"
                checked={!!additionalNotes[n.key]}
                onChange={() => toggleNote(n.key)}
              />
              <span>{n.label}</span>
            </label>
          ))}
        </div>
        {mediaType !== "vinyl" && (
          <p className="help">Standard jewel/Norelco cases are replaceable; track them here if needed.</p>
        )}
      </fieldset>
    </section>
  );

  return (
    <main id="media-grading">
      <a className="back-link" href="/admin">← Back to Dashboard</a>
      {Header}

      <div className="mg-grid">
        <div className="col">
          <h2 className="col-title">
            {mediaType === "vinyl" ? "🎶 Vinyl Record" : mediaType === "cassette" ? "📼 Cassette" : "💿 Compact Disc"} Condition Assessment
          </h2>

          {items.map((item, i) => (
            <MediaItemCard key={i} item={item} index={i} />
          ))}

          <div className="add-row">
            <button type="button" className="btn add" onClick={addAnotherItem} disabled={items.length >= MAX_ITEMS}>
              Add Another {labels.itemWord}
            </button>
          </div>
        </div>

        <div className="col">
          <h2 className="col-title">
            {mediaType === "vinyl" ? "📦 Jacket & Packaging" : mediaType === "cassette" ? "📦 J-Card & Packaging" : "📦 Inlay/Booklet & Packaging"} Condition Assessment
          </h2>
          {PackagingPanel}
        </div>
      </div>

      {/* Custom notes */}
      <section className="panel">
        <h3>📝 Custom Condition Notes</h3>
        <textarea
          rows={4}
          value={customNotes}
          onChange={(e) => setCustomNotes(e.target.value)}
          placeholder=""
          aria-label="Custom condition notes"
        />
      </section>

      {/* Results */}
      <section className="results">
        <div className={`card grade ${overall.mediaGrade}`}>
          <div className="label">{mediaType === "vinyl" ? "Record Grade" : mediaType === "cassette" ? "Tape Grade" : "Disc Grade"}</div>
          <div className="value">{overall.mediaGrade}</div>
          <div className="score">{Math.round(overall.mediaScore)}/100</div>
        </div>

        <div className={`card grade ${overall.pkgGrade}`}>
          <div className="label">Sleeve/Packaging Grade</div>
          <div className="value">{overall.pkgGrade}</div>
          <div className="score">{Math.round(overall.pkgScore)}/100</div>
        </div>

        <div className={`card grade ${overall.overallGrade}`}>
          <div className="label">Overall Grade</div>
          <div className="value">{overall.overallGrade}</div>
          <div className="score">{Math.round(overall.overallScore)}/100</div>
        </div>
      </section>

      <section className="panel explanation">
        <h3>Grading Explanation</h3>
        <p>{overall.explanation}</p>
        {customNotes.trim() && (
          <>
            <h4>Additional Notes</h4>
            <p>{customNotes}</p>
          </>
        )}
      </section>
    </main>
  );
}
