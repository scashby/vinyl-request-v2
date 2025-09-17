// src/app/admin/media-grading/page.js
"use client";

import { useState } from "react";
import "styles/media-grading.css";

/**
 * Systematic Media Grading Tool (Next.js App Router, client page)
 * JavaScript only, React hooks, no external state libs.
 *
 * Grades (exactly 8): M, NM, VG+, VG, G+, G, F, P
 * - M is reachable ONLY if packaging is Sealed AND has zero deductions AND media has zero deductions.
 * - Otherwise NM is the ceiling.
 *
 * Scores start at 100 and deduct via the default weights below (EXACT as requested).
 * Sleeve "Sealed" adds +5 (cap at 100) and appears first.
 *
 * Thresholds (non-Mint path):
 *   97–100: NM
 *   85–91:  VG+
 *   75–84:  VG
 *   65–74:  G+
 *   50–64:  G
 *   35–49:  F
 *   <35:    P
 *
 * Overall formula (per your revision):
 *   - Compute Media score. For multi-disc sets, average all discs/tapes (missing item = score 0).
 *   - If BOTH Media and Packaging are present: OverallScore = (MediaScore + PackagingScore) / 2.
 *   - If EITHER side is missing: OverallScore = (MediaScore + PackagingScore) / 4  (punishes missing components).
 *   - Overall grade = grade(overallScore) except when Mint gate is satisfied (see below).
 *
 * Mint gate:
 *   - Overall = M only if: Packaging "Sealed" is checked AND Packaging has zero deductions AND Media has zero deductions.
 *
 * Penalties (defaults EXACTLY as specified):
 * Media:
 *  - Light scuffs: −3
 *  - Scratches: −8
 *  - Groove wear / laser-rot / shell scuffs: −12
 *  - Warping / wobble: −10
 *  - Surface noise: −6
 *  - Pops/clicks / corrected read errors: −4
 *  - Skipping/repeating / unreadable sectors: −30
 *  - Label/shell/hub defects: −3 each
 *  - Per-track penalty: −1 × totalTracksAffected (ONLY counts tracks from Audio defects)
 *
 * Sleeve/Packaging:
 *  - Minor shelf wear: −3
 *  - Corner wear: −4
 *  - Ring wear / booklet ring wear: −5
 *  - Spine wear (or inlay/booklet fold wear): −3
 *  - Seam split (vinyl only): −12
 *  - Tears: −8
 *  - Writing: −4
 *  - Stickers/tape: −3
 *  - Creases/crushing: −3
 *  - Sealed intact: +5 (cap 100)
 *
 * Notes (CD/cassette): Standard plastic cases (jewel/Norelco) are NOT graded (replaceable).
 * Record any case issues in Additional Notes.
 */

const PILL_LABELS = {
  vinyl: "🎵 Vinyl Records",
  cassette: "📼 Cassette Tapes",
  cd: "💿 Compact Discs",
};

function scoreToGrade(score, opts = { sealedOK: false, zeroDeductions: false }) {
  if (opts.sealedOK && opts.zeroDeductions) return "M";
  if (score >= 97) return "NM";
  if (score >= 85) return "VG+";
  if (score >= 75) return "VG";
  if (score >= 65) return "G+";
  if (score >= 50) return "G";
  if (score >= 35) return "F";
  return "P";
}
function clampScore(x) {
  if (x > 100) return 100;
  if (x < 0) return 0;
  return Math.round(x);
}
function topDeductions(penalties, topN = 3) {
  const arr = [...penalties].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return arr.slice(0, topN);
}

const MEDIA_TYPES = {
  vinyl: "Vinyl",
  cassette: "Cassette",
  cd: "CD",
};

function useMediaDictionaries(mediaType) {
  const isVinyl = mediaType === "vinyl";
  const isCass = mediaType === "cassette";
  const isCD = mediaType === "cd";

  const visual = isVinyl
    ? [
        { key: "glossyLikeNew", label: "Record has glossy, like-new appearance", penalty: 0, infoOnly: true },
        {
          key: "lightScuffs",
          label: "Light scuffs visible",
          penalty: -3,
          allowSides: true,
          allowTracks: true, // disclosure only (not counted in -1/track)
          severity: ["Very light, barely visible", "Visible but not deep", "Obvious, multiple scuffs"],
        },
        {
          key: "scratches",
          label: "Scratches present",
          penalty: -8,
          allowSides: true,
          allowTracks: true,
          severity: ["Hairline scratches only", "Can feel with fingernail", "Deep, visible grooves"],
        },
        {
          key: "grooveWear",
          label: "Groove wear visible",
          penalty: -12,
          allowSides: true,
          allowTracks: true,
          severity: ["Light", "Moderate", "Heavy"],
        },
        {
          key: "warping",
          label: "Warping present",
          penalty: -10,
          allowSides: false,
          allowTracks: false,
        },
      ]
    : isCass
    ? [
        { key: "shellLooksNew", label: "Shell looks like new", penalty: 0, infoOnly: true },
        {
          key: "shellScuffs",
          label: "Shell scuffs present",
          penalty: -12, // maps to "groove wear / shell scuffs"
          allowSides: true,
          allowTracks: true, // disclosure only
          severity: ["Light rubs", "Noticeable scuffs", "Deep gouges"],
        },
        {
          key: "tapeWrinkle",
          label: "Tape wrinkles/creases visible in window",
          penalty: -8, // maps to "scratches"
          allowSides: true,
          allowTracks: true,
          severity: ["Minor wrinkle", "Local crease", "Multiple wrinkles/edge damage"],
        },
        // no warping for tape media
      ]
    : [
        { key: "discLooksNew", label: "Disc playing surface looks like new", penalty: 0, infoOnly: true },
        {
          key: "lightScuffs",
          label: "Light scuffs visible",
          penalty: -3,
          allowSides: false,
          allowTracks: true, // disclosure only
          severity: ["Hairlines", "Light swirls", "Multiple light scuffs"],
        },
        {
          key: "scratches",
          label: "Scratches present",
          penalty: -8,
          allowSides: false,
          allowTracks: true,
          severity: ["Light", "Moderate", "Deep"],
        },
        {
          key: "rotPinholes",
          label: "Laser-rot / pinholes visible (label/top side)",
          penalty: -12,
          allowSides: false,
          allowTracks: true,
          severity: ["Few", "Several", "Widespread"],
        },
        { key: "discWobble", label: "Disc wobble present", penalty: -10, allowSides: false, allowTracks: false },
      ];

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
        { key: "correctedErrors", label: "Occasional read errors corrected", penalty: -4, allowSides: false, allowTracks: true },
        { key: "unreadable", label: "Unreadable sectors / skipping", penalty: -30, allowSides: false, allowTracks: true },
      ];

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
        { key: "pressurePadBad", label: "Pressure pad rusted / degraded", penalty: -6 },
        { key: "pressurePadMissing", label: "Pressure pad missing", penalty: -30 },
      ]
    : [
        { key: "labelClean", label: "Hub/face is clean and bright", penalty: 0, infoOnly: true },
        { key: "labelWriting", label: "Writing on hub/face", penalty: -3 },
        { key: "labelStickers", label: "Stickers or tape on hub/face", penalty: -3 },
      ];

  const sleeveOverall = isCass
    ? [
        { key: "sealed", label: "Sealed (factory shrink intact)", bonus: +5 },
        { key: "looksNew", label: "Looks like new, no flaws", penalty: 0, infoOnly: true },
        { key: "minorShelf", label: "Minor shelf wear only", penalty: -3 },
        { key: "cornerWear", label: "Corner wear present (inlay/case edges)", penalty: -4 },
        // no ring wear on cassette packaging
      ]
    : isCD
    ? [
        { key: "sealed", label: "Sealed (factory shrink intact)", bonus: +5 },
        { key: "looksNew", label: "Looks like new, no flaws", penalty: 0, infoOnly: true },
        { key: "minorShelf", label: "Minor shelf wear only", penalty: -3 },
        { key: "cornerWear", label: "Corner wear present (insert/digipak)", penalty: -4 },
        { key: "ringWear", label: "Booklet ring wear visible", penalty: -5 },
      ]
    : [
        { key: "sealed", label: "Sealed (factory shrink intact)", bonus: +5 },
        { key: "looksNew", label: "Looks like new, no flaws", penalty: 0, infoOnly: true },
        { key: "minorShelf", label: "Minor shelf wear only", penalty: -3 },
        { key: "cornerWear", label: "Corner wear present", penalty: -4 },
        { key: "ringWear", label: "Ring wear visible", penalty: -5 },
      ];

  const sleeveStructure = isCD
    ? [
        { key: "bookletSpineWear", label: "Insert/booklet spine wear or fold wear", penalty: -3 },
        { key: "digipakPanelWear", label: "Digipak/box panel wear", penalty: -3 },
        // case cracked / tray teeth are notes only
      ]
    : isCass
    ? [
        { key: "inlayFoldWear", label: "J-card fold wear / creases", penalty: -3 },
        // standard Norelco case is notes only
      ]
    : [
        { key: "seamsIntact", label: "All seams intact", penalty: 0, infoOnly: true },
        { key: "seamSplit", label: "Seam splits present", penalty: -12 },
        { key: "spineWear", label: "Spine shows wear", penalty: -3 },
      ];

  const sleeveDamage = [
    { key: "creases", label: "Creases / crushing present", penalty: -3 },
    { key: "tears", label: "Tears present", penalty: -8 },
    { key: "writing", label: "Writing present", penalty: -4 },
    { key: "stickers", label: "Stickers or tape", penalty: -3 },
  ];

  const notes = isCD
    ? [
        "Standard jewel case cracked (note — case is replaceable)",
        "Tray teeth broken (note — case is replaceable)",
        "Custom case / box / digipak (note)",
        "OBI present",
        "Promotional copy",
        "Slipcase included",
        "Special/limited edition",
      ]
    : isCass
    ? [
        "Standard Norelco case cracked (note — case is replaceable)",
        "Stickered case (note)",
        "Custom/collectible case (note)",
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
    sidesEnabled: !isCD,
    showCaseIsNote: isCass || isCD,
  };
}

function newMediaItem() {
  return {
    missing: false,
    multiDiscSides: false, // show C/D when true
    visual: {},
    audio: {},
    labelArea: {},
    meta: {}, // { [defKey]: { severity, tracks, sides: {A,B,C,D} } }
  };
}

function initialState(mediaType) {
  return {
    mediaType,
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

function ensureMetaFor(item, defKey, sidesEnabled) {
  const existing = item.meta?.[defKey];
  if (existing) return existing;
  return {
    severity: "",
    tracks: 0,
    sides: sidesEnabled ? { A: false, B: false, C: false, D: false } : {},
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

  dict.visual.forEach((v) => {
    const isOn = !!item.visual[v.key];
    if (!isOn || v.infoOnly) return;

    score += v.penalty;

    const meta = item.meta?.[v.key];
    const bits = [];
    if (meta?.severity) bits.push(meta.severity);
    if (meta?.sides && Object.values(meta.sides).some(Boolean)) {
      const sides = ["A", "B", "C", "D"].filter((s) => meta.sides[s]).join("/");
      if (sides) bits.push(`Side ${sides}`);
    }
    if (v.allowTracks && typeof meta?.tracks === "number" && meta.tracks > 0) {
      bits.push(`${meta.tracks} track(s) noted`);
    }
    const extra = bits.length ? ` — ${bits.join("; ")}` : "";
    if (v.penalty) penalties.push({ label: `${v.label}${extra}`, value: v.penalty });
  });

  dict.audio.forEach((a) => {
    const isOn = !!item.audio[a.key];
    if (!isOn || a.infoOnly) return;

    score += a.penalty;

    const meta = item.meta?.[a.key];
    const bits = [];
    if (meta?.severity) bits.push(meta.severity);
    if (meta?.sides && Object.values(meta.sides).some(Boolean)) {
      const sides = ["A", "B", "C", "D"].filter((s) => meta.sides[s]).join("/");
      if (sides) bits.push(`Side ${sides}`);
    }
    if (a.allowTracks && typeof meta?.tracks === "number" && meta.tracks > 0) {
      bits.push(`${meta.tracks} track(s) affected`);
      totalAudioTracks += meta.tracks;
    }
    const extra = bits.length ? ` — ${bits.join("; ")}` : "";
    if (a.penalty) penalties.push({ label: `${a.label}${extra}`, value: a.penalty });
  });

  Object.entries(item.labelArea || {}).forEach(([key, on]) => {
    if (!on) return;
    const def = dict.labelArea.find((d) => d.key === key);
    if (!def || def.infoOnly) return;
    const pen = def.penalty ?? 0;
    score += pen;
    if (pen) penalties.push({ label: def.label, value: pen });
  });

  if (totalAudioTracks > 0) {
    const perTrack = -1 * totalAudioTracks;
    score += perTrack;
    penalties.push({ label: `Tracks affected (−1 × ${totalAudioTracks})`, value: perTrack });
  }

  return {
    score: clampScore(score),
    penalties,
    zeroDeductions: penalties.length === 0,
  };
}

function computeAggregatedMedia(items, dict) {
  const perItem = items.map((it) => computeMediaItemScore(it, dict));
  const scores = perItem.map((r) => r.score);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const allZeroDeductions = perItem.every((r) => r.zeroDeductions);
  return { perItem, score: avgScore, zeroDeductions: allZeroDeductions };
}

function computeSleeveScore(sleeve, dict) {
  if (sleeve.missing) {
    return {
      score: 0,
      penalties: [{ label: "Packaging missing (auto P)", value: -100 }],
      sealed: false,
      zeroDeductions: false,
    };
  }

  let score = 100;
  const penalties = [];
  let sealed = false;

  dict.sleeveOverall.forEach((o) => {
    if (!sleeve.overall[o.key]) return;
    if (o.bonus) {
      sealed = true;
      score = Math.min(100, score + o.bonus); // +5, cap 100
      return;
    }
    if (!o.infoOnly && o.penalty) {
      score += o.penalty;
      penalties.push({ label: o.label, value: o.penalty });
    }
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

  return {
    score: clampScore(score),
    penalties,
    sealed,
    zeroDeductions: penalties.length === 0,
  };
}

export default function MediaGradingPage() {
  const [mediaType, setMediaType] = useState("vinyl");
  const dict = useMediaDictionaries(mediaType);
  const [state, setState] = useState(() => initialState(mediaType));

  function changeMediaType(next) {
    setMediaType(next);
    setState(initialState(next));
  }

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
        const nextGroup = { ...(it[group] || {}), [key]: !it[group]?.[key] };
        let meta = it.meta || {};
        if (nextGroup[key] && !meta[key]) {
          meta = { ...meta, [key]: ensureMetaFor(it, key, dict.sidesEnabled) };
        }
        return { ...it, [group]: nextGroup, meta };
      });
      return { ...s, items };
    });
  }

  function updateDefectMeta(idx, key, patch) {
    setState((s) => {
      const items = s.items.map((it, i) => {
        if (i !== idx) return it;
        const current = ensureMetaFor(it, key, dict.sidesEnabled);
        return { ...it, meta: { ...(it.meta || {}), [key]: { ...current, ...patch } } };
      });
      return { ...s, items };
    });
  }

  function toggleDefectSide(idx, key, sideKey) {
    setState((s) => {
      const items = s.items.map((it, i) => {
        if (i !== idx) return it;
        const current = ensureMetaFor(it, key, true);
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

  function toggleSleeve(group, key) {
    setState((s) => {
      const g = s.sleeve[group] || {};
      const next = { ...g, [key]: !g[key] };
      return { ...s, sleeve: { ...s.sleeve, [group]: next } };
    });
  }
  function setSleeveMissing(val) {
    setState((s) => ({ ...s, sleeve: { ...s.sleeve, missing: val } }));
  }
  function updateNotes(val) {
    setState((s) => ({ ...s, sleeve: { ...s.sleeve, customNotes: val } }));
  }

  const aggregated = computeAggregatedMedia(state.items, dict);
  const sleeveCalc = computeSleeveScore(state.sleeve, dict);

  const mediaGrade = scoreToGrade(aggregated.score, { sealedOK: false, zeroDeductions: false });
  const sleeveGrade = scoreToGrade(sleeveCalc.score, { sealedOK: sleeveCalc.sealed, zeroDeductions: sleeveCalc.zeroDeductions });

  const usingMedia = !state.items.every((it) => it.missing);
  const usingSleeve = !state.sleeve.missing;

  // ---- Overall score per your rule set ----
  const mintEligible = usingMedia && usingSleeve && sleeveCalc.sealed && sleeveCalc.zeroDeductions && aggregated.zeroDeductions;

  let overallScoreRaw = 0;
  if (mintEligible) {
    overallScoreRaw = 100;
  } else if (usingMedia && usingSleeve) {
    overallScoreRaw = (aggregated.score + sleeveCalc.score) / 2; // both present
  } else {
    // one or both missing → divide by 4
    overallScoreRaw = (aggregated.score + sleeveCalc.score) / 4;
  }

  const overallScore = Math.round(overallScoreRaw);
  const overallGrade = mintEligible
    ? "M"
    : scoreToGrade(overallScore, { sealedOK: false, zeroDeductions: false });

  // Explanation
  const topMedia = topDeductions(aggregated.perItem.flatMap((r) => r.penalties));
  const topSleeve = topDeductions(sleeveCalc.penalties);

  let whyOverall = "";
  if (mintEligible) {
    whyOverall = "Overall = M because packaging is sealed & flawless and media has no deductions.";
  } else if (usingMedia && usingSleeve) {
    whyOverall = `Overall = average of Media and Packaging: (${aggregated.score} + ${sleeveCalc.score}) / 2 = ${((aggregated.score + sleeveCalc.score) / 2).toFixed(1)} → ${overallGrade}.`;
  } else {
    whyOverall = `Overall = (Media + Packaging) / 4 due to missing component(s): (${aggregated.score} + ${sleeveCalc.score}) / 4 = ${((aggregated.score + sleeveCalc.score) / 4).toFixed(1)} → ${overallGrade}.`;
  }

  const addLabel =
    mediaType === "vinyl" ? "Add Another Record" : mediaType === "cassette" ? "Add Another Tape" : "Add Another Disc";

  return (
    <div id="media-grading" className="mg-wrap">
      <div className="mg-header">
        <div className="mg-title">🔍 Systematic Media Grading Tool</div>
        <div className="mg-sub">Detailed condition assessment with automatic grading calculation</div>
      </div>

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

      <div className="mg-grid">
        <section className="mg-card mg-item">
          <div className="mg-item-header">
            <h2>{dict.mediaTitle}</h2>
            <div className="mg-item-actions">
              <button className="mg-btn ghost" onClick={addItem}>{addLabel}</button>
            </div>
          </div>

          {state.items.map((it, idx) => (
            <fieldset key={idx} className="mg-fieldset">
              <legend>{dict.itemLegendLabel} #{idx + 1}</legend>

              <label className="mg-check">
                <input
                  type="checkbox"
                  checked={!!it.missing}
                  onChange={(e) => updateItem(idx, { missing: e.target.checked })}
                />
                <span>Mark this media as Missing (auto P)</span>
              </label>

              {dict.sidesEnabled && (
                <label className="mg-check">
                  <input
                    type="checkbox"
                    checked={!!it.multiDiscSides}
                    onChange={(e) => updateItem(idx, { multiDiscSides: e.target.checked })}
                  />
                  <span>Multi-Disc (2x media) — show Sides C/D</span>
                </label>
              )}

              <fieldset className={`mg-fieldset mg-fieldset-inner ${it.missing ? "mg-disabled" : ""}`}>
                <legend>Visual Appearance</legend>
                {dict.visual.map((v) => {
                  const checked = !!it.visual[v.key];
                  const meta = ensureMetaFor(it, v.key, dict.sidesEnabled);
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
                          {v.severity && (
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

                          {dict.sidesEnabled && v.allowSides && (
                            <div className="mg-sides-grid" aria-label="Which side(s) affected">
                              {["A", "B", ...(it.multiDiscSides ? ["C", "D"] : [])].map((sKey) => (
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

                          {v.allowTracks && (
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
                                    updateDefectMeta(idx, v.key, { tracks: Math.max(0, parseInt(e.target.value || "0", 10)) })
                                  }
                                />
                              </div>
                              <div className="mg-help">For disclosure on visual defects; only audio tracks count toward the −1/track penalty.</div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </fieldset>

              <fieldset className={`mg-fieldset mg-fieldset-inner ${it.missing ? "mg-disabled" : ""}`}>
                <legend>Audio Performance</legend>
                {dict.audio.map((a) => {
                  const checked = !!it.audio[a.key];
                  const meta = ensureMetaFor(it, a.key, dict.sidesEnabled);
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
                              {["A", "B", ...(it.multiDiscSides ? ["C", "D"] : [])].map((sKey) => (
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
                                    updateDefectMeta(idx, a.key, { tracks: Math.max(0, parseInt(e.target.value || "0", 10)) })
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

              <fieldset className={`mg-fieldset mg-fieldset-inner ${it.missing ? "mg-disabled" : ""}`}>
                <legend>{mediaType === "vinyl" ? "Label / Center" : mediaType === "cassette" ? "Shell / Label" : "Hub / Face"}</legend>
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

              <div className="mg-item-controls">
                {state.items.length > 1 && <button className="mg-btn" onClick={() => removeItem(idx)}>Remove</button>}
              </div>

              <div className="mg-per-item-result">
                {(() => {
                  const calc = computeMediaItemScore(it, dict);
                  const g = scoreToGrade(calc.score, { sealedOK: false, zeroDeductions: false });
                  return <span className="mg-chip">Item #{idx + 1}: {g} ({calc.score})</span>;
                })()}
              </div>
            </fieldset>
          ))}
        </section>

        <section className="mg-card">
          <div className="mg-item-header">
            <h2>{dict.packagingTitle}</h2>
          </div>

          <fieldset className="mg-fieldset">
            <legend>Packaging Scope</legend>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={!!state.sleeve.missing}
                onChange={(e) => setSleeveMissing(e.target.checked)}
              />
              <span>Mark packaging as Missing (auto P)</span>
            </label>
          </fieldset>

          <fieldset className={`mg-fieldset mg-fieldset-inner ${state.sleeve.missing ? "mg-disabled" : ""}`}>
            <legend>Overall Appearance</legend>
            {dict.sleeveOverall.map((o) => (
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
            <div className="mg-help">
              Sealed adds +5 (cap 100). If sealed and flawless: Mint (M) is allowed.
              For cassettes/CDs, standard plastic cases are not graded.
            </div>
          </fieldset>

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
                Standard cases (jewel/Norelco) are <em>replaceable</em> and not graded. Record case issues in Additional notes.
              </div>
            )}
          </fieldset>

          <fieldset className={`mg-fieldset mg-fieldset-inner ${state.sleeve.missing ? "mg-disabled" : ""}`}>
            <legend>Damage & Markings</legend>
            {dict.sleeveDamage.map((d) => (
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
        </section>
      </div>

      <section className="mg-card mg-notes">
        <h3>📝 Custom Condition Notes</h3>
        <textarea
          value={state.sleeve.customNotes}
          onChange={(e) => updateNotes(e.target.value)}
          aria-label="Custom condition notes"
        />
      </section>

      <section className="mg-results">
        <div className={`mg-card mg-result ${mediaGrade === "M" || mediaGrade === "NM" ? "mg-grade-nm" : mediaGrade.startsWith("VG") ? "mg-grade-vg" : mediaGrade.startsWith("G") ? "mg-grade-g" : "mg-grade-fp"}`}>
          <div className="mg-result-title">
            {mediaType === "vinyl" ? "Record Grade" : mediaType === "cassette" ? "Tape Grade" : "Disc Grade"}
          </div>
          <div className="mg-result-grade">{mediaGrade}</div>
          <div className="mg-result-score">{aggregated.score}/100</div>
        </div>

        <div className={`mg-card mg-result ${sleeveGrade === "M" || sleeveGrade === "NM" ? "mg-grade-nm" : sleeveGrade.startsWith("VG") ? "mg-grade-vg" : sleeveGrade.startsWith("G") ? "mg-grade-g" : "mg-grade-fp"}`}>
          <div className="mg-result-title">Sleeve/Packaging Grade</div>
          <div className="mg-result-grade">{sleeveGrade}</div>
          <div className="mg-result-score">{sleeveCalc.score}/100</div>
        </div>

        <div className={`mg-card mg-result ${overallGrade === "M" || overallGrade === "NM" ? "mg-grade-nm" : overallGrade.startsWith("VG") ? "mg-grade-vg" : "mg-grade-g" ? "mg-grade-g" : "mg-grade-fp"}`}>
          <div className="mg-result-title">Overall Grade</div>
          <div className="mg-result-grade">{overallGrade}</div>
          <div className="mg-result-score">{overallScore}/100</div>
        </div>
      </section>

      <section className="mg-card">
        <div className="mg-expl-title">Grading Explanation</div>
        <div>
          <strong>Media:</strong>{" "}
          {topMedia.length ? (
            <ul>
              {topMedia.map((p, i) => (
                <li key={i}>{p.label} ({p.value})</li>
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
                <li key={i}>{p.label} ({p.value})</li>
              ))}
            </ul>
          ) : (
            "No deductions."
          )}
        </div>
        <div style={{ marginTop: 8 }}>{whyOverall}</div>
        <div style={{ marginTop: 8 }}>
          {aggregated.perItem.map((r, i) => {
            const g = scoreToGrade(r.score, { sealedOK: false, zeroDeductions: false });
            return (
              <span key={i} className="mg-chip" style={{ marginRight: 6 }}>
                Item #{i + 1}: {g} ({r.score})
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}
