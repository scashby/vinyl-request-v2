"use client";

import React, { useState, useMemo, useCallback } from "react";
import "styles/media-grading.css";

/**
 * Systematic Media Grading Tool — Admin
 *
 * Update (CD packaging depth):
 * - Added CD booklet/insert grading for: Torn pages (with severity), Missing pages (high impact),
 *   and Water damage (with severity). Lives under Damage & Markings.
 *
 * Prior features intact:
 * - NM gating:
 *   • Media (Vinyl): NM only if “Record has glossy…” is the ONLY checked item across media sections.
 *   • Packaging (all types): NM only if “Looks like new, no flaws” is the ONLY checked packaging item.
 * - Shelf wear severity (Light/Moderate/Heavy) penalties (2/8/12).
 * - Sleeve Appearance nudge (Vinyl covers only): ±2 on grade cusps.
 * - Sealed logic + “Start Next Album (Reset)” button.
 */

function numericToBaseGrade(score) {
  if (score >= 97) return "NM";
  if (score >= 85) return "VG+";
  if (score >= 75) return "VG";
  if (score >= 65) return "G+";
  if (score >= 50) return "G";
  return "F/P";
}

const MEDIA_PENALTIES = {
  lightScuffs: 3,
  scratches: 8,
  grooveWearOrAlt: 12,
  warpingOrWobble: 10,
  surfaceNoise: 6,
  popsClicksOrReadErrors: 4,
  skippingOrUnreadable: 30,
  labelShellHubMinor: 3,
  perTrack: 1,
};

const SLEEVE_PENALTIES = {
  minorShelfWear: 3,
  cornerWear: 4,
  ringWearOrBookletRing: 5,
  spineWear: 3,
  seamSplitOrCaseCracked: 12,
  tears: 8,
  writing: 4,
  stickers: 3,
  sealedBonus: 5,
};

const MEDIA_TYPES = [
  { key: "vinyl", label: "Vinyl Records", icon: "🎵" },
  { key: "cassette", label: "Cassette Tapes", icon: "📼" },
  { key: "cd", label: "Compact Discs", icon: "💿" },
];

function sideLettersForIndex(idx) {
  const base = "A".charCodeAt(0) + idx * 2;
  const s1 = String.fromCharCode(base);
  const s2 = String.fromCharCode(base + 1);
  return [s1, s2];
}

// -------- Label builders per media type --------
function getMediaLabels(mediaType) {
  if (mediaType === "vinyl") {
    return {
      mediaHeading: "Vinyl Record Condition Assessment",
      itemWord: "Record",
      sideable: true,
      mediaVisual: [
        { key: "glossy", label: "Record has glossy, like-new appearance", type: "check", penalty: 0, sideable: false, tracks: false },
        { key: "lightScuffs", label: "Light scuffs visible", type: "check+sub", sub: ["Very light, barely visible","Visible but not deep","Obvious, multiple scuffs"], penalty: MEDIA_PENALTIES.lightScuffs, sideable: true, tracks: true },
        { key: "scratches", label: "Scratches present", type: "check+sub", sub: ["Hairline scratches only","Can feel with fingernail","Deep, visible grooves"], penalty: MEDIA_PENALTIES.scratches, sideable: true, tracks: true },
        { key: "grooveWear", label: "Groove wear visible", type: "check+sub", sub: ["Light","Moderate","Heavy"], penalty: MEDIA_PENALTIES.grooveWearOrAlt, sideable: true, tracks: true },
        { key: "warping", label: "Warping present", type: "check+sub", sub: ["Slight dish/edge warp (plays fine)","Moderate warp (minor tracking issues)","Severe warp (affects play)"], penalty: MEDIA_PENALTIES.warpingOrWobble, sideable: false, tracks: false },
      ],
      mediaAudio: [
        { key: "playsClean", label: "Plays with no surface noise", type: "check", penalty: 0, sideable: false, tracks: false },
        { key: "surfaceNoise", label: "Surface noise when played", type: "check+sub", sub: ["Minimal","Noticeable","Significant"], penalty: MEDIA_PENALTIES.surfaceNoise, sideable: true, tracks: true },
        { key: "popsClicks", label: "Occasional pops or clicks", type: "check+sub", sub: ["Occasional","Frequent"], penalty: MEDIA_PENALTIES.popsClicksOrReadErrors, sideable: true, tracks: true },
        { key: "skipping", label: "Skipping or repeating", type: "check", penalty: MEDIA_PENALTIES.skippingOrUnreadable, sideable: true, tracks: true },
      ],
      mediaLabelArea: [
        { key: "labelClean", label: "Label is clean and bright", type: "check", penalty: 0, sideable: false, tracks: false },
        { key: "spindleMarks", label: "Spindle marks present", type: "check", penalty: MEDIA_PENALTIES.labelShellHubMinor, sideable: false, tracks: false },
        { key: "writingOnLabel", label: "Writing on label", type: "check", penalty: MEDIA_PENALTIES.labelShellHubMinor, sideable: false, tracks: false },
        { key: "stickersOnLabel", label: "Stickers or tape on label", type: "check", penalty: MEDIA_PENALTIES.labelShellHubMinor, sideable: false, tracks: false },
      ],
    };
  }

  if (mediaType === "cassette") {
    return {
      mediaHeading: "Cassette Condition Assessment",
      itemWord: "Tape",
      sideable: true,
      mediaVisual: [
        { key: "shellScuffs", label: "Shell scuffs present", type: "check+sub", sub: ["Light","Moderate","Heavy"], penalty: MEDIA_PENALTIES.grooveWearOrAlt, sideable: false, tracks: false },
        { key: "windowHaze", label: "Window/clouding or discoloration", type: "check", penalty: MEDIA_PENALTIES.lightScuffs, sideable: false, tracks: false },
      ],
      mediaAudio: [
        { key: "playsClean", label: "Plays with no audible issues", type: "check", penalty: 0, sideable: false, tracks: false },
        { key: "tapeHiss", label: "Hiss/noise when played", type: "check+sub", sub: ["Minimal","Noticeable","Significant"], penalty: MEDIA_PENALTIES.surfaceNoise, sideable: true, tracks: true },
        { key: "dropouts", label: "Dropouts/clicks", type: "check+sub", sub: ["Occasional","Frequent"], penalty: MEDIA_PENALTIES.popsClicksOrReadErrors, sideable: true, tracks: true },
        { key: "squealFlutter", label: "Squeal / wow–flutter audible", type: "check", penalty: MEDIA_PENALTIES.surfaceNoise, sideable: true, tracks: true },
        { key: "unplayableJam", label: "Jams/unplayable sections", type: "check", penalty: MEDIA_PENALTIES.skippingOrUnreadable, sideable: true, tracks: true },
      ],
      mediaLabelArea: [
        { key: "labelClean", label: "Shell/label clean and bright", type: "check", penalty: 0, sideable: false, tracks: false },
        { key: "writingOnShell", label: "Writing on shell/label", type: "check", penalty: MEDIA_PENALTIES.labelShellHubMinor, sideable: false, tracks: false },
        { key: "stickersOnShell", label: "Stickers or tape on shell", type: "check", penalty: MEDIA_PENALTIES.labelShellHubMinor, sideable: false, tracks: false },
        { key: "pressurePad", label: "Pressure pad missing or degraded", type: "check", penalty: MEDIA_PENALTIES.scratches, sideable: false, tracks: false },
      ],
    };
  }

  // CD
  return {
    mediaHeading: "Compact Disc Condition Assessment",
    itemWord: "Disc",
    sideable: false,
    mediaVisual: [
      { key: "lightScuffs", label: "Light scuffs visible", type: "check+sub", sub: ["Very light","Visible, minor","Multiple light scuffs"], penalty: MEDIA_PENALTIES.lightScuffs, sideable: false, tracks: false },
      { key: "scratches", label: "Scratches present", type: "check+sub", sub: ["Few light","Some deeper","Many/deep"], penalty: MEDIA_PENALTIES.scratches, sideable: false, tracks: false },
      { key: "laserRot", label: "Laser-rot / pinholes visible (label/top coat)", type: "check+sub", sub: ["Minimal","Noticeable","Significant"], penalty: MEDIA_PENALTIES.grooveWearOrAlt, sideable: false, tracks: false },
      { key: "wobble", label: "Disc wobble present", type: "check+sub", sub: ["Slight","Moderate","Severe"], penalty: MEDIA_PENALTIES.warpingOrWobble, sideable: false, tracks: false },
    ],
    mediaAudio: [
      { key: "playsClean", label: "Plays with no read errors", type: "check", penalty: 0, sideable: false, tracks: false },
      { key: "correctedErrors", label: "Occasional read errors corrected", type: "check", penalty: MEDIA_PENALTIES.popsClicksOrReadErrors, sideable: false, tracks: true },
      { key: "unreadable", label: "Unreadable sectors / skipping", type: "check", penalty: MEDIA_PENALTIES.skippingOrUnreadable, sideable: false, tracks: true },
    ],
    mediaLabelArea: [
      { key: "hubClean", label: "Hub/face clean and bright", type: "check", penalty: 0, sideable: false, tracks: false },
      { key: "writingOnFace", label: "Writing on disc face", type: "check", penalty: MEDIA_PENALTIES.labelShellHubMinor, sideable: false, tracks: false },
      { key: "stickersOnFace", label: "Stickers or tape on disc face", type: "check", penalty: MEDIA_PENALTIES.labelShellHubMinor, sideable: false, tracks: false },
    ],
  };
}

function getPackagingLabels(mediaType) {
  if (mediaType === "vinyl") {
    return {
      title: "Jacket & Packaging Condition Assessment",
      overall: [
        { key: "looksNew", label: "Looks like new, no flaws", penalty: 0 },
        { key: "minorShelfWear", label: "Shelf wear present", penalty: SLEEVE_PENALTIES.minorShelfWear, sub: ["Light","Moderate","Heavy"] },
        { key: "cornerWear", label: "Corner wear present", penalty: SLEEVE_PENALTIES.cornerWear, sub: ["Slight bumping","Creased/frayed","Cut/heavily damaged"] },
        { key: "ringWear", label: "Ring wear visible", penalty: SLEEVE_PENALTIES.ringWearOrBookletRing, sub: ["Light","Moderate","Heavy"] },
      ],
      seams: [
        { key: "allSeamsIntact", label: "All seams intact", penalty: 0 },
        { key: "seamSplits", label: "Seam splits present", penalty: SLEEVE_PENALTIES.seamSplitOrCaseCracked, sub: ["Small","Medium","Large / multiple"] },
        { key: "spineWear", label: "Spine shows wear", penalty: SLEEVE_PENALTIES.spineWear, sub: ["Light","Moderate","Heavy"] },
      ],
      damage: [
        { key: "creases", label: "Creases / crushing present", penalty: SLEEVE_PENALTIES.cornerWear, sub: ["Small","Moderate","Large/through"] },
        { key: "tears", label: "Tears present", penalty: SLEEVE_PENALTIES.tears, sub: ["Small","Medium","Large / across"] },
        { key: "writing", label: "Writing present", penalty: SLEEVE_PENALTIES.writing, sub: ["Initials/small","Notes","Large/covering"] },
        { key: "stickers", label: "Stickers or tape", penalty: SLEEVE_PENALTIES.stickers, sub: ["Price","Hype","Residue"] },
      ],
      appearance: {
        key: "appearance",
        label: "Sleeve appearance (Vinyl covers only; tiny bump on the cusp)",
        options: [
          { key: "wellPreserved", label: "Well-preserved (+2 on cusp)" },
          { key: "gentlyHandled", label: "Gently handled (no change)" },
          { key: "wellWorn", label: "Well-worn (−2 on cusp)" },
        ],
      },
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
        { key: "obi", label: "OBI present" },
      ],
    };
  }

  if (mediaType === "cassette") {
    return {
      title: "J-Card & Packaging Condition Assessment",
      overall: [
        { key: "looksNew", label: "Looks like new, no flaws", penalty: 0 },
        { key: "minorShelfWear", label: "Minor shelf wear only", penalty: SLEEVE_PENALTIES.minorShelfWear },
        { key: "cornerWear", label: "Corner wear present", penalty: SLEEVE_PENALTIES.cornerWear, sub: ["Slight bumping","Creased/frayed","Cut/damaged"] },
      ],
      seams: [
        { key: "allIntact", label: "J-card intact", penalty: 0 },
        { key: "foldTears", label: "J-card creases/tears", penalty: SLEEVE_PENALTIES.tears, sub: ["Small","Medium","Large"] },
      ],
      damage: [
        { key: "creases", label: "Creases / crushing present", penalty: SLEEVE_PENALTIES.cornerWear, sub: ["Small","Moderate","Large"] },
        { key: "writing", label: "Writing present", penalty: SLEEVE_PENALTIES.writing, sub: ["Initials","Notes","Large/covering"] },
        { key: "stickers", label: "Stickers or tape", penalty: SLEEVE_PENALTIES.stickers, sub: ["Small","Multiple","Residue"] },
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

  // CD — expanded booklet/insert grading
  return {
    title: "Inlay/Booklet & Packaging Condition Assessment",
    overall: [
      { key: "looksNew", label: "Looks like new, no flaws", penalty: 0 },
      { key: "minorShelfWear", label: "Minor shelf wear only", penalty: SLEEVE_PENALTIES.minorShelfWear },
      { key: "cornerWear", label: "Corner wear present (insert/digipak)", penalty: SLEEVE_PENALTIES.cornerWear, sub: ["Slight bumping","Creased/frayed","Cut/damaged"] },
      { key: "ringWear", label: "Booklet ring wear visible", penalty: SLEEVE_PENALTIES.ringWearOrBookletRing, sub: ["Light","Moderate","Heavy"] },
    ],
    seams: [{ key: "allIntact", label: "Booklet/tray insert intact", penalty: 0 }],
    damage: [
      { key: "creases", label: "Creases / crushing present", penalty: SLEEVE_PENALTIES.cornerWear, sub: ["Small","Moderate","Large/through"] },
      { key: "tears", label: "Tears present", penalty: SLEEVE_PENALTIES.tears, sub: ["Small","Medium","Large / across"] },
      { key: "tornPages", label: "Torn pages", penalty: SLEEVE_PENALTIES.tears, sub: ["Small tears","Multiple tears","Large/edge tears"] },
      { key: "missingPages", label: "Missing pages (booklet incomplete)", penalty: 20 },
      { key: "waterDamage", label: "Water/moisture damage", penalty: 10, sub: ["Light spotting","Noticeable staining","Severe/warped"] },
      { key: "writing", label: "Writing present", penalty: SLEEVE_PENALTIES.writing, sub: ["Initials","Notes","Large/covering"] },
      { key: "stickers", label: "Stickers or tape", penalty: SLEEVE_PENALTIES.stickers, sub: ["Price","Hype","Residue"] },
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

// Create initial per-item state
function makeInitialMediaState(mediaType) {
  const labels = getMediaLabels(mediaType);
  const fold = (arr) =>
    arr.map((cfg) => ({
      key: cfg.key,
      checked: false,
      subOptions: Array.isArray(cfg.sub) ? cfg.sub : null,
      subIndex: null,
      sides: cfg.sideable ? { S1: false, S2: false } : null,
      tracks: cfg.tracks ? (labels.sideable ? { S1: 0, S2: 0 } : 0) : null,
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

  const [items, setItems] = useState([makeInitialMediaState("vinyl")]);

  const [packagingMissing, setPackagingMissing] = useState(false);
  const [packagingChecks, setPackagingChecks] = useState({});
  const [packagingSubs, setPackagingSubs] = useState({});
  const [additionalNotes, setAdditionalNotes] = useState({});
  const [customNotes, setCustomNotes] = useState("");

  // Sleeve appearance nudge (Vinyl only)
  const [packagingAppearance, setPackagingAppearance] = useState("gentlyHandled");

  const labels = useMemo(() => getMediaLabels(mediaType), [mediaType]);
  const pkgLabels = useMemo(() => getPackagingLabels(mediaType), [mediaType]);

  function onSelectType(next) {
    setMediaType(next);
    setItems((prev) => prev.map(() => makeInitialMediaState(next)));
    setPackagingMissing(false);
    setPackagingChecks({});
    setPackagingSubs({});
    setAdditionalNotes({});
    setPackagingAppearance("gentlyHandled");
    setSealed(false);
    setCustomNotes("");
  }

  function addAnotherItem() {
    if (items.length >= MAX_ITEMS) return;
    setItems((prev) => [...prev, makeInitialMediaState(mediaType)]);
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(idx, updater) {
    setItems((prev) => prev.map((it, i) => (i === idx ? updater(it) : it)));
  }

  // Reset/Clear for next album (preserve mediaType)
  function resetForNextAlbum() {
    setItems([makeInitialMediaState(mediaType)]);
    setSealed(false);
    setPackagingMissing(false);
    setPackagingChecks({});
    setPackagingSubs({});
    setAdditionalNotes({});
    setCustomNotes("");
    setPackagingAppearance("gentlyHandled");
  }

  const computeMediaScoreForItem = useCallback(
    (item) => {
      if (item.missing) return { score: 0, deductions: [{ label: "Item missing", amount: 100 }] };

      let score = 100;
      const deductions = [];

      const evalRow = (row, isAudio) => {
        row.forEach((entry) => {
          if (!entry.checked) return;

          // Sealed gating
          if (sealed) {
            if (mediaType === "vinyl") {
              if (entry.key !== "warping") return;
            } else {
              return; // cassette/CD: media assumed perfect when sealed
            }
          }

          const p = entry.penalty || 0;
          if (p > 0) {
            score -= p;
            deductions.push({ label: entry.label, amount: p });
          }

          // per-track (audio-only)
          if (isAudio && entry.tracks !== null) {
            if (labels.sideable && entry.tracks && typeof entry.tracks === "object") {
              const countS1 = entry.sides?.S1 ? Math.max(0, parseInt(entry.tracks.S1 || 0, 10)) : 0;
              const countS2 = entry.sides?.S2 ? Math.max(0, parseInt(entry.tracks.S2 || 0, 10)) : 0;
              const total = countS1 + countS2;
              if (total > 0) {
                const amt = total * MEDIA_PENALTIES.perTrack;
                score -= amt;
                deductions.push({ label: `Tracks affected (${entry.label})`, amount: amt });
              }
            } else if (!labels.sideable && typeof entry.tracks === "number") {
              const t = Math.max(0, parseInt(entry.tracks || 0, 10));
              if (t > 0) {
                const amt = t * MEDIA_PENALTIES.perTrack;
                score -= amt;
                deductions.push({ label: `Tracks affected (${entry.label})`, amount: amt });
              }
            }
          }
        });
      };

      evalRow(item.sections.visual, false);
      evalRow(item.sections.audio, true);
      evalRow(item.sections.labelArea, false);

      score = Math.max(0, Math.min(100, score));
      return { score, deductions };
    },
    [sealed, mediaType, labels.sideable]
  );

  // Shelf wear severity penalties (Light/Moderate/Heavy)
  const shelfWearPenalty = (idx) => {
    if (idx === 0) return 2;
    if (idx === 1) return 8;
    return 12;
  };

  const computePackagingScore = useCallback(() => {
    if (packagingMissing) {
      return { score: 0, deductions: [{ label: "Packaging missing", amount: 100 }], sealedM: false };
    }
    let score = 100;
    const deductions = [];
    let totalDeduction = 0;

    // Sealed gating for packaging
    const sealedVinylAllowed = new Set(["minorShelfWear","cornerWear","ringWear","creases","tears","writing","stickers"]);
    const allowedWhenSealedNonVinyl = new Set(["minorShelfWear","cornerWear","creases"]);

    const allowKey = (key) => {
      if (!sealed) return true;
      if (mediaType === "vinyl") return sealedVinylAllowed.has(key);
      return allowedWhenSealedNonVinyl.has(key) || key === "allIntact" || key === "allSeamsIntact";
    };

    const applyBlock = (blockArr) => {
      blockArr.forEach((cfg) => {
        if (!allowKey(cfg.key)) return;
        const on = !!packagingChecks[cfg.key];
        if (!on) return;

        let p = cfg.penalty || 0;
        if (cfg.key === "minorShelfWear" && Array.isArray(cfg.sub)) {
          const idx = packagingSubs[cfg.key];
          p = idx !== undefined && idx !== null ? shelfWearPenalty(idx) : shelfWearPenalty(0);
        }

        if (p > 0) {
          totalDeduction += p;
          deductions.push({ label: cfg.label, amount: p });
        }
      });
    };

    applyBlock(pkgLabels.overall);
    applyBlock(pkgLabels.seams);
    applyBlock(pkgLabels.damage);

    if (sealed) {
      score = Math.min(100, score - totalDeduction + SLEEVE_PENALTIES.sealedBonus);
    } else {
      score = Math.max(0, 100 - totalDeduction);
    }

    // Sleeve appearance nudge (Vinyl only) on grade cusps
    let appearanceApplied = null;
    if (mediaType === "vinyl" && pkgLabels.appearance) {
      const boundaries = [97, 85, 75, 65, 50];
      const isOnCusp = boundaries.some((b) => Math.abs(score - b) <= 2);
      if (isOnCusp) {
        let bump = 0;
        if (packagingAppearance === "wellPreserved") bump = 2;
        if (packagingAppearance === "wellWorn") bump = -2;
        if (bump !== 0) {
          const before = score;
          score = Math.max(0, Math.min(100, score + bump));
          appearanceApplied = { before, after: score, bump };
        }
      }
    }

    return { score, deductions, sealedM: sealed && totalDeduction === 0, appearanceApplied };
  }, [packagingChecks, packagingMissing, sealed, pkgLabels, mediaType, packagingSubs, packagingAppearance]);

  const mediaAgg = useMemo(() => {
    let total = 0;
    let allDeductions = [];
    const perItem = items.map((it) => computeMediaScoreForItem(it));
    perItem.forEach((r) => {
      total += r.score;
      allDeductions = allDeductions.concat(r.deductions);
    });

    let mediaAllM = false;
    if (sealed) {
      if (mediaType === "vinyl") {
        const anyWarp = items.some((it) => it.sections.visual.some((e) => e.key === "warping" && e.checked));
        const anyMissing = items.some((it) => it.missing);
        mediaAllM = !anyWarp && !anyMissing;
      } else {
        mediaAllM = !items.some((it) => it.missing);
      }
    }

    const avg = items.length ? total / items.length : 0;
    return { avg: Math.max(0, Math.min(100, avg)), deductions: allDeductions, sealedAllM: mediaAllM };
  }, [items, sealed, mediaType, computeMediaScoreForItem]);

  const packagingAgg = useMemo(() => computePackagingScore(), [computePackagingScore]);

  // NM gate helpers
  const isVinylMediaNMEligible = useMemo(() => {
    if (mediaType !== "vinyl") return true;
    if (!items.length) return false;
    for (const item of items) {
      if (item.missing) return false;
      let glossyChecked = false;
      let anyOtherChecked = false;
      const scan = (arr) => { for (const e of arr) { if (e.checked) { if (e.key === "glossy") glossyChecked = true; else anyOtherChecked = true; } } };
      scan(item.sections.visual); scan(item.sections.audio); scan(item.sections.labelArea);
      if (!glossyChecked || anyOtherChecked) return false;
    }
    return true;
  }, [items, mediaType]);

  const isPackagingNMEligible = useMemo(() => {
    if (packagingMissing) return false;
    const looksNewOn = !!packagingChecks["looksNew"];
    if (!looksNewOn) return false;
    for (const [k, v] of Object.entries(packagingChecks)) {
      if (!v) continue;
      if (k !== "looksNew") return false;
    }
    return true;
  }, [packagingChecks, packagingMissing]);

  function scoreToGrade(score, opts) {
    const { isMedia, mediaSealedAllM, packagingSealedM, isSealed } = opts;
    if (isSealed) {
      if (isMedia && mediaSealedAllM) return "M";
      if (!isMedia && packagingSealedM) return "M";
    }
    return numericToBaseGrade(score);
  }

  const overall = useMemo(() => {
    const mediaScore = mediaAgg.avg;
    let mediaGrade = scoreToGrade(mediaScore, { isMedia: true, mediaSealedAllM: mediaAgg.sealedAllM, packagingSealedM: false, isSealed: sealed });
    const pkgScore = packagingAgg.score;
    let pkgGrade = scoreToGrade(pkgScore, { isMedia: false, mediaSealedAllM: false, packagingSealedM: packagingAgg.sealedM, isSealed: sealed });

    // Apply NM caps
    if (mediaGrade === "NM" && mediaType === "vinyl" && !isVinylMediaNMEligible) mediaGrade = "VG+";
    if (pkgGrade === "NM" && !isPackagingNMEligible) pkgGrade = "VG+";

    const componentMissing = packagingMissing || items.every((it) => it.missing);
    const denom = componentMissing ? 4 : 2;
    const overallScore = Math.max(0, Math.min(100, (mediaScore + pkgScore) / denom));

    let overallGrade;
    if (sealed) {
      const bothMint = mediaGrade === "M" && pkgGrade === "M";
      overallGrade = bothMint ? "M" : numericToBaseGrade(overallScore);
    } else {
      overallGrade = numericToBaseGrade(overallScore);
    }

    // Ensure overall NM only when both are NM
    if (overallGrade === "NM" && !(mediaGrade === "NM" && pkgGrade === "NM")) {
      overallGrade = "VG+";
    }

    const mediaTop = [...mediaAgg.deductions].sort((a, b) => b.amount - a.amount).slice(0, 3);
    const pkgTop = [...packagingAgg.deductions].sort((a, b) => b.amount - a.amount).slice(0, 3);

    const details = [];
    details.push(mediaTop.length ? `Media deductions: ${mediaTop.map((d) => `${d.label} (−${d.amount})`).join("; ")}.` : "Media: No deductions.");
    details.push(pkgTop.length ? `Packaging deductions: ${pkgTop.map((d) => `${d.label} (−${d.amount})`).join("; ")}.` : "Packaging: No deductions.");

    if (packagingAgg.appearanceApplied) {
      const { before, after, bump } = packagingAgg.appearanceApplied;
      details.push(`Sleeve appearance nudge applied: ${bump > 0 ? "+" : ""}${bump} (from ${Math.round(before)} to ${Math.round(after)}), on cusp.`);
    }

    const formula = componentMissing ? "Overall = (Media + Packaging) ÷ 4 because a core component is missing." : "Overall = (Media + Packaging) ÷ 2.";

    return { mediaScore, mediaGrade, pkgScore, pkgGrade, overallScore, overallGrade, explanation: `${formula} ${details.join(" ")}` };
  }, [mediaAgg, packagingAgg, sealed, packagingMissing, items, mediaType, isVinylMediaNMEligible, isPackagingNMEligible]);

  function togglePackaging(key) { setPackagingChecks((p) => ({ ...p, [key]: !p[key] })); }
  function setPackagingSub(key, idx) { setPackagingSubs((p) => ({ ...p, [key]: idx })); }
  function toggleNote(key) { setAdditionalNotes((p) => ({ ...p, [key]: !p[key] })); }

  const typeTabs = (
    <div className="mg-type-tabs" role="tablist" aria-label="Media type">
      {MEDIA_TYPES.map((t) => (
        <button key={t.key} role="tab" aria-selected={mediaType === t.key} className={`pill ${mediaType === t.key ? "selected" : ""}`} onClick={() => onSelectType(t.key)} type="button">
          <span className="icon">{t.icon}</span> {t.label}
        </button>
      ))}
    </div>
  );

  const sealedBanner = (
    <div className="mg-sealed">
      <div className="sealed-row">
        <label htmlFor="sealedToggle" className="checkbox-row">
          <input id="sealedToggle" type="checkbox" checked={sealed} onChange={(e) => setSealed(e.target.checked)} />
          <span>Sealed (factory shrink intact)</span>
        </label>
        <button type="button" className="btn reset" onClick={resetForNextAlbum} aria-label="Start next album">
          Start Next Album (Reset)
        </button>
      </div>
      <p className="help">
        When <strong>Sealed</strong> is on:
        <br />• <strong>Vinyl</strong>: only evaluate <em>Warping present</em> for the record; all other record criteria are assumed perfect.
        <br />• <strong>Cassettes/CDs</strong>: media condition is assumed perfect (hidden) unless visibly defective through the case.
        <br />• Packaging: exterior wear only. For Vinyl, sleeve wear/marking/damage items are evaluated. A +5 sealed bonus applies (cap 100). <strong>Mint (M)</strong> requires sealed & flawless in allowed scope.
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

  function MediaItemCard({ item, index }) {
    const [L1, L2] = sideLettersForIndex(index);
    const idxLabel = `${labels.itemWord} #${index + 1}`;

    const setEntry = (sectionKey, entryKey, updates) => {
      updateItem(index, (it) => {
        const next = { ...it, sections: { ...it.sections } };
        const arr = next.sections[sectionKey].map((e) => (e.key === entryKey ? { ...e, ...updates } : e));
        next.sections[sectionKey] = arr;
        return next;
      });
    };

    const setMissing = (val) => updateItem(index, (it) => ({ ...it, missing: val }));

    const sectionBlock = (title, keyName, arr) => {
      if (sealed && mediaType !== "vinyl") return null; // hide ALL media details when sealed for cassette/CD

      let filtered = arr;
      if (sealed && mediaType === "vinyl") {
        if (title.toLowerCase().includes("visual")) {
          filtered = arr.filter((row) => row.key === "warping");
        } else if (title.toLowerCase().includes("audio") || title.toLowerCase().includes("playback") || title.toLowerCase().includes("label") || title.toLowerCase().includes("center")) {
          return null;
        }
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
                  <input id={id} type="checkbox" checked={entry.checked} onChange={(e) => onToggle(e.target.checked)} />
                  <span>{entry.label}</span>
                </label>

                {entry.checked && Array.isArray(entry.subOptions) && (
                  <div className="subradios" role="group" aria-label={`${entry.label} severity`}>
                    {entry.subOptions.map((slabel, i) => {
                      const rid = `${id}-sub-${i}`;
                      return (
                        <label key={rid} htmlFor={rid} className="radio-row">
                          <input id={rid} type="radio" name={`${id}-sub`} checked={entry.subIndex === i} onChange={() => setEntry(keyName, entry.key, { subIndex: i })} />
                          <span>{slabel}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {entry.checked && entry.sides && (
                  <div className="sides" role="group" aria-label="Which side(s) affected">
                    <span className="sides-label">Which side(s) affected</span>
                    {[{ key: "S1", label: L1 }, { key: "S2", label: L2 }].map((s) => {
                      const sid = `${id}-side-${s.key}`;
                      return (
                        <label key={sid} htmlFor={sid} className="checkbox-row side">
                          <input id={sid} type="checkbox" checked={!!entry.sides[s.key]} onChange={(e) => setEntry(keyName, entry.key, { sides: { ...entry.sides, [s.key]: e.target.checked } })} />
                          <span>Side {s.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {entry.checked && entry.tracks !== null && (
                  <div className="tracks">
                    {labels.sideable && typeof entry.tracks === "object" ? (
                      <>
                        <label htmlFor={`${id}-tracks-S1`}>Tracks affected — Side {L1}</label>
                        <input id={`${id}-tracks-S1`} type="number" min="0" value={entry.tracks.S1} onChange={(e) => setEntry(keyName, entry.key, { tracks: { ...entry.tracks, S1: Math.max(0, parseInt(e.target.value || "0", 10)) } })} />
                        <label htmlFor={`${id}-tracks-S2`}>Side {L2}</label>
                        <input id={`${id}-tracks-S2`} type="number" min="0" value={entry.tracks.S2} onChange={(e) => setEntry(keyName, entry.key, { tracks: { ...entry.tracks, S2: Math.max(0, parseInt(e.target.value || "0", 10)) } })} />
                        <span className="hint">−1 per track applies only to <em>audio</em> defects; for visual, track counts are informational.</span>
                      </>
                    ) : (
                      <>
                        <label htmlFor={`${id}-tracks`}>Tracks affected</label>
                        <input id={`${id}-tracks`} type="number" min="0" value={entry.tracks} onChange={(e) => setEntry(keyName, entry.key, { tracks: Math.max(0, parseInt(e.target.value || "0", 10)) })} />
                        <span className="hint">−1 per track applies only to audio defects.</span>
                      </>
                    )}
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
              <input id={`missing-${index}`} type="checkbox" checked={item.missing} onChange={(e) => setMissing(e.target.checked)} />
              <span>Mark this media as Missing (auto P)</span>
            </label>
            <button type="button" className="btn danger" onClick={() => removeItem(index)} aria-label={`Remove ${labels.itemWord}`}>
              Remove {labels.itemWord}
            </button>
          </div>
        </div>

        {sectionBlock("Visual Appearance", "visual", item.sections.visual)}
        {sectionBlock(mediaType === "cassette" ? "Playback & Transport" : "Audio Performance", "audio", item.sections.audio)}
        {sectionBlock(mediaType === "vinyl" ? "Label / Center" : mediaType === "cd" ? "Hub / Face" : "Shell / Label", "labelArea", item.sections.labelArea)}
      </section>
    );
  }

  const isSealedVinyl = sealed && mediaType === "vinyl";
  const vinylAllowedKeys = new Set(["minorShelfWear","cornerWear","ringWear","creases","tears","writing","stickers"]);
  const filterAllowed = (arr) => (isSealedVinyl ? arr.filter((x) => vinylAllowedKeys.has(x.key)) : arr);

  const PackagingPanel = (
    <section className="panel">
      <div className="panel-title">
        <h3>{pkgLabels.title}</h3>
        <div className="title-actions">
          <label htmlFor="pkg-missing" className="checkbox-row">
            <input id="pkg-missing" type="checkbox" checked={packagingMissing} onChange={(e) => setPackagingMissing(e.target.checked)} />
            <span>Mark packaging as Missing (auto P)</span>
          </label>
        </div>
      </div>

      {/* Overall Appearance */}
      <fieldset className="mg-fieldset">
        <legend>Overall Appearance</legend>
        {filterAllowed(pkgLabels.overall).map((cfg) => {
          const id = `pkg-${cfg.key}`;
          const checked = !!packagingChecks[cfg.key];
          const disabled = sealed && mediaType !== "vinyl" && !["minorShelfWear","cornerWear","creases"].includes(cfg.key);
          return (
            <div key={cfg.key} className={`row ${checked ? "active" : ""}`}>
              <label htmlFor={id} className="checkbox-row">
                <input id={id} type="checkbox" checked={checked} onChange={() => togglePackaging(cfg.key)} disabled={disabled} />
                <span>{cfg.label}</span>
              </label>
              {checked && Array.isArray(cfg.sub) && (
                <div className="subradios">
                  {cfg.sub.map((txt, i) => {
                    const rid = `${id}-sub-${i}`;
                    return (
                      <label key={rid} htmlFor={rid} className="radio-row">
                        <input id={rid} type="radio" name={`${id}-sub`} checked={packagingSubs[cfg.key] === i} onChange={() => setPackagingSub(cfg.key, i)} disabled={disabled} />
                        <span>{txt}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {mediaType !== "vinyl" && (
          <p className="help">
            Standard plastic cases are <strong>not graded</strong>; evaluate the insert/booklet/inlay (digipak if applicable). Use Additional Notes for replaceable case issues.
          </p>
        )}
        {sealed && <p className="help">Sealed adds +5 (cap 100). <strong>M</strong> only if sealed &amp; flawless (no allowed deductions).</p>}
      </fieldset>

      {/* Structure — hidden entirely when sealed+vinyl */}
      {!isSealedVinyl && (
        <fieldset className="mg-fieldset">
          <legend>
            {mediaType === "vinyl" ? "Seams & Structure" : mediaType === "cassette" ? "J-card Structure" : "Insert/Tray Structure"}
          </legend>
          {pkgLabels.seams.map((cfg) => {
            const id = `pkg-${cfg.key}`;
            const checked = !!packagingChecks[cfg.key];
            const disabled = sealed && cfg.key !== "allSeamsIntact" && cfg.key !== "allIntact";
            return (
              <div key={cfg.key} className={`row ${checked ? "active" : ""}`}>
                <label htmlFor={id} className="checkbox-row">
                  <input id={id} type="checkbox" checked={checked} onChange={() => togglePackaging(cfg.key)} disabled={disabled} />
                  <span>{cfg.label}</span>
                </label>
                {checked && Array.isArray(cfg.sub) && (
                  <div className="subradios">
                    {cfg.sub.map((txt, i) => {
                      const rid = `${id}-sub-${i}`;
                      return (
                        <label key={rid} htmlFor={rid} className="radio-row">
                          <input id={rid} type="radio" name={`${id}-sub`} checked={packagingSubs[cfg.key] === i} onChange={() => setPackagingSub(cfg.key, i)} disabled={disabled} />
                          <span>{txt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>
      )}

      {/* Damage & Markings (filtered for sealed+vinyl) */}
      <fieldset className="mg-fieldset">
        <legend>Damage &amp; Markings</legend>
        {filterAllowed(pkgLabels.damage).map((cfg) => {
          const id = `pkg-${cfg.key}`;
          const checked = !!packagingChecks[cfg.key];
          const disabled = sealed && mediaType !== "vinyl" && cfg.key !== "creases";
          return (
            <div key={cfg.key} className={`row ${checked ? "active" : ""}`}>
              <label htmlFor={id} className="checkbox-row">
                <input id={id} type="checkbox" checked={checked} onChange={() => togglePackaging(cfg.key)} disabled={disabled} />
                <span>{cfg.label}</span>
              </label>
              {checked && Array.isArray(cfg.sub) && (
                <div className="subradios">
                  {cfg.sub.map((txt, i) => {
                    const rid = `${id}-sub-${i}`;
                    return (
                      <label key={rid} htmlFor={rid} className="radio-row">
                        <input id={rid} type="radio" name={`${id}-sub`} checked={packagingSubs[cfg.key] === i} onChange={() => setPackagingSub(cfg.key, i)} disabled={disabled} />
                        <span>{txt}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </fieldset>

      {/* Sleeve Appearance nudge — Vinyl only */}
      {mediaType === "vinyl" && pkgLabels.appearance && (
        <fieldset className="mg-fieldset">
          <legend>{pkgLabels.appearance.label}</legend>
          <div className="subradios">
            {pkgLabels.appearance.options.map((opt) => {
              const id = `pkg-appearance-${opt.key}`;
              return (
                <label key={id} htmlFor={id} className="radio-row">
                  <input id={id} type="radio" name="pkg-appearance" checked={packagingAppearance === opt.key} onChange={() => setPackagingAppearance(opt.key)} />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
          <p className="help">This adjusts the <strong>sleeve/cover</strong> score slightly (±2) <em>only</em> when it’s on the cusp of a grade boundary.</p>
        </fieldset>
      )}

      {/* Additional notes — hidden in sealed+vinyl mode per earlier rules */}
      {!isSealedVinyl && (
        <fieldset className="mg-fieldset">
          <legend>Additional notes (don’t affect score)</legend>
          <div className="notes-grid">
            {pkgLabels.notes.map((n) => (
              <label key={n.key} htmlFor={`note-${n.key}`} className="checkbox-row note">
                <input id={`note-${n.key}`} type="checkbox" checked={!!additionalNotes[n.key]} onChange={() => toggleNote(n.key)} />
                <span>{n.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </section>
  );

  return (
    <main id="media-grading">
      <a className="back-link" href="/admin">← Back to Dashboard</a>
      {Header}

      <div className="mg-grid">
        <div className="col">
          <h2 className="col-title">
            {mediaType === "vinyl" ? "🎶 Vinyl Record" : mediaType === "cassette" ? "📼 Cassette" : "💿 Compact Disc"}{" "}
            Condition Assessment
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
            {mediaType === "vinyl" ? "📦 Jacket & Packaging" : mediaType === "cassette" ? "📦 J-Card & Packaging" : "📦 Inlay/Booklet & Packaging"}{" "}
            Condition Assessment
          </h2>
          {PackagingPanel}
        </div>
      </div>

      <section className="panel">
        <h3>📝 Custom Condition Notes</h3>
        <textarea rows={4} value={customNotes} onChange={(e) => setCustomNotes(e.target.value)} aria-label="Custom condition notes" />
      </section>

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