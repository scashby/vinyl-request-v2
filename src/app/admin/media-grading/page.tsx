"use client";

import React, { useMemo, useState } from "react";
import "src/styles/media-grading.css";
type MediaType = "vinyl" | "cassette" | "cd";

type MediaItem = {
  id: number;
  skipSides?: string[];
  tracksAffected?: number;
};

type Conditions = Record<string, boolean>;
type Severities = Record<string, string>;
type ActiveSeverities = Record<string, boolean>;

export default function MediaGradingPage() {
  const [mediaType, setMediaType] = useState<MediaType>("vinyl");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([{ id: 1 }]);
  const [conditions, setConditions] = useState<Conditions>({});
  const [severities, setSeverities] = useState<Severities>({});
  const [activeSeverities, setActiveSeverities] = useState<ActiveSeverities>({});
  const [customNotes, setCustomNotes] = useState<string>("");
  const [showResults, setShowResults] = useState(false);
  const [recordGrade, setRecordGrade] = useState<string>("—");
  const [sleeveGrade, setSleeveGrade] = useState<string>("—");
  const [overallGrade, setOverallGrade] = useState<string>("—");

  // convenience aliases for your existing "missing" flags if present later
  const mediaMissing = !!conditions["media-missing"];
  const packageMissing = !!conditions["package-missing"];
  const sealed = !!conditions["sleeve-sealed"];

  const setCondition = (key: string, value: boolean) => {
    setConditions(prev => ({ ...prev, [key]: value }));
    const sevKey = `${key}-severity`; // fix: UI expects this shape
    setActiveSeverities(prev => ({ ...prev, [sevKey]: value }));
  };

  const setSeverity = (key: string, value: string) => {
    setSeverities(prev => ({ ...prev, [key]: value }));
  };

  const addItem = () => {
    setMediaItems(prev => [...prev, { id: (prev.at(-1)?.id ?? 0) + 1 }]);
  };

  const updateSkipSides = (itemId: number, side: string, checked: boolean) => {
    setMediaItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      const curr = it.skipSides || [];
      const next = checked ? Array.from(new Set([...curr, side])) : curr.filter(s => s !== side);
      return { ...it, skipSides: next };
    }));
  };

  const updateTracksAffected = (itemId: number, count: number) => {
    setMediaItems(prev => prev.map(it => it.id === itemId ? { ...it, tracksAffected: count } : it));
  };

  // ---------------- Grading (Goldmine-inspired) ----------------
  // Philosophy per user: M only if sealed. Without sealed, highest is NM and should be rare.
  // Deductions are intentionally strong so most items land VG / G+.
  type Weight = { base: number; sev?: Record<string, number> };
  const WEIGHTS: Record<string, Weight> = useMemo(() => ({
    // Vinyl media
    "vinyl-scuffs":     { base: 6,  sev: { light: 5, moderate: 9, heavy: 14 } },
    "vinyl-scratches":  { base: 12, sev: { hairline: 8, feelable: 16, deep: 26 } },
    "vinyl-groove":     { base: 10, sev: { slight: 8, evident: 14, heavy: 22 } },
    "vinyl-warp":       { base: 20, sev: { slight: 12, moderate: 22, severe: 36 } },
    "vinyl-noise":      { base: 8,  sev: { minimal: 6, noticeable: 12, significant: 18 } },
    "vinyl-pops":       { base: 6 },
    "vinyl-skips":      { base: 24, sev: { occasional: 20, frequent: 34, constant: 48 } },

    // Sleeve (outer)
    "sleeve-corner":    { base: 6,  sev: { slight: 4, creased: 9, cut: 14 } },
    "sleeve-ring":      { base: 8,  sev: { light: 6, evident: 12, heavy: 18 } },
    "sleeve-seam":      { base: 10, sev: { small: 8, medium: 14, large: 22 } },
    "sleeve-tears":     { base: 12, sev: { small: 8, significant: 16, major: 26 } },
    "sleeve-spine":     { base: 6 },
    "sleeve-writing":   { base: 8,  sev: { small: 6, noticeable: 10, heavy: 16 } },
    "sleeve-stickers":  { base: 6,  sev: { residue: 4, partial: 8, heavy: 12 } },
  }), []);

  // Grade thresholds: sealed can reach Mint; otherwise NM is the ceiling.
  function scoreToGrade(s: number, canMint: boolean): string {
    if (canMint && s === 0) return "M";
    if (s <= 5)   return "NM";
    if (s <= 15)  return "VG+";
    if (s <= 28)  return "VG";
    if (s <= 40)  return "G+";
    if (s <= 55)  return "G";
    return "P";
  }

  function computeScores() {
    // Gather booleans by expected keys
    let mediaScore = 0;
    for (const it of mediaItems) {
      const id = it.id;
      const has = (k:string) => !!conditions[`${k}-record-${id}`];
      const sev = (k:string) => (severities[`${k}-severity`] || "");

      // If sealed: media deductions are ignored EXCEPT warping
      if (!sealed) {
        if (has("vinyl-scuffs"))        mediaScore += (WEIGHTS["vinyl-scuffs"].sev?.[sev("vinyl-scuffs")] ?? WEIGHTS["vinyl-scuffs"].base);
        if (has("vinyl-scratches"))     mediaScore += (WEIGHTS["vinyl-scratches"].sev?.[sev("vinyl-scratches")] ?? WEIGHTS["vinyl-scratches"].base);
        if (has("vinyl-groove-wear"))   mediaScore += (WEIGHTS["vinyl-groove"].sev?.[sev("vinyl-groove-wear")] ?? WEIGHTS["vinyl-groove"].base);
        if (has("vinyl-surface-noise")) mediaScore += (WEIGHTS["vinyl-noise"].sev?.[sev("vinyl-surface-noise")] ?? WEIGHTS["vinyl-noise"].base);
        if (has("vinyl-pops-clicks"))   mediaScore += WEIGHTS["vinyl-pops"].base;
      } else {
        // sealed: intentionally ignore most media issues (they shouldn't exist); warn via score only for warp
      }

      // warping counts even if sealed
      if (has("vinyl-warping")) mediaScore += (WEIGHTS["vinyl-warp"].sev?.[sev("vinyl-warping")] ?? WEIGHTS["vinyl-warp"].base);

      // skips (shouldn't happen sealed, but if marked, we count it hard)
      if (has("vinyl-skips")) {
        const base = (WEIGHTS["vinyl-skips"].sev?.[sev("vinyl-skips")] ?? WEIGHTS["vinyl-skips"].base);
        const sides = (it.skipSides || []).length;
        const tracks = it.tracksAffected || 0;
        mediaScore += base + Math.max(0, sides-1)*3 + Math.min(tracks, 12)
  
      }
    }

    // Sleeve score
    let sleeveScore = 0;
    const sHas = (k:string) => !!conditions[k];
    const sSev = (k:string) => (severities[`${k}-severity`] || "");

    // If sealed: allow only storage wear (corner/ring); ignore splits/tears/writing/stickers
    if (sealed) {
      if (sHas("sleeve-corner-wear")) sleeveScore += (WEIGHTS["sleeve-corner"].sev?.[sSev("sleeve-corner-wear")] ?? WEIGHTS["sleeve-corner"].base);
      if (sHas("sleeve-ring-wear"))   sleeveScore += (WEIGHTS["sleeve-ring"].sev?.[sSev("sleeve-ring-wear")] ?? WEIGHTS["sleeve-ring"].base);
    } else {
      if (sHas("sleeve-corner-wear")) sleeveScore += (WEIGHTS["sleeve-corner"].sev?.[sSev("sleeve-corner-wear")] ?? WEIGHTS["sleeve-corner"].base);
      if (sHas("sleeve-ring-wear"))   sleeveScore += (WEIGHTS["sleeve-ring"].sev?.[sSev("sleeve-ring-wear")] ?? WEIGHTS["sleeve-ring"].base);
      if (sHas("sleeve-seam-splits")) sleeveScore += (WEIGHTS["sleeve-seam"].sev?.[sSev("sleeve-seam-splits")] ?? WEIGHTS["sleeve-seam"].base);
      if (sHas("sleeve-tears"))       sleeveScore += (WEIGHTS["sleeve-tears"].sev?.[sSev("sleeve-tears")] ?? WEIGHTS["sleeve-tears"].base);
      if (sHas("sleeve-spine-wear"))  sleeveScore += WEIGHTS["sleeve-spine"].base;
      if (sHas("sleeve-writing"))     sleeveScore += (WEIGHTS["sleeve-writing"].sev?.[sSev("sleeve-writing")] ?? WEIGHTS["sleeve-writing"].base);
      if (sHas("sleeve-stickers-tape")) sleeveScore += (WEIGHTS["sleeve-stickers"].sev?.[sSev("sleeve-stickers-tape")] ?? WEIGHTS["sleeve-stickers"].base);
    }

    return { mediaScore, sleeveScore };
  }

  function calculateGrades() {
    const { mediaScore, sleeveScore } = computeScores();

    const mediaGrade = mediaMissing ? "—" : scoreToGrade(mediaScore, sealed);
    const sleeveGradeVal = packageMissing ? "—" : scoreToGrade(sleeveScore, sealed);

    let combined: string;
    if (sealed) {
      // If sealed AND both scores are zero -> Mint (Sealed). Otherwise, NM is the cap.
      if (mediaScore === 0 && sleeveScore === 0) combined = "M (Sealed)";
      else combined = "NM (Sealed)";
    } else if (mediaMissing) {
      combined = sleeveGradeVal;
    } else if (packageMissing) {
      combined = mediaGrade;
    } else {
      const overallScore = Math.round(mediaScore*0.7 + sleeveScore*0.3);
      combined = scoreToGrade(overallScore, false);
    }

    setRecordGrade(mediaGrade);
    setSleeveGrade(sleeveGradeVal);
    setOverallGrade(combined);
    setShowResults(true);
    setTimeout(()=>document.getElementById("results")?.scrollIntoView({behavior:"smooth"}),100);
  }

  // ---------------- UI ----------------

  const renderMediaItem = (item: MediaItem) => (
    <div key={item.id} className="card">
      <div className="sectionTitle">Record #{item.id}</div>

      <div className="group">
        <div className="sectionTitle">Visual Appearance</div>

        <label>
          <input
            type="checkbox"
            checked={!!conditions[`vinyl-scuffs-record-${item.id}`]}
            onChange={(e)=>setCondition(`vinyl-scuffs-record-${item.id}`, e.target.checked)}
          />
          Light scuffs visible
        </label>
        {activeSeverities["vinyl-scuffs-record-"+item.id+"-severity"] || activeSeverities["vinyl-scuffs-severity"] ? (
          <div className="severity">
            <div>Severity:</div>
            {["light","moderate","heavy"].map(s => (
              <label key={s}>
                <input type="radio"
                  name={`vinyl-scuffs-${item.id}`}
                  checked={severities["vinyl-scuffs-severity"] === s}
                  onChange={()=>setSeverity("vinyl-scuffs-severity", s)}
                /> {s}
              </label>
            ))}
          </div>
        ) : null}

        <label>
          <input
            type="checkbox"
            checked={!!conditions[`vinyl-scratches-record-${item.id}`]}
            onChange={(e)=>setCondition(`vinyl-scratches-record-${item.id}`, e.target.checked)}
          />
          Scratches present
        </label>
        {activeSeverities["vinyl-scratches-severity"] && (
          <div className="severity">
            <div>Severity:</div>
            {["hairline","feelable","deep"].map(s => (
              <label key={s}>
                <input type="radio"
                  name={`vinyl-scratches-${item.id}`}
                  checked={severities["vinyl-scratches-severity"] === s}
                  onChange={()=>setSeverity("vinyl-scratches-severity", s)}
                /> {s}
              </label>
            ))}
          </div>
        )}

        <label>
          <input
            type="checkbox"
            checked={!!conditions[`vinyl-groove-wear-record-${item.id}`]}
            onChange={(e)=>setCondition(`vinyl-groove-wear-record-${item.id}`, e.target.checked)}
          />
          Groove wear visible
        </label>
        {activeSeverities["vinyl-groove-wear-severity"] && (
          <div className="severity">
            <div>Severity:</div>
            {["slight","evident","heavy"].map(s => (
              <label key={s}>
                <input type="radio"
                  name={`vinyl-groove-${item.id}`}
                  checked={severities["vinyl-groove-wear-severity"] === s}
                  onChange={()=>setSeverity("vinyl-groove-wear-severity", s)}
                /> {s}
              </label>
            ))}
          </div>
        )}

        <label>
          <input
            type="checkbox"
            checked={!!conditions[`vinyl-warping-record-${item.id}`]}
            onChange={(e)=>setCondition(`vinyl-warping-record-${item.id}`, e.target.checked)}
          />
          Warping present
        </label>
        {activeSeverities["vinyl-warping-severity"] && (
          <div className="severity">
            <div>Warp severity:</div>
            {["slight","moderate","severe"].map(s => (
              <label key={s}>
                <input type="radio"
                  name={`vinyl-warp-${item.id}`}
                  checked={severities["vinyl-warping-severity"] === s}
                  onChange={()=>setSeverity("vinyl-warping-severity", s)}
                /> {s}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="group">
        <div className="sectionTitle">Audio Performance</div>

        <label>
          <input
            type="checkbox"
            checked={!!conditions[`vinyl-surface-noise-record-${item.id}`]}
            onChange={(e)=>setCondition(`vinyl-surface-noise-record-${item.id}`, e.target.checked)}
          />
          Surface noise when played
        </label>
        {activeSeverities["vinyl-surface-noise-severity"] && (
          <div className="severity">
            <div>Severity:</div>
            {["minimal","noticeable","significant"].map(s => (
              <label key={s}>
                <input type="radio"
                  name={`vinyl-noise-${item.id}`}
                  checked={severities["vinyl-surface-noise-severity"] === s}
                  onChange={()=>setSeverity("vinyl-surface-noise-severity", s)}
                /> {s}
              </label>
            ))}
          </div>
        )}

        <label>
          <input
            type="checkbox"
            checked={!!conditions[`vinyl-pops-clicks-record-${item.id}`]}
            onChange={(e)=>setCondition(`vinyl-pops-clicks-record-${item.id}`, e.target.checked)}
          />
          Occasional pops or clicks
        </label>

        <label>
          <input
            type="checkbox"
            checked={!!conditions[`vinyl-skips-record-${item.id}`]}
            onChange={(e)=>setCondition(`vinyl-skips-record-${item.id}`, e.target.checked)}
          />
          Skipping or repeating
        </label>
        {activeSeverities["vinyl-skips-severity"] && (
          <div className="severity skipPanel">
            <div><strong>Which side(s) affected:</strong></div>
            <div className="sides">
              {["A","B","C","D"].map(side => (
                <label key={side}>
                  <input
                    type="checkbox"
                    checked={!!(mediaItems.find(mi => mi.id === item.id)?.skipSides || []).includes(side)}
                    onChange={(e)=>updateSkipSides(item.id, side, e.target.checked)}
                  /> Side {side}
                </label>
              ))}
            </div>
            <div><strong>Tracks affected:</strong></div>
            <input
              type="number"
              value={mediaItems.find(mi => mi.id === item.id)?.tracksAffected ?? 0}
              onChange={(e)=>updateTracksAffected(item.id, Number(e.target.value || 0))}
              style={{ width: 80, padding: 6, border: "1px solid #cbd5e1", borderRadius: 8 }}
            />
            <div style={{ gridColumn:"1 / -1" }}><strong>Severity:</strong></div>
            {["occasional","frequent","constant"].map(s => (
              <label key={s}>
                <input
                  type="radio"
                  name={`vinyl-skips-${item.id}`}
                  checked={severities["vinyl-skips-severity"] === s}
                  onChange={()=>setSeverity("vinyl-skips-severity", s)}
                /> {s}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderSleeve = () => (
    <div className="card">
      <div className="sectionTitle">Sleeve Condition Assessment</div>

      <label>
        <input
          type="checkbox"
          checked={!!conditions["sleeve-sealed"]}
          onChange={(e)=>setCondition("sleeve-sealed", e.target.checked)}
        />
        Sealed (factory shrink intact)
      </label>

      <label>
        <input
          type="checkbox"
          checked={!!conditions["sleeve-corner-wear"]}
          onChange={(e)=>setCondition("sleeve-corner-wear", e.target.checked)}
        />
        Corner wear / corner crush present
      </label>
      {activeSeverities["sleeve-corner-wear-severity"] && (
        <div className="severity">
          <div>Severity:</div>
          {["slight","creased","cut"].map(s => (
            <label key={s}>
              <input
                type="radio"
                name="sleeve-corner"
                checked={severities["sleeve-corner-wear-severity"] === s}
                onChange={()=>setSeverity("sleeve-corner-wear-severity", s)}
              /> {s}
            </label>
          ))}
        </div>
      )}

      <label>
        <input
          type="checkbox"
          checked={!!conditions["sleeve-ring-wear"]}
          onChange={(e)=>setCondition("sleeve-ring-wear", e.target.checked)}
        />
        Ring wear visible (shelf wear)
      </label>
      {activeSeverities["sleeve-ring-wear-severity"] && (
        <div className="severity">
          <div>Severity:</div>
          {["light","evident","heavy"].map(s => (
            <label key={s}>
              <input
                type="radio"
                name="sleeve-ring"
                checked={severities["sleeve-ring-wear-severity"] === s}
                onChange={()=>setSeverity("sleeve-ring-wear-severity", s)}
              /> {s}
            </label>
          ))}
        </div>
      )}

      <label>
        <input
          type="checkbox"
          checked={!!conditions["sleeve-seam-splits"]}
          onChange={(e)=>setCondition("sleeve-seam-splits", e.target.checked)}
        />
        Seam splits present
      </label>
      {activeSeverities["sleeve-seam-splits-severity"] && (
        <div className="severity">
          <div>Severity:</div>
          {["small","medium","large"].map(s => (
            <label key={s}>
              <input
                type="radio"
                name="sleeve-seam"
                checked={severities["sleeve-seam-splits-severity"] === s}
                onChange={()=>setSeverity("sleeve-seam-splits-severity", s)}
              /> {s}
            </label>
          ))}
        </div>
      )}

      <label>
        <input
          type="checkbox"
          checked={!!conditions["sleeve-tears"]}
          onChange={(e)=>setCondition("sleeve-tears", e.target.checked)}
        />
        Tears present
      </label>
      {activeSeverities["sleeve-tears-severity"] && (
        <div className="severity">
          <div>Severity:</div>
          {["small","significant","major"].map(s => (
            <label key={s}>
              <input
                type="radio"
                name="sleeve-tears"
                checked={severities["sleeve-tears-severity"] === s}
                onChange={()=>setSeverity("sleeve-tears-severity", s)}
              /> {s}
            </label>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="mediaGradingRoot" style={{ padding: 16 }}>
      <div className="grading-header">
        <h1>Systematic Media Grading Tool</h1>
      </div>

      {showResults && (
        <div id="results" className="result">
          <strong>Record Grade:</strong> {recordGrade} &nbsp;|&nbsp;
          <strong>Sleeve Grade:</strong> {sleeveGrade} &nbsp;|&nbsp;
          <strong>Overall:</strong> {overallGrade}
        </div>
      )}

      <div className="controlsRow" style={{ margin: "12px 0" }}>
        <label>
          Media Type:&nbsp;
          <select value={mediaType} onChange={(e)=>setMediaType(e.target.value as MediaType)}>
            <option value="vinyl">Vinyl</option>
            <option value="cassette">Cassette</option>
            <option value="cd">CD</option>
          </select>
        </label>
        <button type="button" className="btn primary" onClick={addItem}>Add Another Record</button>
      </div>

      <div className="twoCol">
        <div>
          <h2>🎵 Record Condition Assessment</h2>
          {mediaItems.map(renderMediaItem)}
        </div>
        <div>
          <h2>📦 Sleeve Condition Assessment</h2>
          {renderSleeve()}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="sectionTitle">📝 Custom Condition Notes</div>
        <textarea
          className="notes-textarea"
          value={customNotes}
          onChange={(e)=>setCustomNotes(e.target.value)}
          placeholder='Examples: "Light warp, does not affect play", "Minor pressing flaw on track 3", "Includes original poster"…'
        />
      </div>

      <div className="controlsRow" style={{ justifyContent:"flex-end", marginTop: 16 }}>
        <button className="btn primary" onClick={calculateGrades}>Calculate Grades</button>
      </div>
    </div>
  );
}
