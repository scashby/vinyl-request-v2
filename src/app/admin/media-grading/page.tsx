"use client";

import React, { useState, useMemo, useCallback } from "react";
import Link from 'next/link';

interface MediaItemState {
  key: string;
  checked: boolean;
  subOptions: string[] | null;
  subIndex: number | null;
  sides: { S1: boolean; S2: boolean } | null;
  tracks: { S1: number; S2: number } | number | null;
  penalty: number;
  label: string;
}

interface MediaState {
  missing: boolean;
  sections: {
    visual: MediaItemState[];
    audio: MediaItemState[];
    labelArea: MediaItemState[];
  };
}

interface GradingOption {
  key: string;
  label: string;
  type?: string;
  penalty?: number;
  sub?: string[];
  sideable?: boolean;
  tracks?: boolean;
}

interface MediaItemState {
  key: string;
  checked: boolean;
  subOptions: string[] | null;
  subIndex: number | null;
  sides: { S1: boolean; S2: boolean } | null;
  tracks: { S1: number; S2: number } | number | null;
  penalty: number;
  label: string;
}

interface MediaState {
  missing: boolean;
  sections: {
    visual: MediaItemState[];
    audio: MediaItemState[];
    labelArea: MediaItemState[];
  };
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

function sideLettersForIndex(idx: number): [string, string] {
  const base = "A".charCodeAt(0) + idx * 2;
  const s1 = String.fromCharCode(base);
  const s2 = String.fromCharCode(base + 1);
  return [s1, s2];
}

function numericToBaseGrade(score: number): string {
  if (score >= 97) return "NM";
  if (score >= 85) return "VG+";
  if (score >= 75) return "VG";
  if (score >= 65) return "G+";
  if (score >= 50) return "G";
  return "F/P";
}

function getMediaLabels(mediaType: string) {
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

function getPackagingLabels(mediaType: string) {
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

  // CD — ONLY Insert/Booklet is graded; everything else is Additional Notes
  return {
    title: "Insert/Booklet Condition Assessment",
    insert: [
      { key: "looksNew", label: "Looks like new, no flaws", penalty: 0 },
      { key: "ringWear", label: "Booklet ring wear visible", penalty: SLEEVE_PENALTIES.ringWearOrBookletRing, sub: ["Light","Moderate","Heavy"] },
      { key: "cornerWear", label: "Corner wear present", penalty: SLEEVE_PENALTIES.cornerWear, sub: ["Slight bumping","Creased/frayed","Cut/damaged"] },
      { key: "creases", label: "Creases / crushing present", penalty: SLEEVE_PENALTIES.cornerWear, sub: ["Small","Moderate","Large/through"] },
      { key: "tears", label: "Tears present", penalty: SLEEVE_PENALTIES.tears, sub: ["Small","Medium","Large / across"] },
      { key: "tornPages", label: "Torn pages", penalty: SLEEVE_PENALTIES.tears, sub: ["Small tears","Multiple tears","Large/edge tears"] },
      { key: "missingPages", label: "Missing pages (booklet incomplete)", penalty: 20 },
      { key: "waterDamage", label: "Water/moisture damage", penalty: 10, sub: ["Light spotting","Noticeable staining","Severe/warped"] },
      { key: "writing", label: "Writing present", penalty: SLEEVE_PENALTIES.writing, sub: ["Initials","Notes","Large/covering"] },
      { key: "stickers", label: "Stickers or tape", penalty: SLEEVE_PENALTIES.stickers, sub: ["Price","Hype","Residue"] },
    ],
    // Case-related items are notes only (non-scoring)
    notes: [
      { key: "stdJewelCracked", label: "Standard jewel case cracked (replaceable)" },
      { key: "trayTeethBrokenNote", label: "Tray teeth broken (replaceable)" },
      { key: "customCase", label: "Custom case / box / digipak" },
      { key: "slipcase", label: "Slipcase included" },
      { key: "obi", label: "OBI present" },
      { key: "promoCopy", label: "Promotional copy" },
      { key: "specialLimited", label: "Special/limited edition" },
    ],
  };
}

function makeInitialMediaState(mediaType: string) {
  const labels = getMediaLabels(mediaType);
  const fold = (arr: GradingOption[]) =>
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
  const [packagingChecks, setPackagingChecks] = useState<Record<string, boolean>>({});
  const [packagingSubs, setPackagingSubs] = useState<Record<string, number>>({});
  const [additionalNotes, setAdditionalNotes] = useState<Record<string, boolean>>({});
  const [customNotes, setCustomNotes] = useState("");

  const [packagingAppearance, setPackagingAppearance] = useState("gentlyHandled");

  const labels = useMemo(() => getMediaLabels(mediaType), [mediaType]);
  const pkgLabels = useMemo(() => getPackagingLabels(mediaType), [mediaType]);

  function onSelectType(next: string) {
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

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(idx: number, updater: (item: MediaState) => MediaState) {
    setItems((prev) => prev.map((it, i) => (i === idx ? updater(it) : it)));
  }

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
    (item: MediaState) => {
      if (item.missing) return { score: 0, deductions: [{ label: "Item missing", amount: 100 }] };

      let score = 100;
      const deductions: { label: string; amount: number }[] = [];

      const evalRow = (row: MediaItemState[], isAudio: boolean) => {
        row.forEach((entry: MediaItemState) => {
          if (!entry.checked) return;

          if (sealed) {
            if (mediaType === "vinyl") {
              if (entry.key !== "warping") return; 
            } else {
              return; 
            }
          }

          const p = entry.penalty || 0;
          if (p > 0) {
            score -= p;
            deductions.push({ label: entry.label, amount: p });
          }

          if (isAudio && entry.tracks !== null) {
            if (labels.sideable && entry.tracks && typeof entry.tracks === "object") {
              const countS1 = entry.sides?.S1 ? Math.max(0, entry.tracks.S1 || 0) : 0;
              const countS2 = entry.sides?.S2 ? Math.max(0, entry.tracks.S2 || 0) : 0;
              const total = countS1 + countS2;
              if (total > 0) {
                const amt = total * MEDIA_PENALTIES.perTrack;
                score -= amt;
                deductions.push({ label: `Tracks affected (${entry.label})`, amount: amt });
              }
            } else if (!labels.sideable && typeof entry.tracks === "number") {
              const t = Math.max(0, entry.tracks || 0);
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

  const shelfWearPenalty = (idx: number) => {
    if (idx === 0) return 2;
    if (idx === 1) return 8;
    return 12;
  };

  const computePackagingScore = useCallback(() => {
    if (packagingMissing) {
      return { score: 0, deductions: [{ label: "Packaging missing", amount: 100 }], sealedM: false, appearanceApplied: null };
    }
    let score = 100;
    const deductions: { label: string; amount: number }[] = [];
    let totalDeduction = 0;

    let allowedWhenSealedNonVinyl = new Set();
    if (mediaType === "cd") {
      allowedWhenSealedNonVinyl = new Set((pkgLabels.insert || []).map((c) => c.key));
    } else if (mediaType === "cassette") {
      allowedWhenSealedNonVinyl = new Set(["minorShelfWear", "cornerWear", "creases"]);
    }

    const sealedVinylAllowed = new Set([
      "minorShelfWear",
      "cornerWear",
      "ringWear",
      "creases",
      "tears",
      "writing",
      "stickers",
    ]);

    const allowKey = (key: string) => {
      if (!sealed) return true;
      if (mediaType === "vinyl") return sealedVinylAllowed.has(key);
      return allowedWhenSealedNonVinyl.has(key) || key === "allIntact" || key === "allSeamsIntact";
    };

    const applyBlock = (blockArr: GradingOption[]) => {
      if (!blockArr) return;
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

    if (mediaType === "cd") {
      applyBlock(pkgLabels.insert || []);
    } else {
      applyBlock(pkgLabels.overall);
      applyBlock(pkgLabels.seams);
      applyBlock(pkgLabels.damage);
    }

    if (sealed) {
      score = Math.min(100, score - totalDeduction + SLEEVE_PENALTIES.sealedBonus);
    } else {
      score = Math.max(0, 100 - totalDeduction);
    }

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
  }, [
    packagingChecks,
    packagingMissing,
    sealed,
    pkgLabels,
    mediaType,
    packagingSubs,
    packagingAppearance,
  ]);

  const mediaAgg = useMemo(() => {
    let total = 0;
    let allDeductions: { label: string; amount: number }[] = [];
    const perItem = items.map((it) => computeMediaScoreForItem(it));
    perItem.forEach((r) => {
      total += r.score;
      allDeductions = allDeductions.concat(r.deductions);
    });

    let mediaAllM = false;
    if (sealed) {
      if (mediaType === "vinyl") {
        const anyWarp = items.some((it) =>
          it.sections.visual.some((e: MediaItemState) => e.key === "warping" && e.checked)
        );
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

  const isVinylMediaNMEligible = useMemo(() => {
    if (mediaType !== "vinyl") return true;
    if (!items.length) return false;
    for (const item of items) {
      if (item.missing) return false;
      let glossyChecked = false;
      let anyOtherChecked = false;
      const scan = (arr: MediaItemState[]) => {
        for (const e of arr) {
          if (e.checked) {
            if (e.key === "glossy") glossyChecked = true;
            else anyOtherChecked = true;
          }
        }
      };
      scan(item.sections.visual);
      scan(item.sections.audio);
      scan(item.sections.labelArea);
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

  function scoreToGrade(score: number, opts: { isMedia: boolean; mediaSealedAllM: boolean; packagingSealedM: boolean; isSealed: boolean }) {
    const { isMedia, mediaSealedAllM, packagingSealedM, isSealed } = opts;
    if (isSealed) {
      if (isMedia && mediaSealedAllM) return "M";
      if (!isMedia && packagingSealedM) return "M";
    }
    return numericToBaseGrade(score);
  }

  const overall = useMemo(() => {
    const mediaScore = mediaAgg.avg;
    let mediaGrade = scoreToGrade(mediaScore, {
      isMedia: true,
      mediaSealedAllM: mediaAgg.sealedAllM,
      packagingSealedM: false,
      isSealed: sealed,
    });

    const pkgScore = packagingAgg.score;
    let pkgGrade = scoreToGrade(pkgScore, {
      isMedia: false,
      mediaSealedAllM: false,
      packagingSealedM: packagingAgg.sealedM,
      isSealed: sealed,
    });

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

    if (overallGrade === "NM" && !(mediaGrade === "NM" && pkgGrade === "NM")) {
      overallGrade = "VG+";
    }

    const mediaTop = [...mediaAgg.deductions].sort((a, b) => b.amount - a.amount).slice(0, 3);
    const pkgTop = [...packagingAgg.deductions].sort((a, b) => b.amount - a.amount).slice(0, 3);

    const details = [];
    details.push(
      mediaTop.length
        ? `Media deductions: ${mediaTop.map((d) => `${d.label} (−${d.amount})`).join("; ")}.`
        : "Media: No deductions."
    );
    details.push(
      pkgTop.length
        ? `Packaging deductions: ${pkgTop.map((d) => `${d.label} (−${d.amount})`).join("; ")}.`
        : "Packaging: No deductions."
    );

    if (packagingAgg.appearanceApplied) {
      const { before, after, bump } = packagingAgg.appearanceApplied;
      details.push(
        `Sleeve appearance nudge applied: ${bump > 0 ? "+" : ""}${bump} (from ${Math.round(
          before
        )} to ${Math.round(after)}), on cusp.`
      );
    }

    const formula = componentMissing
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
  }, [
    mediaAgg,
    packagingAgg,
    sealed,
    packagingMissing,
    items,
    mediaType,
    isVinylMediaNMEligible,
    isPackagingNMEligible,
  ]);

  function togglePackaging(key: string) {
    setPackagingChecks((p) => ({ ...p, [key]: !p[key] }));
  }
  function setPackagingSub(key: string, idx: number) {
    setPackagingSubs((p) => ({ ...p, [key]: idx }));
  }
  function toggleNote(key: string) {
    setAdditionalNotes((p) => ({ ...p, [key]: !p[key] }));
  }

  const typeTabs = (
    <div className="flex gap-2 flex-wrap mb-4" role="tablist" aria-label="Media type">
      {MEDIA_TYPES.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={mediaType === t.key}
          className={`flex items-center px-4 py-2 rounded-full font-semibold border-2 transition-colors ${
            mediaType === t.key 
              ? "bg-red-500 border-red-500 text-white shadow-md" 
              : "bg-transparent border-slate-300 text-slate-100 hover:border-slate-400"
          }`}
          onClick={() => onSelectType(t.key)}
          type="button"
        >
          <span className="mr-2 opacity-90">{t.icon}</span> {t.label}
        </button>
      ))}
    </div>
  );

  const sealedBanner = (
    <div className="bg-slate-100 border border-slate-300 rounded-xl p-4 text-slate-900 shadow-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
        <label htmlFor="sealedToggle" className="flex items-center gap-2 cursor-pointer font-bold select-none text-slate-800">
          <input
            id="sealedToggle"
            type="checkbox"
            checked={sealed}
            onChange={(e) => setSealed(e.target.checked)}
            className="w-5 h-5 accent-blue-600 cursor-pointer"
          />
          <span>Sealed (factory shrink intact)</span>
        </label>

        <button 
          type="button" 
          className="bg-slate-600 text-white hover:bg-slate-700 px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm" 
          onClick={resetForNextAlbum} 
          aria-label="Start next album"
        >
          Start Next Album (Reset)
        </button>
      </div>

      <p className="text-sm text-slate-600 leading-relaxed">
        When <strong>Sealed</strong> is on:
        <br />• <strong>Vinyl</strong>: only evaluate <em>Warping present</em> for the record; all other record criteria are assumed perfect.
        <br />• <strong>Cassettes/CDs</strong>: media condition is assumed perfect (hidden) unless visibly defective through the case.
        <br />• <strong>CD Packaging</strong>: we grade only the insert/booklet; case issues are notes. A +5 sealed bonus applies (cap 100). <strong>Mint (M)</strong> requires sealed & flawless in allowed scope.
      </p>
    </div>
  );

  const Header = (
    <header className="bg-slate-800 text-white rounded-2xl p-6 mb-6 shadow-md border border-slate-700">
      <h1 className="text-2xl font-bold mb-1">🔍 Systematic Media Grading Tool</h1>
      <p className="text-slate-300 text-sm mb-6">Detailed condition assessment with automatic grading calculation</p>
      {typeTabs}
      {sealedBanner}
    </header>
  );

  // Helper for Media Item Card
  const MediaItemCard = ({ item, index }: { item: MediaState; index: number }) => {
    const [L1, L2] = sideLettersForIndex(index);
    const idxLabel = `${labels.itemWord} #${index + 1}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setEntry = (sectionKey: string, entryKey: string, updates: any) => {
      updateItem(index, (it) => {
        const next = { ...it, sections: { ...it.sections } };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arr = next.sections[sectionKey].map((e: any) =>
          e.key === entryKey ? { ...e, ...updates } : e
        );
        next.sections[sectionKey] = arr;
        return next;
      });
    };

    const setMissing = (val: boolean) => updateItem(index, (it) => ({ ...it, missing: val }));

    const sectionBlock = (title: string, keyName: keyof MediaState['sections'], arr: MediaItemState[]) => {
      if (sealed && mediaType !== "vinyl") {
        return null;
      }

      let filtered = arr;

      if (sealed && mediaType === "vinyl") {
        if (title.toLowerCase().includes("visual")) {
          filtered = arr.filter((row) => row.key === "warping");
        } else if (
          title.toLowerCase().includes("audio") ||
          title.toLowerCase().includes("playback") ||
          title.toLowerCase().includes("label") ||
          title.toLowerCase().includes("center")
        ) {
          return null;
        }
      }

      if (filtered.length === 0) return null;

      return (
        <fieldset className="border border-slate-200 rounded-lg p-3 mb-4 bg-slate-50">
          <legend className="px-2 font-bold text-slate-700">{title}</legend>
          {filtered.map((entry) => {
            const id = `${keyName}-${entry.key}-${index}`;
            const onToggle = (checked: boolean) => setEntry(keyName, entry.key, { checked });

            return (
              <div key={entry.key} className={`border border-transparent rounded-lg p-2 transition-colors ${entry.checked ? "bg-white border-slate-200 shadow-sm" : ""}`}>
                <label htmlFor={id} className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-800 font-medium">
                  <input
                    id={id}
                    type="checkbox"
                    checked={entry.checked}
                    onChange={(e) => onToggle(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                  <span>{entry.label}</span>
                </label>

                {entry.checked && Array.isArray(entry.subOptions) && (
                  <div className="flex gap-4 flex-wrap mt-2 ml-6" role="group" aria-label={`${entry.label} severity`}>
                    {entry.subOptions.map((slabel: string, i: number) => {
                      const rid = `${id}-sub-${i}`;
                      return (
                        <label key={rid} htmlFor={rid} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                          <input
                            id={rid}
                            type="radio"
                            name={`${id}-sub`}
                            checked={entry.subIndex === i}
                            onChange={() => setEntry(keyName, entry.key, { subIndex: i })}
                            className="accent-blue-600"
                          />
                          <span>{slabel}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {entry.checked && entry.sides && (
                  <div className="flex flex-wrap gap-4 mt-2 ml-6 items-center" role="group" aria-label="Which side(s) affected">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Affected Sides:</span>
                    {[
                      { key: "S1", label: L1 },
                      { key: "S2", label: L2 },
                    ].map((s) => {
                      const sid = `${id}-side-${s.key}`;
                      return (
                        <label key={sid} htmlFor={sid} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
                          <input
                            id={sid}
                            type="checkbox"
                            checked={!!entry.sides[s.key]}
                            onChange={(e) =>
                              setEntry(keyName, entry.key, {
                                sides: { ...entry.sides, [s.key]: e.target.checked },
                              })
                            }
                            className="w-4 h-4 rounded accent-blue-600"
                          />
                          <span>Side {s.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {entry.checked && entry.tracks !== null && (
                  <div className="flex items-center gap-3 flex-wrap mt-2 ml-6 text-sm">
                    {labels.sideable && typeof entry.tracks === "object" ? (
                      <>
                        <div className="flex items-center gap-2">
                          <label htmlFor={`${id}-tracks-S1`} className="text-slate-600">Tracks Side {L1}:</label>
                          <input
                            id={`${id}-tracks-S1`}
                            type="number"
                            min="0"
                            value={entry.tracks.S1}
                            onChange={(e) =>
                              setEntry(keyName, entry.key, {
                                tracks: {
                                  ...(entry.tracks as { S1: number; S2: number }),
                                  S1: Math.max(0, parseInt(String(e.target.value || "0"), 10)),
                                },
                              })
                            }
                            className="w-16 p-1 border border-slate-300 rounded text-center"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label htmlFor={`${id}-tracks-S2`} className="text-slate-600">Side {L2}:</label>
                          <input
                            id={`${id}-tracks-S2`}
                            type="number"
                            min="0"
                            value={entry.tracks.S2}
                            onChange={(e) =>
                              setEntry(keyName, entry.key, {
                                tracks: {
                                  ...(entry.tracks as { S1: number; S2: number }),
                                  S2: Math.max(0, parseInt(String(e.target.value || "0"), 10)),
                                },
                              })
                            }
                            className="w-16 p-1 border border-slate-300 rounded text-center"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <label htmlFor={`${id}-tracks`} className="text-slate-600">Tracks affected:</label>
                        <input
                          id={`${id}-tracks`}
                          type="number"
                          min="0"
                          value={typeof entry.tracks === 'number' ? entry.tracks : 0}
                          onChange={(e) =>
                            setEntry(keyName, entry.key, {
                              tracks: Math.max(0, parseInt(String(e.target.value || "0"), 10)),
                            })
                          }
                          className="w-16 p-1 border border-slate-300 rounded text-center"
                        />
                      </div>
                    )}
                    <span className="text-xs text-slate-400 italic ml-2">
                      (Tracks count only subtracts points for audio defects)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>
      );
    };

    return (
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">{idxLabel}</h3>
          <div className="flex gap-4 items-center">
            <label htmlFor={`missing-${index}`} className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600">
              <input
                id={`missing-${index}`}
                type="checkbox"
                checked={item.missing}
                onChange={(e) => setMissing(e.target.checked)}
                className="w-4 h-4 accent-red-600"
              />
              <span>Missing (Auto P)</span>
            </label>
            <button
              type="button"
              className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              onClick={() => removeItem(index)}
              aria-label={`Remove ${labels.itemWord}`}
            >
              Remove
            </button>
          </div>
        </div>

        {sectionBlock("Visual Appearance", "visual", item.sections.visual)}
        {sectionBlock(
          mediaType === "cassette" ? "Playback & Transport" : "Audio Performance",
          "audio",
          item.sections.audio
        )}
        {sectionBlock(
          mediaType === "vinyl" ? "Label / Center" : mediaType === "cd" ? "Hub / Face" : "Shell / Label",
          "labelArea",
          item.sections.labelArea
        )}
      </section>
    );
  };

  const isSealedVinyl = sealed && mediaType === "vinyl";
  const vinylAllowedKeys = new Set([
    "minorShelfWear",
    "cornerWear",
    "ringWear",
    "creases",
    "tears",
    "writing",
    "stickers",
  ]);
  const filterAllowed = (arr: GradingOption[]) => (isSealedVinyl ? arr.filter((x) => vinylAllowedKeys.has(x.key)) : arr);

  const PackagingPanel = (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
        <h3 className="text-lg font-bold text-slate-800">{pkgLabels.title}</h3>
        <label htmlFor="pkg-missing" className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600">
          <input
            id="pkg-missing"
            type="checkbox"
            checked={packagingMissing}
            onChange={(e) => setPackagingMissing(e.target.checked)}
            className="w-4 h-4 accent-red-600"
          />
          <span>Mark packaging as Missing (Auto P)</span>
        </label>
      </div>

      {mediaType === "cd" ? (
        <>
          <fieldset className="border border-slate-200 rounded-lg p-3 mb-4 bg-slate-50">
            <legend className="px-2 font-bold text-slate-700">Insert / Booklet Condition</legend>
            {(pkgLabels.insert || []).map((cfg) => {
              const id = `pkg-${cfg.key}`;
              const checked = !!packagingChecks[cfg.key];

              const allowedWhenSealedNonVinyl = new Set((pkgLabels.insert || []).map((c) => c.key));
              const allowKey = (key: string) =>
                !sealed || allowedWhenSealedNonVinyl.has(key) || key === "allIntact" || key === "allSeamsIntact";
              const disabled = !allowKey(cfg.key);

              return (
                <div key={cfg.key} className={`border border-transparent rounded-lg p-2 transition-colors ${checked ? "bg-white border-slate-200 shadow-sm" : ""}`}>
                  <label htmlFor={id} className={`flex items-center gap-2 cursor-pointer select-none text-sm font-medium ${disabled ? 'opacity-50 cursor-not-allowed' : 'text-slate-800'}`}>
                    <input
                      id={id}
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePackaging(cfg.key)}
                      disabled={disabled}
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                    <span>{cfg.label}</span>
                  </label>
                  {checked && Array.isArray(cfg.sub) && (
                    <div className="flex gap-4 flex-wrap mt-2 ml-6">
                      {cfg.sub.map((txt, i) => {
                        const rid = `${id}-sub-${i}`;
                        return (
                          <label key={rid} htmlFor={rid} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                            <input
                              id={rid}
                              type="radio"
                              name={`${id}-sub`}
                              checked={packagingSubs[cfg.key] === i}
                              onChange={() => setPackagingSub(cfg.key, i)}
                              disabled={disabled}
                              className="accent-blue-600"
                            />
                            <span>{txt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-slate-500 mt-2 italic">
              Standard plastic cases are <strong>not graded</strong>; evaluate the <strong>insert/booklet</strong> only.
              Use Additional Notes for replaceable case or tray issues.
            </p>
            {sealed && (
              <p className="text-xs text-green-600 mt-1 font-semibold">Sealed adds +5 (cap 100). <strong>M</strong> only if sealed &amp; flawless.</p>
            )}
          </fieldset>

          <fieldset className="border border-slate-200 rounded-lg p-3 mb-4 bg-slate-50">
            <legend className="px-2 font-bold text-slate-700">Additional notes (don’t affect score)</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              {pkgLabels.notes?.map((n) => (
                <label key={n.key} htmlFor={`note-${n.key}`} className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
                  <input
                    id={`note-${n.key}`}
                    type="checkbox"
                    checked={!!additionalNotes[n.key]}
                    onChange={() => toggleNote(n.key)}
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                  <span>{n.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : (
        <>
          <fieldset className="border border-slate-200 rounded-lg p-3 mb-4 bg-slate-50">
            <legend className="px-2 font-bold text-slate-700">Overall Appearance</legend>
            {filterAllowed(pkgLabels.overall).map((cfg) => {
              const id = `pkg-${cfg.key}`;
              const checked = !!packagingChecks[cfg.key];
              const disabled =
                sealed && mediaType !== "vinyl" && !["minorShelfWear", "cornerWear", "creases"].includes(cfg.key);
              return (
                <div key={cfg.key} className={`border border-transparent rounded-lg p-2 transition-colors ${checked ? "bg-white border-slate-200 shadow-sm" : ""}`}>
                  <label htmlFor={id} className={`flex items-center gap-2 cursor-pointer select-none text-sm font-medium ${disabled ? 'opacity-50 cursor-not-allowed' : 'text-slate-800'}`}>
                    <input
                      id={id}
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePackaging(cfg.key)}
                      disabled={disabled}
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                    <span>{cfg.label}</span>
                  </label>
                  {checked && Array.isArray(cfg.sub) && (
                    <div className="flex gap-4 flex-wrap mt-2 ml-6">
                      {cfg.sub.map((txt, i) => {
                        const rid = `${id}-sub-${i}`;
                        return (
                          <label key={rid} htmlFor={rid} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                            <input
                              id={rid}
                              type="radio"
                              name={`${id}-sub`}
                              checked={packagingSubs[cfg.key] === i}
                              onChange={() => setPackagingSub(cfg.key, i)}
                              disabled={disabled}
                              className="accent-blue-600"
                            />
                            <span>{txt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {mediaType === "cassette" && (
              <p className="text-xs text-slate-500 mt-2 italic">
                Standard plastic cases are <strong>not graded</strong>; evaluate the J-card only. Use Additional Notes
                for replaceable case issues.
              </p>
            )}
            {sealed && (
              <p className="text-xs text-green-600 mt-1 font-semibold">
                Sealed adds +5 (cap 100). <strong>M</strong> only if sealed &amp; flawless (no allowed deductions).
              </p>
            )}
          </fieldset>

          {!isSealedVinyl && pkgLabels.seams && (
            <fieldset className="border border-slate-200 rounded-lg p-3 mb-4 bg-slate-50">
              <legend className="px-2 font-bold text-slate-700">
                {mediaType === "vinyl"
                  ? "Seams & Structure"
                  : mediaType === "cassette"
                  ? "J-card Structure"
                  : "Insert/Tray Structure"}
              </legend>
              {pkgLabels.seams.map((cfg) => {
                const id = `pkg-${cfg.key}`;
                const checked = !!packagingChecks[cfg.key];
                const disabled = sealed && cfg.key !== "allSeamsIntact" && cfg.key !== "allIntact";
                return (
                  <div key={cfg.key} className={`border border-transparent rounded-lg p-2 transition-colors ${checked ? "bg-white border-slate-200 shadow-sm" : ""}`}>
                    <label htmlFor={id} className={`flex items-center gap-2 cursor-pointer select-none text-sm font-medium ${disabled ? 'opacity-50 cursor-not-allowed' : 'text-slate-800'}`}>
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePackaging(cfg.key)}
                        disabled={disabled}
                        className="w-4 h-4 accent-blue-600 rounded"
                      />
                      <span>{cfg.label}</span>
                    </label>
                    {checked && Array.isArray(cfg.sub) && (
                      <div className="flex gap-4 flex-wrap mt-2 ml-6">
                        {cfg.sub.map((txt, i) => {
                          const rid = `${id}-sub-${i}`;
                          return (
                            <label key={rid} htmlFor={rid} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                              <input
                                id={rid}
                                type="radio"
                                name={`${id}-sub`}
                                checked={packagingSubs[cfg.key] === i}
                                onChange={() => setPackagingSub(cfg.key, i)}
                                disabled={disabled}
                                className="accent-blue-600"
                              />
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

          <fieldset className="border border-slate-200 rounded-lg p-3 mb-4 bg-slate-50">
            <legend className="px-2 font-bold text-slate-700">Damage &amp; Markings</legend>
            {filterAllowed(pkgLabels.damage || []).map((cfg) => {
              const id = `pkg-${cfg.key}`;
              const checked = !!packagingChecks[cfg.key];
              const disabled = sealed && mediaType !== "vinyl" && cfg.key !== "creases";
              return (
                <div key={cfg.key} className={`border border-transparent rounded-lg p-2 transition-colors ${checked ? "bg-white border-slate-200 shadow-sm" : ""}`}>
                  <label htmlFor={id} className={`flex items-center gap-2 cursor-pointer select-none text-sm font-medium ${disabled ? 'opacity-50 cursor-not-allowed' : 'text-slate-800'}`}>
                    <input
                      id={id}
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePackaging(cfg.key)}
                      disabled={disabled}
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                    <span>{cfg.label}</span>
                  </label>
                  {checked && Array.isArray(cfg.sub) && (
                    <div className="flex gap-4 flex-wrap mt-2 ml-6">
                      {cfg.sub.map((txt, i) => {
                        const rid = `${id}-sub-${i}`;
                        return (
                          <label key={rid} htmlFor={rid} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                            <input
                              id={rid}
                              type="radio"
                              name={`${id}-sub`}
                              checked={packagingSubs[cfg.key] === i}
                              onChange={() => setPackagingSub(cfg.key, i)}
                              disabled={disabled}
                              className="accent-blue-600"
                            />
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

          {mediaType === "vinyl" && pkgLabels.appearance && (
            <fieldset className="border border-slate-200 rounded-lg p-3 mb-4 bg-slate-50">
              <legend className="px-2 font-bold text-slate-700">{pkgLabels.appearance.label}</legend>
              <div className="flex gap-4 flex-wrap mt-2">
                {pkgLabels.appearance.options.map((opt) => {
                  const id = `pkg-appearance-${opt.key}`;
                  return (
                    <label key={id} htmlFor={id} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                      <input
                        id={id}
                        type="radio"
                        name="pkg-appearance"
                        checked={packagingAppearance === opt.key}
                        onChange={() => setPackagingAppearance(opt.key)}
                        className="accent-purple-600"
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2 italic">
                This adjusts the <strong>sleeve/cover</strong> score slightly (±2) <em>only</em> when it’s on the cusp of a grade boundary.
              </p>
            </fieldset>
          )}

          {!isSealedVinyl && (
            <fieldset className="border border-slate-200 rounded-lg p-3 mb-4 bg-slate-50">
              <legend className="px-2 font-bold text-slate-700">Additional notes (don’t affect score)</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {pkgLabels.notes?.map((n) => (
                  <label key={n.key} htmlFor={`note-${n.key}`} className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
                    <input
                      id={`note-${n.key}`}
                      type="checkbox"
                      checked={!!additionalNotes[n.key]}
                      onChange={() => toggleNote(n.key)}
                      className="w-4 h-4 accent-indigo-600 rounded"
                    />
                    <span>{n.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </>
      )}
    </section>
  );

  const getGradeColorClass = (grade: string) => {
    switch(grade) {
      case 'M': return 'text-emerald-600';
      case 'NM': return 'text-green-600';
      case 'VG+': return 'text-blue-600';
      case 'VG': return 'text-sky-500';
      case 'G+': return 'text-amber-600';
      case 'G': return 'text-orange-600';
      default: return 'text-red-600';
    }
  };

  return (
    <main className="bg-slate-50 min-h-screen p-4 pb-24 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto">
        <Link className="inline-block mb-4 text-slate-600 hover:text-slate-900 hover:underline font-medium" href="/admin">← Back to Dashboard</Link>
        {Header}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              {mediaType === "vinyl" ? "🎶 Vinyl Record" : mediaType === "cassette" ? "📼 Cassette" : "💿 Compact Disc"}{" "}
              Condition Assessment
            </h2>

            {items.map((item, i) => (
              <MediaItemCard key={i} item={item} index={i} />
            ))}

            <div className="mt-4">
              <button 
                type="button" 
                className="bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-bold shadow-sm transition-colors" 
                onClick={addAnotherItem} 
                disabled={items.length >= MAX_ITEMS}
              >
                Add Another {labels.itemWord}
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              {mediaType === "vinyl" ? "📦 Jacket & Packaging" : mediaType === "cassette" ? "📦 J-Card & Packaging" : "📦 Insert/Booklet & Packaging"}{" "}
              Condition Assessment
            </h2>
            {PackagingPanel}
          </div>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mt-8">
          <h3 className="text-lg font-bold text-slate-800 mb-3">📝 Custom Condition Notes</h3>
          <textarea
            rows={4}
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            aria-label="Custom condition notes"
            className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-md">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">
              {mediaType === "vinyl" ? "Record Grade" : mediaType === "cassette" ? "Tape Grade" : "Disc Grade"}
            </div>
            <div className={`text-5xl font-black ${getGradeColorClass(overall.mediaGrade)}`}>{overall.mediaGrade}</div>
            <div className="text-sm text-slate-400 mt-1 font-mono">{Math.round(overall.mediaScore)}/100</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-md">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">Sleeve/Packaging Grade</div>
            <div className={`text-5xl font-black ${getGradeColorClass(overall.pkgGrade)}`}>{overall.pkgGrade}</div>
            <div className="text-sm text-slate-400 mt-1 font-mono">{Math.round(overall.pkgScore)}/100</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-md ring-2 ring-blue-500/20">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">Overall Grade</div>
            <div className={`text-5xl font-black ${getGradeColorClass(overall.overallGrade)}`}>{overall.overallGrade}</div>
            <div className="text-sm text-slate-400 mt-1 font-mono">{Math.round(overall.overallScore)}/100</div>
          </div>
        </section>

        <section className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-8">
          <h3 className="text-lg font-bold text-blue-900 mb-2">Grading Explanation</h3>
          <p className="text-blue-800 leading-relaxed">{overall.explanation}</p>
          {customNotes.trim() && (
            <>
              <h4 className="text-sm font-bold text-blue-900 mt-4 mb-1 uppercase tracking-wide">Additional Notes</h4>
              <p className="text-blue-800 italic">{customNotes}</p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}