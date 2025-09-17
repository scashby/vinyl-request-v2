// src/app/admin/media-grading/page.js
"use client";

import { useState } from "react";
import "styles/media-grading.css";

/**
 * Systematic Media Grading Tool (Admin)
 * Next.js App Router (client component)
 * JavaScript only, no Tailwind, single CSS import above.
 *
 * Grades (exactly 8): M, NM, VG+, VG, G+, G, F, P
 *
 * Scoring:
 *   - Media items and Sleeve start at 100
 *   - Deductions EXACTLY as specified in the brief (see dictionaries below)
 *   - Sleeve "Sealed" bonus +5 (cap at 100), controlled by a GLOBAL toggle above both columns
 *
 * Mint Gate (overall = M) requires:
 *   - Global "Sealed" ON
 *   - Sleeve has zero deductions
 *   - Media has zero deductions
 *
 * Overall Score:
 *   - If both Media and Sleeve present: (Media + Sleeve) / 2
 *   - If either side missing: (Media + Sleeve) / 4
 *   - For multi-disc/tape sets, Media is average of per-item scores (add more items)
 *   - Missing item = 0 for that item (auto P)
 *
 * NOTE (per latest request): Removed “Multi-Disc (2x media) — Show Sides C/D”.
 * Each added Record/Tape represents a separate disc/tape; side controls are A/B only.
 */

const MEDIA_TYPES = {
  vinyl: "Vinyl",
  cassette: "Cassette",
  cd: "CD",
};

const PILL_LABELS = {
  vinyl: "🎵 Vinyl Records",
  cassette: "📼 Cassette Tapes",
  cd: "💿 Compact Discs",
};

function clampScore(n) {
  if (n > 100) return 100;
  if (n < 0) return 0;
  return Math.round(n);
}

function scoreToGrade(score, opts = { sealedOK: false, zeroDeductions: false }) {
  // Mint gate handled here by caller flags
  if (opts.sealedOK && opts.zeroDeductions) return "M";
  if (score >= 97) return "NM";
  if (score >= 85) return "VG+";
  if (score >= 75) return "VG";
  if (score >= 65) return "G+";
  if (score >= 50) return "G";
  if (score >= 35) return "F";
  return "P";
}

function topDeductions(list, topN = 3) {
  const arr = [...list].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return arr.slice(0, topN);
}

function gradeClass(g) {
  if (g === "M" || g === "NM") return "mg-grade-nm";
  if (g === "VG+" || g === "VG") return "mg-grade-vg";
  if (g === "G+" || g === "G") return "mg-grade-g";
  return "mg-grade-fp";
}

/**
 * Media-type dictionaries
 * - which defects allow severity, sides, tracks
 * - penalties required by the brief
 * - additional notes (don’t affect score)
 */
function useMediaDictionaries(mediaType) {
  const isVinyl = mediaType === "vinyl";
  const isCass = mediaType === "cassette";
  const isCD = mediaType === "cd";

  // --- Media: Visual ---
  const visual = isVinyl
    ? [
        { key: "glossyLikeNew", label: "Record has glossy, like-new appearance", penalty: 0, infoOnly: true },
        { key: "lightScuffs", label: "Light scuffs visible", penalty: -3, allowSides: true, allowTracks: true, severity: ["Very light", "Visible", "Multiple"] },
        { key: "scratches", label: "Scratches present", penalty: -8, allowSides: true, allowTracks: true, severity: ["Hairline", "Can feel", "Deep"] },
        { key: "grooveWear", label: "Groove wear visible", penalty: -12, allowSides: true, allowTracks: true, severity: ["Light", "Moderate", "Heavy"] },
        { key: "warping", label: "Warping present", penalty: -10, allowSides: false, allowTracks: false },
      ]
    : isCass
    ? [
        { key: "shellLooksNew", label: "Shell looks like new", penalty: 0, infoOnly: true },
        { key: "shellScuffs", label: "Shell scuffs present", penalty: -12, allowSides: true, allowTracks: true, severity: ["Light rubs", "Noticeable", "Gouges"] },
        { key: "tapeWrinkle", label: "Tape wrinkles/creases visible in window", penalty: -8, allowSides: true, allowTracks: true, severity: ["Minor", "Local crease", "Multiple/edge"] },
      ]
    : [
        { key: "discLooksNew", label: "Disc playing surface looks like new", penalty: 0, infoOnly: true },
        { key: "lightScuffs", label: "Light scuffs visible", penalty: -3, allowSides: false, allowTracks: true, severity: ["Hairlines", "Light swirls", "Multiple"] },
        { key: "scratches", label: "Scratches present", penalty: -8, allowSides: false, allowTracks: true, severity: ["Light", "Moderate", "Deep"] },
        { key: "rotPinholes", label: "Laser-rot / pinholes visible (label/top)", penalty: -12, allowSides: false, allowTracks: true, severity: ["Few", "Several", "Widespread"] },
        { key: "discWobble", label: "Disc wobble present", penalty: -10, allowSides: false, allowTracks: false },
      ];

  // --- Media: Audio ---
  const audio = isVinyl
    ? [
        { key: "playsClean", label: "Plays with no surface noise", penalty: 0, infoOnly: true },
        { key: "surfaceNoise", label: "Surface noise when played", penalty: -6, allowSides: true, allowTracks: true },
        { key: "popsClicks", label: "Occasional pops or clicks", penalty: -4, allowSides: true, allowTracks: true },
        { key: "skipping", label: "Skipping or repeating", penalty: -30, allowSides: true, allowTracks: true },
      ]
    : isCass
    ? [
        { key: "playsClean", label: "Plays with no audible issues", penalty: 0, infoOnly: true },
        { key: "surfaceNoise", label: "Surface noise when played", penalty: -6, allowSides: true, allowTracks: true },
        { key: "wowFlutter", label: "Squeal / wow–flutter audible", penalty: -6, allowSides: true, allowTracks: true },
        { key: "dropouts", label: "Dropouts/jams preventing play", penalty: -30, allowSides: true, allowTracks: true },
      ]
    : [
        { key: "playsClean", label: "Plays with no read errors", penalty: 0, infoOnly: true },
        { key: "correctedErrors", label: "Occasional read errors corrected", penalty: -4, allowTracks: true },
        { key: "unreadable", label: "Unreadable sectors / skipping", penalty: -30, allowTracks: true },
      ];

  // --- Media: Label/Shell/Hub ---
  const labelArea = isVinyl
    ? [
        { key: "labelClean", label: "Label is clean and bright", penalty: 0, infoOnly: true },
        { key: "spindleMarks", label: "Spindle marks present", penalty: -3 },
        { key: "labelWriting", label: "Writing on label", penalty: -3 },
        { key: "labelStickers", label: "Stickers or tape on label", penalty: -3 },
      ]
    : isCass
    ? [
        { key: "labelClean", label: "Shell/label is clean and bright", penalty: 0, infoOnly: true },
        { key: "labelWriting", label: "Writing on shell/label", penalty: -3 },
        { key: "labelStickers", label: "Stickers or tape on shell", penalty: -3 },
        { key: "shellCracked", label: "Shell cracked / hinge damage", penalty: -12 },
        { key: "padDegraded", label: "Pressure pad rusted / degraded", penalty: -6 },
        { key: "padMissing", label: "Pressure pad missing", penalty: -30 },
      ]
    : [
        { key: "labelClean", label: "Hub/face is clean and bright", penalty: 0, infoOnly: true },
        { key: "labelWriting", label: "Writing on hub/face", penalty: -3 },
        { key: "labelStickers", label: "Stickers or tape on hub/face", penalty: -3 },
      ];

  // --- Sleeve: Overall ---
  const sleeveOverall = isCass
    ? [
        { key: "looksNew", label: "Looks like new, no flaws", penalty: 0, infoOnly: true },
        { key: "minorShelf", label: "Minor shelf wear only", penalty: -3 },
        { key: "cornerWear", label: "Corner wear present (inlay/case edges)", penalty: -4 },
      ]
    : isCD
    ? [
        { key: "looksNew", label: "Looks like new, no flaws", penalty: 0, infoOnly: true },
        { key: "minorShelf", label: "Minor shelf wear only", penalty: -3 },
        { key: "cornerWear", label: "Corner wear present (insert/digipak)", penalty: -4 },
        { key: "ringWear", label: "Booklet ring wear visible", penalty: -5 },
      ]
    : [
        { key: "looksNew", label: "Looks like new, no flaws", penalty: 0, infoOnly: true },
        { key: "minorShelf", label: "Minor shelf wear only", penalty: -3 },
        { key: "cornerWear", label: "Corner wear present", penalty: -4 },
        { key: "ringWear", label: "Ring wear visible", penalty: -5 },
      ];

  // --- Sleeve: Structure ---
  const sleeveStructure = isCD
    ? [
        { key: "bookletSpineWear", label: "Insert/booklet spine wear or fold wear", penalty: -3 },
        { key: "digipakPanelWear", label: "Digipak/box panel wear", penalty: -3 },
      ]
    : isCass
    ? [{ key: "inlayFoldWear", label: "J-card fold wear / creases", penalty: -3 }]
    : [
        { key: "seamsIntact", label: "All seams intact", penalty: 0, infoOnly: true },
        { key: "seamSplit", label: "Seam splits present", penalty: -12 },
        { key: "spineWear", label: "Spine shows wear", penalty: -3 },
      ];

  // --- Sleeve: Damage ---
  const sleeveDamage = [
    { key: "creases", label: "Creases / crushing present", penalty: -3 },
    { key: "tears", label: "Tears present", penalty: -8 },
    { key: "writing", label: "Writing present", penalty: -4 },
    { key: "stickers", label: "Stickers or tape", penalty: -3 },
  ];

  // --- Additional notes (don’t affect score) ---
  const notes = isCD
    ? [
        "Standard jewel case cracked (replaceable)",
        "Tray teeth broken (replaceable)",
        "Custom case / box / digipak",
        "OBI present",
        "Promotional copy",
        "Slipcase included",
        "Special/limited edition",
      ]
    : isCass
    ? [
        "Standard Norelco case cracked (replaceable)",
        "Stickered case",
        "Custom/collectible case",
        "Original shrinkwrap (opened)",
        "OBI present",
        "Promotional copy",
        "Shell color variant",
        "Limited edition",
      ]
    : [
        "Original shrinkwrap (opened)",
        "Hype sticker present",
        "Cut-out hole/notch/corner cut",
        "Promotional copy",
        "Price sticker/tag",
        "First pressing",
        "Gatefold sleeve",
        "Original inner sleeve",
        "Generic/company sleeve",
      ];

  // Headings
  const mediaTitle = isVinyl
    ? "🎶 Vinyl Record Condition Assessment"
    : isCass
    ? "🎶 Cassette Condition Assessment"
    : "🎶 Compact Disc Condition Assessment";

  const itemLegendLabel = isVinyl ? "Record" : isCass ? "Tape" : "Disc";

  const packagingTitle = isVinyl
    ? "📦 Jacket & Packaging Condition Assessment"
    : isCass
    ? "📦 J-Card & Case Packaging Condition Assessment"
    : "📦 Booklet / Digipak / Packaging Condition Assessment";

  const packagingStructureLegend = isVinyl ? "Seams & Structure" : isCass ? "J-Card & Inlay" : "Insert / Digipak";

  return {
    visual,
    audio,
    labelArea,
    sleeveOverall,
    sleeveStructure,
    sleeveDamage,
    notes,
    mediaTitle,
    itemLegendLabel,
    packagingTitle,
    packagingStructureLegend,
    sidesEnabled: !isCD, // A/B only
    showCaseIsNote: isCass || isCD,
  };
}

function newMediaItem() {
  return {
    missing: false,
    visual: {},
    audio: {},
    labelArea: {},
    meta: {}, // per-defect meta: severity, tracks, sides
  };
}

function initialState(mediaType) {
  return {
    mediaType,
    sealedGlobal: false, // GLOBAL “Sealed (factory shrink intact)”
    items: [newMediaItem()],
    sleeve: {
      missing: false,
      overall: {},
      structure: {},
      damage: {},
      notes: {},
      customNotes: "",
    },
  };
}

function ensureMeta(item, key, sidesEnabled) {
  const existing = item.meta?.[key];
  if (existing) return existing;
  return {
    severity: "",
    tracks: 0,
    sides: sidesEnabled ? { A: false, B: false } : {},
  };
}

function computeMediaItemScore(item, dict) {
  if (item.missing) {
    return {
      score: 0,
      penalties: [{ label: "Media missing (auto P)", value: -100 }],
      zeroDeductions: false,
    };
  }

  let score = 100;
  const penalties = [];
  let totalAudioTracks = 0;

  // Visual
  dict.visual.forEach((v) => {
    if (!item.visual[v.key] || v.infoOnly) return;
    score += v.penalty;
    if (v.penalty) {
      const meta = item.meta?.[v.key];
      const bits = [];
      if (meta?.severity) bits.push(meta.severity);
      if (meta?.sides && Object.values(meta.sides).some(Boolean)) {
        const sides = ["A", "B"].filter((s) => meta.sides[s]).join("/");
        if (sides) bits.push(`Side ${sides}`);
      }
      if (v.allowTracks && meta?.tracks > 0) bits.push(`${meta.tracks} track(s) noted`);
      const extra = bits.length ? ` — ${bits.join("; ")}` : "";
      penalties.push({ label: `${v.label}${extra}`, value: v.penalty });
    }
  });

  // Audio
  dict.audio.forEach((a) => {
    if (!item.audio[a.key] || a.infoOnly) return;
    score += a.penalty;
    const meta = item.meta?.[a.key];
    const bits = [];
    if (meta?.severity) bits.push(meta.severity);
    if (meta?.sides && Object.values(meta.sides).some(Boolean)) {
      const sides = ["A", "B"].filter((s) => meta.sides[s]).join("/");
      if (sides) bits.push(`Side ${sides}`);
    }
    if (a.allowTracks && meta?.tracks > 0) {
      bits.push(`${meta.tracks} track(s) affected`);
      totalAudioTracks += meta.tracks;
    }
    const extra = bits.length ? ` — ${bits.join("; ")}` : "";
    penalties.push({ label: `${a.label}${extra}`, value: a.penalty });
  });

  // Label/center/shell/hub
  Object.entries(item.labelArea || {}).forEach(([key, on]) => {
    if (!on) return;
    const def = dict.labelArea.find((d) => d.key === key);
    if (!def || def.infoOnly) return;
    score += def.penalty || 0;
    if (def.penalty) penalties.push({ label: def.label, value: def.penalty });
  });

  if (totalAudioTracks > 0) {
    const perTrack = -1 * totalAudioTracks;
    score += perTrack;
    penalties.push({ label: `Tracks affected (−1 × ${totalAudioTracks})`, value: perTrack });
  }

  return { score: clampScore(score), penalties, zeroDeductions: penalties.length === 0 };
}

function computeAggregatedMedia(items, dict) {
  const results = items.map((it) => computeMediaItemScore(it, dict));
  const avg = results.length ? Math.round(results.reduce((a, r) => a + r.score, 0) / results.length) : 0;
  const zero = results.every((r) => r.zeroDeductions);
  return { perItem: results, score: avg, zeroDeductions: zero };
}

function computeSleeveScore(sleeve, dict, sealedGlobal) {
  if (sleeve.missing) {
    return {
      score: 0,
      penalties: [{ label: "Packaging missing (auto P)", value: -100 }],
      sealed: sealedGlobal,
      zeroDeductions: false,
    };
  }

  let score = 100;
  const penalties = [];

  // Global sealed adds +5
  if (sealedGlobal) {
    score = Math.min(100, score + 5);
  }

  dict.sleeveOverall.forEach((o) => {
    if (!sleeve.overall[o.key] || o.infoOnly) return;
    score += o.penalty || 0;
    if (o.penalty) penalties.push({ label: o.label, value: o.penalty });
  });

  dict.sleeveStructure.forEach((s) => {
    if (!sleeve.structure[s.key] || s.infoOnly) return;
    score += s.penalty || 0;
    if (s.penalty) penalties.push({ label: s.label, value: s.penalty });
  });

  dict.sleeveDamage.forEach((d) => {
    if (!sleeve.damage[d.key]) return;
    score += d.penalty || 0;
    if (d.penalty) penalties.push({ label: d.label, value: d.penalty });
  });

  return { score: clampScore(score), penalties, sealed: sealedGlobal, zeroDeductions: penalties.length === 0 };
}

export default function MediaGradingPage() {
  const [mediaType, setMediaType] = useState("vinyl");
  const dict = useMediaDictionaries(mediaType);
  const [state, setState] = useState(() => initialState(mediaType));

  function changeMediaType(next) {
    setMediaType(next);
    setState(initialState(next));
  }

  function setSealedGlobal(val) {
    setState((s) => ({ ...s, sealedGlobal: val }));
  }

  // per-item helpers
  function updateItem(idx, patch) {
    setState((s) => {
      const items = s.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
      return { ...s, items };
    });
  }
  function toggleItemCheck(idx, group, key) {
    setState((s) => {
      const items = s.items.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...(it[group] || {}), [key]: !it[group]?.[key] };
        let meta = it.meta || {};
        if (next[key] && !meta[key]) {
          meta = { ...meta, [key]: ensureMeta(it, key, dict.sidesEnabled) };
        }
        return { ...it, [group]: next, meta };
      });
      return { ...s, items };
    });
  }
  function updateDefectMeta(idx, key, patch) {
    setState((s) => {
      const items = s.items.map((it, i) => {
        if (i !== idx) return it;
        const current = ensureMeta(it, key, dict.sidesEnabled);
        return { ...it, meta: { ...(it.meta || {}), [key]: { ...current, ...patch } } };
      });
      return { ...s, items };
    });
  }
  function toggleDefectSide(idx, key, sideKey) {
    setState((s) => {
      const items = s.items.map((it, i) => {
        if (i !== idx) return it;
        const current = ensureMeta(it, key, dict.sidesEnabled);
        const sides = { ...(current.sides || {}), [sideKey]: !current.sides?.[sideKey] };
        return { ...it, meta: { ...(it.meta || {}), [key]: { ...current, sides } } };
      });
      return { ...s, items };
    });
  }
  function addItem() {
    setState((s) => ({ ...s, items: [...s.items, newMediaItem()] }));
  }
  function removeItem(idx) {
    setState((s) => {
      const next = [...s.items];
      next.splice(idx, 1);
      return { ...s, items: next.length ? next : [newMediaItem()] };
    });
  }

  // sleeve helpers
  function toggleSleeve(group, key) {
    setState((s) => {
      const g = s.sleeve[group] || {};
      return { ...s, sleeve: { ...s.sleeve, [group]: { ...g, [key]: !g[key] } } };
    });
  }
  function setSleeveMissing(val) {
    setState((s) => ({ ...s, sleeve: { ...s.sleeve, missing: val } }));
  }
  function toggleNote(label) {
    setState((s) => {
      const notes = { ...(s.sleeve.notes || {}) };
      notes[label] = !notes[label];
      return { ...s, sleeve: { ...s.sleeve, notes } };
    });
  }
  function updateCustomNotes(val) {
    setState((s) => ({ ...s, sleeve: { ...s.sleeve, customNotes: val } }));
  }

  // calculations
  const aggregated = computeAggregatedMedia(state.items, dict);
  const sleeveCalc = computeSleeveScore(state.sleeve, dict, state.sealedGlobal);

  const usingMedia = !state.items.every((it) => it.missing);
  const usingSleeve = !state.sleeve.missing;

  // ✅ FIX: respect Mint for sealed media (vinyl only if no warping selected)
  const mediaGrade = scoreToGrade(aggregated.score, {
    sealedOK: state.sealedGlobal,
    zeroDeductions: aggregated.zeroDeductions,
  });

  const sleeveGrade = scoreToGrade(sleeveCalc.score, {
    sealedOK: sleeveCalc.sealed,
    zeroDeductions: sleeveCalc.zeroDeductions,
  });

  const mintEligible =
    usingMedia && usingSleeve && state.sealedGlobal && aggregated.zeroDeductions && sleeveCalc.zeroDeductions;

  let overallScoreRaw;
  if (mintEligible) {
    overallScoreRaw = 100;
  } else if (usingMedia && usingSleeve) {
    overallScoreRaw = (aggregated.score + sleeveCalc.score) / 2;
  } else {
    overallScoreRaw = (aggregated.score + sleeveCalc.score) / 4;
  }
  const overallScore = Math.round(overallScoreRaw);
  const overallGrade = mintEligible ? "M" : scoreToGrade(overallScore);

  const topMedia = topDeductions(aggregated.perItem.flatMap((r) => r.penalties));
  const topSleeve = topDeductions(sleeveCalc.penalties);

  let whyOverall = "";
  if (mintEligible) {
    whyOverall = "Overall = M because the item is sealed and both media and packaging have zero deductions.";
  } else if (usingMedia && usingSleeve) {
    whyOverall = `Overall = average of Media and Packaging: (${aggregated.score} + ${sleeveCalc.score}) / 2 = ${(
      (aggregated.score + sleeveCalc.score) / 2
    ).toFixed(1)} → ${overallGrade}.`;
  } else {
    whyOverall = `Overall = (Media + Packaging) / 4 due to missing component(s): (${aggregated.score} + ${
      sleeveCalc.score
    }) / 4 = ${((aggregated.score + sleeveCalc.score) / 4).toFixed(1)} → ${overallGrade}.`;
  }

  const addLabel =
    mediaType === "vinyl" ? "Add Another Record" : mediaType === "cassette" ? "Add Another Tape" : "Add Another Disc";

  // --- Sealed UI filtering rules ---
  const sealed = state.sealedGlobal;
  const showOnlyVinylWarping = sealed && mediaType === "vinyl";
  const hideMediaEntirely = sealed && (mediaType === "cassette" || mediaType === "cd");
  const allowedSleeveWhenSealed = new Set(["minorShelf", "cornerWear", "creases"]);
  function sealedSleeveFilter(group) {
    if (!sealed) return group;
    return group.filter((item) => allowedSleeveWhenSealed.has(item.key));
  }

  return (
    <div id="media-grading" className="mg-wrap">
      <header className="mg-header">
        <div className="mg-title">🔍 Systematic Media Grading Tool</div>
        <div className="mg-sub">Detailed condition assessment with automatic grading calculation</div>
      </header>

      <div className="mg-pills" role="tablist" aria-label="Select media type">
        {Object.keys(MEDIA_TYPES).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={mediaType === key}
            className={`mg-pill ${mediaType === key ? "selected" : ""}`}
            onClick={() => changeMediaType(key)}
          >
            {PILL_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Global Sealed Toggle */}
      <section className="mg-card mg-sealed">
        <label className="mg-check">
          <input type="checkbox" checked={state.sealedGlobal} onChange={(e) => setSealedGlobal(e.target.checked)} />
          <span>Sealed (factory shrink intact)</span>
        </label>
        <div className="mg-help">
          When <strong>Sealed</strong> is on: Vinyl allows evaluating only <em>Warping present</em> (media) and sleeve{" "}
          <em>Minor shelf wear</em>,<em> Corner wear</em>, <em>Creases/crushing</em>. Cassettes/CDs default to Mint
          unless such exterior wear is observed. Sealed adds +5 to packaging (capped at 100). Mint (M) is only allowed
          if sealed & flawless (zero deductions on both sides).
        </div>
      </section>

      <div className="mg-grid">
        {/* MEDIA COLUMN */}
        <section className="mg-card mg-item">
          <div className="mg-item-header">
            <h2>
              {mediaType === "vinyl"
                ? "🎶 Vinyl Record Condition Assessment"
                : mediaType === "cassette"
                ? "🎶 Cassette Condition Assessment"
                : "🎶 Compact Disc Condition Assessment"}
            </h2>
            {!hideMediaEntirely && (
              <div className="mg-item-actions">
                <button className="mg-btn ghost" onClick={addItem}>
                  {addLabel}
                </button>
              </div>
            )}
          </div>

          {hideMediaEntirely ? (
            <div className="mg-help">
              Sealed {MEDIA_TYPES[mediaType]}: media evaluation is not required unless the seal is compromised.
            </div>
          ) : (
            state.items.map((it, idx) => (
              <fieldset key={idx} className="mg-fieldset">
                <legend>{dict.itemLegendLabel} #{idx + 1}</legend>

                {!sealed && (
                  <label className="mg-check">
                    <input
                      type="checkbox"
                      checked={!!it.missing}
                      onChange={(e) => updateItem(idx, { missing: e.target.checked })}
                    />
                    <span>Mark this media as Missing (auto P)</span>
                  </label>
                )}

                {/* Visual Appearance */}
                <fieldset className={`mg-fieldset mg-fieldset-inner ${it.missing ? "mg-disabled" : ""}`}>
                  <legend>Visual Appearance</legend>
                  {dict.visual
                    .filter((v) => (showOnlyVinylWarping ? v.key === "warping" : true))
                    .map((v) => {
                      const checked = !!it.visual[v.key];
                      const meta = ensureMeta(it, v.key, dict.sidesEnabled);
                      return (
                        <div key={v.key}>
                          <label className="mg-check">
                            <input
                              type="checkbox"
                              disabled={it.missing}
                              checked={checked}
                              onChange={() => toggleItemCheck(idx, "visual", v.key)}
                            />
                            <span>{v.label}</span>
                          </label>

                          {checked && (
                            <div className="mg-sub-extent">
                              {v.severity && !sealed && (
                                <div className="mg-subgroup" role="radiogroup" aria-label="Severity">
                                  {v.severity.map((sOpt) => (
                                    <label key={sOpt} className="mg-radio">
                                      <input
                                        type="radio"
                                        name={`sev-${idx}-${v.key}`}
                                        checked={meta.severity === sOpt}
                                        onChange={() => updateDefectMeta(idx, v.key, { severity: sOpt })}
                                      />
                                      <span>{sOpt}</span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              {dict.sidesEnabled && v.allowSides && !sealed && (
                                <div className="mg-sides-grid" aria-label="Which side(s) affected">
                                  {["A", "B"].map((sKey) => (
                                    <label key={sKey} className="mg-check">
                                      <input
                                        type="checkbox"
                                        checked={!!meta.sides[sKey]}
                                        onChange={() => toggleDefectSide(idx, v.key, sKey)}
                                      />
                                      <span>Side {sKey}</span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              {v.allowTracks && !sealed && (
                                <>
                                  <div className="mg-number">
                                    <label htmlFor={`v-tracks-${idx}-${v.key}`}>Tracks affected</label>
                                    <input
                                      id={`v-tracks-${idx}-${v.key}`}
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={meta.tracks || 0}
                                      onChange={(e) =>
                                        updateDefectMeta(idx, v.key, {
                                          tracks: Math.max(0, parseInt(e.target.value || "0", 10)),
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="mg-help">
                                    Visual track counts are disclosure only; −1/track applies to audio defects.
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </fieldset>

                {/* Audio Performance */}
                {!sealed && (
                  <fieldset className={`mg-fieldset mg-fieldset-inner ${it.missing ? "mg-disabled" : ""}`}>
                    <legend>Audio Performance</legend>
                    {dict.audio.map((a) => {
                      const checked = !!it.audio[a.key];
                      const meta = ensureMeta(it, a.key, dict.sidesEnabled);
                      return (
                        <div key={a.key}>
                          <label className="mg-check">
                            <input
                              type="checkbox"
                              disabled={it.missing}
                              checked={checked}
                              onChange={() => toggleItemCheck(idx, "audio", a.key)}
                            />
                            <span>{a.label}</span>
                          </label>

                          {checked && (
                            <div className="mg-sub-extent">
                              {a.severity && (
                                <div className="mg-subgroup" role="radiogroup" aria-label="Severity">
                                  {a.severity.map((sOpt) => (
                                    <label key={sOpt} className="mg-radio">
                                      <input
                                        type="radio"
                                        name={`sev-${idx}-${a.key}`}
                                        checked={meta.severity === sOpt}
                                        onChange={() => updateDefectMeta(idx, a.key, { severity: sOpt })}
                                      />
                                      <span>{sOpt}</span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              {dict.sidesEnabled && a.allowSides && (
                                <div className="mg-sides-grid" aria-label="Which side(s) affected">
                                  {["A", "B"].map((sKey) => (
                                    <label key={sKey} className="mg-check">
                                      <input
                                        type="checkbox"
                                        checked={!!meta.sides[sKey]}
                                        onChange={() => toggleDefectSide(idx, a.key, sKey)}
                                      />
                                      <span>Side {sKey}</span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              {a.allowTracks && (
                                <>
                                  <div className="mg-number">
                                    <label htmlFor={`a-tracks-${idx}-${a.key}`}>Tracks affected</label>
                                    <input
                                      id={`a-tracks-${idx}-${a.key}`}
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={meta.tracks || 0}
                                      onChange={(e) =>
                                        updateDefectMeta(idx, a.key, {
                                          tracks: Math.max(0, parseInt(e.target.value || "0", 10)),
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="mg-help">−1 per track applies to audio defects.</div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </fieldset>
                )}

                {/* Label/Center / Shell / Hub */}
                {!sealed && (
                  <fieldset className={`mg-fieldset mg-fieldset-inner ${it.missing ? "mg-disabled" : ""}`}>
                    <legend>
                      {mediaType === "vinyl"
                        ? "Label / Center"
                        : mediaType === "cassette"
                        ? "Shell / Label"
                        : "Hub / Face"}
                    </legend>
                    {dict.labelArea.map((l) => (
                      <label key={l.key} className="mg-check">
                        <input
                          type="checkbox"
                          disabled={it.missing}
                          checked={!!it.labelArea[l.key]}
                          onChange={() => toggleItemCheck(idx, "labelArea", l.key)}
                        />
                        <span>{l.label}</span>
                      </label>
                    ))}
                  </fieldset>
                )}

                <div className="mg-item-controls">
                  {state.items.length > 1 && !sealed && (
                    <button className="mg-btn" onClick={() => removeItem(idx)}>
                      Remove
                    </button>
                  )}
                </div>

                <div className="mg-per-item-result">
                  {(() => {
                    const calc = computeMediaItemScore(it, dict);
                    const g = scoreToGrade(calc.score, {
                      sealedOK: state.sealedGlobal,
                      zeroDeductions: calc.zeroDeductions,
                    });
                    return (
                      <span className="mg-chip">
                        Item #{idx + 1}: {g} ({calc.score})
                      </span>
                    );
                  })()}
                </div>
              </fieldset>
            ))
          )}
        </section>

        {/* PACKAGING COLUMN */}
        <section className="mg-card">
          <div className="mg-item-header">
            <h2>{dict.packagingTitle}</h2>
          </div>

          <fieldset className="mg-fieldset">
            <legend>Packaging Scope</legend>
            {!sealed && (
              <label className="mg-check">
                <input
                  type="checkbox"
                  checked={!!state.sleeve.missing}
                  onChange={(e) => setSleeveMissing(e.target.checked)}
                />
                <span>Mark packaging as Missing (auto P)</span>
              </label>
            )}
            {sealed && <div className="mg-help">Packaging is sealed; only exterior wear can be evaluated.</div>}
          </fieldset>

          {/* Overall Appearance */}
          <fieldset className={`mg-fieldset mg-fieldset-inner ${state.sleeve.missing ? "mg-disabled" : ""}`}>
            <legend>Overall Appearance</legend>
            {sealedSleeveFilter(dict.sleeveOverall).map((o) => (
              <label key={o.key} className="mg-check">
                <input
                  type="checkbox"
                  disabled={state.sleeve.missing}
                  checked={!!state.sleeve.overall[o.key]}
                  onChange={() => toggleSleeve("overall", o.key)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </fieldset>

          {/* Structure / Inlay */}
          {!sealed && (
            <fieldset className={`mg-fieldset mg-fieldset-inner ${state.sleeve.missing ? "mg-disabled" : ""}`}>
              <legend>{dict.packagingStructureLegend}</legend>
              {dict.sleeveStructure.map((s) => (
                <label key={s.key} className="mg-check">
                  <input
                    type="checkbox"
                    disabled={state.sleeve.missing}
                    checked={!!state.sleeve.structure[s.key]}
                    onChange={() => toggleSleeve("structure", s.key)}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
              {dict.showCaseIsNote && (
                <div className="mg-help">
                  Standard plastic cases (jewel/Norelco) are replaceable and not graded; note case issues in{" "}
                  <em>Additional notes</em>.
                </div>
              )}
            </fieldset>
          )}

          {/* Damage & Markings */}
          <fieldset className={`mg-fieldset mg-fieldset-inner ${state.sleeve.missing ? "mg-disabled" : ""}`}>
            <legend>Damage & Markings</legend>
            {sealedSleeveFilter(dict.sleeveDamage).map((d) => (
              <label key={d.key} className="mg-check">
                <input
                  type="checkbox"
                  disabled={state.sleeve.missing}
                  checked={!!state.sleeve.damage[d.key]}
                  onChange={() => toggleSleeve("damage", d.key)}
                />
                <span>{d.label}</span>
              </label>
            ))}
          </fieldset>

          {/* Additional notes (do not affect score) */}
          <fieldset className="mg-fieldset mg-fieldset-inner">
            <legend>Additional notes (don’t affect score)</legend>
            <div className="mg-notes-grid">
              {dict.notes.map((n) => (
                <label key={n} className="mg-check">
                  <input type="checkbox" checked={!!state.sleeve.notes[n]} onChange={() => toggleNote(n)} />
                  <span>{n}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>
      </div>

      {/* Custom notes */}
      <section className="mg-card mg-notes">
        <h3>📝 Custom Condition Notes</h3>
        <textarea
          value={state.sleeve.customNotes}
          onChange={(e) => updateCustomNotes(e.target.value)}
          aria-label="Custom condition notes"
        />
      </section>

      {/* Results */}
      <section className="mg-results">
        <div className={`mg-card mg-result ${gradeClass(mediaGrade)}`}>
          <div className="mg-result-title">
            {mediaType === "vinyl" ? "Record Grade" : mediaType === "cassette" ? "Tape Grade" : "Disc Grade"}
          </div>
          <div className="mg-result-grade">{mediaGrade}</div>
          <div className="mg-result-score">{aggregated.score}/100</div>
        </div>

        <div className={`mg-card mg-result ${gradeClass(sleeveGrade)}`}>
          <div className="mg-result-title">Sleeve/Packaging Grade</div>
          <div className="mg-result-grade">{sleeveGrade}</div>
          <div className="mg-result-score">{sleeveCalc.score}/100</div>
        </div>

        <div className={`mg-card mg-result ${gradeClass(overallGrade)}`}>
          <div className="mg-result-title">Overall Grade</div>
          <div className="mg-result-grade">{overallGrade}</div>
          <div className="mg-result-score">{overallScore}/100</div>
        </div>
      </section>

      {/* Explanation */}
      <section className="mg-card">
        <div className="mg-expl-title">Grading Explanation</div>
        <div>
          <strong>Media:</strong>{" "}
          {topMedia.length ? (
            <ul>
              {topMedia.map((p, i) => (
                <li key={i}>
                  {p.label} ({p.value})
                </li>
              ))}
            </ul>
          ) : (
            "No deductions."
          )}
        </div>
        <div style={{ marginTop: 8 }}>
          <strong>Packaging:</strong>{" "}
          {topSleeve.length ? (
            <ul>
              {topSleeve.map((p, i) => (
                <li key={i}>
                  {p.label} ({p.value})
                </li>
              ))}
            </ul>
          ) : (
            "No deductions."
          )}
        </div>
        <div style={{ marginTop: 8 }}>{whyOverall}</div>
        <div style={{ marginTop: 8 }}>
          {aggregated.perItem.map((r, i) => {
            const g = scoreToGrade(r.score, { sealedOK: state.sealedGlobal, zeroDeductions: r.zeroDeductions });
            return (
              <span key={i} className="mg-chip" style={{ marginRight: 6 }}>
                Item #{i + 1}: {g} ({r.score})
              </span>
            );
          })}
        </div>
        {Object.keys(state.sleeve.notes || {}).some((k) => state.sleeve.notes[k]) && (
          <div style={{ marginTop: 8 }}>
            <strong>Additional notes:</strong>{" "}
            {Object.keys(state.sleeve.notes)
              .filter((k) => state.sleeve.notes[k])
              .join(" • ")}
          </div>
        )}
      </section>
    </div>
  );
}
