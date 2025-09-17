// src/app/admin/media-grading/page.js
"use client";

import { useMemo, useState } from "react";
import "styles/media-grading.css";

/**
 * Systematic Media Grading Tool (App Router client page)
 * - JS only (no TS), ESLint-friendly, no external state libs
 * - Single-page admin grading UI with live scoring & explanation
 *
 * Grades (exactly 8): M, NM, VG+, VG, G+, G, F, P
 *  - M is only reachable if "Sealed (factory shrink intact)" is checked AND there are zero deductions on BOTH packaging and media.
 *  - Otherwise NM is the top grade.
 *
 * Scores start at 100 and deduct via the default weights you provided.
 * Sleeve sealed adds +5 (cap 100).
 *
 * Thresholds (non-M path):
 *     97–100: NM
 *     85–91:  VG+
 *     75–84:  VG
 *     65–74:  G+
 *     50–64:  G
 *     35–49:  F
 *     <35:    P
 *
 * Overall grade = lower of Media vs Sleeve (unless one side marked Missing/disabled, then overall = active side),
 * except when Mint gate conditions are met (Sealed & flawless packaging + flawless media).
 *
 * Multi-item sets (2xLP, 2xCassette, 2xCD, etc):
 *  - Compute score/grade per item and aggregate the MEDIA score by averaging item scores.
 *  - A missing item = automatic P (score 0).
 *  - We show per-item chips and use the aggregated media score -> media grade.
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
 *  - Per-track penalty: tracksAffected * 1 (only when any audio defect is selected)
 *
 * Sleeve/Packaging:
 *  - Minor shelf wear: −3
 *  - Corner wear: −4
 *  - Ring wear / booklet ring wear: −5
 *  - Spine wear: −3
 *  - Seam split / case cracked: −12
 *  - Tears: −8
 *  - Writing: −4
 *  - Stickers/tape: −3
 *  - Sealed intact: +5 bonus (cap at 100)
 */

/* ---------------- Utilities ---------------- */

/** Score -> Grade. Pass {sealedOK, zeroDeductions} to gate Mint (when used for sleeve or overall checks). */
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

/** Sum and sort top deductions for explanation. */
function topDeductions(penalties, topN = 3) {
  const arr = [...penalties].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return arr.slice(0, topN);
}

/* ---------------- Media-type specific labels ---------------- */

const MEDIA_TYPES = {
  vinyl: "Vinyl",
  cassette: "Cassette",
  cd: "CD",
};

function useMediaDictionaries(mediaType) {
  // Return the set of controls/labels for the selected media type.
  // Each option includes a penalty bucket that maps to the fixed weights above.
  return useMemo(() => {
    const isVinyl = mediaType === "vinyl";
    const isCass = mediaType === "cassette";
    const isCD = mediaType === "cd";

    // Visual appearance (defects). Warping/wobble has no per-side tracks.
    const visual = [
      // Positive/neutral hint for NM visual; does not affect score.
      isVinyl
        ? { key: "glossyLikeNew", label: "Record has glossy, like-new appearance", penalty: 0, tracks: false, sides: false, infoOnly: true }
        : isCD
        ? { key: "discLooksNew", label: "Disc playing surface looks like new", penalty: 0, tracks: false, sides: false, infoOnly: true }
        : { key: "shellLooksNew", label: "Shell looks like new", penalty: 0, tracks: false, sides: false, infoOnly: true },

      // Only show what's relevant per media
      ...(isCass
        ? [
            { key: "shellScuffs", label: "Shell scuffs present", penalty: -12, tracks: true, sides: true },
            { key: "warpingPresent", label: "Warping present", hide: true, penalty: 0, tracks: false, sides: false }, // hidden for cassettes
          ]
        : isCD
        ? [
            { key: "lightScuffs", label: "Light scuffs visible", penalty: -3, tracks: true, sides: false },
            { key: "scratches", label: "Scratches present", penalty: -8, tracks: true, sides: false },
            { key: "rotPinholes", label: "Laser-rot / pinholes visible", penalty: -12, tracks: true, sides: false },
            { key: "discWobble", label: "Disc wobble present", penalty: -10, tracks: false, sides: false },
          ]
        : [
            { key: "lightScuffs", label: "Light scuffs visible", penalty: -3, tracks: true, sides: true },
            { key: "scratches", label: "Scratches present", penalty: -8, tracks: true, sides: true },
            { key: "grooveWear", label: "Groove wear visible", penalty: -12, tracks: true, sides: true },
            { key: "warpingPresent", label: "Warping present", penalty: -10, tracks: false, sides: false },
          ]),
    ].filter((o) => !o.hide);

    // Audio performance
    const audio = isCD
      ? [
          { key: "playsClean", label: "Plays with no read errors", penalty: 0, tracks: false, sides: false, infoOnly: true },
          { key: "correctedErrors", label: "Occasional read errors corrected", penalty: -4, tracks: true, sides: false },
          { key: "unreadable", label: "Unreadable sectors / skipping", penalty: -30, tracks: true, sides: false },
        ]
      : isCass
      ? [
          { key: "playsClean", label: "Plays with no audible issues", penalty: 0, tracks: false, sides: false, infoOnly: true },
          { key: "surfaceNoise", label: "Surface noise when played", penalty: -6, tracks: true, sides: true },
          { key: "wowFlutter", label: "Squeal / wow–flutter audible", penalty: -6, tracks: true, sides: true },
          // No "skipping/repeating" for tape
        ]
      : [
          { key: "playsClean", label: "Plays with no surface noise", penalty: 0, tracks: false, sides: false, infoOnly: true },
          { key: "surfaceNoise", label: "Surface noise when played", penalty: -6, tracks: true, sides: true },
          { key: "popsClicks", label: "Occasional pops or clicks", penalty: -4, tracks: true, sides: true },
          { key: "skipping", label: "Skipping or repeating", penalty: -30, tracks: true, sides: true },
        ];

    // Label / hub / shell defects (−3 each when checked)
    const labelArea = isCD
      ? [
          { key: "labelClean", label: "Hub/face is clean and bright", penalty: 0, infoOnly: true },
          { key: "labelWriting", label: "Writing on label/face", penalty: -3 },
          { key: "labelStickers", label: "Stickers or tape on label/face", penalty: -3 },
        ]
      : isCass
      ? [
          { key: "labelClean", label: "Shell/label is clean and bright", penalty: 0, infoOnly: true },
          { key: "labelWriting", label: "Writing on shell/label", penalty: -3 },
          { key: "labelStickers", label: "Stickers or tape on shell", penalty: -3 },
        ]
      : [
          { key: "labelClean", label: "Label is clean and bright", penalty: 0, infoOnly: true },
          { key: "spindleMarks", label: "Spindle marks present", penalty: -3 },
          { key: "labelWriting", label: "Writing on label", penalty: -3 },
          { key: "labelStickers", label: "Stickers or tape on label", penalty: -3 },
        ];

    // Sleeve/packaging labels
    const sleeveOverall = [
      { key: "looksNew", label: "Looks like new, no flaws", penalty: 0, infoOnly: true },
      { key: "minorShelf", label: "Minor shelf wear only", penalty: -3 },
      { key: "cornerWear", label: "Corner wear present", penalty: -4 },
      {
        key: "sealed",
        label: "Sealed (factory shrink intact)",
        bonus: +5, // handled as +5 bonus with cap at 100; also gates M if flawless
      },
      {
        key: "ringWear",
        label: isCD ? "Booklet ring wear visible" : "Ring wear visible",
        penalty: -5,
      },
    ];

    const sleeveStructure = isCD
      ? [
          { key: "caseOK", label: "Case uncracked", penalty: 0, infoOnly: true },
          { key: "caseCracked", label: "Case cracked", penalty: -12 },
          { key: "trayTeeth", label: "Tray teeth broken/missing", penalty: -3 },
        ]
      : [
          { key: "seamsIntact", label: "All seams intact", penalty: 0, infoOnly: true },
          { key: "seamSplit", label: "Seam splits present", penalty: -12 },
          { key: "spineWear", label: "Spine shows wear", penalty: -3 },
        ];

    const sleeveDamage = [
      { key: "tears", label: "Tears present", penalty: -8 },
      { key: "writing", label: "Writing present", penalty: -4 },
      { key: "stickers", label: "Stickers or tape", penalty: -3 },
    ];

    // Additional notes (do not affect score) by media
    const notes = isCD
      ? [
          "Jewel case damaged (note)",
          "Jewel case missing (note)",
          "OBI present",
          "Promotional copy",
          "Slipcase included",
          "Special/limited edition",
        ]
      : isCass
      ? [
          "Original shrinkwrap (opened)",
          "Stickered case",
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

    return { visual, audio, labelArea, sleeveOverall, sleeveStructure, sleeveDamage, notes };
  }, [mediaType]);
}

/* ---------------- State shapes ---------------- */

function newMediaItem() {
  return {
    missing: false,
    // sides apply to vinyl/cassette only (optional)
    sides: { A: false, B: false, C: false, D: false },
    tracksAffected: 0,
    // dynamic groups will be keyed at runtime
    visual: {},
    audio: {},
    labelArea: {},
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

/* ---------------- Penalty computation ---------------- */

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
  let anyAudioDefect = false;

  // Visual
  dict.visual.forEach((v) => {
    if (!v.infoOnly && item.visual[v.key]) {
      score += v.penalty;
      if (v.penalty) penalties.push({ label: v.label, value: v.penalty });
    }
  });

  // Audio
  dict.audio.forEach((a) => {
    if (!a.infoOnly && item.audio[a.key]) {
      anyAudioDefect = true;
      score += a.penalty;
      if (a.penalty) penalties.push({ label: a.label, value: a.penalty });
    }
  });

  // Label / hub / shell area
  Object.entries(item.labelArea || {}).forEach(([key, on]) => {
    if (!on) return;
    const def = dict.labelArea.find((d) => d.key === key);
    if (!def || def.infoOnly) return;
    const pen = def.penalty ?? 0;
    score += pen;
    if (pen) penalties.push({ label: def.label, value: pen });
  });

  // Per-track penalty: only when any audio defect selected
  if (anyAudioDefect && item.tracksAffected > 0) {
    const perTrack = -1 * Number(item.tracksAffected || 0);
    score += perTrack;
    penalties.push({ label: `Tracks affected (−1 × ${item.tracksAffected})`, value: perTrack });
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

  // Overall
  dict.sleeveOverall.forEach((o) => {
    if (sleeve.overall[o.key]) {
      if (o.bonus) {
        sealed = true;
        // add +5 but cap at 100
        score = Math.min(100, score + o.bonus);
      } else if (!o.infoOnly && o.penalty) {
        score += o.penalty;
        penalties.push({ label: o.label, value: o.penalty });
      }
    }
  });

  // Structure
  dict.sleeveStructure.forEach((s) => {
    if (!s.infoOnly && sleeve.structure[s.key]) {
      score += s.penalty || 0;
      if (s.penalty) penalties.push({ label: s.label, value: s.penalty });
    }
  });

  // Damage
  dict.sleeveDamage.forEach((d) => {
    if (sleeve.damage[d.key]) {
      score += d.penalty || 0;
      if (d.penalty) penalties.push({ label: d.label, value: d.penalty });
    }
  });

  return {
    score: clampScore(score),
    penalties,
    sealed,
    zeroDeductions: penalties.length === 0,
  };
}

/* ---------------- Component ---------------- */

export default function MediaGradingPage() {
  const [mediaType, setMediaType] = useState("vinyl");
  const dict = useMediaDictionaries(mediaType);
  const [state, setState] = useState(() => initialState(mediaType));

  // When media type changes, reset form to that shape (fresh session for clarity)
  function changeMediaType(next) {
    setMediaType(next);
    setState(initialState(next));
  }

  // --- Mutators (controlled inputs) ---
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
        return { ...it, [group]: nextGroup };
      });
      return { ...s, items };
    });
  }

  function toggleItemSide(idx, sideKey) {
    setState((s) => {
      const items = s.items.map((it, i) => {
        if (i !== idx) return it;
        return { ...it, sides: { ...it.sides, [sideKey]: !it.sides[sideKey] } };
      });
      return { ...s, items };
    });
  }

  function updateItemTracks(idx, value) {
    const n = Math.max(0, parseInt(value || "0", 10));
    setState((s) => {
      const items = s.items.map((it, i) => (i === idx ? { ...it, tracksAffected: n } : it));
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

  // --- Calculations ---
  const aggregated = computeAggregatedMedia(state.items, dict);
  const sleeveCalc = computeSleeveScore(state.sleeve, dict);

  const mediaGrade = scoreToGrade(aggregated.score, {
    sealedOK: false,
    zeroDeductions: aggregated.zeroDeductions && false, // Media alone cannot unlock M
  });

  const sleeveGrade = scoreToGrade(sleeveCalc.score, {
    sealedOK: sleeveCalc.sealed,
    zeroDeductions: sleeveCalc.zeroDeductions,
  });

  // Overall logic: lower of media vs sleeve, unless one is missing/disabled
  const usingMedia = !state.items.every((it) => it.missing);
  const usingSleeve = !state.sleeve.missing;

  let overallGrade = "P";
  let overallScore = 0;

  if (usingMedia && usingSleeve) {
    // Explicit Mint gate: sealed & flawless packaging AND flawless media
    const mintEligible = sleeveCalc.sealed && sleeveCalc.zeroDeductions && aggregated.zeroDeductions;
    if (mintEligible) {
      overallScore = 100;
      overallGrade = "M";
    } else {
      overallScore = Math.min(aggregated.score, sleeveCalc.score);
      overallGrade = scoreToGrade(overallScore, { sealedOK: false, zeroDeductions: false });
    }
  } else if (usingMedia) {
    overallScore = aggregated.score;
    overallGrade = mediaGrade;
  } else if (usingSleeve) {
    overallScore = sleeveCalc.score;
    overallGrade = sleeveGrade;
  }

  // Explanation
  const topMedia = topDeductions(aggregated.perItem.flatMap((r) => r.penalties));
  const topSleeve = topDeductions(sleeveCalc.penalties);

  let whyOverall = "";
  if (usingMedia && usingSleeve) {
    const mintEligible = sleeveCalc.sealed && sleeveCalc.zeroDeductions && aggregated.zeroDeductions;
    whyOverall = mintEligible
      ? "Overall = M because packaging is sealed & flawless and media has no deductions."
      : `Overall = ${overallGrade} due to the lower of Media (${mediaGrade}) vs Sleeve (${sleeveGrade}).`;
  } else if (usingMedia) {
    whyOverall = `Overall = ${overallGrade} (media only).`;
  } else {
    whyOverall = `Overall = ${overallGrade} (packaging only).`;
  }

  const sidesUIEnabled = mediaType !== "cd";
  const addLabel =
    mediaType === "vinyl" ? "Add Another Record" : mediaType === "cassette" ? "Add Another Tape" : "Add Another Disc";

  return (
    <div id="media-grading" className="mg-wrap">
      {/* Header */}
      <div className="mg-header">
        <div className="mg-title">🔍 Systematic Media Grading Tool</div>
        <div className="mg-sub">Detailed condition assessment with automatic grading calculation</div>
      </div>

      {/* Media type selector */}
      <div className="mg-pills" role="tablist" aria-label="Select media type">
        {Object.entries(MEDIA_TYPES).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={mediaType === key}
            className={`mg-pill ${mediaType === key ? "selected" : ""}`}
            onClick={() => changeMediaType(key)}
          >
            {key === "vinyl" ? "🎵 " : key === "cassette" ? "📼 " : "💿 "}
            {label}s
          </button>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="mg-grid">
        {/* Left: Record/Media Condition Assessment */}
        <section className="mg-card mg-item">
          <div className="mg-item-header">
            <h2>🎶 Record/Media Condition Assessment</h2>
            <div className="mg-item-actions">
              <button className="mg-btn ghost" onClick={addItem}>{addLabel}</button>
            </div>
          </div>

          {state.items.map((it, idx) => (
            <fieldset key={idx} className="mg-fieldset">
              <legend>Disc/Tape #{idx + 1}</legend>

              <label className="mg-check">
                <input
                  type="checkbox"
                  checked={!!it.missing}
                  onChange={(e) => updateItem(idx, { missing: e.target.checked })}
                />
                <span>Mark this media as Missing (auto P)</span>
              </label>

              {/* Visual Appearance */}
              <fieldset className={`mg-fieldset mg-fieldset-inner ${it.missing ? "mg-disabled" : ""}`}>
                <legend>Visual Appearance</legend>
                {dict.visual.map((v) => (
                  <label key={v.key} className="mg-check">
                    <input
                      type="checkbox"
                      disabled={it.missing}
                      checked={!!it.visual[v.key]}
                      onChange={() => toggleItemCheck(idx, "visual", v.key)}
                    />
                    <span>{v.label}</span>
                  </label>
                ))}
              </fieldset>

              {/* Audio Performance */}
              <fieldset className={`mg-fieldset mg-fieldset-inner ${it.missing ? "mg-disabled" : ""}`}>
                <legend>Audio Performance</legend>
                {dict.audio.map((a) => (
                  <label key={a.key} className="mg-check">
                    <input
                      type="checkbox"
                      disabled={it.missing}
                      checked={!!it.audio[a.key]}
                      onChange={() => toggleItemCheck(idx, "audio", a.key)}
                    />
                    <span>{a.label}</span>
                  </label>
                ))}

                {/* Sides + tracks controls */}
                {sidesUIEnabled && (
                  <div className="mg-sub-extent">
                    <div className="mg-help">Per-track penalty applies only if any audio defect is selected.</div>
                    <div className="mg-sides-grid" aria-label="Which side(s) affected">
                      {["A", "B"].map((sKey) => (
                        <label key={sKey} className="mg-check">
                          <input
                            type="checkbox"
                            disabled={it.missing}
                            checked={!!it.sides[sKey]}
                            onChange={() => toggleItemSide(idx, sKey)}
                          />
                          <span>Side {sKey}</span>
                        </label>
                      ))}
                    </div>

                    <div className="mg-number">
                      <label htmlFor={`tracks-${idx}`}>Tracks affected</label>
                      <input
                        id={`tracks-${idx}`}
                        type="number"
                        min={0}
                        step={1}
                        disabled={it.missing}
                        value={it.tracksAffected}
                        onChange={(e) => updateItemTracks(idx, e.target.value)}
                      />
                    </div>
                    <div className="mg-help">−1 per track, only when any audio defect is selected.</div>
                  </div>
                )}
              </fieldset>

              {/* Label / Hub / Shell area */}
              <fieldset className={`mg-fieldset mg-fieldset-inner ${it.missing ? "mg-disabled" : ""}`}>
                <legend>{mediaType === "cd" ? "Hub/Face" : mediaType === "cassette" ? "Shell/Label" : "Label / Center"}</legend>
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
                {state.items.length > 1 && (
                  <button className="mg-btn" onClick={() => removeItem(idx)}>Remove</button>
                )}
              </div>

              {/* Per-item quick summary */}
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

        {/* Right: Sleeve/Packaging */}
        <section className="mg-card">
          <div className="mg-item-header">
            <h2>📦 Sleeve/Packaging Condition Assessment</h2>
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
            <div className="mg-help">Sealed adds +5 (cap 100). Mint (M) only when sealed & flawless.</div>
          </fieldset>

          <fieldset className={`mg-fieldset mg-fieldset-inner ${state.sleeve.missing ? "mg-disabled" : ""}`}>
            <legend>{mediaType === "cd" ? "Case / Tray" : "Seams & Structure"}</legend>
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

          <fieldset className={`mg-fieldset mg-fieldset-inner ${state.sleeve.missing ? "mg-disabled" : ""}`}>
            <legend>Additional notes (don’t affect score)</legend>
            <div className="mg-notes-grid">
              {dict.notes.map((n) => (
                <label key={n} className="mg-check">
                  <input
                    type="checkbox"
                    disabled={state.sleeve.missing}
                    checked={!!state.sleeve.notes[n]}
                    onChange={() =>
                      setState((s) => ({
                        ...s,
                        sleeve: {
                          ...s.sleeve,
                          notes: { ...s.sleeve.notes, [n]: !s.sleeve.notes[n] },
                        },
                      }))
                    }
                  />
                  <span>{n}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>
      </div>

      {/* Custom Notes */}
      <section className="mg-card mg-notes">
        <h3>📝 Custom Condition Notes</h3>
        <textarea
          value={state.sleeve.customNotes}
          onChange={(e) => updateNotes(e.target.value)}
          aria-label="Custom condition notes"
        />
      </section>

      {/* Results */}
      <section className="mg-results">
        <div className={`mg-card mg-result ${mediaGrade.startsWith("M") ? "mg-grade-nm" : mediaGrade.startsWith("VG") ? "mg-grade-vg" : mediaGrade.startsWith("G") ? "mg-grade-g" : mediaGrade === "F" || mediaGrade === "P" ? "mg-grade-fp" : ""}`}>
          <div className="mg-result-title">{mediaType === "vinyl" ? "Record Grade" : mediaType === "cassette" ? "Tape Grade" : "Disc Grade"}</div>
          <div className="mg-result-grade">{mediaGrade}</div>
          <div className="mg-result-score">{aggregated.score}/100</div>
        </div>

        <div className={`mg-card mg-result ${sleeveGrade === "M" || sleeveGrade === "NM" ? "mg-grade-nm" : sleeveGrade.startsWith("VG") ? "mg-grade-vg" : sleeveGrade.startsWith("G") ? "mg-grade-g" : "mg-grade-fp"}`}>
          <div className="mg-result-title">Sleeve/Packaging Grade</div>
          <div className="mg-result-grade">{sleeveGrade}</div>
          <div className="mg-result-score">{sleeveCalc.score}/100</div>
        </div>

        <div className={`mg-card mg-result ${overallGrade === "M" || overallGrade === "NM" ? "mg-grade-nm" : overallGrade.startsWith("VG") ? "mg-grade-vg" : overallGrade.startsWith("G") ? "mg-grade-g" : "mg-grade-fp"}`}>
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
          {topMedia.length
            ? (
                <ul>
                  {topMedia.map((p, i) => (
                    <li key={i}>
                      {p.label} ({p.value})
                    </li>
                  ))}
                </ul>
              )
            : "No deductions."}
        </div>
        <div style={{ marginTop: 8 }}>
          <strong>Sleeve/Packaging:</strong>{" "}
          {topSleeve.length
            ? (
                <ul>
                  {topSleeve.map((p, i) => (
                    <li key={i}>
                      {p.label} ({p.value})
                    </li>
                  ))}
                </ul>
              )
            : "No deductions."}
        </div>
        <div style={{ marginTop: 8 }}>
          {whyOverall}
        </div>

        {/* Per-item chips */}
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

        {/* Include selected “notes” as plain text */}
        {Object.keys(state.sleeve.notes).some((k) => state.sleeve.notes[k]) && (
          <div style={{ marginTop: 8 }}>
            <strong>Additional notes:</strong>{" "}
            {Object.keys(state.sleeve.notes)
              .filter((k) => state.sleeve.notes[k])
              .join(", ")}
          </div>
        )}
        {state.sleeve.customNotes?.trim() && (
          <div style={{ marginTop: 8 }}>
            <strong>Custom notes:</strong> {state.sleeve.customNotes}
          </div>
        )}
      </section>
    </div>
  );
}
