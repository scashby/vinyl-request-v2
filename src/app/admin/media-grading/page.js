"use client";

import { useState, useMemo } from "react";
import "styles/media-grading.css";

/**
 * Systematic Media Grading Tool (App Router - Client Component, JS only)
 * - Media types: vinyl, cassette, cd
 * - Grades: M, NM, VG+, VG, G+, G, F/P  (M only when sealed & flawless)
 * - Scoring:
 *    - Each disc/tape/record starts at 100, deduct penalties; clamp [0,100].
 *    - MediaScore = average of item scores (missing item = 0).
 *    - PackagingScore = scored from 100; missing packaging = 0.
 *    - Overall:
 *        normal: (MediaScore + PackagingScore) / 2
 *        if media OR packaging is missing: (MediaScore + PackagingScore) / 4
 * - Sealed mode:
 *    * Vinyl: media shows only “Warping present” (with severity). Packaging shows exterior wear only.
 *    * Cassettes/CDs: media is assumed Mint (100) and hidden; packaging shows exterior wear only.
 * - Vinyl sides:
 *    * Audio defects render per-side toggles (A/B, then C/D, E/F… per item index) + per-side track counts.
 *    * Visual (scuffs/scratches/groove wear) have side toggles; warping is whole-disc.
 * - Additional notes never affect score.
 */

/** Grade thresholds (non-sealed NM ceiling; M allowed only if sealed & flawless) */
const GRADE_THRESHOLDS = [
  { band: "NM", min: 97, max: 100 },
  { band: "VG+", min: 85, max: 96 },
  { band: "VG", min: 75, max: 84 },
  { band: "G+", min: 65, max: 74 },
  { band: "G", min: 50, max: 64 },
  { band: "F/P", min: 0, max: 49 },
];

/** Utility */
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Map numeric score to one of the 8 grades (M only if sealed & flawlessAllowed) */
function toGrade(score, opts) {
  const { sealed, flawlessAllowed } = opts || {};
  if (sealed && flawlessAllowed && Math.round(score) === 100) return "M";
  for (const t of GRADE_THRESHOLDS) {
    if (score >= t.min && score <= t.max) return t.band;
  }
  return "F/P";
}

/** Presentation helpers */
const MEDIA_TYPES = {
  vinyl: { key: "vinyl", label: "Vinyl Records", short: "Record", icon: "🎵" },
  cassette: { key: "cassette", label: "Cassette Tapes", short: "Tape", icon: "📼" },
  cd: { key: "cd", label: "Compact Discs", short: "Disc", icon: "💿" },
};

function sidesForIndex(idx) {
  // 0 -> A/B, 1 -> C/D, 2 -> E/F, ...
  const start = idx * 2;
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const a = letters[start] || "A";
  const b = letters[start + 1] || "B";
  return [a, b];
}

/** Default penalties (base; some have severities below) */
const PENALTIES = {
  // media (vinyl/cassette/cd)
  lightScuffs: -3,
  scratches: -8,
  grooveWear: -12,
  warping: { slight: -4, moderate: -10, severe: -18 },
  surfaceNoise: -6,
  popsClicks: -4,
  skipping: -30,
  labelDefect: -3, // spindle marks / writing / stickers on label/hub/shell

  // cassette specifics
  padMissingOrDegraded: -20,
  tapeWrinkled: -10,
  unevenPack: -6,
  rollerWear: -6,
  hissDropouts: -6,
  wowFlutter: -8,
  channelLoss: -15,

  // cd specifics
  laserRot: -12,
  discWobble: -10,
  hubCrack: -8,

  // per-track penalty (vinyl audio only, per selected audio defect)
  perTrack: -1,

  // packaging
  minorShelfWear: -3,
  cornerWear: { slight: -2, moderate: -4, heavy: -6 },
  ringWear: { light: -3, visible: -5, strong: -7 },
  spineWear: { slight: -2, moderate: -3, heavy: -5 },
  seamSplit: { small: -6, medium: -12, large: -18 },
  tears: { small: -4, medium: -8, large: -14 },
  writing: -4,
  stickersTape: -3,
  creases: { light: -3, pronounced: -6, crushing: -10 },

  sealedBonus: +5, // cap at 100
};

/** Additional notes per media type (non-scoring) */
const NOTES = {
  vinyl: [
    "Original shrinkwrap (opened)",
    "Promotional copy",
    "Hype sticker present",
    "Price sticker/tag",
    "Gatefold sleeve",
    "Original inner sleeve",
    "Generic/company sleeve",
    "Cut-out hole/notch/corner cut",
    "First pressing",
  ],
  cassette: [
    "Standard Norelco case cracked (replaceable)",
    "Stickered case",
    "Custom/collectible case",
    "Original shrinkwrap (opened)",
    "OBI present",
    "Promotional copy",
    "Shell color variant",
    "Limited edition",
  ],
  cd: [
    "Standard jewel case cracked (replaceable)",
    "Tray teeth broken (replaceable)",
    "Custom case / box / digipak",
    "OBI present",
    "Promotional copy",
    "Slipcase included",
    "Special/limited edition",
  ],
};

/** Initial media item factories */
function makeVinylItem(index) {
  const [sideA, sideB] = sidesForIndex(index);
  return {
    missing: false,
    visual: {
      glossy: false,
      scuffs: { checked: false, sides: { [sideA]: false, [sideB]: false } },
      scratches: { checked: false, sides: { [sideA]: false, [sideB]: false } },
      grooveWear: { checked: false, sides: { [sideA]: false, [sideB]: false } },
      warping: { checked: false, severity: "moderate" },
    },
    audio: {
      playsClean: false,
      surfaceNoise: {
        checked: false,
        sides: { [sideA]: false, [sideB]: false },
        tracks: { [sideA]: 0, [sideB]: 0 },
      },
      popsClicks: {
        checked: false,
        sides: { [sideA]: false, [sideB]: false },
        tracks: { [sideA]: 0, [sideB]: 0 },
      },
      skipping: {
        checked: false,
        sides: { [sideA]: false, [sideB]: false },
        tracks: { [sideA]: 0, [sideB]: 0 },
      },
    },
    label: {
      clean: false,
      spindle: false,
      writing: false,
      stickers: false,
    },
  };
}

function makeCassetteItem() {
  return {
    missing: false,
    shell: {
      clean: false,
      writing: false,
      stickers: false,
      padMissing: false, // missing or degraded
    },
    mechanics: {
      wrinkled: false,
      unevenPack: false,
      rollerWear: false,
    },
    audio: {
      playsClean: false,
      hissDropouts: false,
      wowFlutter: false,
      channelLoss: false,
    },
  };
}

function makeCDItem() {
  return {
    missing: false,
    visual: {
      scuffs: false,
      scratches: false,
      laserRot: false,
      wobble: false,
    },
    audio: {
      playsClean: false,
      errorsCorrected: false,
      unreadable: false,
    },
    hubFace: {
      clean: false,
      writing: false,
      stickers: false,
      hubCrack: false,
    },
  };
}

/** Packaging state per media type */
function makePackagingState(type) {
  if (type === "vinyl") {
    return {
      missing: false,
      overall: { looksNew: false, minorShelf: false, cornerWear: null, ringWear: null },
      seams: { allIntact: false, seamSplit: null, spineWear: null },
      damage: { creases: null, tears: null, writing: false, stickers: false },
      notes: {},
    };
  }
  if (type === "cassette") {
    return {
      missing: false,
      overall: { looksNew: false, minorShelf: false, cornerWear: null },
      jcard: { allIntact: false, jcardTears: null },
      damage: { creases: null, writing: false, stickers: false },
      notes: {},
    };
  }
  // cd
  return {
    missing: false,
    overall: { looksNew: false, minorShelf: false, cornerWear: null, bookletRing: null },
    insertTray: { insertIntact: true }, // structure of printed contents, not the replaceable case
    damage: { creases: null, tears: null, writing: false, stickers: false },
    notes: {},
  };
}

/** Compute media score for ONE item */
function scoreMediaItem(item, type, sealed) {
  let score = 100;
  const deductions = [];

  // In sealed mode:
  // - Vinyl: only warping is allowed to be evaluated.
  // - Cassette/CD: media is Mint and hidden (100, no deductions).
  if (sealed) {
    if (type === "vinyl") {
      if (item.missing) {
        score = 0;
        deductions.push({ label: "Record missing (auto P)", points: 100 });
        return { score: 0, deductions };
      }
      if (item.visual?.warping?.checked) {
        const sev = item.visual.warping.severity || "moderate";
        const pts = Math.abs(PENALTIES.warping[sev] || 0);
        score = clamp(score + PENALTIES.warping[sev]);
        deductions.push({ label: `Warping present (${sev})`, points: pts });
      }
      return { score, deductions };
    }
    // cassette/cd sealed => 100, unless item marked missing
    if (item.missing) {
      return { score: 0, deductions: [{ label: "Media missing (auto P)", points: 100 }] };
    }
    return { score: 100, deductions: [] };
  }

  if (item.missing) {
    return { score: 0, deductions: [{ label: "Media missing (auto P)", points: 100 }] };
  }

  if (type === "vinyl") {
    // Visual (except glossy which is a positive descriptor)
    if (item.visual?.scuffs?.checked) {
      score = clamp(score + PENALTIES.lightScuffs);
      deductions.push({ label: "Light scuffs visible", points: Math.abs(PENALTIES.lightScuffs) });
    }
    if (item.visual?.scratches?.checked) {
      score = clamp(score + PENALTIES.scratches);
      deductions.push({ label: "Scratches present", points: Math.abs(PENALTIES.scratches) });
    }
    if (item.visual?.grooveWear?.checked) {
      score = clamp(score + PENALTIES.grooveWear);
      deductions.push({ label: "Groove wear visible", points: Math.abs(PENALTIES.grooveWear) });
    }
    if (item.visual?.warping?.checked) {
      const sev = item.visual.warping.severity || "moderate";
      score = clamp(score + PENALTIES.warping[sev]);
      deductions.push({ label: `Warping present (${sev})`, points: Math.abs(PENALTIES.warping[sev]) });
    }

    // Audio
    const audio = item.audio || {};
    const trackHit = (tracksObj, sidesObj) => {
      let t = 0;
      Object.keys(tracksObj || {}).forEach((s) => {
        if (sidesObj?.[s]) t += Number(tracksObj[s] || 0);
      });
      return t;
    };

    if (audio.surfaceNoise?.checked) {
      score = clamp(score + PENALTIES.surfaceNoise);
      deductions.push({ label: "Surface noise when played", points: Math.abs(PENALTIES.surfaceNoise) });
      const t = trackHit(audio.surfaceNoise.tracks, audio.surfaceNoise.sides);
      if (t > 0) {
        const pts = Math.abs(PENALTIES.perTrack) * t;
        score = clamp(score + PENALTIES.perTrack * t);
        deductions.push({ label: `Per-track penalty (surface noise) ×${t}`, points: pts });
      }
    }
    if (audio.popsClicks?.checked) {
      score = clamp(score + PENALTIES.popsClicks);
      deductions.push({ label: "Occasional pops or clicks", points: Math.abs(PENALTIES.popsClicks) });
      const t = trackHit(audio.popsClicks.tracks, audio.popsClicks.sides);
      if (t > 0) {
        const pts = Math.abs(PENALTIES.perTrack) * t;
        score = clamp(score + PENALTIES.perTrack * t);
        deductions.push({ label: `Per-track penalty (pops/clicks) ×${t}`, points: pts });
      }
    }
    if (audio.skipping?.checked) {
      score = clamp(score + PENALTIES.skipping);
      deductions.push({ label: "Skipping or repeating", points: Math.abs(PENALTIES.skipping) });
      const t = trackHit(audio.skipping.tracks, audio.skipping.sides);
      if (t > 0) {
        const pts = Math.abs(PENALTIES.perTrack) * t;
        score = clamp(score + PENALTIES.perTrack * t);
        deductions.push({ label: `Per-track penalty (skipping) ×${t}`, points: pts });
      }
    }

    // Label/Center
    if (item.label?.spindle) {
      score = clamp(score + PENALTIES.labelDefect);
      deductions.push({ label: "Spindle marks present", points: Math.abs(PENALTIES.labelDefect) });
    }
    if (item.label?.writing) {
      score = clamp(score + PENALTIES.labelDefect);
      deductions.push({ label: "Writing on label", points: Math.abs(PENALTIES.labelDefect) });
    }
    if (item.label?.stickers) {
      score = clamp(score + PENALTIES.labelDefect);
      deductions.push({ label: "Stickers or tape on label", points: Math.abs(PENALTIES.labelDefect) });
    }

    return { score, deductions };
  }

  if (type === "cassette") {
    if (item.shell?.padMissing) {
      score = clamp(score + PENALTIES.padMissingOrDegraded);
      deductions.push({ label: "Pressure pad missing/degraded", points: Math.abs(PENALTIES.padMissingOrDegraded) });
    }
    if (item.mechanics?.wrinkled) {
      score = clamp(score + PENALTIES.tapeWrinkled);
      deductions.push({ label: "Tape wrinkled/stretched", points: Math.abs(PENALTIES.tapeWrinkled) });
    }
    if (item.mechanics?.unevenPack) {
      score = clamp(score + PENALTIES.unevenPack);
      deductions.push({ label: "Uneven tape pack", points: Math.abs(PENALTIES.unevenPack) });
    }
    if (item.mechanics?.rollerWear) {
      score = clamp(score + PENALTIES.rollerWear);
      deductions.push({ label: "Roller/capstan wear", points: Math.abs(PENALTIES.rollerWear) });
    }
    if (item.audio?.hissDropouts) {
      score = clamp(score + PENALTIES.hissDropouts);
      deductions.push({ label: "Hiss/dropouts", points: Math.abs(PENALTIES.hissDropouts) });
    }
    if (item.audio?.wowFlutter) {
      score = clamp(score + PENALTIES.wowFlutter);
      deductions.push({ label: "Wow/flutter audible", points: Math.abs(PENALTIES.wowFlutter) });
    }
    if (item.audio?.channelLoss) {
      score = clamp(score + PENALTIES.channelLoss);
      deductions.push({ label: "Channel loss/drop", points: Math.abs(PENALTIES.channelLoss) });
    }
    return { score, deductions };
  }

  // cd
  if (item.visual?.scuffs) {
    score = clamp(score + PENALTIES.lightScuffs);
    deductions.push({ label: "Light scuffs visible", points: Math.abs(PENALTIES.lightScuffs) });
  }
  if (item.visual?.scratches) {
    score = clamp(score + PENALTIES.scratches);
    deductions.push({ label: "Scratches present", points: Math.abs(PENALTIES.scratches) });
  }
  if (item.visual?.laserRot) {
    score = clamp(score + PENALTIES.laserRot);
    deductions.push({ label: "Laser-rot/pinholes visible", points: Math.abs(PENALTIES.laserRot) });
  }
  if (item.visual?.wobble) {
    score = clamp(score + PENALTIES.discWobble);
    deductions.push({ label: "Disc wobble present", points: Math.abs(PENALTIES.discWobble) });
  }
  if (item.audio?.errorsCorrected) {
    score = clamp(score + PENALTIES.popsClicks); // treat like corrected read errors
    deductions.push({ label: "Occasional read errors corrected", points: Math.abs(PENALTIES.popsClicks) });
  }
  if (item.audio?.unreadable) {
    score = clamp(score + PENALTIES.skipping);
    deductions.push({ label: "Unreadable sectors / skipping", points: Math.abs(PENALTIES.skipping) });
  }
  if (item.hubFace?.writing) {
    score = clamp(score + PENALTIES.labelDefect);
    deductions.push({ label: "Writing on disc face", points: Math.abs(PENALTIES.labelDefect) });
  }
  if (item.hubFace?.stickers) {
    score = clamp(score + PENALTIES.labelDefect);
    deductions.push({ label: "Stickers or tape on disc face", points: Math.abs(PENALTIES.labelDefect) });
  }
  if (item.hubFace?.hubCrack) {
    score = clamp(score + PENALTIES.hubCrack);
    deductions.push({ label: "Hub crack", points: Math.abs(PENALTIES.hubCrack) });
  }
  return { score, deductions };
}

/** Compute packaging score */
function scorePackaging(state, type, sealed) {
  if (!state) return { score: 100, deductions: [] };
  if (state.missing) {
    return { score: 0, deductions: [{ label: "Packaging missing (auto P)", points: 100 }] };
  }
  let score = 100;
  const deds = [];
  const add = (label, pts) => {
    score = clamp(score + pts);
    deds.push({ label, points: Math.abs(pts) });
  };

  // Sealed bonus (allowed across types). UI prevents disallowed fields when sealed.
  if (sealed) score = clamp(score + PENALTIES.sealedBonus);

  // VINYL
  if (type === "vinyl") {
    const { overall, seams, damage } = state;

    if (overall?.minorShelf) add("Minor shelf wear", PENALTIES.minorShelfWear);
    if (overall?.cornerWear)
      add(`Corner wear (${overall.cornerWear})`, PENALTIES.cornerWear[overall.cornerWear]);
    if (overall?.ringWear)
      add(`Ring wear (${overall.ringWear})`, PENALTIES.ringWear[overall.ringWear]);

    if (!sealed) {
      if (seams?.seamSplit)
        add(`Seam splits (${seams.seamSplit})`, PENALTIES.seamSplit[seams.seamSplit]);
      if (seams?.spineWear)
        add(`Spine shows wear (${seams.spineWear})`, PENALTIES.spineWear[seams.spineWear]);
    }

    if (damage?.creases)
      add(`Creases/crushing (${damage.creases})`, PENALTIES.creases[damage.creases]);

    if (!sealed) {
      if (damage?.tears) add(`Tears present (${damage.tears})`, PENALTIES.tears[damage.tears]);
      if (damage?.writing) add("Writing present", PENALTIES.writing);
      if (damage?.stickers) add("Stickers or tape", PENALTIES.stickersTape);
    }

    return { score, deductions: deds };
  }

  // CASSETTE (J-card only; cases are replaceable -> handled as notes)
  if (type === "cassette") {
    const { overall, jcard, damage } = state;

    if (overall?.minorShelf) add("Minor shelf wear", PENALTIES.minorShelfWear);
    if (overall?.cornerWear)
      add(`Corner wear (${overall.cornerWear})`, PENALTIES.cornerWear[overall.cornerWear]);

    if (!sealed) {
      if (jcard?.jcardTears)
        add(`J-card tears (${jcard.jcardTears})`, PENALTIES.tears[jcard.jcardTears]);
    }

    if (damage?.creases)
      add(`J-card creases/crushing (${damage.creases})`, PENALTIES.creases[damage.creases]);

    if (!sealed) {
      if (damage?.writing) add("Writing present", PENALTIES.writing);
      if (damage?.stickers) add("Stickers or tape", PENALTIES.stickersTape);
    }

    return { score, deductions: deds };
  }

  // CD (inlay/booklet/digipak only; jewel cases are replaceable -> notes)
  const { overall, insertTray, damage } = state;

  if (overall?.minorShelf) add("Minor shelf wear", PENALTIES.minorShelfWear);
  if (overall?.cornerWear)
    add(`Corner wear (${overall.cornerWear})`, PENALTIES.cornerWear[overall.cornerWear]);
  if (overall?.bookletRing)
    add(`Booklet ring wear (${overall.bookletRing})`, PENALTIES.ringWear[overall.bookletRing] || -5);

  if (!sealed && insertTray && insertTray.insertIntact === false) {
    add("Insert/tray damage", PENALTIES.seamSplit.medium);
  }

  if (damage?.creases)
    add(`Creases/crushing (${damage.creases})`, PENALTIES.creases[damage.creases]);

  if (!sealed) {
    if (damage?.tears) add(`Tears present (${damage.tears})`, PENALTIES.tears[damage.tears]);
    if (damage?.writing) add("Writing present", PENALTIES.writing);
    if (damage?.stickers) add("Stickers or tape", PENALTIES.stickersTape);
  }

  return { score, deductions: deds };
}

/** Explain: top 3 deductions per side (media vs packaging) */
function buildExplanation(mediaDeds, packDeds, overallText, itemSummaries) {
  const top3 = (arr) => arr.slice().sort((a, b) => b.points - a.points).slice(0, 3);
  const mediaTop = top3(mediaDeds);
  const packTop = top3(packDeds);
  const bullet = (d) => `• ${d.label} (−${d.points})`;

  return [
    "Grading Explanation:",
    mediaTop.length
      ? `Media (top factors):\n${mediaTop.map(bullet).join("\n")}`
      : "Media: No deductions.",
    packTop.length
      ? `Packaging (top factors):\n${packTop.map(bullet).join("\n")}`
      : "Packaging: No deductions.",
    overallText,
    itemSummaries && itemSummaries.length ? itemSummaries.join(" ") : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default function MediaGradingPage() {
  const [mediaType, setMediaType] = useState("vinyl"); // 'vinyl' | 'cassette' | 'cd'
  const [sealed, setSealed] = useState(false);

  // Media items
  const [records, setRecords] = useState([makeVinylItem(0)]);
  const [tapes, setTapes] = useState([makeCassetteItem()]);
  const [discs, setDiscs] = useState([makeCDItem()]);

  // Packaging
  const [packVinyl, setPackVinyl] = useState(makePackagingState("vinyl"));
  const [packCassette, setPackCassette] = useState(makePackagingState("cassette"));
  const [packCD, setPackCD] = useState(makePackagingState("cd"));

  // Notes
  const [notes, setNotes] = useState("");

  const items = mediaType === "vinyl" ? records : mediaType === "cassette" ? tapes : discs;
  const setItems = mediaType === "vinyl" ? setRecords : mediaType === "cassette" ? setTapes : setDiscs;
  const packaging = mediaType === "vinyl" ? packVinyl : mediaType === "cassette" ? packCassette : packCD;
  const setPackaging = mediaType === "vinyl" ? setPackVinyl : mediaType === "cassette" ? setPackCassette : setPackCD;

  /** Add / remove media item */
  const addItem = () => {
    if (mediaType === "vinyl") {
      setRecords((prev) => [...prev, makeVinylItem(prev.length)]);
    } else if (mediaType === "cassette") {
      setTapes((prev) => [...prev, makeCassetteItem()]);
    } else {
      setDiscs((prev) => [...prev, makeCDItem()]);
    }
  };
  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  /** Compute media, packaging, overall */
  const computed = useMemo(() => {
    // Media
    const itemScores = items.map((it) => scoreMediaItem(it, mediaType, sealed));
    const mediaDeds = itemScores.flatMap((r) => r.deductions);
    const mediaScore =
      items.length > 0
        ? itemScores.reduce((acc, r) => acc + clamp(r.score), 0) / items.length
        : 0;

    // Packaging
    const pack = scorePackaging(packaging, mediaType, sealed);
    const packScore = clamp(pack.score);
    const packDeds = pack.deductions;

    // Missing logic for overall divider
    const mediaMissingAll = items.length === 0 || items.every((i) => i.missing);
    const packagingMissing = packaging?.missing === true;

    const divider = mediaMissingAll || packagingMissing ? 4 : 2;
    const overallScore = (mediaScore + (packagingMissing ? 0 : packScore)) / divider;

    // Grade mapping (M only when sealed & flawless in allowed sealed scope)
    const flawlessAllowed = sealed; // sealed gating
    const mediaGrade = toGrade(mediaScore, { sealed, flawlessAllowed });
    const packagingGrade = toGrade(packScore, { sealed, flawlessAllowed });
    const overallGrade = toGrade(overallScore, { sealed, flawlessAllowed });

    // Item badges
    const itemBadges = itemScores.map((r, i) => {
      const grade = toGrade(r.score, { sealed, flawlessAllowed });
      return `Item #${i + 1}: ${grade} (${Math.round(r.score)}/100)`;
    });

    const overallWhy =
      divider === 2
        ? `Overall is the average of Media (${Math.round(mediaScore)}) and Packaging (${Math.round(
            packScore
          )}).`
        : `Overall is penalized for a missing component: (Media ${Math.round(
            mediaScore
          )} + Packaging ${packagingMissing ? 0 : Math.round(packScore)}) ÷ 4.`;

    const explanation = buildExplanation(mediaDeds, packDeds, overallWhy, itemBadges);

    return {
      mediaScore,
      mediaGrade,
      packScore,
      packagingGrade,
      overallScore,
      overallGrade,
      explanation,
    };
  }, [items, mediaType, sealed, packaging]);

  /** UI helpers */
  const pill = (key, label, icon) => (
    <button
      key={key}
      className={`mg-pill ${mediaType === key ? "selected" : ""}`}
      type="button"
      onClick={() => {
        setMediaType(key);
      }}
      aria-pressed={mediaType === key}
    >
      <span className="mg-pill-emoji">{icon}</span> {label}
    </button>
  );

  const GradeCard = ({ title, score, grade }) => (
    <div className={`mg-result-card grade-${grade.replace("/", "").replace("+", "p")}`}>
      <div className="mg-result-title">{title}</div>
      <div className="mg-result-grade">{grade}</div>
      <div className="mg-result-score">{Math.round(score)}/100</div>
    </div>
  );

  /** Header + Sealed strip */
  const renderHeader = () => (
    <div className="mg-header">
      <div className="mg-title">Systematic Media Grading Tool</div>
      <div className="mg-subtitle">Detailed condition assessment with automatic grading calculation</div>
      <div className="mg-pill-row">
        {pill("vinyl", MEDIA_TYPES.vinyl.label, MEDIA_TYPES.vinyl.icon)}
        {pill("cassette", MEDIA_TYPES.cassette.label, MEDIA_TYPES.cassette.icon)}
        {pill("cd", MEDIA_TYPES.cd.label, MEDIA_TYPES.cd.icon)}
      </div>

      <div className="mg-sealed">
        <label className="mg-check">
          <input type="checkbox" checked={sealed} onChange={(e) => setSealed(e.target.checked)} />
          <span>Sealed (factory shrink intact)</span>
        </label>
        <div className="mg-help tight">
          {mediaType === "vinyl" ? (
            <>
              When Sealed is on: Vinyl allows evaluating only <em>Warping present</em> for media, and packaging
              exterior wear (<em>Minor shelf wear</em>, <em>Corner wear</em>, <em>Ring wear</em>, <em>Creases/crushing</em>).
              Packaging gets a +5 bonus (capped at 100). Mint (M) is allowed <em>only</em> when sealed and flawless.
            </>
          ) : (
            <>
              When Sealed is on: Cassettes/CDs default to <strong>Mint</strong> for media unless missing. Packaging may
              only show exterior wear (<em>Minor shelf wear</em>, <em>Corner wear</em>{mediaType === "cd" ? ", <em>Booklet ring wear</em>" : ""}, <em>Creases/crushing</em>).
              Packaging gets a +5 bonus (capped at 100). Mint (M) is allowed <em>only</em> when sealed and flawless.
            </>
          )}
        </div>
      </div>
    </div>
  );

  /** Render blocks per media type */
  const renderVinylItem = (it, idx) => {
    const [sideA, sideB] = sidesForIndex(idx);
    return (
      <div key={idx} className="mg-panel">
        <div className="mg-panel-row between">
          <div className="mg-subtle">Record #{idx + 1}</div>
          <div className="mg-inline-actions">
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.missing}
                onChange={(e) =>
                  setRecords((prev) => {
                    const clone = [...prev];
                    clone[idx] = { ...clone[idx], missing: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Mark this media as Missing (auto P)</span>
            </label>
            <button className="mg-danger sm" type="button" onClick={() => removeItem(idx)}>
              Remove Record
            </button>
          </div>
        </div>

        {/* Visual */}
        <fieldset className="mg-fieldset">
          <legend>Visual Appearance</legend>

          {!sealed && (
            <>
              <label className="mg-check">
                <input
                  type="checkbox"
                  checked={it.visual.glossy}
                  onChange={(e) =>
                    setRecords((prev) => {
                      const clone = [...prev];
                      clone[idx] = {
                        ...clone[idx],
                        visual: { ...clone[idx].visual, glossy: e.target.checked },
                      };
                      return clone;
                    })
                  }
                />
                <span>Record has glossy, like-new appearance</span>
              </label>

              {["scuffs", "scratches", "grooveWear"].map((k) => (
                <div key={k} className="mg-check-with-sides">
                  <label className="mg-check">
                    <input
                      type="checkbox"
                      checked={it.visual[k].checked}
                      onChange={(e) =>
                        setRecords((prev) => {
                          const clone = [...prev];
                          clone[idx] = {
                            ...clone[idx],
                            visual: {
                              ...clone[idx].visual,
                              [k]: { ...clone[idx].visual[k], checked: e.target.checked },
                            },
                          };
                          return clone;
                        })
                      }
                    />
                    <span>
                      {k === "scuffs"
                        ? "Light scuffs visible"
                        : k === "scratches"
                        ? "Scratches present"
                        : "Groove wear visible"}
                    </span>
                  </label>
                  {it.visual[k].checked && (
                    <div className="mg-sides">
                      <label className="mg-check sm">
                        <input
                          type="checkbox"
                          checked={it.visual[k].sides[sideA]}
                          onChange={(e) =>
                            setRecords((prev) => {
                              const clone = [...prev];
                              const obj = { ...clone[idx].visual[k] };
                              obj.sides = { ...obj.sides, [sideA]: e.target.checked };
                              clone[idx].visual[k] = obj;
                              return clone;
                            })
                          }
                        />
                        <span>Side {sideA}</span>
                      </label>
                      <label className="mg-check sm">
                        <input
                          type="checkbox"
                          checked={it.visual[k].sides[sideB]}
                          onChange={(e) =>
                            setRecords((prev) => {
                              const clone = [...prev];
                              const obj = { ...clone[idx].visual[k] };
                              obj.sides = { ...obj.sides, [sideB]: e.target.checked };
                              clone[idx].visual[k] = obj;
                              return clone;
                            })
                          }
                        />
                        <span>Side {sideB}</span>
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Warping visible always (sealed vinyl can judge warps) */}
          <div className="mg-warping">
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.visual.warping.checked}
                onChange={(e) =>
                  setRecords((prev) => {
                    const clone = [...prev];
                    clone[idx] = {
                      ...clone[idx],
                      visual: {
                        ...clone[idx].visual,
                        warping: { ...clone[idx].visual.warping, checked: e.target.checked },
                      },
                    };
                    return clone;
                  })
                }
              />
              <span>Warping present</span>
            </label>
            {it.visual.warping.checked && (
              <div className="mg-radio-row">
                {["slight", "moderate", "severe"].map((sev) => (
                  <label className="mg-radio sm" key={sev}>
                    <input
                      type="radio"
                      name={`warp-${idx}`}
                      checked={it.visual.warping.severity === sev}
                      onChange={() =>
                        setRecords((prev) => {
                          const clone = [...prev];
                          clone[idx].visual.warping = { checked: true, severity: sev };
                          return clone;
                        })
                      }
                    />
                    <span>{sev === "slight" ? "Slight" : sev === "moderate" ? "Moderate" : "Severe"}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </fieldset>

        {/* Audio */}
        {!sealed && (
          <fieldset className="mg-fieldset">
            <legend>Audio Performance</legend>

            {["surfaceNoise", "popsClicks", "skipping"].map((k) => (
              <div key={k} className="mg-audio-block">
                <label className="mg-check">
                  <input
                    type="checkbox"
                    checked={it.audio[k].checked}
                    onChange={(e) =>
                      setRecords((prev) => {
                        const clone = [...prev];
                        clone[idx].audio[k] = { ...clone[idx].audio[k], checked: e.target.checked };
                        return clone;
                      })
                    }
                  />
                  <span>
                    {k === "surfaceNoise"
                      ? "Surface noise when played"
                      : k === "popsClicks"
                      ? "Occasional pops or clicks"
                      : "Skipping or repeating"}
                  </span>
                </label>
                {it.audio[k].checked && (
                  <div className="mg-sides mg-audio-sides">
                    <div className="mg-side-line">
                      <label className="mg-check sm">
                        <input
                          type="checkbox"
                          checked={it.audio[k].sides[sideA]}
                          onChange={(e) =>
                            setRecords((prev) => {
                              const clone = [...prev];
                              const obj = { ...clone[idx].audio[k] };
                              obj.sides = { ...obj.sides, [sideA]: e.target.checked };
                              clone[idx].audio[k] = obj;
                              return clone;
                            })
                          }
                        />
                        <span>Side {sideA}</span>
                      </label>
                      <div className="mg-inline-number">
                        <label htmlFor={`tracks-${k}-${idx}-${sideA}`} className="mg-number-label">
                          Tracks affected (Side {sideA})
                        </label>
                        <input
                          id={`tracks-${k}-${idx}-${sideA}`}
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={it.audio[k].tracks[sideA]}
                          onChange={(e) =>
                            setRecords((prev) => {
                              const clone = [...prev];
                              const obj = { ...clone[idx].audio[k] };
                              obj.tracks = {
                                ...obj.tracks,
                                [sideA]: Math.max(0, Number(e.target.value || 0)),
                              };
                              clone[idx].audio[k] = obj;
                              return clone;
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="mg-side-line">
                      <label className="mg-check sm">
                        <input
                          type="checkbox"
                          checked={it.audio[k].sides[sideB]}
                          onChange={(e) =>
                            setRecords((prev) => {
                              const clone = [...prev];
                              const obj = { ...clone[idx].audio[k] };
                              obj.sides = { ...obj.sides, [sideB]: e.target.checked };
                              clone[idx].audio[k] = obj;
                              return clone;
                            })
                          }
                        />
                        <span>Side {sideB}</span>
                      </label>
                      <div className="mg-inline-number">
                        <label htmlFor={`tracks-${k}-${idx}-${sideB}`} className="mg-number-label">
                          Tracks affected (Side {sideB})
                        </label>
                        <input
                          id={`tracks-${k}-${idx}-${sideB}`}
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={it.audio[k].tracks[sideB]}
                          onChange={(e) =>
                            setRecords((prev) => {
                              const clone = [...prev];
                              const obj = { ...clone[idx].audio[k] };
                              obj.tracks = {
                                ...obj.tracks,
                                [sideB]: Math.max(0, Number(e.target.value || 0)),
                              };
                              clone[idx].audio[k] = obj;
                              return clone;
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="mg-help">Per-track penalty applies only when an audio defect is selected.</div>
                  </div>
                )}
              </div>
            ))}

            <div className="mg-help dim">Select sides and track counts for each audio defect as observed.</div>
          </fieldset>
        )}

        {/* Label / Center */}
        {!sealed && (
          <fieldset className="mg-fieldset">
            <legend>Label / Center</legend>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.label.clean}
                onChange={(e) =>
                  setRecords((prev) => {
                    const clone = [...prev];
                    clone[idx].label = { ...clone[idx].label, clean: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Label is clean and bright</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.label.spindle}
                onChange={(e) =>
                  setRecords((prev) => {
                    const clone = [...prev];
                    clone[idx].label = { ...clone[idx].label, spindle: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Spindle marks present</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.label.writing}
                onChange={(e) =>
                  setRecords((prev) => {
                    const clone = [...prev];
                    clone[idx].label = { ...clone[idx].label, writing: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Writing on label</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.label.stickers}
                onChange={(e) =>
                  setRecords((prev) => {
                    const clone = [...prev];
                    clone[idx].label = { ...clone[idx].label, stickers: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Stickers or tape on label</span>
            </label>
          </fieldset>
        )}
      </div>
    );
  };

  const renderCassetteItem = (it, idx) => (
    <div key={idx} className="mg-panel">
      <div className="mg-panel-row between">
        <div className="mg-subtle">Tape #{idx + 1}</div>
        <div className="mg-inline-actions">
          <label className="mg-check">
            <input
              type="checkbox"
              checked={it.missing}
              onChange={(e) =>
                setTapes((prev) => {
                  const clone = [...prev];
                  clone[idx] = { ...clone[idx], missing: e.target.checked };
                  return clone;
                })
              }
            />
            <span>Mark this media as Missing (auto P)</span>
          </label>
          <button className="mg-danger sm" type="button" onClick={() => removeItem(idx)}>
            Remove Tape
          </button>
        </div>
      </div>

      {/* Shell/Label, Mechanics, Audio — all hidden when sealed */}
      {!sealed && (
        <>
          <fieldset className="mg-fieldset">
            <legend>Shell / Label</legend>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.shell.clean}
                onChange={(e) =>
                  setTapes((prev) => {
                    const clone = [...prev];
                    clone[idx].shell = { ...clone[idx].shell, clean: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Shell/label clean and bright</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.shell.writing}
                onChange={(e) =>
                  setTapes((prev) => {
                    const clone = [...prev];
                    clone[idx].shell = { ...clone[idx].shell, writing: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Writing on shell/label</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.shell.stickers}
                onChange={(e) =>
                  setTapes((prev) => {
                    const clone = [...prev];
                    clone[idx].shell = { ...clone[idx].shell, stickers: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Stickers or tape on shell</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.shell.padMissing}
                onChange={(e) =>
                  setTapes((prev) => {
                    const clone = [...prev];
                    clone[idx].shell = { ...clone[idx].shell, padMissing: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Pressure pad missing or degraded</span>
            </label>
          </fieldset>

          <fieldset className="mg-fieldset">
            <legend>Mechanics</legend>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.mechanics.wrinkled}
                onChange={(e) =>
                  setTapes((prev) => {
                    const clone = [...prev];
                    clone[idx].mechanics = { ...clone[idx].mechanics, wrinkled: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Tape wrinkled or stretched</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.mechanics.unevenPack}
                onChange={(e) =>
                  setTapes((prev) => {
                    const clone = [...prev];
                    clone[idx].mechanics = { ...clone[idx].mechanics, unevenPack: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Uneven tape pack</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.mechanics.rollerWear}
                onChange={(e) =>
                  setTapes((prev) => {
                    const clone = [...prev];
                    clone[idx].mechanics = { ...clone[idx].mechanics, rollerWear: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Roller/capstan wear</span>
            </label>
          </fieldset>

          <fieldset className="mg-fieldset">
            <legend>Audio Performance</legend>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.audio.playsClean}
                onChange={(e) =>
                  setTapes((prev) => {
                    const clone = [...prev];
                    clone[idx].audio = { ...clone[idx].audio, playsClean: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Plays cleanly (no notable issues)</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.audio.hissDropouts}
                onChange={(e) =>
                  setTapes((prev) => {
                    const clone = [...prev];
                    clone[idx].audio = { ...clone[idx].audio, hissDropouts: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Hiss/dropouts</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.audio.wowFlutter}
                onChange={(e) =>
                  setTapes((prev) => {
                    const clone = [...prev];
                    clone[idx].audio = { ...clone[idx].audio, wowFlutter: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Wow/flutter audible</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.audio.channelLoss}
                onChange={(e) =>
                  setTapes((prev) => {
                    const clone = [...prev];
                    clone[idx].audio = { ...clone[idx].audio, channelLoss: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Channel loss / drop</span>
            </label>
          </fieldset>
        </>
      )}
    </div>
  );

  const renderCDItem = (it, idx) => (
    <div key={idx} className="mg-panel">
      <div className="mg-panel-row between">
        <div className="mg-subtle">Disc #{idx + 1}</div>
        <div className="mg-inline-actions">
          <label className="mg-check">
            <input
              type="checkbox"
              checked={it.missing}
              onChange={(e) =>
                setDiscs((prev) => {
                  const clone = [...prev];
                  clone[idx] = { ...clone[idx], missing: e.target.checked };
                  return clone;
                })
              }
            />
            <span>Mark this media as Missing (auto P)</span>
          </label>
          <button className="mg-danger sm" type="button" onClick={() => removeItem(idx)}>
            Remove Disc
          </button>
        </div>
      </div>

      {!sealed && (
        <>
          <fieldset className="mg-fieldset">
            <legend>Visual Appearance</legend>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.visual.scuffs}
                onChange={(e) =>
                  setDiscs((prev) => {
                    const clone = [...prev];
                    clone[idx].visual = { ...clone[idx].visual, scuffs: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Light scuffs visible</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.visual.scratches}
                onChange={(e) =>
                  setDiscs((prev) => {
                    const clone = [...prev];
                    clone[idx].visual = { ...clone[idx].visual, scratches: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Scratches present</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.visual.laserRot}
                onChange={(e) =>
                  setDiscs((prev) => {
                    const clone = [...prev];
                    clone[idx].visual = { ...clone[idx].visual, laserRot: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Laser-rot/pinholes visible</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.visual.wobble}
                onChange={(e) =>
                  setDiscs((prev) => {
                    const clone = [...prev];
                    clone[idx].visual = { ...clone[idx].visual, wobble: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Disc wobble present</span>
            </label>
          </fieldset>

          <fieldset className="mg-fieldset">
            <legend>Audio Performance</legend>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.audio.playsClean}
                onChange={(e) =>
                  setDiscs((prev) => {
                    const clone = [...prev];
                    clone[idx].audio = { ...clone[idx].audio, playsClean: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Plays with no read errors</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.audio.errorsCorrected}
                onChange={(e) =>
                  setDiscs((prev) => {
                    const clone = [...prev];
                    clone[idx].audio = { ...clone[idx].audio, errorsCorrected: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Occasional read errors corrected</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.audio.unreadable}
                onChange={(e) =>
                  setDiscs((prev) => {
                    const clone = [...prev];
                    clone[idx].audio = { ...clone[idx].audio, unreadable: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Unreadable sectors / skipping</span>
            </label>
          </fieldset>

          <fieldset className="mg-fieldset">
            <legend>Hub / Face</legend>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.hubFace.clean}
                onChange={(e) =>
                  setDiscs((prev) => {
                    const clone = [...prev];
                    clone[idx].hubFace = { ...clone[idx].hubFace, clean: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Hub/face clean and bright</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.hubFace.writing}
                onChange={(e) =>
                  setDiscs((prev) => {
                    const clone = [...prev];
                    clone[idx].hubFace = { ...clone[idx].hubFace, writing: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Writing on disc face</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.hubFace.stickers}
                onChange={(e) =>
                  setDiscs((prev) => {
                    const clone = [...prev];
                    clone[idx].hubFace = { ...clone[idx].hubFace, stickers: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Stickers or tape on disc face</span>
            </label>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={it.hubFace.hubCrack}
                onChange={(e) =>
                  setDiscs((prev) => {
                    const clone = [...prev];
                    clone[idx].hubFace = { ...clone[idx].hubFace, hubCrack: e.target.checked };
                    return clone;
                  })
                }
              />
              <span>Hub crack</span>
            </label>
          </fieldset>
        </>
      )}
    </div>
  );

  /** Packaging forms (media-aware) */
  const renderPackaging = () => {
    if (mediaType === "vinyl") {
      const s = packaging;
      return (
        <div className="mg-panel">
          <div className="mg-panel-row between">
            <div className="mg-subtle">Jacket & Packaging Condition Assessment</div>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={s.missing}
                onChange={(e) => setPackaging({ ...s, missing: e.target.checked })}
              />
              <span>Mark packaging as Missing (auto P)</span>
            </label>
          </div>

          {/* Overall Appearance */}
          <fieldset className="mg-fieldset">
            <legend>Overall Appearance</legend>
            {!sealed && (
              <label className="mg-check">
                <input
                  type="checkbox"
                  checked={s.overall.looksNew}
                  onChange={(e) => setPackaging({ ...s, overall: { ...s.overall, looksNew: e.target.checked } })}
                />
                <span>Looks like new, no flaws</span>
              </label>
            )}

            <label className="mg-check">
              <input
                type="checkbox"
                checked={s.overall.minorShelf}
                onChange={(e) => setPackaging({ ...s, overall: { ...s.overall, minorShelf: e.target.checked } })}
              />
              <span>Minor shelf wear only</span>
            </label>

            <div className="mg-subselect">
              <div className="mg-subtle">Corner wear present</div>
              <div className="mg-radio-row wrap">
                {["slight", "moderate", "heavy"].map((lv) => (
                  <label className="mg-radio sm" key={lv}>
                    <input
                      type="radio"
                      name="vn-corner"
                      checked={s.overall.cornerWear === lv}
                      onChange={() => setPackaging({ ...s, overall: { ...s.overall, cornerWear: lv } })}
                    />
                    <span>{lv}</span>
                  </label>
                ))}
                <button
                  type="button"
                  className="mg-link sm"
                  onClick={() => setPackaging({ ...s, overall: { ...s.overall, cornerWear: null } })}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mg-subselect">
              <div className="mg-subtle">Ring wear visible</div>
              <div className="mg-radio-row wrap">
                {["light", "visible", "strong"].map((lv) => (
                  <label className="mg-radio sm" key={lv}>
                    <input
                      type="radio"
                      name="vn-ring"
                      checked={s.overall.ringWear === lv}
                      onChange={() => setPackaging({ ...s, overall: { ...s.overall, ringWear: lv } })}
                    />
                    <span>{lv}</span>
                  </label>
                ))}
                <button
                  type="button"
                  className="mg-link sm"
                  onClick={() => setPackaging({ ...s, overall: { ...s.overall, ringWear: null } })}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mg-help">Sealed adds +5 (cap 100). Mint (M) only when sealed & flawless.</div>
          </fieldset>

          {/* Seams & Structure — hidden when sealed */}
          {!sealed && (
            <fieldset className="mg-fieldset">
              <legend>Seams & Structure</legend>
              <label className="mg-check">
                <input
                  type="checkbox"
                  checked={s.seams.allIntact}
                  onChange={(e) => setPackaging({ ...s, seams: { ...s.seams, allIntact: e.target.checked } })}
                />
                <span>All seams intact</span>
              </label>

              <div className="mg-subselect">
                <div className="mg-subtle">Seam splits present</div>
                <div className="mg-radio-row wrap">
                  {["small", "medium", "large"].map((lv) => (
                    <label className="mg-radio sm" key={lv}>
                      <input
                        type="radio"
                        name="vn-seam"
                        checked={s.seams.seamSplit === lv}
                        onChange={() => setPackaging({ ...s, seams: { ...s.seams, seamSplit: lv } })}
                      />
                      <span>{lv}</span>
                    </label>
                  ))}
                  <button
                    type="button"
                    className="mg-link sm"
                    onClick={() => setPackaging({ ...s, seams: { ...s.seams, seamSplit: null } })}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mg-subselect">
                <div className="mg-subtle">Spine shows wear</div>
                <div className="mg-radio-row wrap">
                  {["slight", "moderate", "heavy"].map((lv) => (
                    <label className="mg-radio sm" key={lv}>
                      <input
                        type="radio"
                        name="vn-spine"
                        checked={s.seams.spineWear === lv}
                        onChange={() => setPackaging({ ...s, seams: { ...s.seams, spineWear: lv } })}
                      />
                      <span>{lv}</span>
                    </label>
                  ))}
                  <button
                    type="button"
                    className="mg-link sm"
                    onClick={() => setPackaging({ ...s, seams: { ...s.seams, spineWear: null } })}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </fieldset>
          )}

          {/* Damage & Markings */}
          <fieldset className="mg-fieldset">
            <legend>Damage & Markings</legend>

            <div className="mg-subselect">
              <div className="mg-subtle">Creases / crushing present</div>
              <div className="mg-radio-row wrap">
                {["light", "pronounced", "crushing"].map((lv) => (
                  <label className="mg-radio sm" key={lv}>
                    <input
                      type="radio"
                      name="vn-crease"
                      checked={s.damage.creases === lv}
                      onChange={() => setPackaging({ ...s, damage: { ...s.damage, creases: lv } })}
                    />
                    <span>{lv}</span>
                  </label>
                ))}
                <button
                  type="button"
                  className="mg-link sm"
                  onClick={() => setPackaging({ ...s, damage: { ...s.damage, creases: null } })}
                >
                  Clear
                </button>
              </div>
            </div>

            {!sealed && (
              <>
                <div className="mg-subselect">
                  <div className="mg-subtle">Tears present</div>
                  <div className="mg-radio-row wrap">
                    {["small", "medium", "large"].map((lv) => (
                      <label className="mg-radio sm" key={lv}>
                        <input
                          type="radio"
                          name="vn-tear"
                          checked={s.damage.tears === lv}
                          onChange={() => setPackaging({ ...s, damage: { ...s.damage, tears: lv } })}
                        />
                        <span>{lv}</span>
                      </label>
                    ))}
                    <button
                      type="button"
                      className="mg-link sm"
                      onClick={() => setPackaging({ ...s, damage: { ...s.damage, tears: null } })}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <label className="mg-check">
                  <input
                    type="checkbox"
                    checked={s.damage.writing}
                    onChange={(e) => setPackaging({ ...s, damage: { ...s.damage, writing: e.target.checked } })}
                  />
                  <span>Writing present</span>
                </label>
                <label className="mg-check">
                  <input
                    type="checkbox"
                    checked={s.damage.stickers}
                    onChange={(e) => setPackaging({ ...s, damage: { ...s.damage, stickers: e.target.checked } })}
                  />
                  <span>Stickers or tape</span>
                </label>
              </>
            )}
          </fieldset>

          {/* Additional notes (vinyl) */}
          <fieldset className="mg-fieldset">
            <legend>Additional notes (don’t affect score)</legend>
            <div className="mg-notes-grid">
              {NOTES.vinyl.map((lbl) => (
                <label className="mg-check sm" key={lbl}>
                  <input
                    type="checkbox"
                    checked={!!s.notes[lbl]}
                    onChange={(e) =>
                      setPackaging({
                        ...s,
                        notes: { ...s.notes, [lbl]: e.target.checked },
                      })
                    }
                  />
                  <span>{lbl}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      );
    }

    if (mediaType === "cassette") {
      const s = packaging;
      return (
        <div className="mg-panel">
          <div className="mg-panel-row between">
            <div className="mg-subtle">J-Card & Packaging Condition Assessment</div>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={s.missing}
                onChange={(e) => setPackaging({ ...s, missing: e.target.checked })}
              />
              <span>Mark packaging as Missing (auto P)</span>
            </label>
          </div>

          <fieldset className="mg-fieldset">
            <legend>Overall Appearance</legend>
            {!sealed && (
              <label className="mg-check">
                <input
                  type="checkbox"
                  checked={s.overall.looksNew}
                  onChange={(e) => setPackaging({ ...s, overall: { ...s.overall, looksNew: e.target.checked } })}
                />
                <span>Looks like new, no flaws</span>
              </label>
            )}
            <label className="mg-check">
              <input
                type="checkbox"
                checked={s.overall.minorShelf}
                onChange={(e) => setPackaging({ ...s, overall: { ...s.overall, minorShelf: e.target.checked } })}
              />
              <span>Minor shelf wear only</span>
            </label>
            <div className="mg-subselect">
              <div className="mg-subtle">Corner wear present</div>
              <div className="mg-radio-row wrap">
                {["slight", "moderate", "heavy"].map((lv) => (
                  <label className="mg-radio sm" key={lv}>
                    <input
                      type="radio"
                      name="tc-corner"
                      checked={s.overall.cornerWear === lv}
                      onChange={() => setPackaging({ ...s, overall: { ...s.overall, cornerWear: lv } })}
                    />
                    <span>{lv}</span>
                  </label>
                ))}
                <button
                  type="button"
                  className="mg-link sm"
                  onClick={() => setPackaging({ ...s, overall: { ...s.overall, cornerWear: null } })}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mg-help">
              Standard plastic cases are <strong>not graded</strong>; evaluate only the J-card. Sealed adds +5 (cap 100).
              M only if sealed & flawless.
            </div>
          </fieldset>

          {/* J-card structure hidden when sealed */}
          {!sealed && (
            <fieldset className="mg-fieldset">
              <legend>J-Card Structure</legend>
              <label className="mg-check">
                <input
                  type="checkbox"
                  checked={s.jcard.allIntact}
                  onChange={(e) => setPackaging({ ...s, jcard: { ...s.jcard, allIntact: e.target.checked } })}
                />
                <span>J-card intact</span>
              </label>
              <div className="mg-subselect">
                <div className="mg-subtle">J-card tears</div>
                <div className="mg-radio-row wrap">
                  {["small", "medium", "large"].map((lv) => (
                    <label className="mg-radio sm" key={lv}>
                      <input
                        type="radio"
                        name="tc-tear"
                        checked={s.jcard.jcardTears === lv}
                        onChange={() => setPackaging({ ...s, jcard: { ...s.jcard, jcardTears: lv } })}
                      />
                      <span>{lv}</span>
                    </label>
                  ))}
                  <button
                    type="button"
                    className="mg-link sm"
                    onClick={() => setPackaging({ ...s, jcard: { ...s.jcard, jcardTears: null } })}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </fieldset>
          )}

          <fieldset className="mg-fieldset">
            <legend>Damage & Markings</legend>
            <div className="mg-subselect">
              <div className="mg-subtle">Creases / crushing present</div>
              <div className="mg-radio-row wrap">
                {["light", "pronounced", "crushing"].map((lv) => (
                  <label className="mg-radio sm" key={lv}>
                    <input
                      type="radio"
                      name="tc-crease"
                      checked={s.damage.creases === lv}
                      onChange={() => setPackaging({ ...s, damage: { ...s.damage, creases: lv } })}
                    />
                    <span>{lv}</span>
                  </label>
                ))}
                <button
                  type="button"
                  className="mg-link sm"
                  onClick={() => setPackaging({ ...s, damage: { ...s.damage, creases: null } })}
                >
                  Clear
                </button>
              </div>
            </div>

            {!sealed && (
              <>
                <label className="mg-check">
                  <input
                    type="checkbox"
                    checked={s.damage.writing}
                    onChange={(e) => setPackaging({ ...s, damage: { ...s.damage, writing: e.target.checked } })}
                  />
                  <span>Writing present</span>
                </label>
                <label className="mg-check">
                  <input
                    type="checkbox"
                    checked={s.damage.stickers}
                    onChange={(e) => setPackaging({ ...s, damage: { ...s.damage, stickers: e.target.checked } })}
                  />
                  <span>Stickers or tape</span>
                </label>
              </>
            )}
          </fieldset>

          <fieldset className="mg-fieldset">
            <legend>Additional notes (don’t affect score)</legend>
            <div className="mg-notes-grid">
              {NOTES.cassette.map((lbl) => (
                <label className="mg-check sm" key={lbl}>
                  <input
                    type="checkbox"
                    checked={!!s.notes[lbl]}
                    onChange={(e) =>
                      setPackaging({
                        ...s,
                        notes: { ...s.notes, [lbl]: e.target.checked },
                      })
                    }
                  />
                  <span>{lbl}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      );
    }

    // CD packaging
    const s = packaging;
    return (
      <div className="mg-panel">
        <div className="mg-panel-row between">
          <div className="mg-subtle">Inlay/Booklet & Packaging Condition Assessment</div>
          <label className="mg-check">
            <input
              type="checkbox"
              checked={s.missing}
              onChange={(e) => setPackaging({ ...s, missing: e.target.checked })}
            />
            <span>Mark packaging as Missing (auto P)</span>
          </label>
        </div>

        <fieldset className="mg-fieldset">
          <legend>Overall Appearance</legend>
          {!sealed && (
            <label className="mg-check">
              <input
                type="checkbox"
                checked={s.overall.looksNew}
                onChange={(e) => setPackaging({ ...s, overall: { ...s.overall, looksNew: e.target.checked } })}
              />
              <span>Looks like new, no flaws</span>
            </label>
          )}

          <label className="mg-check">
            <input
              type="checkbox"
              checked={s.overall.minorShelf}
              onChange={(e) => setPackaging({ ...s, overall: { ...s.overall, minorShelf: e.target.checked } })}
            />
            <span>Minor shelf wear only</span>
          </label>

          <div className="mg-subselect">
            <div className="mg-subtle">Corner wear present (inlay/digipak)</div>
            <div className="mg-radio-row wrap">
              {["slight", "moderate", "heavy"].map((lv) => (
                <label className="mg-radio sm" key={lv}>
                  <input
                    type="radio"
                    name="cd-corner"
                    checked={s.overall.cornerWear === lv}
                    onChange={() => setPackaging({ ...s, overall: { ...s.overall, cornerWear: lv } })}
                  />
                  <span>{lv}</span>
                </label>
              ))}
              <button
                type="button"
                className="mg-link sm"
                onClick={() => setPackaging({ ...s, overall: { ...s.overall, cornerWear: null } })}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mg-subselect">
            <div className="mg-subtle">Booklet ring wear visible</div>
            <div className="mg-radio-row wrap">
              {["light", "visible", "strong"].map((lv) => (
                <label className="mg-radio sm" key={lv}>
                  <input
                    type="radio"
                    name="cd-ring"
                    checked={s.overall.bookletRing === lv}
                    onChange={() => setPackaging({ ...s, overall: { ...s.overall, bookletRing: lv } })}
                  />
                  <span>{lv}</span>
                </label>
              ))}
              <button
                type="button"
                className="mg-link sm"
                onClick={() => setPackaging({ ...s, overall: { ...s.overall, bookletRing: null } })}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mg-help">
            Standard jewel cases are <strong>not graded</strong>; evaluate the inlay/booklet/digipak. Sealed adds +5
            (cap 100). M only if sealed & flawless.
          </div>
        </fieldset>

        {/* Insert/Tray hidden when sealed */}
        {!sealed && (
          <fieldset className="mg-fieldset">
            <legend>Insert/Tray Structure</legend>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={s.insertTray.insertIntact}
                onChange={(e) =>
                  setPackaging({ ...s, insertTray: { ...s.insertTray, insertIntact: e.target.checked } })
                }
              />
              <span>Booklet/tray insert intact</span>
            </label>
          </fieldset>
        )}

        <fieldset className="mg-fieldset">
          <legend>Damage & Markings</legend>
          <div className="mg-subselect">
            <div className="mg-subtle">Creases / crushing present</div>
            <div className="mg-radio-row wrap">
              {["light", "pronounced", "crushing"].map((lv) => (
                <label className="mg-radio sm" key={lv}>
                  <input
                    type="radio"
                    name="cd-crease"
                    checked={s.damage.creases === lv}
                    onChange={() => setPackaging({ ...s, damage: { ...s.damage, creases: lv } })}
                  />
                  <span>{lv}</span>
                </label>
              ))}
              <button
                type="button"
                className="mg-link sm"
                onClick={() => setPackaging({ ...s, damage: { ...s.damage, creases: null } })}
              >
                Clear
              </button>
            </div>
          </div>

          {!sealed && (
            <>
              <div className="mg-subselect">
                <div className="mg-subtle">Tears present</div>
                <div className="mg-radio-row wrap">
                  {["small", "medium", "large"].map((lv) => (
                    <label className="mg-radio sm" key={lv}>
                      <input
                        type="radio"
                        name="cd-tear"
                        checked={s.damage.tears === lv}
                        onChange={() => setPackaging({ ...s, damage: { ...s.damage, tears: lv } })}
                      />
                      <span>{lv}</span>
                    </label>
                  ))}
                  <button
                    type="button"
                    className="mg-link sm"
                    onClick={() => setPackaging({ ...s, damage: { ...s.damage, tears: null } })}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <label className="mg-check">
                <input
                  type="checkbox"
                  checked={s.damage.writing}
                  onChange={(e) => setPackaging({ ...s, damage: { ...s.damage, writing: e.target.checked } })}
                />
                <span>Writing present</span>
              </label>
              <label className="mg-check">
                <input
                  type="checkbox"
                  checked={s.damage.stickers}
                  onChange={(e) => setPackaging({ ...s, damage: { ...s.damage, stickers: e.target.checked } })}
                />
                <span>Stickers or tape</span>
              </label>
            </>
          )}
        </fieldset>

        <fieldset className="mg-fieldset">
          <legend>Additional notes (don’t affect score)</legend>
          <div className="mg-notes-grid">
            {NOTES.cd.map((lbl) => (
              <label className="mg-check sm" key={lbl}>
                <input
                  type="checkbox"
                  checked={!!s.notes[lbl]}
                  onChange={(e) =>
                    setPackaging({
                      ...s,
                      notes: { ...s.notes, [lbl]: e.target.checked },
                    })
                  }
                />
                <span>{lbl}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    );
  };

  return (
    <div className="mg-root mg-dark">
      {renderHeader()}

      {/* Dynamic headings per media type */}
      <h3 className="mg-section-title">
        {mediaType === "vinyl" && "Vinyl Record Condition Assessment"}
        {mediaType === "cassette" && "Cassette Condition Assessment"}
        {mediaType === "cd" && "Compact Disc Condition Assessment"}
      </h3>

      <div className="mg-grid">
        <div className="mg-col">
          {items.map((it, idx) =>
            mediaType === "vinyl" ? renderVinylItem(it, idx) : mediaType === "cassette" ? renderCassetteItem(it, idx) : renderCDItem(it, idx)
          )}

          <div className="mg-actions">
            <button type="button" className="mg-primary" onClick={addItem}>
              {mediaType === "vinyl" ? "Add Another Record" : mediaType === "cassette" ? "Add Another Tape" : "Add Another Disc"}
            </button>
          </div>

          <fieldset className="mg-fieldset">
            <legend>Custom Condition Notes</legend>
            <textarea
              placeholder="Add clarifying condition notes (does not affect score)."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </fieldset>
        </div>

        <div className="mg-col">{renderPackaging()}</div>
      </div>

      {/* Results */}
      <div className="mg-results-row">
        <GradeCard
          title={mediaType === "vinyl" ? "Record Grade" : mediaType === "cassette" ? "Tape Grade" : "Disc Grade"}
          score={computed.mediaScore}
          grade={computed.mediaGrade}
        />
        <GradeCard title="Sleeve/Packaging Grade" score={computed.packScore} grade={computed.packagingGrade} />
        <GradeCard title="Overall Grade" score={computed.overallScore} grade={computed.overallGrade} />
      </div>

      <pre className="mg-explanation">{computed.explanation}</pre>
    </div>
  );
}
