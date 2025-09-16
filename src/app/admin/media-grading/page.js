// src/app/admin/media-grading/page.js
"use client";

import { useMemo, useState } from "react";
import "styles/media-grading.css";

const MEDIA_TYPES = {
  vinyl: "🎵 Vinyl Records",
  cassette: "📼 Cassette Tapes",
  cd: "💿 Compact Discs",
};

const GRADE_COLORS = {
  M: "mg-grade-m",
  "M-": "mg-grade-nm", // treat M- as near-mint tier color
  NM: "mg-grade-nm",
  "VG+": "mg-grade-vg",
  VG: "mg-grade-vg",
  "G+": "mg-grade-g",
  G: "mg-grade-g",
  "F/P": "mg-grade-fp",
};

// Base penalty catalog (exact defaults). Labels that vary per media type are resolved via helpers below.
const PENALTIES = {
  media: {
    visual: {
      lightScuffs: { key: "lightScuffs", label: "Light scuffs visible", pts: 3 },
      scratches: { key: "scratches", label: "Scratches present", pts: 8 },
      grooveWearVariant: { key: "grooveWearVariant", label: "Groove wear visible", pts: 12 }, // label varies
      warpingVariant: { key: "warpingVariant", label: "Warping present", pts: 10 }, // label varies
    },
    audio: {
      noNoise: { key: "noNoise", label: "Plays with no surface noise", pts: 0 }, // informative (no deduction)
      surfaceNoise: { key: "surfaceNoise", label: "Surface noise when played", pts: 6 },
      popsClicksVariant: { key: "popsClicksVariant", label: "Occasional pops or clicks", pts: 4 }, // label varies
      skippingVariant: { key: "skippingVariant", label: "Skipping or repeating", pts: 30 }, // label varies
    },
    labelShellHub: {
      labelClean: { key: "labelClean", label: "Label is clean and bright", pts: 0 }, // informative
      spindleMarks: { key: "spindleMarks", label: "Spindle marks present", pts: 3 },
      writingOnLabel: { key: "writingOnLabel", label: "Writing on label", pts: 3 },
      stickersOnLabel: { key: "stickersOnLabel", label: "Stickers or tape on label", pts: 3 },
    },
    scope: {
      multiDisc: { key: "multiDisc", label: "Multi-Disc (2xLP+)", pts: 0 },
      sidesAffected: { key: "sidesAffected", label: "Which side(s) affected", pts: 0 },
      tracksAffected: { key: "tracksAffected", label: "Tracks affected", pts: 0 }, // per-track handled separately
    },
  },
  sleeve: {
    overall: {
      likeNew: { key: "likeNew", label: "Looks like new, no flaws", pts: 0 }, // informative
      minorShelfWear: { key: "minorShelfWear", label: "Minor shelf wear only", pts: 3 },
      cornerWear: { key: "cornerWear", label: "Corner wear present", pts: 4 },
      ringWearVariant: { key: "ringWearVariant", label: "Ring wear visible", pts: 5 }, // label varies
    },
    seamsStructureVariant: {
      seamsIntactVariant: { key: "seamsIntactVariant", label: "All seams intact", pts: 0 }, // or "Case uncracked"
      seamSplitOrCrackVariant: { key: "seamSplitOrCrackVariant", label: "Seam splits present", pts: 12 }, // or "Case cracked"
      spineWearOrTrayVariant: { key: "spineWearOrTrayVariant", label: "Spine shows wear", pts: 3 }, // or "Tray teeth broken/missing"
    },
    damage: {
      tears: { key: "tears", label: "Tears present", pts: 8 },
      writing: { key: "writing", label: "Writing present", pts: 4 },
      stickersTape: { key: "stickersTape", label: "Stickers or tape", pts: 3 },
      sealed: { key: "sealed", label: "Sealed (factory shrink intact)", pts: -5 }, // +5 bonus (cap at 100)
    },
  },
};

// Resolve media-type-specific labels
function resolveMediaLabels(mediaType) {
  return {
    grooveWear:
      mediaType === "vinyl"
        ? "Groove wear visible"
        : mediaType === "cd"
        ? "Laser-rot/pinholes visible"
        : "Shell scuffs present",
    warping:
      mediaType === "cd" ? "Disc wobble present" : "Warping present",
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
    seamsIntact:
      mediaType === "cd" ? "Case uncracked" : "All seams intact",
    seamSplitOrCrack:
      mediaType === "cd" ? "Case cracked" : "Seam splits present",
    spineWearOrTray:
      mediaType === "cd"
        ? "Tray teeth broken/missing"
        : "Spine shows wear",
  };
}

// Map numeric score to grade. If allowMint=true (sealed intact & perfect), return "M" at 100.
function gradeFromScore(score, { allowMint = false } = {}) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (allowMint && s === 100) return "M";
  if (s >= 97) return "NM";
  if (s >= 92) return "M-";
  if (s >= 85) return "VG+";
  if (s >= 75) return "VG";
  if (s >= 65) return "G+";
  if (s >= 50) return "G";
  return "F/P";
}

function ResultsCard({ title, grade, score, colorClass }) {
  return (
    <div className={`mg-card mg-result ${colorClass}`}>
      <div className="mg-result-title">{title}</div>
      <div className="mg-result-grade">{grade}</div>
      <div className="mg-result-score" aria-label={`${title} score`}>
        {score}/100
      </div>
    </div>
  );
}

export default function MediaGradingPage() {
  const [mediaType, setMediaType] = useState("vinyl"); // vinyl | cassette | cd

  // Scope switches
  const [onlyPackaging, setOnlyPackaging] = useState(false);
  const [onlyMedia, setOnlyMedia] = useState(false);

  // Media condition state
  const [mediaState, setMediaState] = useState({
    // visual
    lightScuffs: false,
    scratches: false,
    grooveWearVariant: false,
    warpingVariant: false,
    // audio
    noNoise: false, // informational; no deduction
    surfaceNoise: false,
    popsClicksVariant: false,
    skippingVariant: false,
    // label/shell/hub
    labelClean: false, // informational
    spindleMarks: false,
    writingOnLabel: false,
    stickersOnLabel: false,
    // scope
    multiDisc: false,
    sidesA: false,
    sidesB: false,
    sidesC: false,
    sidesD: false,
    tracksAffected: 0,
  });

  // Sleeve/packaging state
  const [sleeveState, setSleeveState] = useState({
    // overall appearance
    likeNew: false,
    minorShelfWear: false,
    cornerWear: false,
    ringWearVariant: false,
    // seams/case/tray
    seamsIntactVariant: false, // informational
    seamSplitOrCrackVariant: false,
    spineWearOrTrayVariant: false,
    // damage & markings
    tears: false,
    writing: false,
    stickersTape: false,
    sealed: false,
  });

  // Notes
  const [notes, setNotes] = useState("");

  const labels = useMemo(() => resolveMediaLabels(mediaType), [mediaType]);

  // Handlers
  const toggleMedia = (key) =>
    setMediaState((s) => ({ ...s, [key]: !s[key] }));
  const setMediaNumber = (key, val) =>
    setMediaState((s) => ({ ...s, [key]: val }));
  const toggleSleeve = (key) =>
    setSleeveState((s) => ({ ...s, [key]: !s[key] }));

  // Compute penalties and scores
  const {
    mediaScore,
    mediaDeductions,
    mediaHasAnyAudioDefect,
  } = useMemo(() => {
    let score = 100;
    const deducs = [];

    // Visual
    if (mediaState.lightScuffs) {
      score -= PENALTIES.media.visual.lightScuffs.pts;
      deducs.push({
        label: PENALTIES.media.visual.lightScuffs.label,
        pts: PENALTIES.media.visual.lightScuffs.pts,
      });
    }
    if (mediaState.scratches) {
      score -= PENALTIES.media.visual.scratches.pts;
      deducs.push({
        label: PENALTIES.media.visual.scratches.label,
        pts: PENALTIES.media.visual.scratches.pts,
      });
    }
    if (mediaState.grooveWearVariant) {
      score -= PENALTIES.media.visual.grooveWearVariant.pts;
      deducs.push({
        label: labels.grooveWear,
        pts: PENALTIES.media.visual.grooveWearVariant.pts,
      });
    }
    if (mediaState.warpingVariant) {
      score -= PENALTIES.media.visual.warpingVariant.pts;
      deducs.push({
        label: labels.warping,
        pts: PENALTIES.media.visual.warpingVariant.pts,
      });
    }

    // Audio
    const anyAudio =
      mediaState.surfaceNoise ||
      mediaState.popsClicksVariant ||
      mediaState.skippingVariant;

    if (mediaState.surfaceNoise) {
      score -= PENALTIES.media.audio.surfaceNoise.pts;
      deducs.push({
        label: PENALTIES.media.audio.surfaceNoise.label,
        pts: PENALTIES.media.audio.surfaceNoise.pts,
      });
    }
    if (mediaState.popsClicksVariant) {
      score -= PENALTIES.media.audio.popsClicksVariant.pts;
      deducs.push({
        label: labels.popsClicks,
        pts: PENALTIES.media.audio.popsClicksVariant.pts,
      });
    }
    if (mediaState.skippingVariant) {
      score -= PENALTIES.media.audio.skippingVariant.pts;
      deducs.push({
        label: labels.skipping,
        pts: PENALTIES.media.audio.skippingVariant.pts,
      });
    }

    // Label / hub / shell
    if (mediaState.spindleMarks) {
      score -= PENALTIES.media.labelShellHub.spindleMarks.pts;
      deducs.push({
        label: PENALTIES.media.labelShellHub.spindleMarks.label,
        pts: PENALTIES.media.labelShellHub.spindleMarks.pts,
      });
    }
    if (mediaState.writingOnLabel) {
      score -= PENALTIES.media.labelShellHub.writingOnLabel.pts;
      deducs.push({
        label: PENALTIES.media.labelShellHub.writingOnLabel.label,
        pts: PENALTIES.media.labelShellHub.writingOnLabel.pts,
      });
    }
    if (mediaState.stickersOnLabel) {
      score -= PENALTIES.media.labelShellHub.stickersOnLabel.pts;
      deducs.push({
        label: PENALTIES.media.labelShellHub.stickersOnLabel.label,
        pts: PENALTIES.media.labelShellHub.stickersOnLabel.pts,
      });
    }

    // Per-track penalty (only when any audio defect is selected)
    let trackPenalty = 0;
    const tA = parseInt(mediaState.tracksAffected || 0, 10);
    if (anyAudio && !isNaN(tA) && tA > 0) {
      trackPenalty = tA * 1;
      score -= trackPenalty;
      deducs.push({
        label: `Tracks affected (${tA})`,
        pts: trackPenalty,
      });
    }

    // Clamp
    score = Math.max(0, Math.min(100, score));
    return {
      mediaScore: score,
      mediaDeductions: deducs,
      mediaHasAnyAudioDefect: anyAudio,
    };
  }, [mediaState, labels]);

  const {
    sleeveScore,
    sleeveDeductions,
    packagingSealedEligibleForMint,
  } = useMemo(() => {
    let score = 100;
    const deducs = [];
    let allowMint = false;

    // Overall appearance
    if (sleeveState.minorShelfWear) {
      score -= PENALTIES.sleeve.overall.minorShelfWear.pts;
      deducs.push({
        label: PENALTIES.sleeve.overall.minorShelfWear.label,
        pts: PENALTIES.sleeve.overall.minorShelfWear.pts,
      });
    }
    if (sleeveState.cornerWear) {
      score -= PENALTIES.sleeve.overall.cornerWear.pts;
      deducs.push({
        label: PENALTIES.sleeve.overall.cornerWear.label,
        pts: PENALTIES.sleeve.overall.cornerWear.pts,
      });
    }
    if (sleeveState.ringWearVariant) {
      score -= PENALTIES.sleeve.overall.ringWearVariant.pts;
      deducs.push({
        label: labels.ringWear,
        pts: PENALTIES.sleeve.overall.ringWearVariant.pts,
      });
    }

    // Seams / case / tray
    if (sleeveState.seamSplitOrCrackVariant) {
      score -= PENALTIES.sleeve.seamsStructureVariant.seamSplitOrCrackVariant.pts;
      deducs.push({
        label: labels.seamSplitOrCrack,
        pts: PENALTIES.sleeve.seamsStructureVariant.seamSplitOrCrackVariant.pts,
      });
    }
    if (sleeveState.spineWearOrTrayVariant) {
      score -= PENALTIES.sleeve.seamsStructureVariant.spineWearOrTrayVariant.pts;
      deducs.push({
        label: labels.spineWearOrTray,
        pts: PENALTIES.sleeve.seamsStructureVariant.spineWearOrTrayVariant.pts,
      });
    }

    // Damage & markings
    if (sleeveState.tears) {
      score -= PENALTIES.sleeve.damage.tears.pts;
      deducs.push({
        label: PENALTIES.sleeve.damage.tears.label,
        pts: PENALTIES.sleeve.damage.tears.pts,
      });
    }
    if (sleeveState.writing) {
      score -= PENALTIES.sleeve.damage.writing.pts;
      deducs.push({
        label: PENALTIES.sleeve.damage.writing.label,
        pts: PENALTIES.sleeve.damage.writing.pts,
      });
    }
    if (sleeveState.stickersTape) {
      score -= PENALTIES.sleeve.damage.stickersTape.pts;
      deducs.push({
        label: PENALTIES.sleeve.damage.stickersTape.label,
        pts: PENALTIES.sleeve.damage.stickersTape.pts,
      });
    }

    // Sealed bonus (+5, capped at 100)
    if (sleeveState.sealed) {
      score += 5;
      allowMint = true;
    }

    score = Math.max(0, Math.min(100, score));
    return {
      sleeveScore: score,
      sleeveDeductions: deducs,
      packagingSealedEligibleForMint: allowMint && score === 100,
    };
  }, [sleeveState, labels]);

  // Grades
  const mediaGrade = useMemo(() => {
    // Media cannot be Mint by itself—Mint gate is via sealed packaging rule
    return gradeFromScore(mediaScore, { allowMint: false });
  }, [mediaScore]);

  const sleeveGrade = useMemo(() => {
    // Mint only reachable if sealed and perfect
    const allowMint = sleeveState.sealed && sleeveScore === 100;
    return gradeFromScore(sleeveScore, { allowMint });
  }, [sleeveState.sealed, sleeveScore]);

  // Overall grade logic (lower/worse of enabled sides)
  const overall = useMemo(() => {
    const mediaEnabled = !onlyPackaging;
    const sleeveEnabled = !onlyMedia;

    let grade = "NM";
    let score = 100;
    let reason = "";

    if (mediaEnabled && sleeveEnabled) {
      // If both enabled, conservative = worse (min) by grade order
      const order = ["M", "M-", "NM", "VG+", "VG", "G+", "G", "F/P"];
      const mediaIdx = order.indexOf(mediaGrade);
      const sleeveIdx = order.indexOf(sleeveGrade);
      if (mediaIdx > sleeveIdx) {
        grade = mediaGrade;
        score = mediaScore;
        reason = `Overall = ${grade} due to media condition being the limiting factor.`;
      } else if (sleeveIdx > mediaIdx) {
        grade = sleeveGrade;
        score = sleeveScore;
        reason = `Overall = ${grade} due to sleeve/packaging condition being the limiting factor.`;
      } else {
        // Same grade; tie-breaker on lower score
        if (mediaScore <= sleeveScore) {
          grade = mediaGrade;
          score = mediaScore;
          reason = `Overall = ${grade} (media and sleeve match; media score is the tie-breaker).`;
        } else {
          grade = sleeveGrade;
          score = sleeveScore;
          reason = `Overall = ${grade} (media and sleeve match; sleeve score is the tie-breaker).`;
        }
      }

      // If both perfect and sealed, allow overall M
      if (
        sleeveState.sealed &&
        sleeveScore === 100 &&
        mediaScore === 100
      ) {
        grade = "M";
        score = 100;
        reason = "Overall = M (factory sealed; no detectable packaging defects).";
      }
    } else if (mediaEnabled) {
      grade = mediaGrade;
      score = mediaScore;
      reason = `Overall = ${grade} (media-only evaluation selected).`;
    } else if (sleeveEnabled) {
      grade = sleeveGrade;
      score = sleeveScore;
      reason = `Overall = ${grade} (packaging-only evaluation selected).`;
    } else {
      grade = "NM";
      score = 100;
      reason = "No scope selected; defaulting to NM.";
    }

    return { grade, score, reason };
  }, [
    onlyPackaging,
    onlyMedia,
    mediaGrade,
    mediaScore,
    sleeveGrade,
    sleeveScore,
    sleeveState.sealed,
  ]);

  // Build top-3 explanations per side
  function topThree(list) {
    const sorted = [...list].sort((a, b) => b.pts - a.pts);
    return sorted.slice(0, 3);
  }

  const explanation = useMemo(() => {
    const mediaTop = topThree(mediaDeductions);
    const sleeveTop = topThree(sleeveDeductions);
    const parts = [];

    if (!onlyPackaging) {
      parts.push(
        `Media: ${
          mediaTop.length
            ? mediaTop.map((d) => `${d.label} (−${d.pts})`).join("; ")
            : "No notable defects recorded"
        }.`
      );
    }

    if (!onlyMedia) {
      // Mention sealed if it’s the reason for Mint eligibility
      const sealedNote =
        sleeveState.sealed && packagingSealedEligibleForMint
          ? " Sealed, factory shrink intact (+5; eligible for M if otherwise flawless)."
          : "";
      parts.push(
        `Packaging: ${
          sleeveTop.length
            ? sleeveTop.map((d) => `${d.label} (−${d.pts})`).join("; ")
            : "No notable defects recorded"
        }.${sealedNote}`
      );
    }

    parts.push(overall.reason);

    if (notes.trim()) {
      parts.push(`Notes: ${notes.trim()}`);
    }

    return parts.join(" ");
  }, [
    mediaDeductions,
    sleeveDeductions,
    onlyPackaging,
    onlyMedia,
    overall.reason,
    notes,
    sleeveState.sealed,
    packagingSealedEligibleForMint,
  ]);

  const overallColor = GRADE_COLORS[overall.grade] || "mg-grade-vg";

  return (
    <main id="media-grading" className="mg-wrap">
      <header className="mg-header">
        <a className="mg-back" href="/admin" aria-label="Back to Dashboard">
          ← Back to Dashboard
        </a>
        <div className="mg-sub">
          🔍 <strong>Systematic Media Grading Tool</strong> — Detailed condition
          assessment with automatic grading calculation
        </div>
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

      {/* Scope checkboxes */}
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
          <label htmlFor="onlyPackaging">
            Only evaluating packaging — no disc/tape/record present
          </label>
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
          <label htmlFor="onlyMedia">
            Only evaluating media — no packaging present
          </label>
        </div>
      </section>

      {/* Two-column grid */}
      <section className="mg-grid">
        {/* Left: Media Assessment */}
        <div
          className={`mg-card ${onlyPackaging ? "mg-disabled" : ""}`}
          aria-disabled={onlyPackaging}
        >
          <h2>🎶 Record/Media Condition Assessment</h2>

          {/* Visual Appearance */}
          <fieldset className="mg-fieldset">
            <legend>Visual Appearance</legend>

            <div className="mg-check">
              <input
                id="lightScuffs"
                type="checkbox"
                checked={mediaState.lightScuffs}
                onChange={() => toggleMedia("lightScuffs")}
                disabled={onlyPackaging}
              />
              <label htmlFor="lightScuffs">
                {PENALTIES.media.visual.lightScuffs.label}
              </label>
            </div>

            <div className="mg-check">
              <input
                id="scratches"
                type="checkbox"
                checked={mediaState.scratches}
                onChange={() => toggleMedia("scratches")}
                disabled={onlyPackaging}
              />
              <label htmlFor="scratches">
                {PENALTIES.media.visual.scratches.label}
              </label>
            </div>

            <div className="mg-check">
              <input
                id="grooveWearVariant"
                type="checkbox"
                checked={mediaState.grooveWearVariant}
                onChange={() => toggleMedia("grooveWearVariant")}
                disabled={onlyPackaging}
              />
              <label htmlFor="grooveWearVariant">{labels.grooveWear}</label>
            </div>

            <div className="mg-check">
              <input
                id="warpingVariant"
                type="checkbox"
                checked={mediaState.warpingVariant}
                onChange={() => toggleMedia("warpingVariant")}
                disabled={onlyPackaging}
              />
              <label htmlFor="warpingVariant">{labels.warping}</label>
            </div>
          </fieldset>

          {/* Audio Performance */}
          <fieldset className="mg-fieldset">
            <legend>Audio Performance</legend>

            <div className="mg-check">
              <input
                id="noNoise"
                type="checkbox"
                checked={mediaState.noNoise}
                onChange={() => toggleMedia("noNoise")}
                disabled={onlyPackaging}
              />
              <label htmlFor="noNoise">
                {PENALTIES.media.audio.noNoise.label}
              </label>
            </div>

            <div className="mg-check">
              <input
                id="surfaceNoise"
                type="checkbox"
                checked={mediaState.surfaceNoise}
                onChange={() => toggleMedia("surfaceNoise")}
                disabled={onlyPackaging}
              />
              <label htmlFor="surfaceNoise">
                {PENALTIES.media.audio.surfaceNoise.label}
              </label>
            </div>

            <div className="mg-check">
              <input
                id="popsClicksVariant"
                type="checkbox"
                checked={mediaState.popsClicksVariant}
                onChange={() => toggleMedia("popsClicksVariant")}
                disabled={onlyPackaging}
              />
              <label htmlFor="popsClicksVariant">{labels.popsClicks}</label>
            </div>

            <div className="mg-check">
              <input
                id="skippingVariant"
                type="checkbox"
                checked={mediaState.skippingVariant}
                onChange={() => toggleMedia("skippingVariant")}
                disabled={onlyPackaging}
              />
              <label htmlFor="skippingVariant">{labels.skipping}</label>
            </div>

            {/* Defect scope (vinyl & cassette only) */}
            {(mediaType === "vinyl" || mediaType === "cassette") && (
              <>
                <div className="mg-inline">
                  <input
                    id="multiDisc"
                    type="checkbox"
                    checked={mediaState.multiDisc}
                    onChange={() => toggleMedia("multiDisc")}
                    disabled={onlyPackaging}
                  />
                  <label htmlFor="multiDisc">
                    {PENALTIES.media.scope.multiDisc.label}
                  </label>
                </div>

                <div className="mg-sides">
                  <div className="mg-sides-title">
                    {PENALTIES.media.scope.sidesAffected.label}
                  </div>
                  <div className="mg-sides-grid">
                    <div className="mg-check">
                      <input
                        id="sideA"
                        type="checkbox"
                        checked={mediaState.sidesA}
                        onChange={() => toggleMedia("sidesA")}
                        disabled={onlyPackaging}
                      />
                      <label htmlFor="sideA">Side A</label>
                    </div>
                    <div className="mg-check">
                      <input
                        id="sideB"
                        type="checkbox"
                        checked={mediaState.sidesB}
                        onChange={() => toggleMedia("sidesB")}
                        disabled={onlyPackaging}
                      />
                      <label htmlFor="sideB">Side B</label>
                    </div>
                    {mediaState.multiDisc && (
                      <>
                        <div className="mg-check">
                          <input
                            id="sideC"
                            type="checkbox"
                            checked={mediaState.sidesC}
                            onChange={() => toggleMedia("sidesC")}
                            disabled={onlyPackaging}
                          />
                          <label htmlFor="sideC">Side C</label>
                        </div>
                        <div className="mg-check">
                          <input
                            id="sideD"
                            type="checkbox"
                            checked={mediaState.sidesD}
                            onChange={() => toggleMedia("sidesD")}
                            disabled={onlyPackaging}
                          />
                          <label htmlFor="sideD">Side D</label>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="mg-number">
                  <label htmlFor="tracksAffected">
                    {PENALTIES.media.scope.tracksAffected.label}
                  </label>
                  <input
                    id="tracksAffected"
                    type="number"
                    min={0}
                    step={1}
                    value={mediaState.tracksAffected}
                    onChange={(e) =>
                      setMediaNumber(
                        "tracksAffected",
                        Math.max(0, parseInt(e.target.value || 0, 10))
                      )
                    }
                    disabled={onlyPackaging || !mediaHasAnyAudioDefect}
                  />
                  <div className="mg-help">
                    Applies 1-point deduction per track only when any audio defect is selected.
                  </div>
                </div>
              </>
            )}
          </fieldset>

          {/* Label/Center / Hub/Face / Shell/Label */}
          <fieldset className="mg-fieldset">
            <legend>{labels.labelSectionTitle}</legend>

            <div className="mg-check">
              <input
                id="labelClean"
                type="checkbox"
                checked={mediaState.labelClean}
                onChange={() => toggleMedia("labelClean")}
                disabled={onlyPackaging}
              />
              <label htmlFor="labelClean">
                {PENALTIES.media.labelShellHub.labelClean.label}
              </label>
            </div>

            <div className="mg-check">
              <input
                id="spindleMarks"
                type="checkbox"
                checked={mediaState.spindleMarks}
                onChange={() => toggleMedia("spindleMarks")}
                disabled={onlyPackaging}
              />
              <label htmlFor="spindleMarks">
                {PENALTIES.media.labelShellHub.spindleMarks.label}
              </label>
            </div>

            <div className="mg-check">
              <input
                id="writingOnLabel"
                type="checkbox"
                checked={mediaState.writingOnLabel}
                onChange={() => toggleMedia("writingOnLabel")}
                disabled={onlyPackaging}
              />
              <label htmlFor="writingOnLabel">
                {PENALTIES.media.labelShellHub.writingOnLabel.label}
              </label>
            </div>

            <div className="mg-check">
              <input
                id="stickersOnLabel"
                type="checkbox"
                checked={mediaState.stickersOnLabel}
                onChange={() => toggleMedia("stickersOnLabel")}
                disabled={onlyPackaging}
              />
              <label htmlFor="stickersOnLabel">
                {PENALTIES.media.labelShellHub.stickersOnLabel.label}
              </label>
            </div>
          </fieldset>
        </div>

        {/* Right: Sleeve/Packaging Assessment */}
        <div
          className={`mg-card ${onlyMedia ? "mg-disabled" : ""}`}
          aria-disabled={onlyMedia}
        >
          <h2>📦 Sleeve/Packaging Condition Assessment</h2>

          {/* Overall Appearance */}
          <fieldset className="mg-fieldset">
            <legend>Overall Appearance</legend>

            <div className="mg-check">
              <input
                id="likeNew"
                type="checkbox"
                checked={sleeveState.likeNew}
                onChange={() => toggleSleeve("likeNew")}
                disabled={onlyMedia}
              />
              <label htmlFor="likeNew">
                {PENALTIES.sleeve.overall.likeNew.label}
              </label>
            </div>

            <div className="mg-check">
              <input
                id="minorShelfWear"
                type="checkbox"
                checked={sleeveState.minorShelfWear}
                onChange={() => toggleSleeve("minorShelfWear")}
                disabled={onlyMedia}
              />
              <label htmlFor="minorShelfWear">
                {PENALTIES.sleeve.overall.minorShelfWear.label}
              </label>
            </div>

            <div className="mg-check">
              <input
                id="cornerWear"
                type="checkbox"
                checked={sleeveState.cornerWear}
                onChange={() => toggleSleeve("cornerWear")}
                disabled={onlyMedia}
              />
              <label htmlFor="cornerWear">
                {PENALTIES.sleeve.overall.cornerWear.label}
              </label>
            </div>

            <div className="mg-check">
              <input
                id="ringWearVariant"
                type="checkbox"
                checked={sleeveState.ringWearVariant}
                onChange={() => toggleSleeve("ringWearVariant")}
                disabled={onlyMedia}
              />
              <label htmlFor="ringWearVariant">{labels.ringWear}</label>
            </div>
          </fieldset>

          {/* Seams & Structure / Case & Tray */}
          <fieldset className="mg-fieldset">
            <legend>{labels.seamsStructureTitle}</legend>

            <div className="mg-check">
              <input
                id="seamsIntactVariant"
                type="checkbox"
                checked={sleeveState.seamsIntactVariant}
                onChange={() => toggleSleeve("seamsIntactVariant")}
                disabled={onlyMedia}
              />
              <label htmlFor="seamsIntactVariant">{labels.seamsIntact}</label>
            </div>

            <div className="mg-check">
              <input
                id="seamSplitOrCrackVariant"
                type="checkbox"
                checked={sleeveState.seamSplitOrCrackVariant}
                onChange={() => toggleSleeve("seamSplitOrCrackVariant")}
                disabled={onlyMedia}
              />
              <label htmlFor="seamSplitOrCrackVariant">
                {labels.seamSplitOrCrack}
              </label>
            </div>

            <div className="mg-check">
              <input
                id="spineWearOrTrayVariant"
                type="checkbox"
                checked={sleeveState.spineWearOrTrayVariant}
                onChange={() => toggleSleeve("spineWearOrTrayVariant")}
                disabled={onlyMedia}
              />
              <label htmlFor="spineWearOrTrayVariant">
                {labels.spineWearOrTray}
              </label>
            </div>
          </fieldset>

          {/* Damage & Markings */}
          <fieldset className="mg-fieldset">
            <legend>Damage & Markings</legend>

            <div className="mg-check">
              <input
                id="tears"
                type="checkbox"
                checked={sleeveState.tears}
                onChange={() => toggleSleeve("tears")}
                disabled={onlyMedia}
              />
              <label htmlFor="tears">
                {PENALTIES.sleeve.damage.tears.label}
              </label>
            </div>

            <div className="mg-check">
              <input
                id="writing"
                type="checkbox"
                checked={sleeveState.writing}
                onChange={() => toggleSleeve("writing")}
                disabled={onlyMedia}
              />
              <label htmlFor="writing">
                {PENALTIES.sleeve.damage.writing.label}
              </label>
            </div>

            <div className="mg-check">
              <input
                id="stickersTape"
                type="checkbox"
                checked={sleeveState.stickersTape}
                onChange={() => toggleSleeve("stickersTape")}
                disabled={onlyMedia}
              />
              <label htmlFor="stickersTape">
                {PENALTIES.sleeve.damage.stickersTape.label}
              </label>
            </div>

            <div className="mg-check">
              <input
                id="sealed"
                type="checkbox"
                checked={sleeveState.sealed}
                onChange={() => toggleSleeve("sealed")}
                disabled={onlyMedia}
              />
              <label htmlFor="sealed">
                {PENALTIES.sleeve.damage.sealed.label}
              </label>
            </div>
            <div className="mg-help">
              Sealed adds a +5 bonus (cap 100). Mint (M) is only reachable if sealed and otherwise flawless.
            </div>
          </fieldset>
        </div>
      </section>

      {/* Notes */}
      <section className="mg-notes mg-card">
        <label htmlFor="customNotes">
          <strong>Custom Condition Notes</strong>
        </label>
        <textarea
          id="customNotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Add any specific observations, matrix details, pressing notes, etc."
        />
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
            score={sleeveScore}
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

      {/* Explanation */}
      <section className="mg-explanation mg-card">
        <div className="mg-expl-title">Grading Explanation</div>
        <p>{explanation}</p>
      </section>
    </main>
  );
}
