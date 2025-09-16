// src/app/admin/media-grading/page.js
"use client";

import { useMemo, useState } from "react";
import "styles/media-grading.css";

/* =================== Constants =================== */

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

// 8-grade scale (no M-). Mint only if sealed & perfect.
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

const ORDER = ["M", "NM", "VG+", "VG", "G+", "G", "F", "P"];

/* =================== Labels by media type =================== */
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

/* =================== Severity weights =================== */
const SV = {
  media: {
    scuffs: { veryLight: 1, visible: 3, obvious: 6 },
    scratches: { hairline: 5, feelable: 8, deep: 12 },
    grooveWear: { light: 8, evident: 12, heavy: 18 },
    warping: { slight: 4, moderate: 10, severe: 18 },
    surfaceNoise: { minimal: 3, noticeable: 6, significant: 10 },
    popsClicks: { rare: 2, occasional: 4, frequent: 8 },
    skipping: { isolated: 20, repeating: 30, widespread: 40 },
    labelShellHub: 3,
    perTrack: 1, // only applied when ANY audio defect selected on the item
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

const clampScore = (n) => Math.max(0, Math.min(100, Math.round(n)));
const pretty = (k, map) => map[k] || k;
const labelMap = {
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
};

/* =================== Item state =================== */
function newMediaItem() {
  return {
    missing: false,

    // Visual with severities + per-defect sides/tracks
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
    warpingLevel: "", // no sides / tracks per request

    // Audio (each with sides/tracks)
    noNoise: false,

    surfaceNoise: false,
    surfaceNoiseLevel: "",
    noiseSidesA: false,
    noiseSidesB: false,
    noiseTracks: 0,

    popsClicks: false,
    popsClicksLevel: "",
    popsSidesA: false,
    popsSidesB: false,
    popsTracks: 0,

    skipping: false,
    skippingLevel: "",
    skipSidesA: false,
    skipSidesB: false,
    skipTracks: 0,

    // Label/Hub/Shell
    labelClean: false,
    spindleMarks: false,
    writingOnLabel: false,
    stickersOnLabel: false,
  };
}

/* ========= Score one media item (disc/tape/CD) ========= */
function scoreOneItem(item, labels) {
  if (item.missing) {
    return {
      score: 0,
      deductions: [{ label: "Media missing", pts: 100 }],
    };
  }

  let score = 100;
  const deds = [];

  // Visual
  if (item.scuffs) {
    const lv = item.scuffsLevel || "visible";
    const pts = SV.media.scuffs[lv];
    score -= pts;
    const trackNote =
      item.scuffsTracks && item.scuffsTracks > 0 ? `; tracks ${item.scuffsTracks}` : "";
    const sideNote =
      item.scuffsSidesA || item.scuffsSidesB
        ? `; sides ${["A", "B"].filter((s, i) => (i ? item.scuffsSidesB : item.scuffsSidesA)).join("/")}`
        : "";
    deds.push({ label: `Light scuffs (${pretty(lv, labelMap)}${sideNote}${trackNote})`, pts });
  }
  if (item.scratches) {
    const lv = item.scratchesLevel || "feelable";
    const pts = SV.media.scratches[lv];
    score -= pts;
    const trackNote =
      item.scratchesTracks && item.scratchesTracks > 0 ? `; tracks ${item.scratchesTracks}` : "";
    const sideNote =
      item.scratchesSidesA || item.scratchesSidesB
        ? `; sides ${["A", "B"].filter((s, i) => (i ? item.scratchesSidesB : item.scratchesSidesA)).join("/")}`
        : "";
    deds.push({ label: `Scratches (${pretty(lv, labelMap)}${sideNote}${trackNote})`, pts });
  }
  if (item.grooveWear) {
    const lv = item.grooveWearLevel || "evident";
    const pts = SV.media.grooveWear[lv];
    score -= pts;
    const trackNote =
      item.grooveTracks && item.grooveTracks > 0 ? `; tracks ${item.grooveTracks}` : "";
    const sideNote =
      item.grooveSidesA || item.grooveSidesB
        ? `; sides ${["A", "B"].filter((s, i) => (i ? item.grooveSidesB : item.grooveSidesA)).join("/")}`
        : "";
    deds.push({ label: `${labels.grooveWear} (${pretty(lv, labelMap)}${sideNote}${trackNote})`, pts });
  }
  if (item.warping) {
    const lv = item.warpingLevel || "moderate";
    const pts = SV.media.warping[lv];
    score -= pts;
    deds.push({ label: `${labels.warping} (${pretty(lv, labelMap)})`, pts });
  }

  // Audio
  const anyAudio = item.surfaceNoise || item.popsClicks || item.skipping;

  if (item.surfaceNoise) {
    const lv = item.surfaceNoiseLevel || "noticeable";
    const pts = SV.media.surfaceNoise[lv];
    score -= pts;
    const sideNote =
      item.noiseSidesA || item.noiseSidesB
        ? `; sides ${["A", "B"].filter((s, i) => (i ? item.noiseSidesB : item.noiseSidesA)).join("/")}`
        : "";
    deds.push({ label: `Surface noise (${pretty(lv, labelMap)}${sideNote})`, pts });
  }
  if (item.popsClicks) {
    const lv = item.popsClicksLevel || "occasional";
    const pts = SV.media.popsClicks[lv];
    score -= pts;
    const sideNote =
      item.popsSidesA || item.popsSidesB
        ? `; sides ${["A", "B"].filter((s, i) => (i ? item.popsSidesB : item.popsSidesA)).join("/")}`
        : "";
    deds.push({ label: `${labels.popsClicks} (${pretty(lv, labelMap)}${sideNote})`, pts });
  }
  if (item.skipping) {
    const lv = item.skippingLevel || "repeating";
    const pts = SV.media.skipping[lv];
    score -= pts;
    const sideNote =
      item.skipSidesA || item.skipSidesB
        ? `; sides ${["A", "B"].filter((s, i) => (i ? item.skipSidesB : item.skipSidesA)).join("/")}`
        : "";
    deds.push({ label: `${labels.skipping} (${pretty(lv, labelMap)}${sideNote})`, pts });
  }

  // Label/Hub/Shell micro-deductions
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

  // Per-track penalty: ONLY if any audio defect is selected (per spec).
  const totalTracks =
    (item.noiseTracks || 0) + (item.popsTracks || 0) + (item.skipTracks || 0);
  if (anyAudio && totalTracks > 0) {
    const pts = totalTracks * SV.media.perTrack;
    score -= pts;
    deds.push({ label: `Tracks affected (${totalTracks})`, pts });
  }

  return { score: clampScore(score), deductions: deds };
}

/* =================== Components =================== */

function ResultsCard({ title, grade, score, colorClass }) {
  return (
    <div className={`mg-card mg-result ${colorClass}`}>
      <div className="mg-result-title">{title}</div>
      <div className="mg-result-grade">{grade}</div>
      <div className="mg-result-score">{score}/100</div>
    </div>
  );
}

function SubgroupSidesTracks({ baseId, valueSidesA, valueSidesB, onSidesA, onSidesB, valueTracks, onTracks, hideTracks = false }) {
  return (
    <div className="mg-sub-extent">
      <div className="mg-sides-grid">
        <div className="mg-check">
          <input id={`${baseId}-sa`} type="checkbox" checked={valueSidesA} onChange={(e) => onSidesA(e.target.checked)} />
          <label htmlFor={`${baseId}-sa`}>Side A</label>
        </div>
        <div className="mg-check">
          <input id={`${baseId}-sb`} type="checkbox" checked={valueSidesB} onChange={(e) => onSidesB(e.target.checked)} />
          <label htmlFor={`${baseId}-sb`}>Side B</label>
        </div>
      </div>
      {!hideTracks && (
        <div className="mg-number">
          <label htmlFor={`${baseId}-t`}>Tracks affected</label>
          <input
            id={`${baseId}-t`}
            type="number"
            min={0}
            step={1}
            value={valueTracks}
            onChange={(e) => onTracks(Math.max(0, parseInt(e.target.value || "0", 10)))}
          />
          <div className="mg-help">−1 per track applies only if any audio defect is selected.</div>
        </div>
      )}
    </div>
  );
}

/* =================== Page =================== */

export default function MediaGradingPage() {
  const [mediaType, setMediaType] = useState("vinyl");
  const labels = useMemo(() => resolveMediaLabels(mediaType), [mediaType]);

  // Multi-disc/tape/CD
  const [items, setItems] = useState([newMediaItem()]);
  const updateItem = (idx, patch) =>
    setItems((arr) => {
      const next = arr.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  const addItem = () => setItems((arr) => [...arr, newMediaItem()]);
  const removeItem = (idx) =>
    setItems((arr) => (arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr));

  // Sleeve/Packaging (single)
  const [sleeve, setSleeve] = useState({
    missing: false, // NEW: packaging missing -> auto P
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
    sealed: false, // moved to Overall Appearance per request
    tears: false,
    writing: false,
    stickersTape: false,
  });

  // Additional (disclosure-only) notes
  const [extra, setExtra] = useState({
    jewelDamaged: false,
    jewelMissing: false,
    origShrink: false,
    hypeSticker: false,
    cutout: false,
    promo: false,
    priceSticker: false,
    firstPress: false,
    coloredVinyl: false,
    limitedEdition: false,
    gatefoldSleeve: false,
    originalInner: false,
  });

  const [notes, setNotes] = useState("");

  // Score each media item
  const perItem = useMemo(
    () => items.map((it) => scoreOneItem(it, labels)),
    [items, labels]
  );

  // Aggregate media
  const mediaScore = useMemo(() => {
    if (perItem.length === 0) return 100;
    const sum = perItem.reduce((acc, r) => acc + r.score, 0);
    return clampScore(sum / perItem.length);
  }, [perItem]);
  const mediaGrade = useMemo(() => gradeFromScore(mediaScore, { allowMint: false }), [mediaScore]);

  // Sleeve scoring (with missing)
  const sleeveCalc = useMemo(() => {
    if (sleeve.missing) {
      return { score: 0, deds: [{ label: "Packaging missing", pts: 100 }], allowMint: false };
    }
    let score = 100;
    const deds = [];
    let allowMint = false;

    if (sleeve.likeNew) {
      // no deduction; helps description
    }
    if (sleeve.sealed) {
      score = Math.min(100, score + SV.sleeve.sealedBonus);
    }
    if (sleeve.minorShelfWear) {
      score -= SV.sleeve.minorShelfWear;
      deds.push({ label: "Minor shelf wear only", pts: SV.sleeve.minorShelfWear });
    }
    if (sleeve.cornerWear) {
      const lv = sleeve.cornerWearLevel || "creased";
      const pts = SV.sleeve.cornerWear[lv];
      score -= pts;
      deds.push({ label: `Corner wear (${pretty(lv, labelMap)})`, pts });
    }
    if (sleeve.ringWear) {
      const lv = sleeve.ringWearLevel || "visible";
      const pts = SV.sleeve.ringWear[lv];
      score -= pts;
      deds.push({ label: `${labels.ringWear} (${pretty(lv, labelMap)})`, pts });
    }
    if (sleeve.seamSplit) {
      const lv = sleeve.seamSplitLevel || "medium";
      const pts = SV.sleeve.seamSplit[lv];
      score -= pts;
      deds.push({ label: `${labels.seamSplitOrCrack} (${pretty(lv, labelMap)})`, pts });
    }
    if (sleeve.spineWear) {
      const lv = sleeve.spineWearLevel || "worn";
      const pts = SV.sleeve.spineWear[lv];
      score -= pts;
      deds.push({ label: `${labels.spineWearOrTray} (${pretty(lv, labelMap)})`, pts });
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

    score = clampScore(score);
    allowMint = sleeve.sealed && score === 100;
    return { score, deds, allowMint };
  }, [sleeve, labels]);

  const sleeveGrade = useMemo(
    () => gradeFromScore(sleeveCalc.score, { allowMint: sleeveCalc.allowMint }),
    [sleeveCalc]
  );

  // Overall (always min of media vs sleeve)
  const overall = useMemo(() => {
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
    // same bucket: use lower score
    if (mediaScore <= sleeveCalc.score) {
      return { grade: mediaGrade, score: mediaScore, reason: `Overall = ${mediaGrade} (tie on grade; media score lower).` };
    }
    return { grade: sleeveGrade, score: sleeveCalc.score, reason: `Overall = ${sleeveGrade} (tie on grade; sleeve score lower).` };
  }, [mediaGrade, mediaScore, sleeveGrade, sleeveCalc, sleeve.sealed]);

  // Explanation
  const explanation = useMemo(() => {
    const perDisc = perItem
      .map((r, i) => {
        const g = gradeFromScore(r.score, { allowMint: false });
        const top = [...r.deductions].sort((a, b) => b.pts - a.pts).slice(0, 3);
        const list = top.length ? top.map((d) => `${d.label} (−${d.pts})`).join("; ") : "No notable defects";
        return `Disc/Tape ${i + 1}: ${g} (${r.score}) — ${list}`;
      })
      .join(" | ");

    const topSleeve = [...sleeveCalc.deds].sort((a, b) => b.pts - a.pts).slice(0, 3);
    const sleeveTxt = topSleeve.length ? topSleeve.map((d) => `${d.label} (−${d.pts})`).join("; ") : "No notable defects";
    const sealedNote =
      sleeve.sealed && sleeveCalc.allowMint
        ? " Sealed; eligible for M if otherwise flawless."
        : "";

    const extras = Object.entries(extra)
      .filter(([, v]) => v)
      .map(([k]) =>
        ({
          jewelDamaged: "Jewel case damaged",
          jewelMissing: "Jewel case missing",
          origShrink: "Original shrinkwrap",
          hypeSticker: "Hype sticker present",
          cutout: "Cut-out hole/mark",
          promo: "Promotional copy",
          priceSticker: "Price sticker/tag",
          firstPress: "First pressing",
          coloredVinyl: "Colored vinyl",
          limitedEdition: "Limited edition",
          gatefoldSleeve: "Gatefold sleeve",
          originalInner: "Original inner sleeve",
        }[k] || k)
      );

    const parts = [
      `Media per-item: ${perDisc}.`,
      `Packaging: ${sleeveTxt}.${sealedNote}`,
      overall.reason,
      notes.trim() ? `Notes: ${notes.trim()}` : "",
      extras.length ? `Additional notes: ${extras.join(", ")}.` : "",
    ].filter(Boolean);

    return parts.join(" ");
  }, [perItem, sleeveCalc, sleeve, overall, notes, extra]);

  const overallColor = GRADE_COLORS[overall.grade] || "mg-grade-vg";

  /* =================== JSX =================== */
  return (
    <main id="media-grading" className="mg-wrap">
      <header className="mg-header">
        <div className="mg-title">🔍 Systematic Media Grading Tool</div>
        <div className="mg-sub">Detailed condition assessment with automatic grading calculation</div>
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

      {/* Two-column grid */}
      <section className="mg-grid">
        {/* LEFT: MEDIA (multi-disc) */}
        <div className="mg-card">
          <h2>🎶 Record/Media Condition Assessment</h2>

          {items.map((item, idx) => {
            const r = scoreOneItem(items[idx], labels);
            const g = gradeFromScore(r.score, { allowMint: false });

            return (
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
                      <button type="button" className="mg-btn ghost" onClick={() => removeItem(idx)}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className={`mg-fieldset-inner ${item.missing ? "mg-disabled" : ""}`}>
                  {/* Visual */}
                  <fieldset className="mg-fieldset">
                    <legend>Visual Appearance</legend>

                    {/* Scuffs */}
                    <div className="mg-check">
                      <input
                        id={`scuffs-${idx}`}
                        type="checkbox"
                        checked={item.scuffs}
                        onChange={(e) => updateItem(idx, { scuffs: e.target.checked })}
                      />
                      <label htmlFor={`scuffs-${idx}`}>Light scuffs visible</label>
                    </div>
                    {item.scuffs && (
                      <>
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
                        <SubgroupSidesTracks
                          baseId={`scuffs-ext-${idx}`}
                          valueSidesA={item.scuffsSidesA}
                          valueSidesB={item.scuffsSidesB}
                          onSidesA={(v) => updateItem(idx, { scuffsSidesA: v })}
                          onSidesB={(v) => updateItem(idx, { scuffsSidesB: v })}
                          valueTracks={item.scuffsTracks}
                          onTracks={(n) => updateItem(idx, { scuffsTracks: n })}
                        />
                      </>
                    )}

                    {/* Scratches */}
                    <div className="mg-check">
                      <input
                        id={`scratches-${idx}`}
                        type="checkbox"
                        checked={item.scratches}
                        onChange={(e) => updateItem(idx, { scratches: e.target.checked })}
                      />
                      <label htmlFor={`scratches-${idx}`}>Scratches present</label>
                    </div>
                    {item.scratches && (
                      <>
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
                        <SubgroupSidesTracks
                          baseId={`scr-ext-${idx}`}
                          valueSidesA={item.scratchesSidesA}
                          valueSidesB={item.scratchesSidesB}
                          onSidesA={(v) => updateItem(idx, { scratchesSidesA: v })}
                          onSidesB={(v) => updateItem(idx, { scratchesSidesB: v })}
                          valueTracks={item.scratchesTracks}
                          onTracks={(n) => updateItem(idx, { scratchesTracks: n })}
                        />
                      </>
                    )}

                    {/* Groove wear / rot / shell scuffs */}
                    <div className="mg-check">
                      <input
                        id={`groove-${idx}`}
                        type="checkbox"
                        checked={item.grooveWear}
                        onChange={(e) => updateItem(idx, { grooveWear: e.target.checked })}
                      />
                      <label htmlFor={`groove-${idx}`}>{labels.grooveWear}</label>
                    </div>
                    {item.grooveWear && (
                      <>
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
                        <SubgroupSidesTracks
                          baseId={`groove-ext-${idx}`}
                          valueSidesA={item.grooveSidesA}
                          valueSidesB={item.grooveSidesB}
                          onSidesA={(v) => updateItem(idx, { grooveSidesA: v })}
                          onSidesB={(v) => updateItem(idx, { grooveSidesB: v })}
                          valueTracks={item.grooveTracks}
                          onTracks={(n) => updateItem(idx, { grooveTracks: n })}
                        />
                      </>
                    )}

                    {/* Warping / wobble (no sides/tracks) */}
                    <div className="mg-check">
                      <input
                        id={`warp-${idx}`}
                        type="checkbox"
                        checked={item.warping}
                        onChange={(e) => updateItem(idx, { warping: e.target.checked })}
                      />
                      <label htmlFor={`warp-${idx}`}>{labels.warping}</label>
                    </div>
                    {item.warping && (
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
                      />
                      <label htmlFor={`noNoise-${idx}`}>Plays with no surface noise</label>
                    </div>

                    <div className="mg-check">
                      <input
                        id={`noise-${idx}`}
                        type="checkbox"
                        checked={item.surfaceNoise}
                        onChange={(e) => updateItem(idx, { surfaceNoise: e.target.checked })}
                      />
                      <label htmlFor={`noise-${idx}`}>Surface noise when played</label>
                    </div>
                    {item.surfaceNoise && (
                      <>
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
                        <SubgroupSidesTracks
                          baseId={`noise-ext-${idx}`}
                          valueSidesA={item.noiseSidesA}
                          valueSidesB={item.noiseSidesB}
                          onSidesA={(v) => updateItem(idx, { noiseSidesA: v })}
                          onSidesB={(v) => updateItem(idx, { noiseSidesB: v })}
                          valueTracks={item.noiseTracks}
                          onTracks={(n) => updateItem(idx, { noiseTracks: n })}
                        />
                      </>
                    )}

                    <div className="mg-check">
                      <input
                        id={`pops-${idx}`}
                        type="checkbox"
                        checked={item.popsClicks}
                        onChange={(e) => updateItem(idx, { popsClicks: e.target.checked })}
                      />
                      <label htmlFor={`pops-${idx}`}>{labels.popsClicks}</label>
                    </div>
                    {item.popsClicks && (
                      <>
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
                        <SubgroupSidesTracks
                          baseId={`pops-ext-${idx}`}
                          valueSidesA={item.popsSidesA}
                          valueSidesB={item.popsSidesB}
                          onSidesA={(v) => updateItem(idx, { popsSidesA: v })}
                          onSidesB={(v) => updateItem(idx, { popsSidesB: v })}
                          valueTracks={item.popsTracks}
                          onTracks={(n) => updateItem(idx, { popsTracks: n })}
                        />
                      </>
                    )}

                    <div className="mg-check">
                      <input
                        id={`skip-${idx}`}
                        type="checkbox"
                        checked={item.skipping}
                        onChange={(e) => updateItem(idx, { skipping: e.target.checked })}
                      />
                      <label htmlFor={`skip-${idx}`}>{labels.skipping}</label>
                    </div>
                    {item.skipping && (
                      <>
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
                        <SubgroupSidesTracks
                          baseId={`skip-ext-${idx}`}
                          valueSidesA={item.skipSidesA}
                          valueSidesB={item.skipSidesB}
                          onSidesA={(v) => updateItem(idx, { skipSidesA: v })}
                          onSidesB={(v) => updateItem(idx, { skipSidesB: v })}
                          valueTracks={item.skipTracks}
                          onTracks={(n) => updateItem(idx, { skipTracks: n })}
                        />
                      </>
                    )}
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
                      />
                      <label htmlFor={`clean-${idx}`}>Label is clean and bright</label>
                    </div>
                    <div className="mg-check">
                      <input
                        id={`spindle-${idx}`}
                        type="checkbox"
                        checked={item.spindleMarks}
                        onChange={(e) => updateItem(idx, { spindleMarks: e.target.checked })}
                      />
                      <label htmlFor={`spindle-${idx}`}>Spindle marks present</label>
                    </div>
                    <div className="mg-check">
                      <input
                        id={`write-${idx}`}
                        type="checkbox"
                        checked={item.writingOnLabel}
                        onChange={(e) => updateItem(idx, { writingOnLabel: e.target.checked })}
                      />
                      <label htmlFor={`write-${idx}`}>Writing on label</label>
                    </div>
                    <div className="mg-check">
                      <input
                        id={`stick-${idx}`}
                        type="checkbox"
                        checked={item.stickersOnLabel}
                        onChange={(e) => updateItem(idx, { stickersOnLabel: e.target.checked })}
                      />
                      <label htmlFor={`stick-${idx}`}>Stickers or tape on label</label>
                    </div>
                  </fieldset>
                </div>

                {/* Per-item mini result */}
                <div className="mg-per-item-result">
                  <span className={`mg-chip ${GRADE_COLORS[g]}`}>
                    Disc/Tape #{idx + 1}: <strong>{g}</strong> ({r.score})
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

        {/* RIGHT: SLEEVE/PACKAGING */}
        <div className="mg-card">
          <h2>📦 Sleeve/Packaging Condition Assessment</h2>

          {/* Missing packaging toggle lives here (replaces the old top scope row) */}
          <div className="mg-check">
            <input
              id="pkg-missing"
              type="checkbox"
              checked={sleeve.missing}
              onChange={(e) => setSleeve((s) => ({ ...s, missing: e.target.checked }))}
            />
            <label htmlFor="pkg-missing"><strong>Mark packaging as Missing (auto P)</strong></label>
          </div>

          <fieldset className={`mg-fieldset ${sleeve.missing ? "mg-disabled" : ""}`}>
            <legend>Overall Appearance</legend>

            <div className="mg-check">
              <input
                id="likeNew"
                type="checkbox"
                checked={sleeve.likeNew}
                onChange={(e) => setSleeve((s) => ({ ...s, likeNew: e.target.checked }))}
                disabled={sleeve.missing}
              />
              <label htmlFor="likeNew">Looks like new, no flaws</label>
            </div>

            <div className="mg-check">
              <input
                id="minorShelfWear"
                type="checkbox"
                checked={sleeve.minorShelfWear}
                onChange={(e) => setSleeve((s) => ({ ...s, minorShelfWear: e.target.checked }))}
                disabled={sleeve.missing}
              />
              <label htmlFor="minorShelfWear">Minor shelf wear only</label>
            </div>

            <div className="mg-check">
              <input
                id="cornerWear"
                type="checkbox"
                checked={sleeve.cornerWear}
                onChange={(e) => setSleeve((s) => ({ ...s, cornerWear: e.target.checked }))}
                disabled={sleeve.missing}
              />
              <label htmlFor="cornerWear">Corner wear present</label>
            </div>
            {sleeve.cornerWear && !sleeve.missing && (
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
                      onChange={() => setSleeve((s) => ({ ...s, cornerWearLevel: val }))}
                    />
                    <span>{text}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Sealed moved here per request */}
            <div className="mg-check">
              <input
                id="sealed"
                type="checkbox"
                checked={sleeve.sealed}
                onChange={(e) => setSleeve((s) => ({ ...s, sealed: e.target.checked }))}
                disabled={sleeve.missing}
              />
              <label htmlFor="sealed">Sealed (factory shrink intact)</label>
            </div>
            <div className="mg-help">Sealed adds +5 (cap 100). M only if sealed & flawless.</div>

            <div className="mg-check">
              <input
                id="ringWear"
                type="checkbox"
                checked={sleeve.ringWear}
                onChange={(e) => setSleeve((s) => ({ ...s, ringWear: e.target.checked }))}
                disabled={sleeve.missing}
              />
              <label htmlFor="ringWear">{labels.ringWear}</label>
            </div>
            {sleeve.ringWear && !sleeve.missing && (
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
                      onChange={() => setSleeve((s) => ({ ...s, ringWearLevel: val }))}
                    />
                    <span>{text}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className={`mg-fieldset ${sleeve.missing ? "mg-disabled" : ""}`}>
            <legend>{labels.seamsStructureTitle}</legend>

            <div className="mg-check">
              <input
                id="seamsIntact"
                type="checkbox"
                checked={sleeve.seamsIntact}
                onChange={(e) => setSleeve((s) => ({ ...s, seamsIntact: e.target.checked }))}
                disabled={sleeve.missing}
              />
              <label htmlFor="seamsIntact">{labels.seamsIntact}</label>
            </div>

            <div className="mg-check">
              <input
                id="seamSplit"
                type="checkbox"
                checked={sleeve.seamSplit}
                onChange={(e) => setSleeve((s) => ({ ...s, seamSplit: e.target.checked }))}
                disabled={sleeve.missing}
              />
              <label htmlFor="seamSplit">{labels.seamSplitOrCrack}</label>
            </div>
            {sleeve.seamSplit && !sleeve.missing && (
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
                      onChange={() => setSleeve((s) => ({ ...s, seamSplitLevel: val }))}
                    />
                    <span>{text}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="mg-check">
              <input
                id="spineWear"
                type="checkbox"
                checked={sleeve.spineWear}
                onChange={(e) => setSleeve((s) => ({ ...s, spineWear: e.target.checked }))}
                disabled={sleeve.missing}
              />
              <label htmlFor="spineWear">{labels.spineWearOrTray}</label>
            </div>
            {sleeve.spineWear && !sleeve.missing && (
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
                      onChange={() => setSleeve((s) => ({ ...s, spineWearLevel: val }))}
                    />
                    <span>{text}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className={`mg-fieldset ${sleeve.missing ? "mg-disabled" : ""}`}>
            <legend>Damage & Markings</legend>

            <div className="mg-check">
              <input
                id="tears"
                type="checkbox"
                checked={sleeve.tears}
                onChange={(e) => setSleeve((s) => ({ ...s, tears: e.target.checked }))}
                disabled={sleeve.missing}
              />
              <label htmlFor="tears">Tears present</label>
            </div>
            <div className="mg-check">
              <input
                id="writing"
                type="checkbox"
                checked={sleeve.writing}
                onChange={(e) => setSleeve((s) => ({ ...s, writing: e.target.checked }))}
                disabled={sleeve.missing}
              />
              <label htmlFor="writing">Writing present</label>
            </div>
            <div className="mg-check">
              <input
                id="stickersTape"
                type="checkbox"
                checked={sleeve.stickersTape}
                onChange={(e) => setSleeve((s) => ({ ...s, stickersTape: e.target.checked }))}
                disabled={sleeve.missing}
              />
              <label htmlFor="stickersTape">Stickers or tape</label>
            </div>
          </fieldset>

          {/* Additional notes (disclosure-only) */}
          <fieldset className="mg-fieldset">
            <legend>Additional Notes (don’t affect grade)</legend>
            <div className="mg-notes-grid">
              {[
                ["jewelDamaged", "Jewel case damaged"],
                ["jewelMissing", "Jewel case missing"],
                ["origShrink", "Original shrinkwrap"],
                ["hypeSticker", "Hype sticker present"],
                ["cutout", "Cut-out hole/mark"],
                ["promo", "Promotional copy"],
                ["priceSticker", "Price sticker/tag"],
                ["firstPress", "First pressing"],
                ["coloredVinyl", "Colored vinyl"],
                ["limitedEdition", "Limited edition"],
                ["gatefoldSleeve", "Gatefold sleeve"],
                ["originalInner", "Original inner sleeve"],
              ].map(([key, label]) => (
                <label key={key} className="mg-check">
                  <input
                    type="checkbox"
                    checked={extra[key]}
                    onChange={(e) => setExtra((x) => ({ ...x, [key]: e.target.checked }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      {/* Freeform notes */}
      <section className="mg-notes mg-card">
        <label htmlFor="customNotes"><strong>Custom Condition Notes</strong></label>
        <textarea id="customNotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </section>

      {/* Results */}
      <section className="mg-results">
        <ResultsCard
          title="Record/Media Grade"
          grade={mediaGrade}
          score={mediaScore}
          colorClass={GRADE_COLORS[mediaGrade]}
        />
        <ResultsCard
          title="Sleeve/Packaging Grade"
          grade={sleeveGrade}
          score={sleeveCalc.score}
          colorClass={GRADE_COLORS[sleeveGrade]}
        />
        <ResultsCard
          title="Overall Grade"
          grade={overall.grade}
          score={overall.score}
          colorClass={overallColor}
        />
      </section>

      {/* Explanation */}
      <section className="mg-explanation mg-card">
        <div className="mg-expl-title">Grading Explanation</div>
        <p>{explanation}</p>
      </section>
    </main>
  );
}
