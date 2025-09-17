// src/app/admin/media-grading/page.js
"use client";

import { useMemo, useState } from "react";
import "styles/media-grading.css";

/**
 * Systematic Media Grading Tool
 * Next.js App Router client page (JavaScript only).
 *
 * 8-grade scale only: M, NM, VG+, VG, G+, G, F, P
 * - M is reachable only when: Sleeve is Sealed AND media+packaging have 0 deductions (100/100).
 * - Otherwise NM is the ceiling (subject to caps below).
 *
 * Scoring model:
 * - Start mediaScore/sleeveScore at 100.
 * - Subtract configured penalties per selected defect.
 * - Some defects introduce a GRADE CAP (max allowed grade). Final grade = min(score→grade, all caps).
 * - Per-track penalty: -1 per affected track (only if ANY audio defect on that disc/tape is selected).
 *
 * Multi-item media sets:
 * - Add/remove "Disc/Tape" items; each is scored independently.
 * - Media Score = arithmetic average of per-item scores; Media Grade derived from average score with caps merged.
 * - If an item is "Missing", it auto-scores 0 and grade P (cap P).
 *
 * Packaging:
 * - Single packaging scored once (with "Missing" toggle).
 * - "Sealed" lives in Overall Appearance; +5 bonus (capped at 100). M only if sealed & flawless.
 * - Disclosure toggles don't change score, except some (cut-out, promo) block NM via a cap.
 *
 * Labels dynamically adjust by media type for a few items (vinyl/cassette/CD).
 */

/* --------------------------- Constants --------------------------- */

const MEDIA_TYPES = {
  vinyl: "🎵 Vinyl Records",
  cassette: "📼 Cassette Tapes",
  cd: "💿 Compact Discs",
};

// Grade order from best→worst for comparisons
const GRADES = ["M", "NM", "VG+", "VG", "G+", "G", "F", "P"];
const gradeIndex = (g) => GRADES.indexOf(g);

const GRADE_COLORS = {
  M: "mg-grade-m",
  NM: "mg-grade-nm",
  "VG+": "mg-grade-vg",
  VG: "mg-grade-vg",
  "G+": "mg-grade-g",
  G: "mg-grade-g",
  F: "mg-grade-fp",
  P: "mg-grade-fp",
};

// Map numeric score → grade (no M-; exactly 8 buckets)
function gradeFromScore(score, { allowMint = false } = {}) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (allowMint && s === 100) return "M";
  if (s >= 97) return "NM";
  if (s >= 85) return "VG+";
  if (s >= 75) return "VG";
  if (s >= 65) return "G+";
  if (s >= 50) return "G";
  if (s >= 35) return "F";
  return "P";
}

const clampScore = (n) => Math.max(0, Math.min(100, Math.round(n)));

function resolveLabels(mediaType) {
  return {
    // Media visuals
    glossy: "Record has glossy, like-new appearance",
    scuffs: "Light scuffs visible",
    scratches: "Scratches present",
    grooveWear:
      mediaType === "vinyl"
        ? "Groove wear visible"
        : mediaType === "cd"
        ? "Laser-rot/pinholes visible"
        : "Shell scuffs present",
    warping: mediaType === "cd" ? "Disc wobble present" : "Warping present",
    offCenter: mediaType === "vinyl" ? "Off-center pressing" : null,
    edgeChip: mediaType === "vinyl" ? "Edge chipping present" : null,
    heatWaves: mediaType === "vinyl" ? "Heat/storage waves (mild)" : null,
    hubCrack: mediaType === "cd" ? "Hub crack present" : null,
    // Audio
    noNoise: "Plays with no surface noise",
    surfaceNoise: "Surface noise when played",
    popsClicks:
      mediaType === "cd"
        ? "Occasional read errors corrected"
        : "Pops or clicks when played",
    skipping:
      mediaType === "cd"
        ? "Unreadable sectors / skipping"
        : "Skipping or repeating",
    cassetteSqueal:
      mediaType === "cassette" ? "Squeal / wow–flutter audible" : null,
    // Label/Hub/Shell group
    labelGroupTitle:
      mediaType === "vinyl"
        ? "Label / Center"
        : mediaType === "cd"
        ? "Hub / Face"
        : "Shell / Label",
    labelClean: "Label is clean and bright",
    spindleMarks:
      mediaType === "vinyl" ? "Spindle marks present" : "Spindle marks present",
    labelWriting: "Writing on label",
    labelStickers: "Stickers or tape on label",
    cassettePadMissing:
      mediaType === "cassette" ? "Pressure pad missing" : null,
    cassettePadDegraded:
      mediaType === "cassette" ? "Pressure pad rusted / degraded" : null,
    cassetteShellCrack:
      mediaType === "cassette" ? "Shell cracked / hinge damage" : null,
    cassettePack:
      mediaType === "cassette" ? "Irregular tape pack / edge waves" : null,
    // Sleeve/Packaging
    ringWear:
      mediaType === "cd" ? "Booklet ring wear visible" : "Ring wear visible",
    seamsTitle: mediaType === "cd" ? "Case / Tray" : "Seams & Structure",
    seamsIntact: mediaType === "cd" ? "Case uncracked" : "All seams intact",
    seamSplitOrCrack: mediaType === "cd" ? "Case cracked" : "Seam splits present",
    spineWearOrTray:
      mediaType === "cd" ? "Tray teeth broken/missing" : "Spine shows wear",
    bookletWater: mediaType === "cd" ? "Booklet water damage / stuck pages" : null,
  };
}

/* --------------------------- Penalties & Caps --------------------------- */
// Severity weight tables (points are deliberately conservative)
const P = {
  media: {
    scuffs: { veryLight: 1, visible: 3, obvious: 6 },
    scratches: { hairline: 5, feelable: 8, deep: 12 },
    grooveWear: { light: 8, evident: 12, heavy: 18 },
    warping: { slight: 4, moderate: 10, severe: 18 }, // wobble for CD
    surfaceNoise: { light: 3, moderate: 6, loud: 12 },
    popsClicks: { light: 4, moderate: 8, frequent: 12 }, // CD "corrected" uses light
    skipping: { occasional: 20, repeating: 30, widespread: 40 },
    labelMicro: 3, // spindle/writing/stickers
    offCenter: 4,
    edgeChip: 4,
    heatWaves: 4,
    hubCrack: { hairline: 6, radial: 12 },
    perTrack: 1, // −1 per affected track when any audio defect on that item
    // Cassette specifics
    padMissing: 40, // auto P cap too
    padDegraded: 6,
    shellCrack: { hairline: 6, crack: 12 },
    tapePack: { light: 6, moderate: 12 },
    squeal: { rare: 4, occasional: 8, frequent: 15 },
  },
  sleeve: {
    likeNew: 0,
    minorShelfWear: 3,
    cornerWear: { slight: 2, creased: 4, cut: 8 },
    ringWear: { light: 3, visible: 5, heavy: 8 },
    seamSplit: { small: 6, medium: 12, large: 18 },
    spineWear: { minor: 2, worn: 3, major: 5 },
    tears: 8,
    writing: 4,
    stickers: 3,
    water: 8, // water damage/staining
    bookletWater: 8, // CD booklet pages stuck/warped
    sealedBonus: 5, // max 100
  },
};

/** Grade CAPS by defect (applies as "max grade allowed"). */
const CAPS = {
  // Media (vinyl/cd common-ish)
  vinyl_offCenter: "VG+",
  vinyl_labelWriting: "VG+",
  vinyl_labelStickers: "VG+",
  vinyl_spindleMarks: "VG+",
  vinyl_grooveWear_heavy: "VG",
  vinyl_scratches_feelable: "VG",
  vinyl_scratches_deep: "VG",
  vinyl_surfaceNoise_light: "VG+",
  vinyl_surfaceNoise_moderate: "VG",
  vinyl_surfaceNoise_loud: "G",
  vinyl_popsClicks_light: "VG+",
  vinyl_popsClicks_moderate: "VG",
  vinyl_popsClicks_frequent: "G+",
  // Cassette
  cassette_padMissing: "P",
  cassette_shellCrack_crack: "VG",
  cassette_squeal_occasional: "VG",
  cassette_squeal_frequent: "G",
  // CD
  cd_labelHairlines: "VG+",
  cd_labelPinholes: "VG",
  cd_labelSevere: "G",
  cd_hubHairline: "VG+",
  cd_hubRadial: "VG",
  cd_correctedErrors: "VG+",
  cd_unreadable: "G",
  // Sleeve caps (all formats)
  sleeve_water: "G",
  sleeve_ringWear_heavy: "G",
  // Sleeve notes that block NM (cap ≤ VG+)
  sleeve_cutout: "VG+",
  sleeve_promo: "VG+",
};

/* --------------------------- Helpers --------------------------- */

function applyCaps(baseGrade, capGrades) {
  // baseGrade is from score; capGrades is an array of cap grade strings (max allowed).
  let final = baseGrade;
  capGrades.forEach((cap) => {
    if (!cap) return;
    if (gradeIndex(final) < 0 || gradeIndex(cap) < 0) return;
    // If baseGrade is better than cap → degrade to cap
    if (gradeIndex(final) < gradeIndex(cap)) final = cap;
  });
  return final;
}

function topDeductions(list, n = 3) {
  return [...list].sort((a, b) => b.pts - a.pts).slice(0, n);
}

/* --------------------------- Item (disc/tape) model --------------------------- */

function newMediaItem(mediaType) {
  return {
    missing: false,

    // Positive indicator for NM vinyl
    glossy: mediaType === "vinyl" ? false : undefined,

    // Visuals (with severities and side/track extents except warping)
    scuffs: false,
    scuffsLevel: "",
    scuffsSidesA: false,
    scuffsSidesB: false,
    scuffsTracks: 0,

    scratches: false,
    scratchesLevel: "",
    scratchesSidesA: false,
    scratchesSidesB: false,
    scratchesTracks: 0,

    grooveWear: false,
    grooveWearLevel: "",
    grooveSidesA: false,
    grooveSidesB: false,
    grooveTracks: 0,

    warping: false,
    warpingLevel: "", // no sides/tracks

    offCenter: mediaType === "vinyl" ? false : undefined,
    edgeChip: mediaType === "vinyl" ? false : undefined,
    heatWaves: mediaType === "vinyl" ? false : undefined,

    hubCrack: mediaType === "cd" ? false : undefined,
    hubCrackLevel: "",

    // Audio
    noNoise: false,
    surfaceNoise: false,
    surfaceNoiseLevel: "",
    noiseSidesA: false,
    noiseSidesB: false,

    popsClicks: false,
    popsClicksLevel: "",
    popsSidesA: false,
    popsSidesB: false,

    skipping: false,
    skippingLevel: "",
    skipSidesA: false,
    skipSidesB: false,

    // provide a shared "tracks" for per-track deduction across audio defects
    audioTracks: 0,

    // Cassette-specific
    cassetteSqueal: mediaType === "cassette" ? false : undefined,
    cassetteSquealLevel: "",
    padMissing: mediaType === "cassette" ? false : undefined,
    padDegraded: mediaType === "cassette" ? false : undefined,
    shellCrack: mediaType === "cassette" ? false : undefined,
    shellCrackLevel: "",
    tapePack: mediaType === "cassette" ? false : undefined,
    tapePackLevel: "",

    // Label/Hub/Shell
    labelClean: false,
    spindleMarks: false,
    labelWriting: false,
    labelStickers: false,
  };
}

/* --------------------------- Score ONE item --------------------------- */
function scoreOneItem(item, mediaType, labels) {
  if (item.missing) {
    return {
      score: 0,
      baseGrade: "P",
      capGrades: ["P"],
      deductions: [{ label: "Media missing", pts: 100 }],
      flags: [],
    };
  }

  let score = 100;
  const deds = [];
  const caps = [];
  const flags = [];

  // Positive indicator (vinyl NM sheen)
  if (mediaType === "vinyl" && item.glossy) {
    flags.push("Glossy / like-new sheen observed");
  }

  // ----- Visuals -----
  if (item.scuffs) {
    const lv = item.scuffsLevel || "visible";
    const pts = P.media.scuffs[lv] || 3;
    score -= pts;
    const sides = (item.scuffsSidesA ? "A" : "") + (item.scuffsSidesB ? (item.scuffsSidesA ? "/B" : "B") : "");
    deds.push({
      label: `${labels.scuffs}${sides ? ` (sides ${sides})` : ""}${item.scuffsTracks ? `; tracks ${item.scuffsTracks}` : ""}`,
      pts,
    });
  }
  if (item.scratches) {
    const lv = item.scratchesLevel || "feelable";
    const pts = P.media.scratches[lv] || 8;
    score -= pts;
    if (mediaType === "vinyl" && (lv === "feelable" || lv === "deep")) caps.push(CAPS.vinyl_scratches_feelable);
    if (mediaType === "vinyl" && lv === "deep") caps.push(CAPS.vinyl_scratches_deep);
    const sides = (item.scratchesSidesA ? "A" : "") + (item.scratchesSidesB ? (item.scratchesSidesA ? "/B" : "B") : "");
    deds.push({
      label: `${labels.scratches}${sides ? ` (sides ${sides})` : ""}${item.scratchesTracks ? `; tracks ${item.scratchesTracks}` : ""}`,
      pts,
    });
  }
  if (item.grooveWear) {
    const lv = item.grooveWearLevel || "evident";
    const pts = P.media.grooveWear[lv] || 12;
    score -= pts;
    if (mediaType === "vinyl" && lv === "heavy") caps.push(CAPS.vinyl_grooveWear_heavy);
    const sides = (item.grooveSidesA ? "A" : "") + (item.grooveSidesB ? (item.grooveSidesA ? "/B" : "B") : "");
    deds.push({
      label: `${labels.grooveWear}${sides ? ` (sides ${sides})` : ""}${item.grooveTracks ? `; tracks ${item.grooveTracks}` : ""}`,
      pts,
    });
  }
  if (item.warping) {
    const lv = item.warpingLevel || "moderate";
    const pts = P.media.warping[lv] || 10;
    score -= pts;
    deds.push({ label: `${labels.warping} (${lv})`, pts });
  }
  if (mediaType === "vinyl" && item.offCenter) {
    score -= P.media.offCenter;
    caps.push(CAPS.vinyl_offCenter);
    deds.push({ label: labels.offCenter, pts: P.media.offCenter });
  }
  if (mediaType === "vinyl" && item.edgeChip) {
    score -= P.media.edgeChip;
    caps.push("VG+");
    deds.push({ label: labels.edgeChip, pts: P.media.edgeChip });
  }
  if (mediaType === "vinyl" && item.heatWaves) {
    score -= P.media.heatWaves;
    caps.push("VG+");
    deds.push({ label: labels.heatWaves, pts: P.media.heatWaves });
  }
  if (mediaType === "cd" && item.hubCrack) {
    const lv = item.hubCrackLevel || "hairline";
    const pts = P.media.hubCrack[lv] || 6;
    score -= pts;
    caps.push(lv === "radial" ? CAPS.cd_hubRadial : CAPS.cd_hubHairline);
    deds.push({ label: `${labels.hubCrack} (${lv})`, pts });
  }

  // ----- Audio -----
  const anyAudio = item.surfaceNoise || item.popsClicks || item.skipping || item.cassetteSqueal;

  if (item.surfaceNoise) {
    const lv = item.surfaceNoiseLevel || "moderate";
    const pts = P.media.surfaceNoise[lv] || 6;
    score -= pts;
    if (mediaType === "vinyl") {
      caps.push(
        lv === "light" ? CAPS.vinyl_surfaceNoise_light :
        lv === "loud" ? CAPS.vinyl_surfaceNoise_loud :
        CAPS.vinyl_surfaceNoise_moderate
      );
    }
    const sides = (item.noiseSidesA ? "A" : "") + (item.noiseSidesB ? (item.noiseSidesA ? "/B" : "B") : "");
    deds.push({ label: `Surface noise (${lv})${sides ? `, sides ${sides}` : ""}`, pts });
  }
  if (item.popsClicks) {
    const lv = item.popsClicksLevel || "light";
    const pts = P.media.popsClicks[lv] || 4;
    score -= pts;
    if (mediaType === "vinyl") {
      caps.push(
        lv === "light" ? CAPS.vinyl_popsClicks_light :
        lv === "frequent" ? CAPS.vinyl_popsClicks_frequent :
        CAPS.vinyl_popsClicks_moderate
      );
    }
    const sides = (item.popsSidesA ? "A" : "") + (item.popsSidesB ? (item.popsSidesA ? "/B" : "B") : "");
    deds.push({ label: `${labels.popsClicks} (${lv})${sides ? `, sides ${sides}` : ""}`, pts });
  }
  if (item.skipping) {
    const lv = item.skippingLevel || "repeating";
    const pts = P.media.skipping[lv] || 30;
    score -= pts;
    if (mediaType === "cd") caps.push(CAPS.cd_unreadable);
    const sides = (item.skipSidesA ? "A" : "") + (item.skipSidesB ? (item.skipSidesA ? "/B" : "B") : "");
    deds.push({ label: `${labels.skipping} (${lv})${sides ? `, sides ${sides}` : ""}`, pts });
  }

  // Cassette-specific audio/mech
  if (mediaType === "cassette" && item.cassetteSqueal) {
    const lv = item.cassetteSquealLevel || "occasional";
    const pts = P.media.squeal[lv] || 8;
    score -= pts;
    caps.push(
      lv === "frequent" ? CAPS.cassette_squeal_frequent :
      lv === "occasional" ? CAPS.cassette_squeal_occasional :
      CAPS.cassette_squeal_occasional
    );
    deds.push({ label: "Squeal / wow–flutter (" + lv + ")", pts });
  }
  if (mediaType === "cassette" && item.padMissing) {
    const pts = P.media.padMissing;
    score -= pts;
    caps.push(CAPS.cassette_padMissing);
    deds.push({ label: "Pressure pad missing", pts });
  }
  if (mediaType === "cassette" && item.padDegraded) {
    const pts = P.media.padDegraded;
    score -= pts;
    // cap ≤ VG (degraded pad), missing handled above
    caps.push("VG");
    deds.push({ label: "Pressure pad rusted / degraded", pts });
  }
  if (mediaType === "cassette" && item.shellCrack) {
    const lv = item.shellCrackLevel || "crack";
    const pts = P.media.shellCrack[lv] || 12;
    score -= pts;
    caps.push(lv === "crack" ? CAPS.cassette_shellCrack_crack : "VG+");
    deds.push({ label: `Shell cracked / hinge damage (${lv})`, pts });
  }
  if (mediaType === "cassette" && item.tapePack) {
    const lv = item.tapePackLevel || "moderate";
    const pts = P.media.tapePack[lv] || 12;
    score -= pts;
    if (lv === "moderate") caps.push("VG");
    deds.push({ label: `Irregular tape pack / edge waves (${lv})`, pts });
  }

  // Label/Hub/Shell micro defects (all media)
  if (item.spindleMarks) {
    score -= P.media.labelMicro;
    if (mediaType === "vinyl") caps.push(CAPS.vinyl_spindleMarks);
    deds.push({ label: "Spindle marks present", pts: P.media.labelMicro });
  }
  if (item.labelWriting) {
    score -= P.media.labelMicro;
    if (mediaType === "vinyl") caps.push(CAPS.vinyl_labelWriting);
    deds.push({ label: "Writing on label", pts: P.media.labelMicro });
  }
  if (item.labelStickers) {
    score -= P.media.labelMicro;
    if (mediaType === "vinyl") caps.push(CAPS.vinyl_labelStickers);
    deds.push({ label: "Stickers or tape on label", pts: P.media.labelMicro });
  }

  // CD: label-side integrity handled via wrapper below

  // Per-track penalty (only if ANY audio defect is present)
  if (anyAudio && (item.audioTracks || 0) > 0) {
    const pts = (item.audioTracks || 0) * P.media.perTrack;
    score -= pts;
    deds.push({ label: `Tracks affected (${item.audioTracks})`, pts });
  }

  const finalScore = clampScore(score);
  const baseGrade = gradeFromScore(finalScore, { allowMint: false });
  return { score: finalScore, baseGrade, capGrades: caps, deductions: deds, flags };
}

/* --------------------------- Packaging model --------------------------- */

function newSleeve(mediaType) {
  return {
    missing: false,
    likeNew: false,
    minorShelfWear: false,
    cornerWear: false,
    cornerWearLevel: "",
    ringWear: false,
    ringWearLevel: "",
    seamsIntact: false,
    seamSplit: false,
    seamSplitLevel: "",
    spineWear: false,
    spineWearLevel: "",
    sealed: false, // M-eligibility helper
    tears: false,
    writing: false,
    stickersTape: false,
    water: false,
    bookletWater: mediaType === "cd" ? false : undefined,
  };
}

function scoreSleeve(sleeve, mediaType, notesCaps) {
  if (sleeve.missing) {
    return {
      score: 0,
      baseGrade: "P",
      capGrades: ["P"],
      deductions: [{ label: "Packaging missing", pts: 100 }],
      allowMint: false,
    };
  }

  let score = 100;
  const deds = [];
  const caps = [];

  if (sleeve.likeNew) {
    // positive indicator only
  }
  if (sleeve.sealed) {
    score = Math.min(100, score + P.sleeve.sealedBonus);
  }
  if (sleeve.minorShelfWear) {
    score -= P.sleeve.minorShelfWear;
    deds.push({ label: "Minor shelf wear only", pts: P.sleeve.minorShelfWear });
  }
  if (sleeve.cornerWear) {
    const lv = sleeve.cornerWearLevel || "creased";
    const pts = P.sleeve.cornerWear[lv] || 4;
    score -= pts;
    deds.push({ label: `Corner wear (${lv})`, pts });
  }
  if (sleeve.ringWear) {
    const lv = sleeve.ringWearLevel || "visible";
    const pts = P.sleeve.ringWear[lv] || 5;
    score -= pts;
    if (lv === "heavy") caps.push(CAPS.sleeve_ringWear_heavy);
    deds.push({ label: `${mediaType === "cd" ? "Booklet" : "Sleeve"} ring wear (${lv})`, pts });
  }
  if (sleeve.seamSplit) {
    const lv = sleeve.seamSplitLevel || "medium";
    const pts = P.sleeve.seamSplit[lv] || 12;
    score -= pts;
    deds.push({ label: `${mediaType === "cd" ? "Case cracked" : "Seam splits"} (${lv})`, pts });
  }
  if (sleeve.spineWear) {
    const lv = sleeve.spineWearLevel || "worn";
    const pts = P.sleeve.spineWear[lv] || 3;
    score -= pts;
    deds.push({ label: `${mediaType === "cd" ? "Tray teeth broken/missing" : "Spine shows wear"} (${lv})`, pts });
  }
  if (sleeve.tears) {
    score -= P.sleeve.tears;
    deds.push({ label: "Tears present", pts: P.sleeve.tears });
  }
  if (sleeve.writing) {
    score -= P.sleeve.writing;
    deds.push({ label: "Writing present", pts: P.sleeve.writing });
  }
  if (sleeve.stickersTape) {
    score -= P.sleeve.stickers;
    deds.push({ label: "Stickers or tape", pts: P.sleeve.stickers });
  }
  if (sleeve.water) {
    score -= P.sleeve.water;
    caps.push(CAPS.sleeve_water);
    deds.push({ label: "Water damage / staining", pts: P.sleeve.water });
  }
  if (mediaType === "cd" && sleeve.bookletWater) {
    score -= P.sleeve.bookletWater;
    caps.push(CAPS.sleeve_water);
    deds.push({ label: "Booklet water damage / stuck pages", pts: P.sleeve.bookletWater });
  }

  // Disclosure-driven caps (block NM on sleeve)
  if (notesCaps.blockNM) {
    caps.push(CAPS.sleeve_cutout); // ≤ VG+
  }

  const s = clampScore(score);
  const baseGrade = gradeFromScore(s, { allowMint: false });
  const allowMint = sleeve.sealed && s === 100;
  return { score: s, baseGrade, capGrades: caps, deductions: deds, allowMint };
}

/* --------------------------- Page --------------------------- */

export default function MediaGradingPage() {
  const [mediaType, setMediaType] = useState("vinyl");
  const L = useMemo(() => resolveLabels(mediaType), [mediaType]);

  // Media items
  const [items, setItems] = useState([newMediaItem(mediaType)]);
  // Reset item shape when switching media type
  const onSwitchMedia = (type) => {
    setMediaType(type);
    setItems([newMediaItem(type)]);
    setSleeve(newSleeve(type));
    setNotes("");
    setExtra(defaultExtraNotes);
  };

  const updateItem = (idx, patch) =>
    setItems((arr) => {
      const next = arr.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  const addItem = () => setItems((arr) => [...arr, newMediaItem(mediaType)]);
  const removeItem = (idx) =>
    setItems((arr) => (arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr));

  // Packaging
  const [sleeve, setSleeve] = useState(newSleeve(mediaType));

  // Disclosure-only notes (some block NM)
  const defaultExtraNotes = {
    jewelDamaged: false,
    jewelMissing: false,
    genericSleeve: false,
    promoCopy: false, // blocks NM
    cutout: false, // blocks NM
    hypeSticker: false,
    obiPresent: false,
    posterInsert: false,
    origShrink: false,
    priceSticker: false,
    firstPress: false,
    coloredVinyl: false,
    limitedEdition: false,
    gatefoldSleeve: false,
    originalInner: false,
  };
  const [extra, setExtra] = useState(defaultExtraNotes);
  const notesCaps = useMemo(
    () => ({ blockNM: !!(extra.cutout || extra.promoCopy) }),
    [extra.cutout, extra.promoCopy]
  );

  const [notes, setNotes] = useState("");

  // Per-item scoring
  const perItem = useMemo(
    () => items.map((it) => scoreOneItem(it, mediaType, L)),
    [items, mediaType, L]
  );

  // Aggregate media score (average) and combine caps
  const mediaScore = useMemo(() => {
    if (!perItem.length) return 100;
    const sum = perItem.reduce((acc, r) => acc + r.score, 0);
    return clampScore(sum / perItem.length);
  }, [perItem]);

  const mediaBaseGrade = useMemo(
    () => gradeFromScore(mediaScore, { allowMint: false }),
    [mediaScore]
  );

  const mediaCaps = useMemo(() => perItem.flatMap((r) => r.capGrades || []), [perItem]);

  const mediaGrade = useMemo(
    () => applyCaps(mediaBaseGrade, mediaCaps),
    [mediaBaseGrade, mediaCaps]
  );

  // Sleeve scoring
  const sleeveCalc = useMemo(
    () => scoreSleeve(sleeve, mediaType, notesCaps),
    [sleeve, mediaType, notesCaps]
  );
  const sleeveGrade = applyCaps(
    gradeFromScore(sleeveCalc.score, { allowMint: sleeveCalc.allowMint }),
    sleeveCalc.capGrades
  );

  // Overall (min of media vs packaging; if both sealed & flawless → M)
  const overall = useMemo(() => {
    const mintEligible =
      sleeve.sealed && sleeveCalc.score === 100 && mediaScore === 100;
    if (mintEligible) return { grade: "M", score: 100 };

    // min by order
    const mi = gradeIndex(mediaGrade);
    const si = gradeIndex(sleeveGrade);
    if (mi > si) return { grade: mediaGrade, score: mediaScore };
    if (si > mi) return { grade: sleeveGrade, score: sleeveCalc.score };
    // same bucket → pick lower score
    return mediaScore <= sleeveCalc.score
      ? { grade: mediaGrade, score: mediaScore }
      : { grade: sleeveGrade, score: sleeveCalc.score };
  }, [mediaGrade, mediaScore, sleeveGrade, sleeveCalc, sleeve.sealed]);

  const overallColor = GRADE_COLORS[overall.grade] || "mg-grade-vg";

  // Explanation text
  const explanation = useMemo(() => {
    const perDisc = perItem
      .map((r, i) => {
        const capped = applyCaps(r.baseGrade, r.capGrades || []);
        const top = topDeductions(r.deductions, 3);
        const topTxt = top.length
          ? top.map((d) => `${d.label} (−${d.pts})`).join("; ")
          : "No notable deductions";
        const flagsTxt = r.flags?.length ? `; ${r.flags.join("; ")}` : "";
        return `Disc/Tape ${i + 1}: ${capped} (${r.score}) — ${topTxt}${flagsTxt}`;
      })
      .join(" | ");

    const topSleeve = topDeductions(sleeveCalc.deductions, 3);
    const sleeveTxt = topSleeve.length
      ? topSleeve.map((d) => `${d.label} (−${d.pts})`).join("; ")
      : "No notable deductions";

    const extras = Object.entries(extra)
      .filter(([, v]) => v)
      .map(([k]) => DISCLOSURE_LABELS[k])
      .filter(Boolean);

    const lineParts = [
      `Media per-item: ${perDisc}.`,
      `Packaging: ${sleeveTxt}.`,
      extras.length ? `Additional notes: ${extras.join(", ")}.` : "",
      notes.trim() ? `Notes: ${notes.trim()}` : "",
    ].filter(Boolean);

    return lineParts.join(" ");
  }, [perItem, sleeveCalc, extra, notes]);

  /* --------------------------- UI --------------------------- */

  return (
    <main id="media-grading" className="mg-wrap">
      <header className="mg-header">
        <div className="mg-title">🔍 Systematic Media Grading Tool</div>
        <div className="mg-sub">
          Detailed condition assessment with automatic grading calculation
        </div>
      </header>

      {/* Media type pills */}
      <section className="mg-pills" role="tablist" aria-label="Media type selector">
        {Object.entries(MEDIA_TYPES).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={mediaType === key}
            className={`mg-pill ${mediaType === key ? "selected" : ""}`}
            onClick={() => onSwitchMedia(key)}
            type="button"
          >
            {label}
          </button>
        ))}
      </section>

      {/* Two columns */}
      <section className="mg-grid">
        {/* Left: Media */}
        <div className="mg-card">
          <h2>🎶 Record/Media Condition Assessment</h2>

          {items.map((item, idx) => {
            const res = scoreOneItem(item, mediaType, L);
            const capped = applyCaps(res.baseGrade, res.capGrades || []);
            return (
              <fieldset key={idx} className="mg-fieldset mg-item">
                <legend>Disc/Tape #{idx + 1}</legend>

                <div className="mg-item-header">
                  <label className="mg-check">
                    <input
                      id={`missing-${idx}`}
                      type="checkbox"
                      checked={item.missing}
                      onChange={(e) =>
                        updateItem(idx, { missing: e.target.checked })
                      }
                    />
                    <span><strong>Mark this media as Missing (auto P)</strong></span>
                  </label>
                  <div className="mg-item-actions">
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="mg-btn ghost"
                        onClick={() => removeItem(idx)}
                        aria-label={`Remove disc/tape ${idx + 1}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className={`mg-fieldset-inner ${item.missing ? "mg-disabled" : ""}`}>
                  {/* Visual Appearance */}
                  <fieldset className="mg-fieldset">
                    <legend>Visual Appearance</legend>

                    {mediaType === "vinyl" && (
                      <label className="mg-check">
                        <input
                          type="checkbox"
                          checked={item.glossy || false}
                          onChange={(e) => updateItem(idx, { glossy: e.target.checked })}
                        />
                        <span>{L.glossy}</span>
                      </label>
                    )}

                    {/* Scuffs */}
                    <label className="mg-check">
                      <input
                        type="checkbox"
                        checked={item.scuffs}
                        onChange={(e) => updateItem(idx, { scuffs: e.target.checked })}
                      />
                      <span>{L.scuffs}</span>
                    </label>
                    {item.scuffs && (
                      <>
                        <SeverityRadios
                          name={`scuffs-${idx}`}
                          options={[
                            ["veryLight", "Very light, barely visible"],
                            ["visible", "Visible but not deep"],
                            ["obvious", "Obvious, multiple scuffs"],
                          ]}
                          value={item.scuffsLevel}
                          onChange={(val) => updateItem(idx, { scuffsLevel: val })}
                        />
                        <SidesTracks
                          baseId={`scuffs-${idx}`}
                          a={item.scuffsSidesA}
                          b={item.scuffsSidesB}
                          tracks={item.scuffsTracks}
                          onA={(v) => updateItem(idx, { scuffsSidesA: v })}
                          onB={(v) => updateItem(idx, { scuffsSidesB: v })}
                          onTracks={(n) => updateItem(idx, { scuffsTracks: n })}
                        />
                      </>
                    )}

                    {/* Scratches */}
                    <label className="mg-check">
                      <input
                        type="checkbox"
                        checked={item.scratches}
                        onChange={(e) => updateItem(idx, { scratches: e.target.checked })}
                      />
                      <span>{L.scratches}</span>
                    </label>
                    {item.scratches && (
                      <>
                        <SeverityRadios
                          name={`scratches-${idx}`}
                          options={[
                            ["hairline", "Hairline only"],
                            ["feelable", "Can feel with fingernail"],
                            ["deep", "Deep, visible grooves"],
                          ]}
                          value={item.scratchesLevel}
                          onChange={(val) => updateItem(idx, { scratchesLevel: val })}
                        />
                        <SidesTracks
                          baseId={`scr-${idx}`}
                          a={item.scratchesSidesA}
                          b={item.scratchesSidesB}
                          tracks={item.scratchesTracks}
                          onA={(v) => updateItem(idx, { scratchesSidesA: v })}
                          onB={(v) => updateItem(idx, { scratchesSidesB: v })}
                          onTracks={(n) => updateItem(idx, { scratchesTracks: n })}
                        />
                      </>
                    )}

                    {/* Groove wear / laser rot / shell scuffs */}
                    <label className="mg-check">
                      <input
                        type="checkbox"
                        checked={item.grooveWear}
                        onChange={(e) => updateItem(idx, { grooveWear: e.target.checked })}
                      />
                      <span>{L.grooveWear}</span>
                    </label>
                    {item.grooveWear && (
                      <>
                        <SeverityRadios
                          name={`groove-${idx}`}
                          options={[
                            ["light", "Light"],
                            ["evident", "Evident"],
                            ["heavy", "Heavy"],
                          ]}
                          value={item.grooveWearLevel}
                          onChange={(val) => updateItem(idx, { grooveWearLevel: val })}
                        />
                        <SidesTracks
                          baseId={`grv-${idx}`}
                          a={item.grooveSidesA}
                          b={item.grooveSidesB}
                          tracks={item.grooveTracks}
                          onA={(v) => updateItem(idx, { grooveSidesA: v })}
                          onB={(v) => updateItem(idx, { grooveSidesB: v })}
                          onTracks={(n) => updateItem(idx, { grooveTracks: n })}
                        />
                      </>
                    )}

                    {/* Warping / wobble (no sides/tracks) */}
                    <label className="mg-check">
                      <input
                        type="checkbox"
                        checked={item.warping}
                        onChange={(e) => updateItem(idx, { warping: e.target.checked })}
                      />
                      <span>{L.warping}</span>
                    </label>
                    {item.warping && (
                      <SeverityRadios
                        name={`warp-${idx}`}
                        options={[
                          ["slight", "Slight (doesn’t affect play)"],
                          ["moderate", "Moderate"],
                          ["severe", "Severe (affects play)"],
                        ]}
                        value={item.warpingLevel}
                        onChange={(val) => updateItem(idx, { warpingLevel: val })}
                      />
                    )}

                    {/* Vinyl extras */}
                    {mediaType === "vinyl" && (
                      <>
                        <label className="mg-check">
                          <input
                            type="checkbox"
                            checked={item.offCenter || false}
                            onChange={(e) => updateItem(idx, { offCenter: e.target.checked })}
                          />
                          <span>{L.offCenter}</span>
                        </label>
                        <label className="mg-check">
                          <input
                            type="checkbox"
                            checked={item.edgeChip || false}
                            onChange={(e) => updateItem(idx, { edgeChip: e.target.checked })}
                          />
                          <span>{L.edgeChip}</span>
                        </label>
                        <label className="mg-check">
                          <input
                            type="checkbox"
                            checked={item.heatWaves || false}
                            onChange={(e) => updateItem(idx, { heatWaves: e.target.checked })}
                          />
                          <span>{L.heatWaves}</span>
                        </label>
                      </>
                    )}

                    {/* CD hub crack */}
                    {mediaType === "cd" && (
                      <>
                        <label className="mg-check">
                          <input
                            type="checkbox"
                            checked={item.hubCrack || false}
                            onChange={(e) => updateItem(idx, { hubCrack: e.target.checked })}
                          />
                          <span>{L.hubCrack}</span>
                        </label>
                        {item.hubCrack && (
                          <SeverityRadios
                            name={`hub-${idx}`}
                            options={[
                              ["hairline", "Hairline"],
                              ["radial", "Radial crack"],
                            ]}
                            value={item.hubCrackLevel}
                            onChange={(val) => updateItem(idx, { hubCrackLevel: val })}
                          />
                        )}
                      </>
                    )}
                  </fieldset>

                  {/* Audio Performance */}
                  <fieldset className="mg-fieldset">
                    <legend>Audio Performance</legend>

                    <label className="mg-check">
                      <input
                        type="checkbox"
                        checked={item.noNoise}
                        onChange={(e) => updateItem(idx, { noNoise: e.target.checked })}
                      />
                      <span>{L.noNoise}</span>
                    </label>

                    <label className="mg-check">
                      <input
                        type="checkbox"
                        checked={item.surfaceNoise}
                        onChange={(e) => updateItem(idx, { surfaceNoise: e.target.checked })}
                      />
                      <span>{L.surfaceNoise}</span>
                    </label>
                    {item.surfaceNoise && (
                      <>
                        <SeverityRadios
                          name={`noise-${idx}`}
                          options={[
                            ["light", "Light"],
                            ["moderate", "Moderate"],
                            ["loud", "Loud"],
                          ]}
                          value={item.surfaceNoiseLevel}
                          onChange={(val) => updateItem(idx, { surfaceNoiseLevel: val })}
                        />
                        <Sides
                          baseId={`noise-${idx}`}
                          a={item.noiseSidesA}
                          b={item.noiseSidesB}
                          onA={(v) => updateItem(idx, { noiseSidesA: v })}
                          onB={(v) => updateItem(idx, { noiseSidesB: v })}
                        />
                      </>
                    )}

                    <label className="mg-check">
                      <input
                        type="checkbox"
                        checked={item.popsClicks}
                        onChange={(e) => updateItem(idx, { popsClicks: e.target.checked })}
                      />
                      <span>{L.popsClicks}</span>
                    </label>
                    {item.popsClicks && (
                      <>
                        <SeverityRadios
                          name={`pops-${idx}`}
                          options={[
                            ["light", "Light"],
                            ["moderate", "Moderate"],
                            ["frequent", "Frequent"],
                          ]}
                          value={item.popsClicksLevel}
                          onChange={(val) => updateItem(idx, { popsClicksLevel: val })}
                        />
                        <Sides
                          baseId={`pops-${idx}`}
                          a={item.popsSidesA}
                          b={item.popsSidesB}
                          onA={(v) => updateItem(idx, { popsSidesA: v })}
                          onB={(v) => updateItem(idx, { popsSidesB: v })}
                        />
                      </>
                    )}

                    <label className="mg-check">
                      <input
                        type="checkbox"
                        checked={item.skipping}
                        onChange={(e) => updateItem(idx, { skipping: e.target.checked })}
                      />
                      <span>{L.skipping}</span>
                    </label>
                    {item.skipping && (
                      <>
                        <SeverityRadios
                          name={`skip-${idx}`}
                          options={[
                            ["occasional", "Occasional sections"],
                            ["repeating", "Repeating"],
                            ["widespread", "Widespread"],
                          ]}
                          value={item.skippingLevel}
                          onChange={(val) => updateItem(idx, { skippingLevel: val })}
                        />
                        <Sides
                          baseId={`skip-${idx}`}
                          a={item.skipSidesA}
                          b={item.skipSidesB}
                          onA={(v) => updateItem(idx, { skipSidesA: v })}
                          onB={(v) => updateItem(idx, { skipSidesB: v })}
                        />
                      </>
                    )}

                    {mediaType === "cassette" && (
                      <>
                        <label className="mg-check">
                          <input
                            type="checkbox"
                            checked={item.cassetteSqueal || false}
                            onChange={(e) => updateItem(idx, { cassetteSqueal: e.target.checked })}
                          />
                          <span>{L.cassetteSqueal}</span>
                        </label>
                        {item.cassetteSqueal && (
                          <SeverityRadios
                            name={`squeal-${idx}`}
                            options={[
                              ["rare", "Rare"],
                              ["occasional", "Occasional"],
                              ["frequent", "Frequent"],
                            ]}
                            value={item.cassetteSquealLevel}
                            onChange={(val) => updateItem(idx, { cassetteSquealLevel: val })}
                          />
                        )}
                      </>
                    )}

                    {/* Tracks affected (single field that applies to audio section) */}
                    <div className="mg-number">
                      <label htmlFor={`tracks-${idx}`}>Tracks affected</label>
                      <input
                        id={`tracks-${idx}`}
                        type="number"
                        min={0}
                        step={1}
                        value={item.audioTracks}
                        onChange={(e) =>
                          updateItem(idx, {
                            audioTracks: Math.max(0, parseInt(e.target.value || "0", 10)),
                          })
                        }
                      />
                      <div className="mg-help">
                        −1 per track applies only if any audio defect is selected.
                      </div>
                    </div>
                  </fieldset>

                  {/* Cassette mechanics / CD label-side block */}
                  {mediaType === "cassette" && (
                    <fieldset className="mg-fieldset">
                      <legend>Mechanics</legend>

                      <label className="mg-check">
                        <input
                          type="checkbox"
                          checked={item.padMissing || false}
                          onChange={(e) => updateItem(idx, { padMissing: e.target.checked })}
                        />
                        <span>Pressure pad missing</span>
                      </label>

                      <label className="mg-check">
                        <input
                          type="checkbox"
                          checked={item.padDegraded || false}
                          onChange={(e) => updateItem(idx, { padDegraded: e.target.checked })}
                        />
                        <span>Pressure pad rusted / degraded</span>
                      </label>

                      <label className="mg-check">
                        <input
                          type="checkbox"
                          checked={item.shellCrack || false}
                          onChange={(e) => updateItem(idx, { shellCrack: e.target.checked })}
                        />
                        <span>Shell cracked / hinge damage</span>
                      </label>
                      {item.shellCrack && (
                        <SeverityRadios
                          name={`shell-${idx}`}
                          options={[
                            ["hairline", "Hairline"],
                            ["crack", "Crack"],
                          ]}
                          value={item.shellCrackLevel}
                          onChange={(val) => updateItem(idx, { shellCrackLevel: val })}
                        />
                      )}

                      <label className="mg-check">
                        <input
                          type="checkbox"
                          checked={item.tapePack || false}
                          onChange={(e) => updateItem(idx, { tapePack: e.target.checked })}
                        />
                        <span>Irregular tape pack / edge waves</span>
                      </label>
                      {item.tapePack && (
                        <SeverityRadios
                          name={`pack-${idx}`}
                          options={[
                            ["light", "Light"],
                            ["moderate", "Moderate"],
                          ]}
                          value={item.tapePackLevel}
                          onChange={(val) => updateItem(idx, { tapePackLevel: val })}
                        />
                      )}
                    </fieldset>
                  )}

                  {mediaType === "cd" && (
                    <fieldset className="mg-fieldset">
                      <legend>Label-side Integrity</legend>
                      <LabelSideCD idx={idx} updateItem={updateItem} />
                    </fieldset>
                  )}

                  {/* Label / Center / Hub / Shell */}
                  <fieldset className="mg-fieldset">
                    <legend>{resolveLabels(mediaType).labelGroupTitle}</legend>
                    <label className="mg-check">
                      <input
                        type="checkbox"
                        checked={item.labelClean}
                        onChange={(e) => updateItem(idx, { labelClean: e.target.checked })}
                      />
                      <span>{resolveLabels(mediaType).labelClean}</span>
                    </label>
                    <label className="mg-check">
                      <input
                        type="checkbox"
                        checked={item.spindleMarks}
                        onChange={(e) => updateItem(idx, { spindleMarks: e.target.checked })}
                      />
                      <span>{resolveLabels(mediaType).spindleMarks}</span>
                    </label>
                    <label className="mg-check">
                      <input
                        type="checkbox"
                        checked={item.labelWriting}
                        onChange={(e) => updateItem(idx, { labelWriting: e.target.checked })}
                      />
                      <span>{resolveLabels(mediaType).labelWriting}</span>
                    </label>
                    <label className="mg-check">
                      <input
                        type="checkbox"
                        checked={item.labelStickers}
                        onChange={(e) => updateItem(idx, { labelStickers: e.target.checked })}
                      />
                      <span>{resolveLabels(mediaType).labelStickers}</span>
                    </label>
                  </fieldset>
                </div>

                <div className="mg-per-item-result">
                  <span className={`mg-chip ${GRADE_COLORS[capped]}`}>
                    Disc/Tape #{idx + 1}: <strong>{capped}</strong> ({res.score})
                  </span>
                </div>
              </fieldset>
            );
          })}

          <div className="mg-item-controls">
            <button type="button" className="mg-btn" onClick={addItem}>
              + Add another disc/tape
            </button>
          </div>
        </div>

        {/* Right: Sleeve/Packaging */}
        <div className="mg-card">
          <h2>📦 Sleeve/Packaging Condition Assessment</h2>

          <label className="mg-check">
            <input
              id="pkg-missing"
              type="checkbox"
              checked={sleeve.missing}
              onChange={(e) => setSleeve((s) => ({ ...s, missing: e.target.checked }))}
            />
            <span><strong>Mark packaging as Missing (auto P)</strong></span>
          </label>

          <fieldset className={`mg-fieldset ${sleeve.missing ? "mg-disabled" : ""}`}>
            <legend>Overall Appearance</legend>

            <label className="mg-check">
              <input
                type="checkbox"
                checked={sleeve.likeNew}
                onChange={(e) => setSleeve((s) => ({ ...s, likeNew: e.target.checked }))}
              />
              <span>Looks like new, no flaws</span>
            </label>

            <label className="mg-check">
              <input
                type="checkbox"
                checked={sleeve.minorShelfWear}
                onChange={(e) => setSleeve((s) => ({ ...s, minorShelfWear: e.target.checked }))}
              />
              <span>Minor shelf wear only</span>
            </label>

            <label className="mg-check">
              <input
                type="checkbox"
                checked={sleeve.cornerWear}
                onChange={(e) => setSleeve((s) => ({ ...s, cornerWear: e.target.checked }))}
              />
              <span>Corner wear present</span>
            </label>
            {sleeve.cornerWear && (
              <SeverityRadios
                name="corner-level"
                options={[
                  ["slight", "Slight bumping"],
                  ["creased", "Creased or frayed"],
                  ["cut", "Cut or heavily damaged"],
                ]}
                value={sleeve.cornerWearLevel}
                onChange={(val) => setSleeve((s) => ({ ...s, cornerWearLevel: val }))}
              />
            )}

            {/* Sealed here, affects Mint eligibility */}
            <label className="mg-check">
              <input
                type="checkbox"
                checked={sleeve.sealed}
                onChange={(e) => setSleeve((s) => ({ ...s, sealed: e.target.checked }))}
              />
              <span>Sealed (factory shrink intact)</span>
            </label>
            <div className="mg-help">Sealed adds +5 (up to 100). M only if sealed & flawless.</div>

            <label className="mg-check">
              <input
                type="checkbox"
                checked={sleeve.ringWear}
                onChange={(e) => setSleeve((s) => ({ ...s, ringWear: e.target.checked }))}
              />
              <span>{resolveLabels(mediaType).ringWear}</span>
            </label>
            {sleeve.ringWear && (
              <SeverityRadios
                name="ring-level"
                options={[
                  ["light", "Light"],
                  ["visible", "Visible"],
                  ["heavy", "Heavy"],
                ]}
                value={sleeve.ringWearLevel}
                onChange={(val) => setSleeve((s) => ({ ...s, ringWearLevel: val }))}
              />
            )}
          </fieldset>

          <fieldset className={`mg-fieldset ${sleeve.missing ? "mg-disabled" : ""}`}>
            <legend>{resolveLabels(mediaType).seamsTitle}</legend>

            <label className="mg-check">
              <input
                type="checkbox"
                checked={sleeve.seamsIntact}
                onChange={(e) => setSleeve((s) => ({ ...s, seamsIntact: e.target.checked }))}
              />
              <span>{resolveLabels(mediaType).seamsIntact}</span>
            </label>

            <label className="mg-check">
              <input
                type="checkbox"
                checked={sleeve.seamSplit}
                onChange={(e) => setSleeve((s) => ({ ...s, seamSplit: e.target.checked }))}
              />
              <span>{resolveLabels(mediaType).seamSplitOrCrack}</span>
            </label>
            {sleeve.seamSplit && (
              <SeverityRadios
                name="seam-level"
                options={[
                  ["small", "Small"],
                  ["medium", "Medium"],
                  ["large", "Large / multiple"],
                ]}
                value={sleeve.seamSplitLevel}
                onChange={(val) => setSleeve((s) => ({ ...s, seamSplitLevel: val }))}
              />
            )}

            <label className="mg-check">
              <input
                type="checkbox"
                checked={sleeve.spineWear}
                onChange={(e) => setSleeve((s) => ({ ...s, spineWear: e.target.checked }))}
              />
              <span>{resolveLabels(mediaType).spineWearOrTray}</span>
            </label>
            {sleeve.spineWear && (
              <SeverityRadios
                name="spine-level"
                options={[
                  ["minor", "Minor"],
                  ["worn", "Worn"],
                  ["major", "Major"],
                ]}
                value={sleeve.spineWearLevel}
                onChange={(val) => setSleeve((s) => ({ ...s, spineWearLevel: val }))}
              />
            )}
          </fieldset>

          <fieldset className={`mg-fieldset ${sleeve.missing ? "mg-disabled" : ""}`}>
            <legend>Damage & Markings</legend>

            <label className="mg-check">
              <input
                type="checkbox"
                checked={sleeve.tears}
                onChange={(e) => setSleeve((s) => ({ ...s, tears: e.target.checked }))}
              />
              <span>Tears present</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={sleeve.writing}
                onChange={(e) => setSleeve((s) => ({ ...s, writing: e.target.checked }))}
              />
              <span>Writing present</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={sleeve.stickersTape}
                onChange={(e) => setSleeve((s) => ({ ...s, stickersTape: e.target.checked }))}
              />
              <span>Stickers or tape</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={sleeve.water}
                onChange={(e) => setSleeve((s) => ({ ...s, water: e.target.checked }))}
              />
              <span>Water damage / staining</span>
            </label>
            {mediaType === "cd" && (
              <label className="mg-check">
                <input
                  type="checkbox"
                  checked={sleeve.bookletWater || false}
                  onChange={(e) => setSleeve((s) => ({ ...s, bookletWater: e.target.checked }))}
                />
                <span>{resolveLabels(mediaType).bookletWater}</span>
              </label>
            )}
          </fieldset>

          {/* Disclosure-only (may block NM on sleeve for some flags) */}
          <fieldset className="mg-fieldset">
            <legend>Additional Notes (don’t affect score)</legend>
            <div className="mg-notes-grid">
              {DISCLOSURE_KEYS.map((k) => (
                <label key={k} className="mg-check">
                  <input
                    type="checkbox"
                    checked={!!extra[k]}
                    onChange={(e) => setExtra((x) => ({ ...x, [k]: e.target.checked }))}
                  />
                  <span>{DISCLOSURE_LABELS[k]}</span>
                </label>
              ))}
            </div>
            <div className="mg-help">
              “Cut-out” and “Promo copy” block NM for sleeve (cap ≤ VG+).
            </div>
          </fieldset>
        </div>
      </section>

      {/* Freeform notes */}
      <section className="mg-notes mg-card">
        <label htmlFor="customNotes"><strong>Custom Condition Notes</strong></label>
        <textarea
          id="customNotes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder=""
        />
      </section>

      {/* Results */}
      <section className="mg-results">
        <ResultCard title="Record/Media Grade" grade={mediaGrade} score={mediaScore} />
        <ResultCard title="Sleeve/Packaging Grade" grade={sleeveGrade} score={sleeveCalc.score} />
        <div className={`mg-card mg-result ${overallColor}`}>
          <div className="mg-result-title">Overall Grade</div>
          <div className="mg-result-grade">{overall.grade}</div>
          <div className="mg-result-score">{overall.score}/100</div>
        </div>
      </section>

      {/* Explanation */}
      <section className="mg-explanation mg-card">
        <div className="mg-expl-title">Grading Explanation</div>
        <p>{explanation}</p>
      </section>
    </main>
  );
}

/* --------------------------- Small components --------------------------- */

function SeverityRadios({ name, options, value, onChange }) {
  return (
    <div className="mg-subgroup" role="group" aria-label={`${name}-severity`}>
      {options.map(([val, text]) => (
        <label key={val} className="mg-radio">
          <input
            type="radio"
            name={name}
            checked={value === val}
            onChange={() => onChange(val)}
          />
          <span>{text}</span>
        </label>
      ))}
    </div>
  );
}

function Sides({ baseId, a, b, onA, onB }) {
  return (
    <div className="mg-sub-extent">
      <div className="mg-sides-grid">
        <label className="mg-check">
          <input
            id={`${baseId}-sa`}
            type="checkbox"
            checked={a}
            onChange={(e) => onA(e.target.checked)}
          />
          <span>Side A</span>
        </label>
        <label className="mg-check">
          <input
            id={`${baseId}-sb`}
            type="checkbox"
            checked={b}
            onChange={(e) => onB(e.target.checked)}
          />
          <span>Side B</span>
        </label>
      </div>
    </div>
  );
}

function SidesTracks({ baseId, a, b, onA, onB, tracks, onTracks }) {
  return (
    <div className="mg-sub-extent">
      <div className="mg-sides-grid">
        <label className="mg-check">
          <input
            id={`${baseId}-sa`}
            type="checkbox"
            checked={a}
            onChange={(e) => onA(e.target.checked)}
          />
          <span>Side A</span>
        </label>
        <label className="mg-check">
          <input
            id={`${baseId}-sb`}
            type="checkbox"
            checked={b}
            onChange={(e) => onB(e.target.checked)}
          />
          <span>Side B</span>
        </label>
      </div>
      <div className="mg-number">
        <label htmlFor={`${baseId}-t`}>Tracks affected</label>
        <input
          id={`${baseId}-t`}
          type="number"
          min={0}
          step={1}
          value={tracks}
          onChange={(e) => onTracks(Math.max(0, parseInt(e.target.value || "0", 10)))}
        />
      </div>
    </div>
  );
}

function ResultCard({ title, grade, score }) {
  const color = GRADE_COLORS[grade] || "mg-grade-vg";
  return (
    <div className={`mg-card mg-result ${color}`}>
      <div className="mg-result-title">{title}</div>
      <div className="mg-result-grade">{grade}</div>
      <div className="mg-result-score">{score}/100</div>
    </div>
  );
}

// CD label-side integrity mini-block (hairlines / pinholes(bronzing) / severe)
function LabelSideCD({ idx, updateItem }) {
  const [hair, setHair] = useState(false);
  const [pin, setPin] = useState(false);
  const [severe, setSevere] = useState(false);

  // We store these as hidden local flags but translate them to deductions via a "virtual" update:
  const toggle = (key, checked) => {
    updateItem(idx, { [`cd_${key}`]: checked });
  };

  return (
    <div className="mg-cd-labelset">
      <label className="mg-check">
        <input
          type="checkbox"
          checked={hair}
          onChange={(e) => {
            setHair(e.target.checked);
            toggle("labelHairlines", e.target.checked);
          }}
        />
        <span>Label-side hairlines</span>
      </label>
      <label className="mg-check">
        <input
          type="checkbox"
          checked={pin}
          onChange={(e) => {
            setPin(e.target.checked);
            toggle("labelPinholes", e.target.checked);
          }}
        />
        <span>Pinholes / bronzing present</span>
      </label>
      <label className="mg-check">
        <input
          type="checkbox"
          checked={severe}
          onChange={(e) => {
            setSevere(e.target.checked);
            toggle("labelSevere", e.target.checked);
          }}
        />
        <span>Severe label damage (aluminum exposed)</span>
      </label>
      <div className="mg-help">These impair reflectivity and may cap the grade.</div>
    </div>
  );
}

/* --------------------------- Disclosure notes --------------------------- */

const DISCLOSURE_KEYS = [
  "promoCopy",
  "cutout",
  "genericSleeve",
  "hypeSticker",
  "obiPresent",
  "posterInsert",
  "origShrink",
  "priceSticker",
  "firstPress",
  "coloredVinyl",
  "limitedEdition",
  "gatefoldSleeve",
  "originalInner",
  "jewelDamaged",
  "jewelMissing",
];

const DISCLOSURE_LABELS = {
  promoCopy: "Promotional copy",
  cutout: "Cut-out hole/notch/corner cut",
  genericSleeve: "Generic/company sleeve",
  hypeSticker: "Hype sticker present",
  obiPresent: "OBI present",
  posterInsert: "Poster / insert present",
  origShrink: "Original shrinkwrap",
  priceSticker: "Price sticker/tag",
  firstPress: "First pressing",
  coloredVinyl: "Colored vinyl",
  limitedEdition: "Limited edition",
  gatefoldSleeve: "Gatefold sleeve",
  originalInner: "Original inner sleeve",
  jewelDamaged: "Jewel case damaged (note)",
  jewelMissing: "Jewel case missing (note)",
};

/* --------------------------- Patch scorer to honor CD label-side flags --------------------------- */

const _origScoreOneItem = scoreOneItem;
scoreOneItem = function wrappedScoreOneItem(item, mediaType, labels) {
  const r = _origScoreOneItem(item, mediaType, labels);

  if (mediaType === "cd") {
    // Inject deductions/caps from CD label-side flags
    const extraCaps = [];
    const extraDeds = [];
    if (item.cd_labelHairlines) {
      extraDeds.push({ label: "Label-side hairlines", pts: 5 });
      extraCaps.push(CAPS.cd_labelHairlines);
    }
    if (item.cd_labelPinholes) {
      extraDeds.push({ label: "Pinholes / bronzing present", pts: 10 });
      extraCaps.push(CAPS.cd_labelPinholes);
    }
    if (item.cd_labelSevere) {
      extraDeds.push({ label: "Severe label damage (aluminum exposed)", pts: 20 });
      extraCaps.push(CAPS.cd_labelSevere);
    }
    if (extraDeds.length) {
      const newScore = clampScore(r.score - extraDeds.reduce((a, d) => a + d.pts, 0));
      return {
        ...r,
        score: newScore,
        baseGrade: gradeFromScore(newScore, { allowMint: false }),
        capGrades: [...(r.capGrades || []), ...extraCaps],
        deductions: [...r.deductions, ...extraDeds],
      };
    }
  }
  return r;
};
