// src/app/admin/media-grading/page.js
"use client";

import { useMemo, useState } from "react";
import "styles/media-grading.css";

/* -------------------- Constants -------------------- */

const MEDIA_TYPES = {
  vinyl: "🎵 Vinyl Records",
  cassette: "📼 Cassette Tapes",
  cd: "💿 Compact Discs",
};

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

// Score → grade (8 buckets). Mint is only via sealed packaging + perfect 100/100.
// NM remains the ceiling for unsealed items.
// Thresholds chosen to preserve your earlier spacing while splitting F vs P clearly.
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

function resolveMediaLabels(mediaType) {
  return {
    grooveWear:
      mediaType === "vinyl"
        ? "Groove wear visible"
        : mediaType === "cd"
        ? "Laser-rot/pinholes visible"
        : "Shell scuffs present",
    warping: mediaType === "cd" ? "Disc wobble present" : "Warping present",
    popsClicks:
      mediaType === "cd"
        ? "Occasional read errors corrected"
        : "Occasional pops or clicks",
    skipping:
      mediaType === "cd"
        ? "Unreadable sectors / skipping"
        : "Skipping or repeating",
    labelSectionTitle:
      mediaType === "vinyl"
        ? "Label/Center"
        : mediaType === "cd"
        ? "Hub/Face"
        : "Shell/Label",
    ringWear:
      mediaType === "cd" ? "Booklet ring wear visible" : "Ring wear visible",
    seamsStructureTitle:
      mediaType === "cd" ? "Case/Tray" : "Seams & Structure",
    seamsIntact: mediaType === "cd" ? "Case uncracked" : "All seams intact",
    seamSplitOrCrack:
      mediaType === "cd" ? "Case cracked" : "Seam splits present",
    spineWearOrTray:
      mediaType === "cd" ? "Tray teeth broken/missing" : "Spine shows wear",
  };
}

/* ------------- Shared severity weights ------------- */
const SV = {
  media: {
    scuffs: { veryLight: 1, visible: 3, obvious: 6 },
    scratches: { hairline: 5, feelable: 8, deep: 12 },
    grooveWear: { light: 8, evident: 12, heavy: 18 },
    warping: { slight: 4, moderate: 10, severe: 18 },
    surfaceNoise: { minimal: 3, noticeable: 6, significant: 10 },
    popsClicks: { rare: 2, occasional: 4, frequent: 8 },
    skipping: { isolated: 20, repeating: 30, widespread: 40 },
    labelShellHub: 3, // per
    perTrack: 1,
  },
  sleeve: {
    minorShelfWear: 3,
    cornerWear: { slight: 2, creased: 4, cut: 8 },
    ringWear: { light: 3, visible: 5, heavy: 8 },
    spineWear: { minor: 2, worn: 3, major: 5 },
    seamSplit: { small: 6, medium: 12, large: 18 },
    tears: 8,
    writing: 4,
    stickers: 3,
    sealedBonus: 5,
  },
};

const ORDER = ["M", "NM", "VG+", "VG", "G+", "G", "F", "P"];

/* -------------------- Small helpers -------------------- */
const clampScore = (n) => Math.max(0, Math.min(100, Math.round(n)));
const labelPretty = (k) =>
  ({
    veryLight: "very light",
    visible: "visible",
    obvious: "obvious",
    hairline: "hairline",
    feelable: "can feel with fingernail",
    deep: "deep",
    light: "light",
    evident: "evident",
    heavy: "heavy",
    slight: "slight",
    moderate: "moderate",
    severe: "severe",
    minimal: "minimal",
    noticeable: "noticeable",
    significant: "significant",
    rare: "rare",
    occasional: "occasional",
    frequent: "frequent",
    isolated: "isolated",
    repeating: "repeating",
    widespread: "widespread",
    small: "small",
    medium: "medium",
    large: "large",
    minor: "minor",
    worn: "worn",
    major: "major",
  }[k] || k);

/* --------- Item (disc/tape/CD) initial state --------- */
function newMediaItem() {
  return {
    missing: false, // if true → auto P (score 0)
    // Visual
    scuffs: false,
    scuffsLevel: "",
    scratches: false,
    scratchesLevel: "",
    grooveWear: false,
    grooveWearLevel: "",
    warping: false,
    warpingLevel: "",
    // Audio
    noNoise: false,
    surfaceNoise: false,
    surfaceNoiseLevel: "",
    popsClicks: false,
    popsClicksLevel: "",
    skipping: false,
    skippingLevel: "",
    // Label/Hub/Shell
    labelClean: false,
    spindleMarks: false,
    writingOnLabel: false,
    stickersOnLabel: false,
    // Scope
    sidesA: false,
    sidesB: false,
    tracksAffected: 0,
  };
}

/* ------------- Score one media item (disc) ------------- */
function scoreOneItem(item, labels) {
  if (item.missing) {
    return {
      score: 0,
      deductions: [{ label: "Media missing", pts: 100 }],
      hasAnyAudio: false,
    };
  }

  let score = 100;
  const deds = [];

  // Visual
  if (item.scuffs) {
    const lv = item.scuffsLevel || "visible";
    const pts = SV.media.scuffs[lv];
    score -= pts;
    deds.push({ label: `Light scuffs (${labelPretty(lv)})`, pts });
  }
  if (item.scratches) {
    const lv = item.scratchesLevel || "feelable";
    const pts = SV.media.scratches[lv];
    score -= pts;
    deds.push({ label: `Scratches present (${labelPretty(lv)})`, pts });
  }
  if (item.grooveWear) {
    const lv = item.grooveWearLevel || "evident";
    const pts = SV.media.grooveWear[lv];
    score -= pts;
    deds.push({ label: `${labels.grooveWear} (${labelPretty(lv)})`, pts });
  }
  if (item.warping) {
    const lv = item.warpingLevel || "moderate";
    const pts = SV.media.warping[lv];
    score -= pts;
    deds.push({ label: `${labels.warping} (${labelPretty(lv)})`, pts });
  }

  // Audio
  const anyAudio = item.surfaceNoise || item.popsClicks || item.skipping;

  if (item.surfaceNoise) {
    const lv = item.surfaceNoiseLevel || "noticeable";
    const pts = SV.media.surfaceNoise[lv];
    score -= pts;
    deds.push({ label: `Surface noise (${labelPretty(lv)})`, pts });
  }
  if (item.popsClicks) {
    const lv = item.popsClicksLevel || "occasional";
    const pts = SV.media.popsClicks[lv];
    score -= pts;
    deds.push({ label: `${labels.popsClicks} (${labelPretty(lv)})`, pts });
  }
  if (item.skipping) {
    const lv = item.skippingLevel || "repeating";
    const pts = SV.media.skipping[lv];
    score -= pts;
    deds.push({ label: `${labels.skipping} (${labelPretty(lv)})`, pts });
  }

  // Label/hub/shell small defects
  if (item.spindleMarks) {
    score -= SV.media.labelShellHub;
    deds.push({ label: "Spindle marks present", pts: SV.media.labelShellHub });
  }
  if (item.writingOnLabel) {
    score -= SV.media.labelShellHub;
    deds.push({ label: "Writing on label", pts: SV.media.labelShellHub });
  }
  if (item.stickersOnLabel) {
    score -= SV.media.labelShellHub;
    deds.push({ label: "Stickers or tape on label", pts: SV.media.labelShellHub });
  }

  // Per-track penalty only if any audio defect is selected
  const tA = parseInt(item.tracksAffected || 0, 10);
  if (anyAudio && !isNaN(tA) && tA > 0) {
    const pts = tA * SV.media.perTrack;
    score -= pts;
    deds.push({ label: `Tracks affected (${tA})`, pts });
  }

  score = clampScore(score);
  return { score, deductions: deds, hasAnyAudio: anyAudio };
}

/* -------------------- Components -------------------- */

function ResultsCard({ title, grade, score, colorClass }) {
  return (
    <div className={`mg-card mg-result ${colorClass}`}>
      <div className="mg-result-title">{title}</div>
      <div className="mg-result-grade">{grade}</div>
      <div className="mg-result-score">{score}/100</div>
    </div>
  );
}

export default function MediaGradingPage() {
  const [mediaType, setMediaType] = useState("vinyl");
  const labels = useMemo(() => resolveMediaLabels(mediaType), [mediaType]);

  // Scope toggles
  const [onlyPackaging, setOnlyPackaging] = useState(false);
  const [onlyMedia, setOnlyMedia] = useState(false);

  // MULTI-ITEM media: grade each disc/tape/CD individually
  const [items, setItems] = useState([newMediaItem()]);

  // Sleeve/Packaging (one per release)
  const [sleeve, setSleeve] = useState({
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
    tears: false,
    writing: false,
    stickersTape: false,
    sealed: false,
  });

  const [notes, setNotes] = useState("");

  // Handlers for items
  const updateItem = (idx, patch) =>
    setItems((arr) => {
      const next = arr.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  const addItem = () => setItems((arr) => [...arr, newMediaItem()]);
  const removeItem = (idx) =>
    setItems((arr) => (arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr));

  // Score each item
  const perItem = useMemo(
    () => items.map((it) => scoreOneItem(it, labels)),
    [items, labels]
  );

  // Aggregate Media score = arithmetic mean of items
  const mediaScore = useMemo(() => {
    if (perItem.length === 0) return 100;
    const sum = perItem.reduce((acc, r) => acc + r.score, 0);
    return clampScore(sum / perItem.length);
  }, [perItem]);

  const mediaGrade = useMemo(
    () => gradeFromScore(mediaScore, { allowMint: false }),
    [mediaScore]
  );

  // Sleeve score
  const sleeveCalc = useMemo(() => {
    let score = 100;
    const deds = [];
    let sealedOK = false;

    if (sleeve.minorShelfWear) {
      score -= SV.sleeve.minorShelfWear;
      deds.push({ label: "Minor shelf wear only", pts: SV.sleeve.minorShelfWear });
    }

    if (sleeve.cornerWear) {
      const lv = sleeve.cornerWearLevel || "creased";
      const pts = SV.sleeve.cornerWear[lv];
      score -= pts;
      deds.push({ label: `Corner wear (${labelPretty(lv)})`, pts });
    }

    if (sleeve.ringWear) {
      const lv = sleeve.ringWearLevel || "visible";
      const pts = SV.sleeve.ringWear[lv];
      score -= pts;
      deds.push({ label: `${labels.ringWear} (${labelPretty(lv)})`, pts });
    }

    if (sleeve.seamSplit) {
      const lv = sleeve.seamSplitLevel || "medium";
      const pts = SV.sleeve.seamSplit[lv];
      score -= pts;
      deds.push({ label: `${labels.seamSplitOrCrack} (${labelPretty(lv)})`, pts });
    }

    if (sleeve.spineWear) {
      const lv = sleeve.spineWearLevel || "worn";
      const pts = SV.sleeve.spineWear[lv];
      score -= pts;
      deds.push({ label: `${labels.spineWearOrTray} (${labelPretty(lv)})`, pts });
    }

    if (sleeve.tears) {
      score -= SV.sleeve.tears;
      deds.push({ label: "Tears present", pts: SV.sleeve.tears });
    }
    if (sleeve.writing) {
      score -= SV.sleeve.writing;
      deds.push({ label: "Writing present", pts: SV.sleeve.writing });
    }
    if (sleeve.stickersTape) {
      score -= SV.sleeve.stickers;
      deds.push({ label: "Stickers or tape", pts: SV.sleeve.stickers });
    }

    if (sleeve.sealed) {
      score = Math.min(100, score + SV.sleeve.sealedBonus);
      sealedOK = score === 100;
    }

    score = clampScore(score);
    return { score, deds, allowMint: sealedOK };
  }, [sleeve, labels]);

  const sleeveGrade = useMemo(
    () => gradeFromScore(sleeveCalc.score, { allowMint: sleeveCalc.allowMint }),
    [sleeveCalc]
  );

  // Overall = worse (by grade rank); tie → lower score.
  const overall = useMemo(() => {
    const mediaEnabled = !onlyPackaging;
    const sleeveEnabled = !onlyMedia;

    if (mediaEnabled && sleeveEnabled) {
      // Special Mint gate when both are perfect and sealed.
      if (sleeve.sealed && sleeveCalc.score === 100 && mediaScore === 100) {
        return { grade: "M", score: 100, reason: "Overall = M (factory sealed; no detectable defects)." };
      }

      const mi = ORDER.indexOf(mediaGrade);
      const si = ORDER.indexOf(sleeveGrade);
      if (mi > si) {
        return { grade: mediaGrade, score: mediaScore, reason: `Overall = ${mediaGrade} due to media being the limiting factor.` };
      } else if (si > mi) {
        return { grade: sleeveGrade, score: sleeveCalc.score, reason: `Overall = ${sleeveGrade} due to sleeve/packaging being the limiting factor.` };
      }
      // Same bucket → tie-break on score
      if (mediaScore <= sleeveCalc.score) {
        return { grade: mediaGrade, score: mediaScore, reason: `Overall = ${mediaGrade} (tie on grade; media score lower).` };
      } else {
        return { grade: sleeveGrade, score: sleeveCalc.score, reason: `Overall = ${sleeveGrade} (tie on grade; sleeve score lower).` };
      }
    }

    if (mediaEnabled) return { grade: mediaGrade, score: mediaScore, reason: `Overall = ${mediaGrade} (media-only).` };
    if (sleeveEnabled) return { grade: sleeveGrade, score: sleeveCalc.score, reason: `Overall = ${sleeveGrade} (packaging-only).` };
    return { grade: "NM", score: 100, reason: "No scope selected; default NM." };
  }, [onlyPackaging, onlyMedia, mediaGrade, mediaScore, sleeveGrade, sleeveCalc, sleeve.sealed]);

  // Explanation (top-3 per side, plus per-disc summary)
  const explanation = useMemo(() => {
    const parts = [];

    // Per-disc top hits
    if (!onlyPackaging) {
      const itemSummaries = perItem.map((r, i) => {
        const top = [...r.deductions].sort((a, b) => b.pts - a.pts).slice(0, 3);
        const summary = top.length
          ? top.map((d) => `${d.label} (−${d.pts})`).join("; ")
          : "No notable defects recorded";
        const g = gradeFromScore(r.score, { allowMint: false });
        return `Disc ${i + 1}: ${g} (${r.score}) — ${summary}`;
      });
      parts.push(`Media per-disc: ${itemSummaries.join(" | ")}`);
    }

    if (!onlyMedia) {
      const topSleeve = [...sleeveCalc.deds].sort((a, b) => b.pts - a.pts).slice(0, 3);
      const sTxt = topSleeve.length
        ? topSleeve.map((d) => `${d.label} (−${d.pts})`).join("; ")
        : "No notable defects recorded";
      const sealedNote =
        sleeve.sealed && sleeveCalc.allowMint
          ? " Sealed, factory shrink intact (+5; eligible for M if otherwise flawless)."
          : "";
      parts.push(`Packaging: ${sTxt}.${sealedNote}`);
    }

    parts.push(overall.reason);
    if (notes.trim()) parts.push(`Notes: ${notes.trim()}`);
    return parts.join(" ");
  }, [onlyPackaging, onlyMedia, perItem, sleeveCalc, sleeve, overall, notes]);

  const overallColor = GRADE_COLORS[overall.grade] || "mg-grade-vg";

  /* -------------------- UI -------------------- */
  return (
    <main id="media-grading" className="mg-wrap">
      <header className="mg-header">
        <a className="mg-back" href="/admin">← Back to Dashboard</a>
        <div className="mg-sub">🔍 <strong>Systematic Media Grading Tool</strong> — Detailed condition assessment with automatic grading calculation</div>
      </header>

      {/* Media type selector */}
      <section className="mg-pills" role="tablist" aria-label="Media type selector">
        {Object.entries(MEDIA_TYPES).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={mediaType === key}
            className={`mg-pill ${mediaType === key ? "selected" : ""}`}
            onClick={() => setMediaType(key)}
            type="button"
          >
            {label}
          </button>
        ))}
      </section>

      {/* Scope banner */}
      <section className="mg-scope">
        <div className="mg-scope-option">
          <input
            id="onlyPackaging"
            type="checkbox"
            checked={onlyPackaging}
            onChange={() => {
              setOnlyPackaging((v) => !v);
              if (!onlyPackaging) setOnlyMedia(false);
            }}
          />
          <label htmlFor="onlyPackaging">Only evaluating packaging — no disc/tape/record present</label>
        </div>
        <div className="mg-scope-option">
          <input
            id="onlyMedia"
            type="checkbox"
            checked={onlyMedia}
            onChange={() => {
              setOnlyMedia((v) => !v);
              if (!onlyMedia) setOnlyPackaging(false);
            }}
          />
          <label htmlFor="onlyMedia">Only evaluating media — no packaging present</label>
        </div>
      </section>

      {/* Two-column grid */}
      <section className="mg-grid">
        {/* LEFT: MEDIA (multi-disc) */}
        <div className={`mg-card ${onlyPackaging ? "mg-disabled" : ""}`} aria-disabled={onlyPackaging}>
          <h2>🎶 Record/Media Condition Assessment</h2>

          {items.map((item, idx) => (
            <fieldset key={idx} className="mg-fieldset mg-item">
              <legend>Disc/Tape #{idx + 1}</legend>

              <div className="mg-item-header">
                <div className="mg-check">
                  <input
                    id={`missing-${idx}`}
                    type="checkbox"
                    checked={item.missing}
                    onChange={(e) => updateItem(idx, { missing: e.target.checked })}
                  />
                  <label htmlFor={`missing-${idx}`}><strong>Mark this media as Missing (auto P)</strong></label>
                </div>
                <div className="mg-item-actions">
                  {items.length > 1 && (
                    <button type="button" className="mg-btn ghost" onClick={() => removeItem(idx)} aria-label={`Remove disc ${idx + 1}`}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Visual */}
              <div className={`mg-fieldset-inner ${item.missing ? "mg-disabled" : ""}`}>
                <fieldset className="mg-fieldset">
                  <legend>Visual Appearance</legend>

                  {/* Scuffs */}
                  <div className="mg-check">
                    <input
                      id={`scuffs-${idx}`}
                      type="checkbox"
                      checked={item.scuffs}
                      onChange={(e) => updateItem(idx, { scuffs: e.target.checked })}
                      disabled={item.missing}
                    />
                    <label htmlFor={`scuffs-${idx}`}>Light scuffs visible</label>
                  </div>
                  {item.scuffs && !item.missing && (
                    <div className="mg-subgroup" role="group" aria-label="Scuffs severity">
                      {[
                        ["veryLight", "Very light, barely visible"],
                        ["visible", "Visible but not deep"],
                        ["obvious", "Obvious, multiple scuffs"],
                      ].map(([val, text]) => (
                        <label key={val} className="mg-radio">
                          <input
                            type="radio"
                            name={`scuffs-level-${idx}`}
                            checked={item.scuffsLevel === val}
                            onChange={() => updateItem(idx, { scuffsLevel: val })}
                          />
                          <span>{text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Scratches */}
                  <div className="mg-check">
                    <input
                      id={`scratches-${idx}`}
                      type="checkbox"
                      checked={item.scratches}
                      onChange={(e) => updateItem(idx, { scratches: e.target.checked })}
                      disabled={item.missing}
                    />
                    <label htmlFor={`scratches-${idx}`}>Scratches present</label>
                  </div>
                  {item.scratches && !item.missing && (
                    <div className="mg-subgroup" role="group" aria-label="Scratches severity">
                      {[
                        ["hairline", "Hairline scratches only"],
                        ["feelable", "Can feel with fingernail"],
                        ["deep", "Deep, visible grooves"],
                      ].map(([val, text]) => (
                        <label key={val} className="mg-radio">
                          <input
                            type="radio"
                            name={`scratches-level-${idx}`}
                            checked={item.scratchesLevel === val}
                            onChange={() => updateItem(idx, { scratchesLevel: val })}
                          />
                          <span>{text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Groove wear / rot / shell scuffs */}
                  <div className="mg-check">
                    <input
                      id={`groove-${idx}`}
                      type="checkbox"
                      checked={item.grooveWear}
                      onChange={(e) => updateItem(idx, { grooveWear: e.target.checked })}
                      disabled={item.missing}
                    />
                    <label htmlFor={`groove-${idx}`}>{labels.grooveWear}</label>
                  </div>
                  {item.grooveWear && !item.missing && (
                    <div className="mg-subgroup" role="group" aria-label="Groove wear severity">
                      {[
                        ["light", "Light"],
                        ["evident", "Evident"],
                        ["heavy", "Heavy"],
                      ].map(([val, text]) => (
                        <label key={val} className="mg-radio">
                          <input
                            type="radio"
                            name={`groove-level-${idx}`}
                            checked={item.grooveWearLevel === val}
                            onChange={() => updateItem(idx, { grooveWearLevel: val })}
                          />
                          <span>{text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Warping / wobble */}
                  <div className="mg-check">
                    <input
                      id={`warp-${idx}`}
                      type="checkbox"
                      checked={item.warping}
                      onChange={(e) => updateItem(idx, { warping: e.target.checked })}
                      disabled={item.missing}
                    />
                    <label htmlFor={`warp-${idx}`}>{labels.warping}</label>
                  </div>
                  {item.warping && !item.missing && (
                    <div className="mg-subgroup" role="group" aria-label="Warping severity">
                      {[
                        ["slight", "Slight (doesn’t affect play)"],
                        ["moderate", "Moderate"],
                        ["severe", "Severe (affects play)"],
                      ].map(([val, text]) => (
                        <label key={val} className="mg-radio">
                          <input
                            type="radio"
                            name={`warp-level-${idx}`}
                            checked={item.warpingLevel === val}
                            onChange={() => updateItem(idx, { warpingLevel: val })}
                          />
                          <span>{text}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>

                {/* Audio */}
                <fieldset className="mg-fieldset">
                  <legend>Audio Performance</legend>

                  <div className="mg-check">
                    <input
                      id={`noNoise-${idx}`}
                      type="checkbox"
                      checked={item.noNoise}
                      onChange={(e) => updateItem(idx, { noNoise: e.target.checked })}
                      disabled={item.missing}
                    />
                    <label htmlFor={`noNoise-${idx}`}>Plays with no surface noise</label>
                  </div>

                  <div className="mg-check">
                    <input
                      id={`noise-${idx}`}
                      type="checkbox"
                      checked={item.surfaceNoise}
                      onChange={(e) => updateItem(idx, { surfaceNoise: e.target.checked })}
                      disabled={item.missing}
                    />
                    <label htmlFor={`noise-${idx}`}>Surface noise when played</label>
                  </div>
                  {item.surfaceNoise && !item.missing && (
                    <div className="mg-subgroup">
                      {[
                        ["minimal", "Minimal"],
                        ["noticeable", "Noticeable"],
                        ["significant", "Significant"],
                      ].map(([val, text]) => (
                        <label key={val} className="mg-radio">
                          <input
                            type="radio"
                            name={`noise-level-${idx}`}
                            checked={item.surfaceNoiseLevel === val}
                            onChange={() => updateItem(idx, { surfaceNoiseLevel: val })}
                          />
                          <span>{text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="mg-check">
                    <input
                      id={`pops-${idx}`}
                      type="checkbox"
                      checked={item.popsClicks}
                      onChange={(e) => updateItem(idx, { popsClicks: e.target.checked })}
                      disabled={item.missing}
                    />
                    <label htmlFor={`pops-${idx}`}>{labels.popsClicks}</label>
                  </div>
                  {item.popsClicks && !item.missing && (
                    <div className="mg-subgroup">
                      {[
                        ["rare", "Rare"],
                        ["occasional", "Occasional"],
                        ["frequent", "Frequent"],
                      ].map(([val, text]) => (
                        <label key={val} className="mg-radio">
                          <input
                            type="radio"
                            name={`pops-level-${idx}`}
                            checked={item.popsClicksLevel === val}
                            onChange={() => updateItem(idx, { popsClicksLevel: val })}
                          />
                          <span>{text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="mg-check">
                    <input
                      id={`skip-${idx}`}
                      type="checkbox"
                      checked={item.skipping}
                      onChange={(e) => updateItem(idx, { skipping: e.target.checked })}
                      disabled={item.missing}
                    />
                    <label htmlFor={`skip-${idx}`}>{labels.skipping}</label>
                  </div>
                  {item.skipping && !item.missing && (
                    <div className="mg-subgroup">
                      {[
                        ["isolated", "Isolated sections"],
                        ["repeating", "Repeating / unreadable sectors"],
                        ["widespread", "Widespread issues"],
                      ].map(([val, text]) => (
                        <label key={val} className="mg-radio">
                          <input
                            type="radio"
                            name={`skip-level-${idx}`}
                            checked={item.skippingLevel === val}
                            onChange={() => updateItem(idx, { skippingLevel: val })}
                          />
                          <span>{text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="mg-sides">
                    <div className="mg-sides-title">Which side(s) affected</div>
                    <div className="mg-sides-grid">
                      <div className="mg-check">
                        <input
                          id={`A-${idx}`}
                          type="checkbox"
                          checked={item.sidesA}
                          onChange={(e) => updateItem(idx, { sidesA: e.target.checked })}
                          disabled={item.missing}
                        />
                        <label htmlFor={`A-${idx}`}>Side A</label>
                      </div>
                      <div className="mg-check">
                        <input
                          id={`B-${idx}`}
                          type="checkbox"
                          checked={item.sidesB}
                          onChange={(e) => updateItem(idx, { sidesB: e.target.checked })}
                          disabled={item.missing}
                        />
                        <label htmlFor={`B-${idx}`}>Side B</label>
                      </div>
                    </div>
                  </div>

                  <div className="mg-number">
                    <label htmlFor={`tracks-${idx}`}>Tracks affected</label>
                    <input
                      id={`tracks-${idx}`}
                      type="number"
                      min={0}
                      step={1}
                      value={item.tracksAffected}
                      onChange={(e) =>
                        updateItem(idx, {
                          tracksAffected: Math.max(0, parseInt(e.target.value || "0", 10)),
                        })
                      }
                      disabled={!item.surfaceNoise && !item.popsClicks && !item.skipping}
                    />
                    <div className="mg-help">−1 per track, only when any audio defect is selected.</div>
                  </div>
                </fieldset>

                {/* Label / Hub / Shell */}
                <fieldset className="mg-fieldset">
                  <legend>Label / Hub / Shell</legend>
                  <div className="mg-check">
                    <input
                      id={`clean-${idx}`}
                      type="checkbox"
                      checked={item.labelClean}
                      onChange={(e) => updateItem(idx, { labelClean: e.target.checked })}
                      disabled={item.missing}
                    />
                    <label htmlFor={`clean-${idx}`}>Label is clean and bright</label>
                  </div>
                  <div className="mg-check">
                    <input
                      id={`spindle-${idx}`}
                      type="checkbox"
                      checked={item.spindleMarks}
                      onChange={(e) => updateItem(idx, { spindleMarks: e.target.checked })}
                      disabled={item.missing}
                    />
                    <label htmlFor={`spindle-${idx}`}>Spindle marks present</label>
                  </div>
                  <div className="mg-check">
                    <input
                      id={`write-${idx}`}
                      type="checkbox"
                      checked={item.writingOnLabel}
                      onChange={(e) => updateItem(idx, { writingOnLabel: e.target.checked })}
                      disabled={item.missing}
                    />
                    <label htmlFor={`write-${idx}`}>Writing on label</label>
                  </div>
                  <div className="mg-check">
                    <input
                      id={`stick-${idx}`}
                      type="checkbox"
                      checked={item.stickersOnLabel}
                      onChange={(e) => updateItem(idx, { stickersOnLabel: e.target.checked })}
                      disabled={item.missing}
                    />
                    <label htmlFor={`stick-${idx}`}>Stickers or tape on label</label>
                  </div>
                </fieldset>
              </div>

              {/* Per-item mini result */}
              <div className="mg-per-item-result">
                {(() => {
                  const r = scoreOneItem(items[idx], labels);
                  const g = gradeFromScore(r.score, { allowMint: false });
                  return (
                    <div className={`mg-chip ${GRADE_COLORS[g]}`}>
                      Disc/Tape #{idx + 1}: <strong>{g}</strong> ({r.score})
                    </div>
                  );
                })()}
              </div>
            </fieldset>
          ))}

          <div className="mg-item-controls">
            <button type="button" className="mg-btn" onClick={addItem}>+ Add another disc/tape</button>
          </div>
        </div>

        {/* RIGHT: SLEEVE/PACKAGING */}
        <div className={`mg-card ${onlyMedia ? "mg-disabled" : ""}`} aria-disabled={onlyMedia}>
          <h2>📦 Sleeve/Packaging Condition Assessment</h2>

          <fieldset className="mg-fieldset">
            <legend>Overall Appearance</legend>
            <div className="mg-check">
              <input id="likeNew" type="checkbox" checked={sleeve.likeNew} onChange={(e) => setSleeve({ ...sleeve, likeNew: e.target.checked })} />
              <label htmlFor="likeNew">Looks like new, no flaws</label>
            </div>
            <div className="mg-check">
              <input id="minorShelfWear" type="checkbox" checked={sleeve.minorShelfWear} onChange={(e) => setSleeve({ ...sleeve, minorShelfWear: e.target.checked })} />
              <label htmlFor="minorShelfWear">Minor shelf wear only</label>
            </div>
            <div className="mg-check">
              <input id="cornerWear" type="checkbox" checked={sleeve.cornerWear} onChange={(e) => setSleeve({ ...sleeve, cornerWear: e.target.checked })} />
              <label htmlFor="cornerWear">Corner wear present</label>
            </div>
            {sleeve.cornerWear && (
              <div className="mg-subgroup">
                {[
                  ["slight", "Slight bumping"],
                  ["creased", "Creased or frayed"],
                  ["cut", "Cut or heavily damaged"],
                ].map(([val, text]) => (
                  <label key={val} className="mg-radio">
                    <input
                      type="radio"
                      name="corner-level"
                      checked={sleeve.cornerWearLevel === val}
                      onChange={() => setSleeve({ ...sleeve, cornerWearLevel: val })}
                    />
                    <span>{text}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="mg-check">
              <input id="ringWear" type="checkbox" checked={sleeve.ringWear} onChange={(e) => setSleeve({ ...sleeve, ringWear: e.target.checked })} />
              <label htmlFor="ringWear">{labels.ringWear}</label>
            </div>
            {sleeve.ringWear && (
              <div className="mg-subgroup">
                {[
                  ["light", "Light"],
                  ["visible", "Visible"],
                  ["heavy", "Heavy"],
                ].map(([val, text]) => (
                  <label key={val} className="mg-radio">
                    <input
                      type="radio"
                      name="ring-level"
                      checked={sleeve.ringWearLevel === val}
                      onChange={() => setSleeve({ ...sleeve, ringWearLevel: val })}
                    />
                    <span>{text}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="mg-fieldset">
            <legend>{labels.seamsStructureTitle}</legend>
            <div className="mg-check">
              <input id="seamsIntact" type="checkbox" checked={sleeve.seamsIntact} onChange={(e) => setSleeve({ ...sleeve, seamsIntact: e.target.checked })} />
              <label htmlFor="seamsIntact">{labels.seamsIntact}</label>
            </div>
            <div className="mg-check">
              <input id="seamSplit" type="checkbox" checked={sleeve.seamSplit} onChange={(e) => setSleeve({ ...sleeve, seamSplit: e.target.checked })} />
              <label htmlFor="seamSplit">{labels.seamSplitOrCrack}</label>
            </div>
            {sleeve.seamSplit && (
              <div className="mg-subgroup">
                {[
                  ["small", "Small"],
                  ["medium", "Medium"],
                  ["large", "Large / multiple"],
                ].map(([val, text]) => (
                  <label key={val} className="mg-radio">
                    <input
                      type="radio"
                      name="seam-level"
                      checked={sleeve.seamSplitLevel === val}
                      onChange={() => setSleeve({ ...sleeve, seamSplitLevel: val })}
                    />
                    <span>{text}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="mg-check">
              <input id="spineWear" type="checkbox" checked={sleeve.spineWear} onChange={(e) => setSleeve({ ...sleeve, spineWear: e.target.checked })} />
              <label htmlFor="spineWear">{labels.spineWearOrTray}</label>
            </div>
            {sleeve.spineWear && (
              <div className="mg-subgroup">
                {[
                  ["minor", "Minor"],
                  ["worn", "Worn"],
                  ["major", "Major"],
                ].map(([val, text]) => (
                  <label key={val} className="mg-radio">
                    <input
                      type="radio"
                      name="spine-level"
                      checked={sleeve.spineWearLevel === val}
                      onChange={() => setSleeve({ ...sleeve, spineWearLevel: val })}
                    />
                    <span>{text}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="mg-fieldset">
            <legend>Damage & Markings</legend>
            <div className="mg-check">
              <input id="tears" type="checkbox" checked={sleeve.tears} onChange={(e) => setSleeve({ ...sleeve, tears: e.target.checked })} />
              <label htmlFor="tears">Tears present</label>
            </div>
            <div className="mg-check">
              <input id="writing" type="checkbox" checked={sleeve.writing} onChange={(e) => setSleeve({ ...sleeve, writing: e.target.checked })} />
              <label htmlFor="writing">Writing present</label>
            </div>
            <div className="mg-check">
              <input id="stickersTape" type="checkbox" checked={sleeve.stickersTape} onChange={(e) => setSleeve({ ...sleeve, stickersTape: e.target.checked })} />
              <label htmlFor="stickersTape">Stickers or tape</label>
            </div>
            <div className="mg-check">
              <input id="sealed" type="checkbox" checked={sleeve.sealed} onChange={(e) => setSleeve({ ...sleeve, sealed: e.target.checked })} />
              <label htmlFor="sealed">Sealed (factory shrink intact)</label>
            </div>
            <div className="mg-help">Sealed adds +5 (caps at 100). Mint (M) only when sealed & flawless.</div>
          </fieldset>
        </div>
      </section>

      {/* Notes */}
      <section className="mg-notes mg-card">
        <label htmlFor="customNotes"><strong>Custom Condition Notes</strong></label>
        <textarea id="customNotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </section>

      {/* Results */}
      <section className="mg-results">
        {!onlyPackaging && (
          <ResultsCard
            title="Record/Media Grade"
            grade={mediaGrade}
            score={mediaScore}
            colorClass={GRADE_COLORS[mediaGrade]}
          />
        )}
        {!onlyMedia && (
          <ResultsCard
            title="Sleeve/Packaging Grade"
            grade={sleeveGrade}
            score={sleeveCalc.score}
            colorClass={GRADE_COLORS[sleeveGrade]}
          />
        )}
        <ResultsCard
          title="Overall Grade"
          grade={overall.grade}
          score={overall.score}
          colorClass={overallColor}
        />
      </section>

      {/* Per-disc recap row */}
      {!onlyPackaging && (
        <section className="mg-card mg-per-item-recap">
          <div className="mg-expl-title">Per-disc Summary</div>
          <div className="mg-chip-row">
            {perItem.map((r, i) => {
              const g = gradeFromScore(r.score, { allowMint: false });
              return (
                <span key={i} className={`mg-chip ${GRADE_COLORS[g]}`}>
                  Disc/Tape #{i + 1}: <strong>{g}</strong> ({r.score})
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* Explanation */}
      <section className="mg-explanation mg-card">
        <div className="mg-expl-title">Grading Explanation</div>
        <p>{explanation}</p>
      </section>
    </main>
  );
}
