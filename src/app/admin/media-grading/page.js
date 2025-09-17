"use client";

import React, { useState } from "react";
import "styles/media-grading.css";

/**
 * Systematic Media Grading Tool (Admin)
 * - Framework: Next.js App Router (client component)
 * - Language: JavaScript
 * - Styling: src/styles/media-grading.css (vanilla CSS)
 *
 * Rules:
 * • Eight grades only: M, NM, VG+, VG, G+, G, F/P
 * • Start each score at 100; apply penalties per selected defect
 * • Sealed toggle (global) shown above both columns:
 *    - Vinyl media: only Warping may be evaluated; all other media controls hidden
 *    - Cassette/CD media: media assumed Mint (M) when sealed; media controls hidden
 *    - Packaging: only exterior wear allowed when sealed (minor shelf, corner wear, creases/crushing; plus Ring wear for vinyl / Booklet ring wear for CD)
 *    - Packaging gets +5 bonus (capped at 100)
 *    - “M” only when sealed AND flawless in the allowed scope
 * • Per-item missing => auto P (score 0)
 * • Multi-item media: average all item scores (missing items count as 0)
 * • Overall score = (mediaAvg + packagingScore) / 2
 *      If EITHER media (all items) OR packaging is completely missing → divide by 4 instead of 2
 * • Side-aware inputs:
 *      - Vinyl: for Audio defects and for Visual scuffs/scratches/groove wear, choose Side A/B (C/D/E/F… on later records) and enter tracks affected per side
 *      - Cassette: Audio defects allow Side A/B + per-side tracks
 *      - CD: sides don’t apply
 * • Explanation: show top 3 deductions for media and for packaging; summarize overall rule used
 */

/* ----------------------------- Constants ----------------------------- */

const MEDIA_TYPES = [
  {
    id: "vinyl",
    pill: "🎵 Vinyl Records",
    mediaTitle: "Vinyl Record Condition Assessment",
    packagingTitle: "Jacket & Packaging Condition Assessment",
    itemNoun: "Record",
  },
  {
    id: "cassette",
    pill: "📼 Cassette Tapes",
    mediaTitle: "Cassette Condition Assessment",
    packagingTitle: "J-Card & Packaging Condition Assessment",
    itemNoun: "Tape",
  },
  {
    id: "cd",
    pill: "💿 Compact Discs",
    mediaTitle: "Compact Disc Condition Assessment",
    packagingTitle: "Inlay/Booklet & Packaging Condition Assessment",
    itemNoun: "Disc",
  },
];

// Grade thresholds (score → grade).
// Only 8 buckets. “M” is gated by ‘sealed & flawless in allowed scope’.
function scoreToGrade(score) {
  if (score >= 97) return "NM";
  if (score >= 90) return "VG+";
  if (score >= 75) return "VG";
  if (score >= 65) return "G+";
  if (score >= 50) return "G";
  return "F/P";
}

// Side letters for each media item (vinyl/cassette only)
const SIDE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
function sidePairForIndex(idx) {
  const i = idx * 2; // 0 -> A/B, 1 -> C/D, 2 -> E/F, ...
  return [SIDE_LETTERS[i] || "A", SIDE_LETTERS[i + 1] || "B"];
}

// Packaging Additional Notes (don’t affect score)
const ADDL_NOTES = {
  vinyl: [
    "Original shrinkwrap (opened)",
    "Promotional copy",
    "Gatefold sleeve",
    "Original inner sleeve",
    "Cut-out hole/notch/corner cut",
    "Hype sticker present",
    "Price sticker/tag",
    "Generic/company sleeve",
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

/* --------------------------- Item factories --------------------------- */

function makeVinylItem(index) {
  const [sideA, sideB] = sidePairForIndex(index);
  return {
    id: cryptoRandomId(),
    missing: false,
    sides: { a: sideA, b: sideB },
    visual: {
      glossy: false,
      scuffs: { on: false, sides: { a: false, b: false } },
      scratches: { on: false, sides: { a: false, b: false } },
      grooveWear: { on: false, sides: { a: false, b: false } },
      warping: { on: false, severity: "" }, // slight/moderate/severe
    },
    audio: {
      noNoise: false,
      surfaceNoise: { on: false, sides: { a: false, b: false }, tracks: { a: 0, b: 0 } },
      popsClicks: { on: false, sides: { a: false, b: false }, tracks: { a: 0, b: 0 } },
      skipping: { on: false, sides: { a: false, b: false }, tracks: { a: 0, b: 0 } },
    },
    labelCenter: {
      clean: false,
      spindle: false,
      writing: false,
      stickers: false,
    },
  };
}

function makeCassetteItem(index) {
  const [sideA, sideB] = sidePairForIndex(index);
  return {
    id: cryptoRandomId(),
    missing: false,
    sides: { a: sideA, b: sideB },
    shell: {
      clean: false,
      writing: false,
      stickers: false,
      pressurePad: false,
    },
    mechanics: {
      tapeWrinkleStretch: false,
      unevenPack: false,
      rollerWear: false,
    },
    audio: {
      noIssues: false,
      hissDropouts: { on: false, severity: "", sides: { a: false, b: false }, tracks: { a: 0, b: 0 } },
      wowFlutter: { on: false, sides: { a: false, b: false }, tracks: { a: 0, b: 0 } },
      channelLoss: { on: false, sides: { a: false, b: false }, tracks: { a: 0, b: 0 } },
    },
  };
}

function makeCDItem() {
  return {
    id: cryptoRandomId(),
    missing: false,
    visual: {
      lightScuffs: false,
      scratches: false,
      rotPinholes: false,
      wobble: false,
    },
    audio: {
      noErrors: false,
      correctedErrors: { on: false, tracks: 0 },
      unreadable: { on: false, tracks: 0 },
    },
    hubFace: {
      clean: false,
      writing: false,
      stickers: false,
      hubCrack: false,
    },
  };
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Math.random().toString(36).slice(2)}`;
}

/* ------------------------ Penalty & grading logic ------------------------ */

const MEDIA_PENALTIES = {
  vinyl: {
    visual: {
      scuffs: -3,
      scratches: -8,
      grooveWear: -12,
      warping: { slight: -4, moderate: -8, severe: -12 },
    },
    audio: {
      surfaceNoise: -6,
      popsClicks: -4,
      skipping: -30,
    },
    labelCenter: {
      spindle: -3,
      writing: -3,
      stickers: -3,
    },
    perTrack: -1,
  },
  cassette: {
    shell: {
      writing: -3,
      stickers: -3,
      pressurePad: -30,
    },
    mechanics: {
      tapeWrinkleStretch: -12,
      unevenPack: -6,
      rollerWear: -4,
    },
    audio: {
      hissDropouts: { mild: -4, moderate: -8, severe: -12 },
      wowFlutter: -6,
      channelLoss: -8,
    },
    perTrack: -1,
  },
  cd: {
    visual: {
      lightScuffs: -3,
      scratches: -8,
      rotPinholes: -12,
      wobble: -10,
    },
    audio: {
      correctedErrors: -4,
      unreadable: -30,
    },
    hubFace: {
      writing: -3,
      stickers: -3,
      hubCrack: -3,
    },
    perTrack: -1,
  },
};

const PKG_PENALTIES = {
  minorShelf: -3,
  cornerWear: -4,
  ringWear: -5,
  spineWear: -3,
  seamSplitOrCaseCrack: -12,
  tears: -8,
  writing: -4,
  stickers: -3,
  creases: -4,
  sealedBonus: +5,
};

function computeVinylItemScore(item, sealed, explanations) {
  if (item.missing) {
    explanations.push({ t: "Missing record", p: -100 });
    return 0;
  }
  let score = 100;

  if (sealed) {
    if (item.visual.warping.on) {
      const sev = item.visual.warping.severity || "";
      const p = MEDIA_PENALTIES.vinyl.visual.warping[sev] || 0;
      if (p) {
        score += p;
        explanations.push({ t: `Warping (${sev})`, p });
      }
    }
    return clampScore(score);
  }

  if (item.visual.scuffs.on) {
    score += MEDIA_PENALTIES.vinyl.visual.scuffs;
    explanations.push({ t: "Light scuffs", p: MEDIA_PENALTIES.vinyl.visual.scuffs });
  }
  if (item.visual.scratches.on) {
    score += MEDIA_PENALTIES.vinyl.visual.scratches;
    explanations.push({ t: "Scratches present", p: MEDIA_PENALTIES.vinyl.visual.scratches });
  }
  if (item.visual.grooveWear.on) {
    score += MEDIA_PENALTIES.vinyl.visual.grooveWear;
    explanations.push({ t: "Groove wear visible", p: MEDIA_PENALTIES.vinyl.visual.grooveWear });
  }
  if (item.visual.warping.on) {
    const sev = item.visual.warping.severity || "";
    const p = MEDIA_PENALTIES.vinyl.visual.warping[sev] || 0;
    if (p) {
      score += p;
      explanations.push({ t: `Warping (${sev})`, p });
    }
  }

  let perTrackApplied = 0;
  if (item.audio.surfaceNoise.on) {
    score += MEDIA_PENALTIES.vinyl.audio.surfaceNoise;
    explanations.push({ t: "Surface noise when played", p: MEDIA_PENALTIES.vinyl.audio.surfaceNoise });
    perTrackApplied += (item.audio.surfaceNoise.tracks.a || 0) + (item.audio.surfaceNoise.tracks.b || 0);
  }
  if (item.audio.popsClicks.on) {
    score += MEDIA_PENALTIES.vinyl.audio.popsClicks;
    explanations.push({ t: "Occasional pops or clicks", p: MEDIA_PENALTIES.vinyl.audio.popsClicks });
    perTrackApplied += (item.audio.popsClicks.tracks.a || 0) + (item.audio.popsClicks.tracks.b || 0);
  }
  if (item.audio.skipping.on) {
    score += MEDIA_PENALTIES.vinyl.audio.skipping;
    explanations.push({ t: "Skipping or repeating", p: MEDIA_PENALTIES.vinyl.audio.skipping });
    perTrackApplied += (item.audio.skipping.tracks.a || 0) + (item.audio.skipping.tracks.b || 0);
  }
  if (perTrackApplied > 0) {
    const p = MEDIA_PENALTIES.vinyl.perTrack * perTrackApplied;
    score += p;
    explanations.push({ t: `Tracks affected (total ${perTrackApplied})`, p });
  }

  if (item.labelCenter.spindle) {
    score += MEDIA_PENALTIES.vinyl.labelCenter.spindle;
    explanations.push({ t: "Spindle marks present", p: MEDIA_PENALTIES.vinyl.labelCenter.spindle });
  }
  if (item.labelCenter.writing) {
    score += MEDIA_PENALTIES.vinyl.labelCenter.writing;
    explanations.push({ t: "Writing on label", p: MEDIA_PENALTIES.vinyl.labelCenter.writing });
  }
  if (item.labelCenter.stickers) {
    score += MEDIA_PENALTIES.vinyl.labelCenter.stickers;
    explanations.push({ t: "Stickers or tape on label", p: MEDIA_PENALTIES.vinyl.labelCenter.stickers });
  }

  return clampScore(score);
}

function computeCassetteItemScore(item, sealed, explanations) {
  if (item.missing) {
    explanations.push({ t: "Missing tape", p: -100 });
    return 0;
  }
  let score = 100;

  if (sealed) return 100;

  if (item.shell.writing) {
    score += MEDIA_PENALTIES.cassette.shell.writing;
    explanations.push({ t: "Writing on shell/label", p: MEDIA_PENALTIES.cassette.shell.writing });
  }
  if (item.shell.stickers) {
    score += MEDIA_PENALTIES.cassette.shell.stickers;
    explanations.push({ t: "Stickers or tape on shell", p: MEDIA_PENALTIES.cassette.shell.stickers });
  }
  if (item.shell.pressurePad) {
    score += MEDIA_PENALTIES.cassette.shell.pressurePad;
    explanations.push({ t: "Pressure pad missing/degraded", p: MEDIA_PENALTIES.cassette.shell.pressurePad });
  }

  if (item.mechanics.tapeWrinkleStretch) {
    const p = MEDIA_PENALTIES.cassette.mechanics.tapeWrinkleStretch;
    score += p;
    explanations.push({ t: "Tape wrinkled/stretched", p });
  }
  if (item.mechanics.unevenPack) {
    const p = MEDIA_PENALTIES.cassette.mechanics.unevenPack;
    score += p;
    explanations.push({ t: "Uneven tape pack", p });
  }
  if (item.mechanics.rollerWear) {
    const p = MEDIA_PENALTIES.cassette.mechanics.rollerWear;
    score += p;
    explanations.push({ t: "Roller/capstan wear", p });
  }

  let perTrackApplied = 0;
  if (item.audio.hissDropouts.on) {
    const sev = item.audio.hissDropouts.severity || "mild";
    const p = MEDIA_PENALTIES.cassette.audio.hissDropouts[sev];
    score += p;
    explanations.push({ t: `Hiss/dropouts (${sev})`, p });
    perTrackApplied += (item.audio.hissDropouts.tracks.a || 0) + (item.audio.hissDropouts.tracks.b || 0);
  }
  if (item.audio.wowFlutter.on) {
    const p = MEDIA_PENALTIES.cassette.audio.wowFlutter;
    score += p;
    explanations.push({ t: "Wow/flutter audible", p });
    perTrackApplied += (item.audio.wowFlutter.tracks.a || 0) + (item.audio.wowFlutter.tracks.b || 0);
  }
  if (item.audio.channelLoss.on) {
    const p = MEDIA_PENALTIES.cassette.audio.channelLoss;
    score += p;
    explanations.push({ t: "Channel loss/drop", p });
    perTrackApplied += (item.audio.channelLoss.tracks.a || 0) + (item.audio.channelLoss.tracks.b || 0);
  }
  if (perTrackApplied > 0) {
    const p = MEDIA_PENALTIES.cassette.perTrack * perTrackApplied;
    score += p;
    explanations.push({ t: `Tracks affected (total ${perTrackApplied})`, p });
  }

  return clampScore(score);
}

function computeCDItemScore(item, sealed, explanations) {
  if (item.missing) {
    explanations.push({ t: "Missing disc", p: -100 });
    return 0;
  }
  let score = 100;

  if (sealed) return 100;

  if (item.visual.lightScuffs) {
    const p = MEDIA_PENALTIES.cd.visual.lightScuffs;
    score += p;
    explanations.push({ t: "Light scuffs visible", p });
  }
  if (item.visual.scratches) {
    const p = MEDIA_PENALTIES.cd.visual.scratches;
    score += p;
    explanations.push({ t: "Scratches present", p });
  }
  if (item.visual.rotPinholes) {
    const p = MEDIA_PENALTIES.cd.visual.rotPinholes;
    score += p;
    explanations.push({ t: "Laser-rot/pinholes visible", p });
  }
  if (item.visual.wobble) {
    const p = MEDIA_PENALTIES.cd.visual.wobble;
    score += p;
    explanations.push({ t: "Disc wobble present", p });
  }

  let perTrackApplied = 0;
  if (item.audio.correctedErrors.on) {
    const p = MEDIA_PENALTIES.cd.audio.correctedErrors;
    score += p;
    explanations.push({ t: "Occasional read errors corrected", p });
    perTrackApplied += item.audio.correctedErrors.tracks || 0;
  }
  if (item.audio.unreadable.on) {
    const p = MEDIA_PENALTIES.cd.audio.unreadable;
    score += p;
    explanations.push({ t: "Unreadable sectors / skipping", p });
    perTrackApplied += item.audio.unreadable.tracks || 0;
  }
  if (perTrackApplied > 0) {
    const p = MEDIA_PENALTIES.cd.perTrack * perTrackApplied;
    score += p;
    explanations.push({ t: `Tracks affected (total ${perTrackApplied})`, p });
  }

  if (item.hubFace.writing) {
    const p = MEDIA_PENALTIES.cd.hubFace.writing;
    score += p;
    explanations.push({ t: "Writing on disc face", p });
  }
  if (item.hubFace.stickers) {
    const p = MEDIA_PENALTIES.cd.hubFace.stickers;
    score += p;
    explanations.push({ t: "Stickers or tape on disc face", p });
  }
  if (item.hubFace.hubCrack) {
    const p = MEDIA_PENALTIES.cd.hubFace.hubCrack;
    score += p;
    explanations.push({ t: "Hub crack", p });
  }

  return clampScore(score);
}

function clampScore(n) {
  if (n > 100) return 100;
  if (n < 0) return 0;
  return Math.round(n);
}

function computePackagingScore(state, mediaType, sealed, explanations) {
  if (state.pkgMissing) {
    explanations.push({ t: "Packaging missing", p: -100 });
    return 0;
  }
  let score = 100;

  const allow = {
    minorShelf: state.pkg.minorShelf,
    cornerWear: state.pkg.cornerWear,
    creases: state.pkg.creases,
  };
  if (mediaType === "vinyl" && state.pkg.ringWear) allow.ringWear = true;
  if (mediaType === "cd" && state.pkg.ringWear) allow.ringWear = true;

  if (sealed) {
    if (allow.minorShelf) {
      score += PKG_PENALTIES.minorShelf;
      explanations.push({ t: "Minor shelf wear (sealed)", p: PKG_PENALTIES.minorShelf });
    }
    if (allow.cornerWear) {
      score += PKG_PENALTIES.cornerWear;
      explanations.push({ t: "Corner wear present (sealed)", p: PKG_PENALTIES.cornerWear });
    }
    if (allow.ringWear) {
      score += PKG_PENALTIES.ringWear;
      explanations.push({ t: mediaType === "cd" ? "Booklet ring wear visible (sealed)" : "Ring wear visible (sealed)", p: PKG_PENALTIES.ringWear });
    }
    if (allow.creases) {
      score += PKG_PENALTIES.creases;
      explanations.push({ t: "Creases/crushing present (sealed)", p: PKG_PENALTIES.creases });
    }
    score = Math.min(100, score + PKG_PENALTIES.sealedBonus);
  } else {
    if (state.pkg.minorShelf) {
      score += PKG_PENALTIES.minorShelf;
      explanations.push({ t: "Minor shelf wear", p: PKG_PENALTIES.minorShelf });
    }
    if (state.pkg.cornerWear) {
      score += PKG_PENALTIES.cornerWear;
      explanations.push({ t: "Corner wear present", p: PKG_PENALTIES.cornerWear });
    }
    if (state.pkg.ringWear) {
      score += PKG_PENALTIES.ringWear;
      explanations.push({ t: mediaType === "cd" ? "Booklet ring wear visible" : "Ring wear visible", p: PKG_PENALTIES.ringWear });
    }
    if (mediaType !== "cd" && state.pkg.spineWear) {
      score += PKG_PENALTIES.spineWear;
      explanations.push({ t: "Spine shows wear", p: PKG_PENALTIES.spineWear });
    }
    if (state.pkg.seamSplitOrCaseCrack) {
      score += PKG_PENALTIES.seamSplitOrCaseCrack;
      explanations.push({ t: mediaType === "cd" ? "Case cracked" : "Seam splits present", p: PKG_PENALTIES.seamSplitOrCaseCrack });
    }
    if (state.pkg.tears) {
      score += PKG_PENALTIES.tears;
      explanations.push({ t: "Tears present", p: PKG_PENALTIES.tears });
    }
    if (state.pkg.writing) {
      score += PKG_PENALTIES.writing;
      explanations.push({ t: "Writing present", p: PKG_PENALTIES.writing });
    }
    if (state.pkg.stickers) {
      score += PKG_PENALTIES.stickers;
      explanations.push({ t: "Stickers or tape", p: PKG_PENALTIES.stickers });
    }
  }

  return clampScore(score);
}

function topDeductions(explArr, n = 3) {
  const negs = explArr.filter((e) => e.p < 0);
  negs.sort((a, b) => a.p - b.p);
  return negs.slice(0, n);
}

/* ------------------------------- Component ------------------------------- */

export default function MediaGradingPage() {
  const [mediaType, setMediaType] = useState("vinyl");
  const [sealed, setSealed] = useState(false);

  const [pkgState, setPkgState] = useState({
    pkgMissing: false,
    pkg: {
      minorShelf: false,
      cornerWear: false,
      ringWear: false,
      spineWear: false,
      seamSplitOrCaseCrack: false,
      tears: false,
      writing: false,
      stickers: false,
      creases: false,
    },
    notes: [],
  });

  const [items, setItems] = useState([makeVinylItem(0)]);
  const [notes, setNotes] = useState("");

  const handleSelectType = (type) => {
    setMediaType(type);
    setSealed(false);
    setPkgState({
      pkgMissing: false,
      pkg: {
        minorShelf: false,
        cornerWear: false,
        ringWear: false,
        spineWear: false,
        seamSplitOrCaseCrack: false,
        tears: false,
        writing: false,
        stickers: false,
        creases: false,
      },
      notes: [],
    });
    if (type === "vinyl") setItems([makeVinylItem(0)]);
    if (type === "cassette") setItems([makeCassetteItem(0)]);
    if (type === "cd") setItems([makeCDItem()]);
  };

  const addItem = () => {
    if (mediaType === "vinyl") setItems((prev) => [...prev, makeVinylItem(prev.length)]);
    if (mediaType === "cassette") setItems((prev) => [...prev, makeCassetteItem(prev.length)]);
    if (mediaType === "cd") setItems((prev) => [...prev, makeCDItem()]);
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const mediaExpl = [];
  const pkgExpl = [];

  const perItemScores = items.map((it) => {
    if (mediaType === "vinyl") return computeVinylItemScore(it, sealed, mediaExpl);
    if (mediaType === "cassette") return computeCassetteItemScore(it, sealed, mediaExpl);
    return computeCDItemScore(it, sealed, mediaExpl);
  });

  const mediaAvg =
    perItemScores.length > 0
      ? Math.round(perItemScores.reduce((a, b) => a + b, 0) / perItemScores.length)
      : 0;

  const allMediaMissing = items.length > 0 && items.every((it) => it.missing);
  const packagingScore = computePackagingScore(pkgState, mediaType, sealed, pkgExpl);

  const denom = pkgState.pkgMissing || allMediaMissing ? 4 : 2;
  const overallScore = clampScore(Math.round((mediaAvg + packagingScore) / denom));

  const mediaGrade = deriveMediaGrade(mediaAvg, mediaType, sealed, items);
  const pkgGrade = derivePackagingGrade(packagingScore, sealed, pkgState);
  const overallGrade = scoreToGrade(overallScore);

  const mediaTop = topDeductions(mediaExpl, 3);
  const pkgTop = topDeductions(pkgExpl, 3);

  const t = MEDIA_TYPES.find((tt) => tt.id === mediaType);

  return (
    <div id="media-grading">
      <header className="mg-header">
        <a className="mg-back" href="/admin">← Back to Dashboard</a>
        <div className="mg-title">
          <h1>🔍 Systematic Media Grading Tool</h1>
          <p>Detailed condition assessment with automatic grading calculation</p>
        </div>
      </header>

      <div className="mg-pills">
        {MEDIA_TYPES.map((m) => (
          <button
            key={m.id}
            className={`mg-pill ${mediaType === m.id ? "selected" : ""}`}
            onClick={() => handleSelectType(m.id)}
            type="button"
          >
            {m.pill}
          </button>
        ))}
      </div>

      <div className="mg-sealed-row">
        <label className="mg-checkbox">
          <input
            type="checkbox"
            checked={sealed}
            onChange={(e) => setSealed(e.target.checked)}
          />
          <span>Sealed (factory shrink intact)</span>
        </label>
        <div className="mg-hint">
          <em>
            When <strong>Sealed</strong> is on:
            {mediaType === "vinyl" ? (
              <> Vinyl allows evaluating only <strong>Warping present</strong> for media, and packaging exterior wear (<strong>Minor shelf wear</strong>, <strong>Corner wear</strong>, <strong>Creases/crushing</strong>, <strong>Ring wear</strong> if visible). </>
            ) : (
              <> Cassettes/CDs default to <strong>Mint</strong> for media unless missing; packaging may only show exterior wear (Minor shelf wear, Corner wear, Creases/crushing{mediaType === "cd" ? ", Booklet ring wear" : ""}). </>
            )}{" "}
            Packaging gets a <strong>+5</strong> bonus (capped at 100).{" "}
            Mint <strong>(M)</strong> is allowed <u>only</u> when sealed and flawless within the allowed scope.
          </em>
        </div>
      </div>

      <div className="mg-grid">
        <section className="mg-panel">
          <div className="mg-panel-header">
            <h2>🎶 {t.mediaTitle}</h2>
            <button className="mg-add" type="button" onClick={addItem}>
              Add Another {t.itemNoun}
            </button>
          </div>

          {items.map((item, index) => (
            <article key={item.id} className="mg-card">
              <div className="mg-card-title">
                <strong>
                  {t.itemNoun} #{index + 1}
                </strong>
                <div className="mg-card-actions">
                  <label className="mg-checkbox">
                    <input
                      type="checkbox"
                      checked={item.missing}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setItems((prev) =>
                          prev.map((x) => (x.id === item.id ? { ...x, missing: v } : x))
                        );
                      }}
                    />
                    <span>Mark this media as Missing (auto P)</span>
                  </label>
                  <button className="mg-remove" type="button" onClick={() => removeItem(item.id)}>
                    Remove {t.itemNoun}
                  </button>
                </div>
              </div>

              {renderMediaForm({
                mediaType,
                sealed,
                item,
                onChange: (next) =>
                  setItems((prev) => prev.map((x) => (x.id === item.id ? next : x))),
              })}

              <div className="mg-inline-badge">
                Item #{index + 1}: {scoreToGrade(perItemScores[index])} ({perItemScores[index]}/100)
              </div>
            </article>
          ))}

          <div className="mg-card">
            <label htmlFor="customNotes" className="mg-card-title">
              📝 Custom Condition Notes
            </label>
            <textarea
              id="customNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add clarifying condition notes (does not affect score)."
            />
          </div>
        </section>

        <section className="mg-panel">
          <h2>📦 {t.packagingTitle}</h2>

          <article className="mg-card">
            <div className="mg-card-title">
              <strong>{t.packagingTitle}</strong>
              <label className="mg-checkbox">
                <input
                  type="checkbox"
                  checked={pkgState.pkgMissing}
                  onChange={(e) =>
                    setPkgState((s) => ({ ...s, pkgMissing: e.target.checked }))
                  }
                />
                <span>Mark packaging as Missing (auto P)</span>
              </label>
            </div>

            <fieldset className="mg-fieldset" disabled={pkgState.pkgMissing}>
              <legend>Overall Appearance</legend>

              {sealed ? (
                <>
                  <Check
                    id="pkg-minor"
                    label="Minor shelf wear only"
                    checked={pkgState.pkg.minorShelf}
                    onChange={(v) => setPkgState((s) => ({ ...s, pkg: { ...s.pkg, minorShelf: v } }))}
                  />
                  <Check
                    id="pkg-corner"
                    label="Corner wear present"
                    checked={pkgState.pkg.cornerWear}
                    onChange={(v) => setPkgState((s) => ({ ...s, pkg: { ...s.pkg, cornerWear: v } }))}
                  />
                  {mediaType !== "cassette" && (
                    <Check
                      id="pkg-ring"
                      label={mediaType === "cd" ? "Booklet ring wear visible" : "Ring wear visible"}
                      checked={pkgState.pkg.ringWear}
                      onChange={(v) => setPkgState((s) => ({ ...s, pkg: { ...s.pkg, ringWear: v } }))}
                    />
                  )}
                  <Check
                    id="pkg-crease"
                    label="Creases / crushing present"
                    checked={pkgState.pkg.creases}
                    onChange={(v) => setPkgState((s) => ({ ...s, pkg: { ...s.pkg, creases: v } }))}
                  />
                  <p className="mg-subtext">Sealed adds +5 (cap 100). M only if sealed & flawless.</p>
                </>
              ) : (
                <>
                  <Check id="pkg-new" label="Looks like new, no flaws" checked={false} onChange={() => {}} disabled />
                  <Check
                    id="pkg-minor2"
                    label="Minor shelf wear only"
                    checked={pkgState.pkg.minorShelf}
                    onChange={(v) => setPkgState((s) => ({ ...s, pkg: { ...s.pkg, minorShelf: v } }))}
                  />
                  <Check
                    id="pkg-corner2"
                    label="Corner wear present"
                    checked={pkgState.pkg.cornerWear}
                    onChange={(v) => setPkgState((s) => ({ ...s, pkg: { ...s.pkg, cornerWear: v } }))}
                  />
                  {mediaType !== "cassette" && (
                    <Check
                      id="pkg-ring2"
                      label={mediaType === "cd" ? "Booklet ring wear visible" : "Ring wear visible"}
                      checked={pkgState.pkg.ringWear}
                      onChange={(v) => setPkgState((s) => ({ ...s, pkg: { ...s.pkg, ringWear: v } }))}
                    />
                  )}
                </>
              )}
            </fieldset>

            {!sealed && (
              <fieldset className="mg-fieldset" disabled={pkgState.pkgMissing}>
                <legend>{mediaType === "cd" ? "Insert/Tray Structure" : "Seams & Structure"}</legend>
                {mediaType !== "cd" && (
                  <Check id="pkg-allintact" label="All seams intact" checked={false} onChange={() => {}} disabled />
                )}
                {mediaType === "cd" ? (
                  <Check
                    id="pkg-casecrack"
                    label="Case cracked"
                    checked={pkgState.pkg.seamSplitOrCaseCrack}
                    onChange={(v) =>
                      setPkgState((s) => ({ ...s, pkg: { ...s.pkg, seamSplitOrCaseCrack: v } }))
                    }
                  />
                ) : (
                  <Check
                    id="pkg-seamsplit"
                    label="Seam splits present"
                    checked={pkgState.pkg.seamSplitOrCaseCrack}
                    onChange={(v) =>
                      setPkgState((s) => ({ ...s, pkg: { ...s.pkg, seamSplitOrCaseCrack: v } }))
                    }
                  />
                )}
                {mediaType !== "cd" && (
                  <Check
                    id="pkg-spine"
                    label="Spine shows wear"
                    checked={pkgState.pkg.spineWear}
                    onChange={(v) => setPkgState((s) => ({ ...s, pkg: { ...s.pkg, spineWear: v } }))}
                  />
                )}
              </fieldset>
            )}

            {!sealed && (
              <fieldset className="mg-fieldset" disabled={pkgState.pkgMissing}>
                <legend>Damage & Markings</legend>
                <Check
                  id="pkg-crease2"
                  label="Creases / crushing present"
                  checked={pkgState.pkg.creases}
                  onChange={(v) => setPkgState((s) => ({ ...s, pkg: { ...s.pkg, creases: v } }))}
                />
                <Check
                  id="pkg-tears"
                  label="Tears present"
                  checked={pkgState.pkg.tears}
                  onChange={(v) => setPkgState((s) => ({ ...s, pkg: { ...s.pkg, tears: v } }))}
                />
                <Check
                  id="pkg-writing"
                  label="Writing present"
                  checked={pkgState.pkg.writing}
                  onChange={(v) => setPkgState((s) => ({ ...s, pkg: { ...s.pkg, writing: v } }))}
                />
                <Check
                  id="pkg-stickers"
                  label="Stickers or tape"
                  checked={pkgState.pkg.stickers}
                  onChange={(v) => setPkgState((s) => ({ ...s, pkg: { ...s.pkg, stickers: v } }))}
                />
              </fieldset>
            )}

            <fieldset className="mg-fieldset" disabled={pkgState.pkgMissing}>
              <legend>Additional notes (don’t affect score)</legend>
              <div className="mg-notes-grid">
                {ADDL_NOTES[mediaType].map((n) => (
                  <label key={n} className="mg-checkbox">
                    <input
                      type="checkbox"
                      checked={pkgState.notes.includes(n)}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setPkgState((s) => {
                          const set = new Set(s.notes);
                          if (v) set.add(n);
                          else set.delete(n);
                          return { ...s, notes: Array.from(set) };
                        });
                      }}
                    />
                    <span>{n}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </article>
        </section>
      </div>

      <section className="mg-results">
        <div className={`mg-result-card ${gradeColor(mediaGrade)}`}>
          <div className="mg-result-title">
            {mediaType === "vinyl" ? "Record Grade" : mediaType === "cassette" ? "Tape Grade" : "Disc Grade"}
          </div>
          <div className="mg-result-grade">{mediaGrade}</div>
          <div className="mg-result-score">{mediaAvg}/100</div>
        </div>
        <div className={`mg-result-card ${gradeColor(pkgGrade)}`}>
          <div className="mg-result-title">Sleeve/Packaging Grade</div>
          <div className="mg-result-grade">{pkgGrade}</div>
          <div className="mg-result-score">{packagingScore}/100</div>
        </div>
        <div className={`mg-result-card ${gradeColor(overallGrade)}`}>
          <div className="mg-result-title">Overall Grade</div>
          <div className="mg-result-grade">{overallGrade}</div>
          <div className="mg-result-score">{overallScore}/100</div>
        </div>
      </section>

      <section className="mg-explain">
        <h3>Grading Explanation</h3>
        <div className="mg-explain-cols">
          <div>
            <strong>Media (top factors):</strong>
            <ul>
              {mediaTop.length === 0 ? (
                <li>No deductions.</li>
              ) : (
                mediaTop.map((e, i) => (
                  <li key={`m${i}`}>
                    {e.t} ({e.p})
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <strong>Packaging (top factors):</strong>
            <ul>
              {pkgTop.length === 0 ? (
                <li>No deductions.</li>
              ) : (
                pkgTop.map((e, i) => (
                  <li key={`p${i}`}>
                    {e.t} ({e.p})
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
        <p className="mg-overall-note">
          Overall = {(pkgState.pkgMissing || allMediaMissing) ? " (Media + Packaging) ÷ 4 " : " (Media + Packaging) ÷ 2 "}
          {pkgState.pkgMissing ? "because packaging is missing." : allMediaMissing ? "because all media are missing." : "by standard averaging."}
        </p>

        <div className="mg-item-badges">
          {perItemScores.map((s, i) => (
            <span key={`b${i}`} className="mg-inline-badge">
              Item #{i + 1}: {scoreToGrade(s)} ({s}/100)
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------ Subcomponents ------------------------------ */

function Check({ id, label, checked, onChange, disabled }) {
  return (
    <label htmlFor={id} className={`mg-checkbox ${disabled ? "disabled" : ""}`}>
      <input
        id={id}
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}

function NumberInput({ id, value, onChange, min = 0, step = 1, label }) {
  return (
    <label htmlFor={id} className="mg-number">
      <span>{label}</span>
      <input
        id={id}
        type="number"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseInt(e.target.value || "0", 10))}
      />
    </label>
  );
}

function RadioRow({ name, options, value, onChange }) {
  return (
    <div className="mg-radio-row">
      {options.map((opt) => (
        <label key={opt.value} className="mg-radio">
          <input
            type="radio"
            name={name}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function gradeColor(g) {
  if (g === "M" || g === "NM") return "mg-good";
  if (g === "VG+" || g === "VG") return "mg-ok";
  if (g === "G+" || g === "G") return "mg-warn";
  return "mg-bad";
}

function deriveMediaGrade(mediaAvgScore, mediaType, sealed, items) {
  if (sealed) {
    if (mediaType === "vinyl") {
      const anyWarp = items.some((it) => it.visual?.warping?.on);
      const anyMissing = items.some((it) => it.missing);
      if (!anyWarp && !anyMissing) return "M";
    } else {
      const anyMissing = items.some((it) => it.missing);
      if (!anyMissing) return "M";
    }
  }
  return scoreToGrade(mediaAvgScore);
}

function derivePackagingGrade(pkgScore, sealed, pkgState) {
  if (sealed) {
    if (pkgScore === 100 && !pkgState.pkgMissing) return "M";
  }
  return scoreToGrade(pkgScore);
}

/* -------------------------- Media form renderers -------------------------- */

function renderMediaForm({ mediaType, sealed, item, onChange }) {
  if (mediaType === "vinyl") return renderVinylForm(sealed, item, onChange);
  if (mediaType === "cassette") return renderCassetteForm(sealed, item, onChange);
  return renderCDForm(sealed, item, onChange);
}

function renderVinylForm(sealed, item, onChange) {
  const [sideA, sideB] = [item.sides.a, item.sides.b];
  return (
    <>
      <fieldset className="mg-fieldset" disabled={item.missing}>
        <legend>Visual Appearance</legend>

        {!sealed && (
          <>
            <Check
              id={`v-glossy-${item.id}`}
              label="Record has glossy, like-new appearance"
              checked={item.visual.glossy}
              onChange={(v) => onChange({ ...item, visual: { ...item.visual, glossy: v } })}
            />
            <div className="mg-with-sides">
              <Check
                id={`v-scuffs-${item.id}`}
                label="Light scuffs visible"
                checked={item.visual.scuffs.on}
                onChange={(v) => onChange({ ...item, visual: { ...item.visual, scuffs: { ...item.visual.scuffs, on: v } } })}
              />
              {item.visual.scuffs.on && (
                <div className="mg-sides">
                  <Check
                    id={`v-scuffs-a-${item.id}`}
                    label={`Side ${sideA}`}
                    checked={item.visual.scuffs.sides.a}
                    onChange={(v) =>
                      onChange({
                        ...item,
                        visual: { ...item.visual, scuffs: { ...item.visual.scuffs, sides: { ...item.visual.scuffs.sides, a: v } } },
                      })
                    }
                  />
                  <Check
                    id={`v-scuffs-b-${item.id}`}
                    label={`Side ${sideB}`}
                    checked={item.visual.scuffs.sides.b}
                    onChange={(v) =>
                      onChange({
                        ...item,
                        visual: { ...item.visual, scuffs: { ...item.visual.scuffs, sides: { ...item.visual.scuffs.sides, b: v } } },
                      })
                    }
                  />
                </div>
              )}
            </div>

            <div className="mg-with-sides">
              <Check
                id={`v-scratch-${item.id}`}
                label="Scratches present"
                checked={item.visual.scratches.on}
                onChange={(v) =>
                  onChange({ ...item, visual: { ...item.visual, scratches: { ...item.visual.scratches, on: v } } })
                }
              />
              {item.visual.scratches.on && (
                <div className="mg-sides">
                  <Check
                    id={`v-scratch-a-${item.id}`}
                    label={`Side ${sideA}`}
                    checked={item.visual.scratches.sides.a}
                    onChange={(v) =>
                      onChange({
                        ...item,
                        visual: { ...item.visual, scratches: { ...item.visual.scratches, sides: { ...item.visual.scratches.sides, a: v } } },
                      })
                    }
                  />
                  <Check
                    id={`v-scratch-b-${item.id}`}
                    label={`Side ${sideB}`}
                    checked={item.visual.scratches.sides.b}
                    onChange={(v) =>
                      onChange({
                        ...item,
                        visual: { ...item.visual, scratches: { ...item.visual.scratches, sides: { ...item.visual.scratches.sides, b: v } } },
                      })
                    }
                  />
                </div>
              )}
            </div>

            <div className="mg-with-sides">
              <Check
                id={`v-groove-${item.id}`}
                label="Groove wear visible"
                checked={item.visual.grooveWear.on}
                onChange={(v) =>
                  onChange({ ...item, visual: { ...item.visual, grooveWear: { ...item.visual.grooveWear, on: v } } })
                }
              />
              {item.visual.grooveWear.on && (
                <div className="mg-sides">
                  <Check
                    id={`v-groove-a-${item.id}`}
                    label={`Side ${sideA}`}
                    checked={item.visual.grooveWear.sides.a}
                    onChange={(v) =>
                      onChange({
                        ...item,
                        visual: { ...item.visual, grooveWear: { ...item.visual.grooveWear, sides: { ...item.visual.grooveWear.sides, a: v } } },
                      })
                    }
                  />
                  <Check
                    id={`v-groove-b-${item.id}`}
                    label={`Side ${sideB}`}
                    checked={item.visual.grooveWear.sides.b}
                    onChange={(v) =>
                      onChange({
                        ...item,
                        visual: { ...item.visual, grooveWear: { ...item.visual.grooveWear, sides: { ...item.visual.grooveWear.sides, b: v } } },
                      })
                    }
                  />
                </div>
              )}
            </div>
          </>
        )}

        <div className="mg-warp">
          <Check
            id={`v-warp-${item.id}`}
            label="Warping present"
            checked={item.visual.warping.on}
            onChange={(v) => onChange({ ...item, visual: { ...item.visual, warping: { ...item.visual.warping, on: v } } })}
          />
          {item.visual.warping.on && (
            <div className="mg-subblock">
              <RadioRow
                name={`v-warp-sev-${item.id}`}
                value={item.visual.warping.severity}
                onChange={(val) => onChange({ ...item, visual: { ...item.visual, warping: { ...item.visual.warping, severity: val } } })}
                options={[
                  { value: "slight", label: "Slight (doesn’t affect play)" },
                  { value: "moderate", label: "Moderate (may affect tracking)" },
                  { value: "severe", label: "Severe (affects play)" },
                ]}
              />
            </div>
          )}
        </div>
      </fieldset>

      {!sealed && (
        <fieldset className="mg-fieldset" disabled={item.missing}>
          <legend>Audio Performance</legend>
          <Check
            id={`v-nonoise-${item.id}`}
            label="Plays with no surface noise"
            checked={item.audio.noNoise}
            onChange={(v) => onChange({ ...item, audio: { ...item.audio, noNoise: v } })}
          />

          {renderVinylAudioDefect({
            id: item.id,
            label: "Surface noise when played",
            obj: item.audio.surfaceNoise,
            sides: [sideA, sideB],
            onChange: (def) => onChange({ ...item, audio: { ...item.audio, surfaceNoise: def } }),
          })}

          {renderVinylAudioDefect({
            id: item.id,
            label: "Occasional pops or clicks",
            obj: item.audio.popsClicks,
            sides: [sideA, sideB],
            onChange: (def) => onChange({ ...item, audio: { ...item.audio, popsClicks: def } }),
          })}

          {renderVinylAudioDefect({
            id: item.id,
            label: "Skipping or repeating",
            obj: item.audio.skipping,
            sides: [sideA, sideB],
            onChange: (def) => onChange({ ...item, audio: { ...item.audio, skipping: def } }),
          })}

          <p className="mg-subtext">Per-track penalty applies only if any audio defect above is selected.</p>
        </fieldset>
      )}

      {!sealed && (
        <fieldset className="mg-fieldset" disabled={item.missing}>
          <legend>Label / Center</legend>
          <Check
            id={`v-lblclean-${item.id}`}
            label="Label is clean and bright"
            checked={item.labelCenter.clean}
            onChange={(v) => onChange({ ...item, labelCenter: { ...item.labelCenter, clean: v } })}
          />
          <Check
            id={`v-spindle-${item.id}`}
            label="Spindle marks present"
            checked={item.labelCenter.spindle}
            onChange={(v) => onChange({ ...item, labelCenter: { ...item.labelCenter, spindle: v } })}
          />
          <Check
            id={`v-lblwrite-${item.id}`}
            label="Writing on label"
            checked={item.labelCenter.writing}
            onChange={(v) => onChange({ ...item, labelCenter: { ...item.labelCenter, writing: v } })}
          />
          <Check
            id={`v-lblstick-${item.id}`}
            label="Stickers or tape on label"
            checked={item.labelCenter.stickers}
            onChange={(v) => onChange({ ...item, labelCenter: { ...item.labelCenter, stickers: v } })}
          />
        </fieldset>
      )}
    </>
  );
}

function renderVinylAudioDefect({ id, label, obj, sides, onChange }) {
  const [sideA, sideB] = sides;
  return (
    <div className="mg-audio-block">
      <Check
        id={`aud-${label}-${id}`}
        label={label}
        checked={obj.on}
        onChange={(v) => onChange({ ...obj, on: v })}
      />
      {obj.on && (
        <div className="mg-subblock">
          <div className="mg-sides">
            <Check
              id={`aud-a-${label}-${id}`}
              label={`Side ${sideA}`}
              checked={obj.sides.a}
              onChange={(v) => onChange({ ...obj, sides: { ...obj.sides, a: v } })}
            />
            <Check
              id={`aud-b-${label}-${id}`}
              label={`Side ${sideB}`}
              checked={obj.sides.b}
              onChange={(v) => onChange({ ...obj, sides: { ...obj.sides, b: v } })}
            />
          </div>
          <div className="mg-tracks">
            <NumberInput
              id={`aud-tr-a-${label}-${id}`}
              label={`Tracks affected — Side ${sideA}`}
              value={obj.tracks.a}
              onChange={(n) => onChange({ ...obj, tracks: { ...obj.tracks, a: n } })}
              min={0}
            />
            <NumberInput
              id={`aud-tr-b-${label}-${id}`}
              label={`Tracks affected — Side ${sideB}`}
              value={obj.tracks.b}
              onChange={(n) => onChange({ ...obj, tracks: { ...obj.tracks, b: n } })}
              min={0}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function renderCassetteForm(sealed, item, onChange) {
  const [sideA, sideB] = [item.sides.a, item.sides.b];
  return (
    <>
      {!item.missing && (
        <fieldset className="mg-fieldset">
          <legend>Shell / Label</legend>
          <Check
            id={`c-clean-${item.id}`}
            label="Shell/label clean and bright"
            checked={item.shell.clean}
            onChange={(v) => onChange({ ...item, shell: { ...item.shell, clean: v } })}
          />
          {!sealed && (
            <>
              <Check
                id={`c-write-${item.id}`}
                label="Writing on shell/label"
                checked={item.shell.writing}
                onChange={(v) => onChange({ ...item, shell: { ...item.shell, writing: v } })}
              />
              <Check
                id={`c-stick-${item.id}`}
                label="Stickers or tape on shell"
                checked={item.shell.stickers}
                onChange={(v) => onChange({ ...item, shell: { ...item.shell, stickers: v } })}
              />
              <Check
                id={`c-pad-${item.id}`}
                label="Pressure pad missing or degraded"
                checked={item.shell.pressurePad}
                onChange={(v) => onChange({ ...item, shell: { ...item.shell, pressurePad: v } })}
              />
            </>
          )}
        </fieldset>
      )}

      {!sealed && !item.missing && (
        <fieldset className="mg-fieldset">
          <legend>Mechanics</legend>
          <Check
            id={`c-wrink-${item.id}`}
            label="Tape wrinkled or stretched"
            checked={item.mechanics.tapeWrinkleStretch}
            onChange={(v) => onChange({ ...item, mechanics: { ...item.mechanics, tapeWrinkleStretch: v } })}
          />
          <Check
            id={`c-pack-${item.id}`}
            label="Uneven tape pack"
            checked={item.mechanics.unevenPack}
            onChange={(v) => onChange({ ...item, mechanics: { ...item.mechanics, unevenPack: v } })}
          />
          <Check
            id={`c-roller-${item.id}`}
            label="Roller/capstan wear"
            checked={item.mechanics.rollerWear}
            onChange={(v) => onChange({ ...item, mechanics: { ...item.mechanics, rollerWear: v } })}
          />
        </fieldset>
      )}

      {!item.missing && (
        <fieldset className="mg-fieldset" disabled={sealed}>
          <legend>Audio Performance</legend>
          <Check
            id={`c-noissues-${item.id}`}
            label="Plays cleanly (no notable issues)"
            checked={item.audio.noIssues}
            onChange={(v) => onChange({ ...item, audio: { ...item.audio, noIssues: v } })}
          />

          <div className="mg-audio-block">
            <Check
              id={`c-hiss-${item.id}`}
              label="Hiss/dropouts"
              checked={item.audio.hissDropouts.on}
              onChange={(v) => onChange({ ...item, audio: { ...item.audio, hissDropouts: { ...item.audio.hissDropouts, on: v } } })}
            />
            {item.audio.hissDropouts.on && (
              <div className="mg-subblock">
                <RadioRow
                  name={`c-hiss-sev-${item.id}`}
                  value={item.audio.hissDropouts.severity}
                  onChange={(val) =>
                    onChange({ ...item, audio: { ...item.audio, hissDropouts: { ...item.audio.hissDropouts, severity: val } } })
                  }
                  options={[
                    { value: "mild", label: "Mild" },
                    { value: "moderate", label: "Moderate" },
                    { value: "severe", label: "Severe" },
                  ]}
                />
                <div className="mg-sides">
                  <Check
                    id={`c-hiss-a-${item.id}`}
                    label={`Side ${sideA}`}
                    checked={item.audio.hissDropouts.sides.a}
                    onChange={(v) => onChange({ ...item, audio: { ...item.audio, hissDropouts: { ...item.audio.hissDropouts, sides: { ...item.audio.hissDropouts.sides, a: v } } } })}
                  />
                  <Check
                    id={`c-hiss-b-${item.id}`}
                    label={`Side ${sideB}`}
                    checked={item.audio.hissDropouts.sides.b}
                    onChange={(v) => onChange({ ...item, audio: { ...item.audio, hissDropouts: { ...item.audio.hissDropouts, sides: { ...item.audio.hissDropouts.sides, b: v } } } })}
                  />
                </div>
                <div className="mg-tracks">
                  <NumberInput
                    id={`c-hiss-tr-a-${item.id}`}
                    label={`Tracks affected — Side ${sideA}`}
                    value={item.audio.hissDropouts.tracks.a}
                    onChange={(n) => onChange({ ...item, audio: { ...item.audio, hissDropouts: { ...item.audio.hissDropouts, tracks: { ...item.audio.hissDropouts.tracks, a: n } } } })}
                    min={0}
                  />
                  <NumberInput
                    id={`c-hiss-tr-b-${item.id}`}
                    label={`Tracks affected — Side ${sideB}`}
                    value={item.audio.hissDropouts.tracks.b}
                    onChange={(n) => onChange({ ...item, audio: { ...item.audio, hissDropouts: { ...item.audio.hissDropouts, tracks: { ...item.audio.hissDropouts.tracks, b: n } } } })}
                    min={0}
                  />
                </div>
              </div>
            )}
          </div>

          {renderCassetteAudioSideBlock({
            id: item.id,
            label: "Wow/flutter audible",
            obj: item.audio.wowFlutter,
            sides: [sideA, sideB],
            onChange: (o) => onChange({ ...item, audio: { ...item.audio, wowFlutter: o } }),
          })}

          {renderCassetteAudioSideBlock({
            id: item.id,
            label: "Channel loss / drop",
            obj: item.audio.channelLoss,
            sides: [sideA, sideB],
            onChange: (o) => onChange({ ...item, audio: { ...item.audio, channelLoss: o } }),
          })}

          <p className="mg-subtext">Per-track penalty applies only if any audio defect above is selected.</p>
        </fieldset>
      )}
    </>
  );
}

function renderCassetteAudioSideBlock({ id, label, obj, sides, onChange }) {
  const [a, b] = sides;
  return (
    <div className="mg-audio-block">
      <Check id={`c-${label}-${id}`} label={label} checked={obj.on} onChange={(v) => onChange({ ...obj, on: v })} />
      {obj.on && (
        <div className="mg-subblock">
          <div className="mg-sides">
            <Check id={`c-${label}-a-${id}`} label={`Side ${a}`} checked={obj.sides.a} onChange={(v) => onChange({ ...obj, sides: { ...obj.sides, a: v } })} />
            <Check id={`c-${label}-b-${id}`} label={`Side ${b}`} checked={obj.sides.b} onChange={(v) => onChange({ ...obj, sides: { ...obj.sides, b: v } })} />
          </div>
          <div className="mg-tracks">
            <NumberInput id={`c-${label}-ta-${id}`} label={`Tracks affected — Side ${a}`} value={obj.tracks.a} onChange={(n) => onChange({ ...obj, tracks: { ...obj.tracks, a: n } })} min={0} />
            <NumberInput id={`c-${label}-tb-${id}`} label={`Tracks affected — Side ${b}`} value={obj.tracks.b} onChange={(n) => onChange({ ...obj, tracks: { ...obj.tracks, b: n } })} min={0} />
          </div>
        </div>
      )}
    </div>
  );
}

function renderCDForm(sealed, item, onChange) {
  return (
    <>
      {!item.missing && (
        <fieldset className="mg-fieldset">
          <legend>Visual Appearance</legend>

          {!sealed && (
            <>
              <Check
                id={`cd-scuff-${item.id}`}
                label="Light scuffs visible"
                checked={item.visual.lightScuffs}
                onChange={(v) => onChange({ ...item, visual: { ...item.visual, lightScuffs: v } })}
              />
              <Check
                id={`cd-scratch-${item.id}`}
                label="Scratches present"
                checked={item.visual.scratches}
                onChange={(v) => onChange({ ...item, visual: { ...item.visual, scratches: v } })}
              />
              <Check
                id={`cd-rot-${item.id}`}
                label="Laser-rot/pinholes visible"
                checked={item.visual.rotPinholes}
                onChange={(v) => onChange({ ...item, visual: { ...item.visual, rotPinholes: v } })}
              />
              <Check
                id={`cd-wobble-${item.id}`}
                label="Disc wobble present"
                checked={item.visual.wobble}
                onChange={(v) => onChange({ ...item, visual: { ...item.visual, wobble: v } })}
              />
            </>
          )}
        </fieldset>
      )}

      {!item.missing && (
        <fieldset className="mg-fieldset" disabled={sealed}>
          <legend>Audio Performance</legend>
          <Check
            id={`cd-noerr-${item.id}`}
            label="Plays with no read errors"
            checked={item.audio.noErrors}
            onChange={(v) => onChange({ ...item, audio: { ...item.audio, noErrors: v } })}
          />
          <div className="mg-audio-block">
            <Check
              id={`cd-corr-${item.id}`}
              label="Occasional read errors corrected"
              checked={item.audio.correctedErrors.on}
              onChange={(v) => onChange({ ...item, audio: { ...item.audio, correctedErrors: { ...item.audio.correctedErrors, on: v } } })}
            />
            {item.audio.correctedErrors.on && (
              <div className="mg-subblock">
                <NumberInput
                  id={`cd-corr-tr-${item.id}`}
                  label="Tracks affected (total)"
                  value={item.audio.correctedErrors.tracks}
                  onChange={(n) => onChange({ ...item, audio: { ...item.audio, correctedErrors: { ...item.audio.correctedErrors, tracks: n } } })}
                  min={0}
                />
              </div>
            )}
          </div>
          <div className="mg-audio-block">
            <Check
              id={`cd-unread-${item.id}`}
              label="Unreadable sectors / skipping"
              checked={item.audio.unreadable.on}
              onChange={(v) => onChange({ ...item, audio: { ...item.audio, unreadable: { ...item.audio.unreadable, on: v } } })}
            />
            {item.audio.unreadable.on && (
              <div className="mg-subblock">
                <NumberInput
                  id={`cd-unread-tr-${item.id}`}
                  label="Tracks affected (total)"
                  value={item.audio.unreadable.tracks}
                  onChange={(n) => onChange({ ...item, audio: { ...item.audio, unreadable: { ...item.audio.unreadable, tracks: n } } })}
                  min={0}
                />
              </div>
            )}
          </div>
          <p className="mg-subtext">Per-track penalty applies only when an audio defect above is selected.</p>
        </fieldset>
      )}

      {!item.missing && (
        <fieldset className="mg-fieldset" disabled={sealed}>
          <legend>Hub / Face</legend>
          <Check
            id={`cd-clean-${item.id}`}
            label="Hub/face clean and bright"
            checked={item.hubFace.clean}
            onChange={(v) => onChange({ ...item, hubFace: { ...item.hubFace, clean: v } })}
          />
          <Check
            id={`cd-write-${item.id}`}
            label="Writing on disc face"
            checked={item.hubFace.writing}
            onChange={(v) => onChange({ ...item, hubFace: { ...item.hubFace, writing: v } })}
          />
          <Check
            id={`cd-stick-${item.id}`}
            label="Stickers or tape on disc face"
            checked={item.hubFace.stickers}
            onChange={(v) => onChange({ ...item, hubFace: { ...item.hubFace, stickers: v } })}
          />
          <Check
            id={`cd-hubcrack-${item.id}`}
            label="Hub crack"
            checked={item.hubFace.hubCrack}
            onChange={(v) => onChange({ ...item, hubFace: { ...item.hubFace, hubCrack: v } })}
          />
        </fieldset>
      )}
    </>
  );
}
