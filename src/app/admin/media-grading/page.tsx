// src/app/admin/media-grading/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import "../../../styles/media-grading.css";

type MediaKind = "vinyl" | "cassette" | "cd";

interface MediaItem {
  id: number;
  conditions: Record<string, boolean>;
  severities: Record<string, string>;
  skipSides: string[];
  tracksAffected: number;
}

export default function MediaGradingPage() {
  const [currentMedia, setCurrentMedia] = useState<MediaKind>("vinyl");
  const [mediaMissing, setMediaMissing] = useState(false);
  const [packageMissing, setPackageMissing] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([{
    id: 1, conditions: {}, severities: {}, skipSides: [], tracksAffected: 0
  }]);
  const [packagingConditions, setPackagingConditions] = useState<Record<string, boolean>>({});
  const [packagingSeverities, setPackagingSeverities] = useState<Record<string, string>>({});
  const [customNotes, setCustomNotes] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState<Record<string, boolean>>({});
  const [showResults, setShowResults] = useState(false);
  const [mediaGrade, setMediaGrade] = useState<string>("—");
  const [packagingGrade, setPackagingGrade] = useState<string>("—");
  const [overallGrade, setOverallGrade] = useState<string>("—");

  const selectMedia = (kind: MediaKind) => {
    setCurrentMedia(kind);
    // reset state specific to number of items when switching
    setShowResults(false);
    setMediaItems([{ id: 1, conditions: {}, severities: {}, skipSides: [], tracksAffected: 0 }]);
    setPackagingConditions({});
    setPackagingSeverities({});
    setMediaMissing(false);
    setPackageMissing(false);
  };

  const activeStyle = (enabled: boolean): React.CSSProperties => ({
    background: enabled ? "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)" : "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
    color: "white",
    border: "none",
    padding: "15px 30px",
    borderRadius: 50,
    fontSize: "1rem",
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(0,0,0,0.2)",
    transition: "all .2s ease",
  });

  // Toggle visibility of severity blocks (pure DOM class for simplicity)
  const toggleSeverity = (key: string, show: boolean) => {
    const el = document.getElementById(key);
    if (!el) return;
    el.style.display = show ? "block" : "none";
  };

  const updateMediaCondition = (itemId: number, condKey: string, checked: boolean) => {
    setMediaItems(prev => prev.map(it => it.id === itemId ? { ...it, conditions: { ...it.conditions, [condKey]: checked } } : it));
    const sevKey = `${condKey}-severity-${itemId}`; // group id container
    toggleSeverity(sevKey, checked);
  };

  const updateMediaSeverity = (itemId: number, group: string, value: string) => {
    setMediaItems(prev => prev.map(it => it.id === itemId ? { ...it, severities: { ...it.severities, [group]: value } } : it));
  };

  const updatePackagingCondition = (condKey: string, checked: boolean) => {
    setPackagingConditions(prev => ({ ...prev, [condKey]: checked }));
    toggleSeverity(`${condKey}-severity`, checked);
  };

  const updatePackagingSeverity = (group: string, value: string) => {
    setPackagingSeverities(prev => ({ ...prev, [group]: value }));
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

  const addItem = () => {
    const newId = Math.max(...mediaItems.map(i => i.id)) + 1;
    setMediaItems(prev => [...prev, { id: newId, conditions: {}, severities: {}, skipSides: [], tracksAffected: 0 }]);
  };

  const removeItem = (id: number) => {
    setMediaItems(prev => prev.filter(i => i.id !== id));
  };

  const toggleMissing = (which: "media" | "package") => {
    if (which === "media") setMediaMissing(v => !v);
    else setPackageMissing(v => !v);
    setShowResults(false);
  };

  // ---------- Grading logic ----------
  const sealed = packagingConditions[`${currentMedia}-sealed`] || false;

  const scoreToGrade = (score: number, canMint: boolean) => {
    if (canMint && score === 0) return "M";
    if (score <= 5) return "NM";
    if (score <= 15) return "VG+";
    if (score <= 28) return "VG";
    if (score <= 40) return "G+";
    if (score <= 55) return "G";
    return "P";
  };

  const computeScores = () => {
    let mScore = 0;
    for (const it of mediaItems) {
      const id = it.id;
      const has = (k: string) => !!it.conditions[`${k}-${id}`];
      const sev = (k: string) => (it.severities[`${k}-${id}`] || "");

      if (currentMedia === "vinyl") {
        if (!sealed) {
          if (has("vinyl-scuffs"))       mScore += ({light:5,moderate:9,heavy:14}[sev("vinyl-scuffs-level")] ?? 6);
          if (has("vinyl-scratches"))    mScore += ({hairline:8,feelable:16,deep:26}[sev("vinyl-scratches-level")] ?? 12);
          if (has("vinyl-groove-wear"))  mScore += ({slight:8,evident:14,heavy:22}[sev("vinyl-groove-level")] ?? 10);
          if (has("vinyl-surface-noise"))mScore += ({minimal:6,noticeable:12,significant:18}[sev("vinyl-noise-level")] ?? 8);
          if (has("vinyl-pops-clicks"))  mScore += 6;
          if (has("vinyl-skips")) {
            const base = ({occasional:20,frequent:34,constant:48}[sev("vinyl-skips-severity")] ?? 24);
            const sides = (it.skipSides||[]).length;
            const tracks = it.tracksAffected || 0;
            mScore += base + Math.max(0, sides-1)*3 + Math.min(tracks, 12);
          }
        }
        if (has("vinyl-warping")) mScore += ({slight:12,moderate:22,severe:36}[sev("vinyl-warp-level")] ?? 20);
      }

      if (currentMedia === "cassette") {
        if (has("tape-shell-crack"))  mScore += ({hairline:6,major:14}[sev("tape-shell-crack-sev")] ?? 8);
        if (has("tape-pressure-pad-missing")) mScore += 16;
        if (has("tape-warp-pack")) mScore += ({mild:8,moderate:14,severe:22}[sev("tape-warp-pack-sev")] ?? 10);
        if (has("tape-dropouts-hiss")) mScore += ({minimal:6,noticeable:12,severe:18}[sev("tape-dropouts-hiss-sev")] ?? 8);
        if (has("tape-wow-flutter")) mScore += ({mild:6,moderate:12,severe:18}[sev("tape-wow-flutter-sev")] ?? 8);
        if (has("tape-squeal-stick")) mScore += ({occasional:12,frequent:20,constant:30}[sev("tape-squeal-stick-sev")] ?? 12);
        if (has("tape-stretch-wrinkle")) mScore += ({mild:12,moderate:20,severe:30}[sev("tape-stretch-wrinkle-sev")] ?? 14);
        if (has("tape-channel-dropout")) mScore += ({intermittent:12,frequent:22,constant:32}[sev("tape-channel-dropout-sev")] ?? 12);
      }

      if (currentMedia === "cd") {
        if (has("cd-light-scuffs")) mScore += 4;
        if (has("cd-scratches"))    mScore += ({hairline:8,feelable:18,deep:28}[sev("cd-scratches-sev")] ?? 10);
        if (has("cd-label-scratch")) mScore += 26; // label-side damage is serious
        if (has("cd-hub-crack"))    mScore += ({hairline:8,spider:14,through:24}[sev("cd-hub-crack-sev")] ?? 10);
        if (has("cd-pinholes"))     mScore += ({few:4,many:10}[sev("cd-pinholes-sev")] ?? 6);
        if (has("cd-bronzing-rot")) mScore += ({early:16,moderate:28,severe:40}[sev("cd-bronzing-rot-sev")] ?? 22);
        if (has("cd-skips")) {
          const base = ({occasional:18,frequent:30,constant:44}[sev("cd-skips-sev")] ?? 22);
          const tracks = it.tracksAffected || 0;
          mScore += base + Math.min(tracks, 12);
        }
      }
    }

    let pScore = 0;
    const hasP = (k: string) => !!packagingConditions[k];
    const sevP = (k: string) => (packagingSeverities[`${k}`] || "");

    // Common packaging (Sealed present for all)
    if (currentMedia === "vinyl") {
      if (hasP("vinyl-corner-wear")) pScore += ({slight:4,creased:9,cut:14}[sevP("vinyl-corner-wear-severity")] ?? 6);
      if (hasP("vinyl-ring-wear"))   pScore += ({light:6,evident:12,heavy:18}[sevP("vinyl-ring-wear-severity")] ?? 8);
      if (hasP("vinyl-seam-splits")) pScore += ({small:8,medium:14,large:22}[sevP("vinyl-seam-splits-severity")] ?? 10);
      if (hasP("vinyl-tears"))       pScore += ({small:8,significant:16,major:26}[sevP("vinyl-tears-severity")] ?? 12);
      if (hasP("vinyl-spine-wear"))  pScore += 6;
      if (hasP("vinyl-writing"))     pScore += ({small:6,noticeable:10,heavy:16}[sevP("vinyl-writing-severity")] ?? 8);
      if (hasP("vinyl-stickers-tape")) pScore += ({residue:4,partial:8,heavy:12}[sevP("vinyl-stickers-tape-severity")] ?? 6);
    }

    if (currentMedia === "cassette") {
      if (hasP("cassette-case-crack")) pScore += ({hairline:4,major:10}[sevP("cassette-case-crack-sev")] ?? 6);
      if (hasP("cassette-hinge-broken")) pScore += 10;
      if (hasP("cassette-jcard-tears")) pScore += ({small:6,medium:12,large:18}[sevP("cassette-jcard-tears-sev")] ?? 8);
      if (hasP("cassette-water-damage")) pScore += ({light:8,moderate:16,severe:26}[sevP("cassette-water-damage-sev")] ?? 10);
      if (hasP("cassette-writing-stickers")) pScore += ({small:4,noticeable:8,heavy:12}[sevP("cassette-writing-stickers-sev")] ?? 6);
    }

    if (currentMedia === "cd") {
      if (hasP("cd-jewel-cracked")) pScore += ({hairline:4,major:10}[sevP("cd-jewel-cracked-sev")] ?? 6);
      if (hasP("cd-hub-broken"))    pScore += 12;
      if (hasP("cd-booklet-wear"))  pScore += ({light:4,evident:8,heavy:12}[sevP("cd-booklet-wear-sev")] ?? 6);
      if (hasP("cd-booklet-tear"))  pScore += ({small:6,significant:12,major:18}[sevP("cd-booklet-tear-sev")] ?? 8);
      if (hasP("cd-water-damage"))  pScore += ({light:8,moderate:16,severe:26}[sevP("cd-water-damage-sev")] ?? 10);
      if (hasP("cd-stickers-residue")) pScore += ({small:4,noticeable:8,heavy:12}[sevP("cd-stickers-residue-sev")] ?? 6);
    }

    return { mScore, pScore };
  };

  const calculate = () => {
    const { mScore, pScore } = computeScores();
    const mGrade = mediaMissing ? "—" : scoreToGrade(mScore, sealed);
    const pGrade = packageMissing ? "—" : scoreToGrade(pScore, sealed);

    let overall: string;
    if (sealed) {
      overall = (mScore === 0 && pScore === 0) ? "M (Sealed)" : "NM (Sealed)";
    } else if (mediaMissing) {
      overall = pGrade;
    } else if (packageMissing) {
      overall = mGrade;
    } else {
      const overallScore = Math.round(mScore * 0.7 + pScore * 0.3);
      overall = scoreToGrade(overallScore, false);
    }

    setMediaGrade(mGrade);
    setPackagingGrade(pGrade);
    setOverallGrade(overall);
    setShowResults(true);
    setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const sectionCard: React.CSSProperties = { background: "white", borderRadius: 12, padding: 18, border: "1px solid #e9ecef" };

  const renderVinylItem = (item: MediaItem) => (
    <div key={item.id} style={{ ...sectionCard, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>Record #{item.id}</h4>
        {mediaItems.length > 1 && <button onClick={() => removeItem(item.id)} style={{ background: "#dc3545", color: "white", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>✕ Remove</button>}
      </div>

      <h5 style={{ margin: "10px 0" }}>Visual Appearance</h5>
      {[
        { key: "vinyl-scuffs", label: "Light scuffs visible", sevId: "vinyl-scuffs-level", opts: [{v:"light", l:"Very light, barely visible"}, {v:"moderate", l:"Visible but not deep"}, {v:"heavy", l:"Obvious, multiple scuffs"}] },
        { key: "vinyl-scratches", label: "Scratches present", sevId: "vinyl-scratches-level", opts: [{v:"hairline", l:"Hairline only"}, {v:"feelable", l:"Can feel with fingernail"}, {v:"deep", l:"Deep, visible grooves"}] },
        { key: "vinyl-groove-wear", label: "Groove wear visible", sevId: "vinyl-groove-level", opts: [{v:"slight", l:"Slight loss of gloss"}, {v:"evident", l:"Evident on sight"}, {v:"heavy", l:"Obvious dulling"}] },
        { key: "vinyl-warping", label: "Warping present", sevId: "vinyl-warp-level", opts: [{v:"slight", l:"Slight – does not affect play"}, {v:"moderate", l:"May cause tracking"}, {v:"severe", l:"Significantly affects play"}] },
      ].map(row => (
        <div key={row.key} style={{ marginBottom: 10 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={!!item.conditions[`${row.key}-${item.id}`]} onChange={e => updateMediaCondition(item.id, row.key, e.target.checked)} />
            {row.label}
          </label>
          <div id={`${row.key}-severity-${item.id}`} style={{ display: "none", marginLeft: 26, marginTop: 8 }}>
            {row.opts.map(o => (
              <label key={o.v} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input type="radio" name={`${row.sevId}-${item.id}`} onChange={() => updateMediaSeverity(item.id, `${row.sevId}-${item.id}`, o.v)} />
                {o.l}
              </label>
            ))}
          </div>
        </div>
      ))}

      <h5 style={{ margin: "12px 0 6px" }}>Audio Performance</h5>
      {[
        { key: "vinyl-surface-noise", label: "Surface noise when played", sevId: "vinyl-noise-level", opts: [{v:"minimal", l:"Minimal"}, {v:"noticeable", l:"Noticeable"}, {v:"significant", l:"Significant"}] },
        { key: "vinyl-pops-clicks", label: "Occasional pops or clicks" },
        { key: "vinyl-skips", label: "Skipping or repeating", sevId: "vinyl-skips-severity", opts: [{v:"occasional", l:"Occasional skips"}, {v:"frequent", l:"Frequent skipping"}, {v:"constant", l:"Constant skipping"}], extra: true },
      ].map(row => (
        <div key={row.key} style={{ marginBottom: 10 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={!!item.conditions[`${row.key}-${item.id}`]} onChange={e => updateMediaCondition(item.id, row.key, e.target.checked)} />
            {row.label}
          </label>
          <div id={`${row.key}-severity-${item.id}`} style={{ display: "none", marginLeft: 26, marginTop: 8 }}>
            {row.opts && row.opts.map(o => (
              <label key={o.v} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input type="radio" name={`${row.sevId}-${item.id}`} onChange={() => updateMediaSeverity(item.id, `${row.sevId}-${item.id}`, o.v)} />
                {o.l}
              </label>
            ))}
            {row.extra && (
              <div className="skipPanel" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: "#fff7e6", padding: 12, borderRadius: 8, marginTop: 8 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6 }}>Which side(s) affected:</label>
                  {["Side A","Side B","Side C","Side D"].map(side => (
                    <label key={side} style={{ display: "inline-flex", alignItems: "center", marginRight: 12 }}>
                      <input type="checkbox" value={side} checked={(item.skipSides||[]).includes(side)} onChange={(e)=>updateSkipSides(item.id, side, e.target.checked)} style={{ marginRight: 4 }} />
                      {side}
                    </label>
                  ))}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6 }}>Tracks affected:</label>
                  <input type="number" value={item.tracksAffected || 0} onChange={(e)=>updateTracksAffected(item.id, Number(e.target.value||0))} style={{ width: 84, padding: 6, border: "1px solid #cbd5e1", borderRadius: 6 }} />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCassetteItem = (item: MediaItem) => (
    <div key={item.id} style={{ ...sectionCard, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>Tape #{item.id}</h4>
        {mediaItems.length > 1 && <button onClick={() => removeItem(item.id)} style={{ background: "#dc3545", color: "white", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>✕ Remove</button>}
      </div>

      <h5 style={{ margin: "10px 0" }}>Tape & Shell</h5>
      {[
        { key: "tape-shell-crack", label: "Shell crack present", sevId: "tape-shell-crack-sev", opts: [{v:"hairline", l:"Hairline / cosmetic"}, {v:"major", l:"Major / structural"}] },
        { key: "tape-pressure-pad-missing", label: "Pressure pad missing" },
        { key: "tape-warp-pack", label: "Irregular tape pack / warping", sevId: "tape-warp-pack-sev", opts: [{v:"mild", l:"Mild"}, {v:"moderate", l:"Moderate"}, {v:"severe", l:"Severe"}] },
      ].map(row => (
        <div key={row.key} style={{ marginBottom: 10 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={!!item.conditions[`${row.key}-${item.id}`]} onChange={e => updateMediaCondition(item.id, row.key, e.target.checked)} />
            {row.label}
          </label>
          <div id={`${row.key}-severity-${item.id}`} style={{ display: "none", marginLeft: 26, marginTop: 8 }}>
            {row.opts && row.opts.map(o => (
              <label key={o.v} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input type="radio" name={`${row.sevId}-${item.id}`} onChange={() => updateMediaSeverity(item.id, `${row.sevId}-${item.id}`, o.v)} />
                {o.l}
              </label>
            ))}
          </div>
        </div>
      ))}

      <h5 style={{ margin: "10px 0" }}>Playback</h5>
      {[
        { key: "tape-dropouts-hiss", label: "Dropouts / hiss present", sevId: "tape-dropouts-hiss-sev", opts: [{v:"minimal", l:"Minimal"}, {v:"noticeable", l:"Noticeable"}, {v:"severe", l:"Severe"}] },
        { key: "tape-wow-flutter", label: "Wow / flutter", sevId: "tape-wow-flutter-sev", opts: [{v:"mild", l:"Mild"}, {v:"moderate", l:"Moderate"}, {v:"severe", l:"Severe"}] },
        { key: "tape-squeal-stick", label: "Squeal / sticking", sevId: "tape-squeal-stick-sev", opts: [{v:"occasional", l:"Occasional"}, {v:"frequent", l:"Frequent"}, {v:"constant", l:"Constant"}] },
        { key: "tape-stretch-wrinkle", label: "Tape stretch / wrinkles", sevId: "tape-stretch-wrinkle-sev", opts: [{v:"mild", l:"Mild"}, {v:"moderate", l:"Moderate"}, {v:"severe", l:"Severe"}] },
        { key: "tape-channel-dropout", label: "Channel(s) drop out", sevId: "tape-channel-dropout-sev", opts: [{v:"intermittent", l:"Intermittent"}, {v:"frequent", l:"Frequent"}, {v:"constant", l:"Constant"}] },
      ].map(row => (
        <div key={row.key} style={{ marginBottom: 10 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={!!item.conditions[`${row.key}-${item.id}`]} onChange={e => updateMediaCondition(item.id, row.key, e.target.checked)} />
            {row.label}
          </label>
          <div id={`${row.key}-severity-${item.id}`} style={{ display: "none", marginLeft: 26, marginTop: 8 }}>
            {row.opts && row.opts.map(o => (
              <label key={o.v} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input type="radio" name={`${row.sevId}-${item.id}`} onChange={() => updateMediaSeverity(item.id, `${row.sevId}-${item.id}`, o.v)} />
                {o.l}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCDItem = (item: MediaItem) => (
    <div key={item.id} style={{ ...sectionCard, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>Disc #{item.id}</h4>
        {mediaItems.length > 1 && <button onClick={() => removeItem(item.id)} style={{ background: "#dc3545", color: "white", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>✕ Remove</button>}
      </div>

      <h5 style={{ margin: "10px 0" }}>Disc Condition</h5>
      {[
        { key: "cd-light-scuffs", label: "Light scuffs visible" },
        { key: "cd-scratches", label: "Scratches present", sevId: "cd-scratches-sev", opts: [{v:"hairline", l:"Hairline"}, {v:"feelable", l:"Feelable"}, {v:"deep", l:"Deep"}] },
        { key: "cd-label-scratch", label: "Label-side scratch (top coat) present" },
        { key: "cd-hub-crack", label: "Hub crack present", sevId: "cd-hub-crack-sev", opts: [{v:"hairline", l:"Hairline"}, {v:"spider", l:"Spidering"}, {v:"through", l:"Through hub"}] },
        { key: "cd-pinholes", label: "Pinholes visible", sevId: "cd-pinholes-sev", opts: [{v:"few", l:"Few"}, {v:"many", l:"Many"}] },
        { key: "cd-bronzing-rot", label: "Bronzing / disc rot", sevId: "cd-bronzing-rot-sev", opts: [{v:"early", l:"Early"}, {v:"moderate", l:"Moderate"}, {v:"severe", l:"Severe"}] },
        { key: "cd-skips", label: "Skips or read errors", sevId: "cd-skips-sev", opts: [{v:"occasional", l:"Occasional"}, {v:"frequent", l:"Frequent"}, {v:"constant", l:"Constant"}] },
      ].map(row => (
        <div key={row.key} style={{ marginBottom: 10 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={!!item.conditions[`${row.key}-${item.id}`]} onChange={e => updateMediaCondition(item.id, row.key, e.target.checked)} />
            {row.label}
          </label>
          <div id={`${row.key}-severity-${item.id}`} style={{ display: "none", marginLeft: 26, marginTop: 8 }}>
            {row.opts && row.opts.map(o => (
              <label key={o.v} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input type="radio" name={`${row.sevId}-${item.id}`} onChange={() => updateMediaSeverity(item.id, `${row.sevId}-${item.id}`, o.v)} />
                {o.l}
              </label>
            ))}
            {row.key === "cd-skips" && (
              <div style={{ marginTop: 8 }}>
                <label style={{ display: "block", marginBottom: 6 }}>Tracks affected:</label>
                <input type="number" value={item.tracksAffected || 0} onChange={(e)=>updateTracksAffected(item.id, Number(e.target.value||0))} style={{ width: 84, padding: 6, border: "1px solid #cbd5e1", borderRadius: 6 }} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderPackaging = () => {
    const packKey = (k: string) => `${currentMedia}-${k}`;
    const sevId = (k: string) => `${packKey(k)}-severity`;

    const vinylRows = [
      { k: "sealed", label: "Sealed (factory shrink intact)" },
      { k: "corner-wear", label: "Corner wear present", opts: [{v:"slight", l:"Slight bumping"}, {v:"creased", l:"Creased or frayed"}, {v:"cut", l:"Corner cut"}] },
      { k: "ring-wear", label: "Ring wear visible", opts: [{v:"light", l:"Light"}, {v:"evident", l:"Evident"}, {v:"heavy", l:"Heavy"}] },
      { k: "seam-splits", label: "Seam splits present", opts: [{v:"small", l:"Small"}, {v:"medium", l:"Medium"}, {v:"large", l:"Large"}] },
      { k: "tears", label: "Tears present", opts: [{v:"small", l:"Small"}, {v:"significant", l:"Significant"}, {v:"major", l:"Major"}] },
      { k: "spine-wear", label: "Spine shows wear" },
      { k: "writing", label: "Writing present", opts: [{v:"small", l:"Small"}, {v:"noticeable", l:"Noticeable"}, {v:"heavy", l:"Heavy"}] },
      { k: "stickers-tape", label: "Stickers or tape", opts: [{v:"residue", l:"Residue"}, {v:"partial", l:"Partial removal"}, {v:"heavy", l:"Heavy"}] },
    ];

    const cassetteRows = [
      { k: "sealed", label: "Sealed (factory shrink intact)" },
      { k: "case-crack", label: "Case crack", opts: [{v:"hairline", l:"Hairline"}, {v:"major", l:"Major"}] },
      { k: "hinge-broken", label: "Hinge broken" },
      { k: "jcard-tears", label: "J-card tears / creases", opts: [{v:"small", l:"Small"}, {v:"medium", l:"Medium"}, {v:"large", l:"Large"}] },
      { k: "water-damage", label: "Water damage / staining", opts: [{v:"light", l:"Light"}, {v:"moderate", l:"Moderate"}, {v:"severe", l:"Severe"}] },
      { k: "writing-stickers", label: "Writing / stickers", opts: [{v:"small", l:"Small"}, {v:"noticeable", l:"Noticeable"}, {v:"heavy", l:"Heavy"}] },
    ];

    const cdRows = [
      { k: "sealed", label: "Sealed (factory wrap intact)" },
      { k: "jewel-cracked", label: "Jewel case cracked", opts: [{v:"hairline", l:"Hairline"}, {v:"major", l:"Major"}] },
      { k: "hub-broken", label: "Center hub broken" },
      { k: "booklet-wear", label: "Booklet wear", opts: [{v:"light", l:"Light"}, {v:"evident", l:"Evident"}, {v:"heavy", l:"Heavy"}] },
      { k: "booklet-tear", label: "Booklet tears", opts: [{v:"small", l:"Small"}, {v:"significant", l:"Significant"}, {v:"major", l:"Major"}] },
      { k: "water-damage", label: "Water damage", opts: [{v:"light", l:"Light"}, {v:"moderate", l:"Moderate"}, {v:"severe", l:"Severe"}] },
      { k: "stickers-residue", label: "Stickers / residue", opts: [{v:"small", l:"Small"}, {v:"noticeable", l:"Noticeable"}, {v:"heavy", l:"Heavy"}] },
    ];

    const rows = currentMedia === "vinyl" ? vinylRows : currentMedia === "cassette" ? cassetteRows : cdRows;

    return (
      <div style={{ ...sectionCard }}>
        <div className="card-title" style={{ fontWeight: 700, marginBottom: 8 }}>{currentMedia === "vinyl" ? "📦 Sleeve Condition Assessment" : currentMedia === "cassette" ? "📦 Case & J-Card Assessment" : "📦 Packaging Assessment"}</div>
        <div>
          {rows.map(r => (
            <div key={r.k} style={{ marginBottom: 10 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={!!packagingConditions[packKey(r.k)]} onChange={e => updatePackagingCondition(packKey(r.k), e.target.checked)} />
                {r.label}
              </label>
              <div id={`${packKey(r.k)}-severity`} style={{ display: "none", marginLeft: 26, marginTop: 8 }}>
                {r.opts && r.opts.map(o => (
                  <label key={o.v} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <input type="radio" name={`${sevId(r.k)}`} onChange={() => updatePackagingSeverity(sevId(r.k), o.v)} />
                    {o.l}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const addLabel = currentMedia === "vinyl" ? "Add Another Record" : currentMedia === "cassette" ? "Add Another Tape" : "Add Another Disc";

  return (
    <div style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", lineHeight: 1.6, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 24px rgba(0,0,0,.2)" }}>
        {/* Header */}
        <div style={{ background: "rgba(0,0,0,0.35)", padding: "30px 30px 20px", color: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/admin" style={{ background: "rgba(255,255,255,0.2)", color: "white", padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>← Back to Dashboard</Link>
            <div>
              <h1 style={{ fontSize: "2.5rem", margin: "0 0 10px 0", textShadow: "2px 2px 4px rgba(0,0,0,.3)" }}>🔍 Systematic Media Grading Tool</h1>
              <p style={{ margin: 0, opacity: .9 }}>Detailed condition assessment with automatic grading calculation</p>
            </div>
            <div style={{ width: 120 }} />
          </div>
        </div>

        {/* Body */}
        <div className="admin-media-grading" style={{ padding: 40 }}>
          {/* Media Selector */}
          <div style={{ marginBottom: 20, textAlign: "center" }}>
            <div style={{ display: "flex", gap: 15, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => selectMedia("vinyl")} style={activeStyle(currentMedia==="vinyl")}>🎵 Vinyl Records</button>
              <button onClick={() => selectMedia("cassette")} style={activeStyle(currentMedia==="cassette")}>📼 Cassette Tapes</button>
              <button onClick={() => selectMedia("cd")} style={activeStyle(currentMedia==="cd")}>💿 Compact Discs</button>
            </div>
          </div>

          {/* Missing Components */}
          <div style={{ background: "#fff3cd", border: "1px solid #ffeeba", borderRadius: 15, padding: 20, marginBottom: 24 }}>
            <h3 style={{ color: "#856404", marginBottom: 15 }}>⚠️ Missing Components Check (Check First!)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ background: "white", padding: 15, borderRadius: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={mediaMissing} onChange={() => toggleMissing("media")} style={{ transform: "scale(1.1)" }} />
                  <div>
                    <div style={{ fontWeight: "bold" }}>Only evaluating packaging - no disc/tape/record present</div>
                  </div>
                </label>
              </div>
              <div style={{ background: "white", padding: 15, borderRadius: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={packageMissing} onChange={() => toggleMissing("package")} style={{ transform: "scale(1.1)" }} />
                  <div>
                    <div style={{ fontWeight: "bold" }}>Only evaluating media - no packaging present</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Media & Packaging Columns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
            <div>
              <div style={{ ...sectionCard, marginBottom: 16 }}>
                <div className="card-title" style={{ fontWeight: 700, marginBottom: 8 }}>
                  {currentMedia === "vinyl" ? "🎵 Record Condition Assessment" : currentMedia === "cassette" ? "📼 Tape Condition Assessment" : "💿 Disc Condition Assessment"}
                </div>
                <div>
                  {mediaItems.map(it => (currentMedia === "vinyl" ? renderVinylItem(it) : currentMedia === "cassette" ? renderCassetteItem(it) : renderCDItem(it)))}
                  <button onClick={addItem} style={{ background: "#28a745", color: "white", border: "none", padding: "10px 16px", borderRadius: 8, cursor: "pointer" }}>+ {addLabel}</button>
                </div>
              </div>
            </div>
            <div>{renderPackaging()}</div>
          </div>

          {/* Notes */}
          <div style={{ background: "#f8f9fa", borderRadius: 15, padding: 25, margin: "20px 0" }}>
            <h3 style={{ color: "#495057", marginBottom: 12 }}>📝 Custom Condition Notes</h3>
            <textarea className="notes-textarea" placeholder="Add any additional condition details not covered by the checkboxes above…" value={customNotes} onChange={e=>setCustomNotes(e.target.value)} style={{ width: "100%", minHeight: 120, padding: 12, borderRadius: 8, border: "1px solid #ced4da", background: "white" }} />
            <div style={{ fontSize: ".85rem", color: "#666", marginTop: 8 }}>Examples: &quot;Light warp does not affect play&quot;, &quot;Minor pressing flaw on track 3&quot;, &quot;Includes original poster&quot;, etc.</div>
          </div>

          {/* Additional Notes */}
          <div style={{ background: "#fff3cd", border: "1px solid #ffeeba", borderRadius: 15, padding: 20, marginBottom: 24 }}>
            <h3>📋 Additional Notes (Don&rsquo;t Affect Grade but Important for Disclosure)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {[
                "Jewel Case Damaged","Jewel Case Missing","Original Shrinkwrap","Hype Sticker Present",
                "Cut-out Hole/Mark","Promotional Copy","Price Sticker/Tag","First Pressing",
                "Colored Vinyl","Limited Edition","Gatefold Sleeve","Original Inner Sleeve"
              ].map(key => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, background: "white", padding: 12, borderRadius: 8 }}>
                  <input type="checkbox" checked={!!additionalNotes[key]} onChange={e=>setAdditionalNotes(prev=>({ ...prev, [key]: e.target.checked }))} />
                  {key}
                </label>
              ))}
            </div>
          </div>

          {/* Calculate */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <button onClick={calculate} style={{ background: "linear-gradient(135deg,#2ecc71,#27ae60)", color: "white", border: "none", padding: "14px 28px", borderRadius: 999, fontSize: "1.05rem", cursor: "pointer", boxShadow: "0 10px 20px rgba(39,174,96,.35)" }}>📊 Calculate Grades</button>
          </div>

          {/* Results */}
          {showResults && (
            <div id="results" style={{ background: "#eafbea", borderRadius: 15, padding: 20, border: "1px solid #a5d6a7", marginBottom: 40 }}>
              <h3 style={{ color: "#2e7d32", marginBottom: 16 }}>📈 Calculated Grading Results</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div style={{ background: "white", borderRadius: 12, padding: 20, textAlign: "center", boxShadow: "0 2px 6px rgba(0,0,0,.05)" }}>
                  <div style={{ fontSize: ".9rem", color: "#555", marginBottom: 6 }}>{currentMedia === "vinyl" ? "Record Grade" : currentMedia === "cassette" ? "Tape Grade" : "Disc Grade"}</div>
                  <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1b5e20" }}>{mediaGrade}</div>
                </div>
                <div style={{ background: "white", borderRadius: 12, padding: 20, textAlign: "center", boxShadow: "0 2px 6px rgba(0,0,0,.05)" }}>
                  <div style={{ fontSize: ".9rem", color: "#555", marginBottom: 6 }}>{currentMedia === "vinyl" ? "Sleeve Grade" : currentMedia === "cassette" ? "Case/J‑Card Grade" : "Packaging Grade"}</div>
                  <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1b5e20" }}>{packagingGrade}</div>
                </div>
                <div style={{ background: "white", borderRadius: 12, padding: 20, textAlign: "center", boxShadow: "0 2px 6px rgba(0,0,0,.05)" }}>
                  <div style={{ fontSize: ".9rem", color: "#555", marginBottom: 6 }}>Overall Grade</div>
                  <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1b5e20" }}>{overallGrade}</div>
                </div>
              </div>
              <div style={{ background: "white", borderRadius: 12, padding: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Grading Explanation:</div>
                <div style={{ color: "#333" }}>
                  {sealed ? "Sealed grading rules applied. Mint is possible only when sealed and no deductions are present." : "Unsealed: NM is the maximum. Weighted deductions applied based on severity and playback impact."}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
