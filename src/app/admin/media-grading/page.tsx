// src/app/admin/media-grading/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "@/styles/media-grading.css";

/**
 * This file restores:
 * - Full multi-level criteria (vinyl/cassette/CD) with severities + sub-fields
 * - Tracks affected + side selection when "skips" is chosen
 * - Working grade calculation (Goldmine-inspired) with sealed → Mint gate
 * - Visibility/readability (imports the page CSS; no global CSS changes)
 * It does NOT change your layout, routing, or move components.
 */

// ---------- Types & Config (inline to avoid cross-file drift) ----------
type MediaKind = "vinyl" | "cassette" | "cd";

type SeverityOpt = { v: string; label: string; weight: number };
type Field = {
  key: string;
  label: string;
  weight?: number;
  severityKey?: string;
  severity?: SeverityOpt[];
  extra?: "skips" | "cd-skips";
};
type Section = { title: string; fields: Field[] };
type MediaConfig = { mediaTitle: string; packagingTitle: string; mediaSections: Section[]; packagingSections: Section[] };

const sev = (light=1, mod=3, heavy=6): SeverityOpt[] => [
  { v: "light", label: "Very light / minor", weight: light },
  { v: "moderate", label: "Moderate", weight: mod },
  { v: "severe", label: "Severe", weight: heavy },
];

const configs: Record<MediaKind, MediaConfig> = {
  vinyl: {
    mediaTitle: "🎵 Record Condition Assessment",
    packagingTitle: "📦 Sleeve Condition Assessment",
    mediaSections: [
      {
        title: "Visual Appearance",
        fields: [
          { key: "glossy", label: "Record has glossy, like-new appearance", weight: 0 },
          { key: "light_scuffs", label: "Light scuffs visible", severityKey: "scuffs", severity: sev(1,2,4) },
          { key: "scratches", label: "Scratches present", severityKey: "scratch", severity: sev(3,6,12) },
          { key: "groove_wear", label: "Groove wear visible", severityKey: "groove", severity: sev(2,4,8) },
          { key: "warping", label: "Warping present", severityKey: "warp", severity: [
            { v: "slight", label: "Slight warp (no play impact)", weight: 2 },
            { v: "moderate", label: "Moderate warp (may affect tracking)", weight: 6 },
            { v: "severe", label: "Severe warp (affects play)", weight: 12 },
          ]},
        ],
      },
      {
        title: "Audio Performance",
        fields: [
          { key: "silent_play", label: "Plays with no surface noise", weight: 0 },
          { key: "surface_noise", label: "Surface noise when played", severityKey: "noise", severity: sev(2,5,9) },
          { key: "pops_clicks", label: "Occasional pops or clicks", severityKey: "pops", severity: sev(1,3,6) },
          { key: "skips", label: "Skipping or repeating", severityKey: "skip", severity: [
            { v: "occasional", label: "Occasional skips", weight: 6 },
            { v: "frequent", label: "Frequent skipping", weight: 12 },
            { v: "constant", label: "Constant skipping", weight: 18 },
          ], extra: "skips" },
        ],
      },
      {
        title: "Label & Center",
        fields: [
          { key: "label_clean", label: "Label is clean and bright", weight: 0 },
          { key: "spindle_marks", label: "Spindle marks present", severityKey: "spindle", severity: sev(1,2,4) },
          { key: "label_writing", label: "Writing on label", severityKey: "labelwrite", severity: sev(1,3,5) },
          { key: "label_sticker", label: "Stickers or tape on label", severityKey: "labelsticker", severity: sev(1,3,5) },
        ],
      },
    ],
    packagingSections: [
      {
        title: "Overall Appearance",
        fields: [
          { key: "sleeve_nm", label: "Looks like new, no flaws", weight: 0 },
          { key: "shelf_wear", label: "Minor shelf wear only", severityKey: "shelf", severity: sev(1,2,3) },
          { key: "corner_wear", label: "Corner wear present", severityKey: "corner", severity: sev(2,4,8) },
          { key: "ring_wear", label: "Ring wear visible", severityKey: "ring", severity: sev(2,5,9) },
        ],
      },
      {
        title: "Seams & Structure",
        fields: [
          { key: "seams_ok", label: "All seams intact", weight: 0 },
          { key: "seam_splits", label: "Seam splits present", severityKey: "seamsplit", severity: sev(3,6,10) },
          { key: "spine_wear", label: "Spine shows wear", severityKey: "spine", severity: sev(1,3,6) },
        ],
      },
      {
        title: "Damage & Markings",
        fields: [
          { key: "tears", label: "Tears present", severityKey: "tears", severity: sev(3,6,10) },
          { key: "writing", label: "Writing present", severityKey: "write", severity: sev(2,4,6) },
          { key: "stickers_tape", label: "Stickers or tape", severityKey: "stape", severity: sev(1,3,5) },
          { key: "sealed", label: "Sealed (factory shrink intact)", weight: 0 },
        ],
      },
    ],
  },
  cassette: {
    mediaTitle: "📼 Tape Condition Assessment",
    packagingTitle: "📦 Case & J‑Card Assessment",
    mediaSections: [
      {
        title: "Tape Shell & Pack",
        fields: [
          { key: "shell_crack", label: "Shell crack present", severityKey: "shell", severity: sev(3,6,10) },
          { key: "pressure_pad", label: "Pressure pad missing", severityKey: "pad", severity: sev(4,8,12) },
          { key: "tape_pack", label: "Irregular tape pack / warping", severityKey: "tpack", severity: sev(2,5,8) },
        ],
      },
      {
        title: "Playback",
        fields: [
          { key: "dropouts", label: "Dropouts / hiss present", severityKey: "drop", severity: sev(2,5,8) },
          { key: "wow_flutter", label: "Wow / flutter", severityKey: "wow", severity: sev(2,5,9) },
          { key: "squeal", label: "Squeal / sticking", severityKey: "squeal", severity: sev(4,8,12) },
          { key: "channels_drop", label: "Channel(s) drop out", severityKey: "channel", severity: sev(4,8,12) },
        ],
      },
    ],
    packagingSections: [
      {
        title: "Case",
        fields: [
          { key: "case_crack", label: "Case crack", severityKey: "case", severity: sev(2,4,7) },
          { key: "hinge_broken", label: "Hinge broken", severityKey: "hinge", severity: sev(3,6,9) },
        ],
      },
      {
        title: "J‑Card",
        fields: [
          { key: "jcard_tears", label: "J‑card tears / creases", severityKey: "jcard", severity: sev(2,5,8) },
          { key: "water_damage", label: "Water damage / staining", severityKey: "water", severity: sev(3,6,10) },
          { key: "writing_stickers", label: "Writing / stickers", severityKey: "jcwrite", severity: sev(1,3,5) },
          { key: "sealed", label: "Sealed (factory shrink intact)", weight: 0 },
        ],
      },
    ],
  },
  cd: {
    mediaTitle: "💿 Disc Condition Assessment",
    packagingTitle: "📦 Jewel Case & Booklet Assessment",
    mediaSections: [
      {
        title: "Disc Surface",
        fields: [
          { key: "light_scuffs", label: "Light scuffs visible", severityKey: "cdscuff", severity: sev(1,2,4) },
          { key: "scratches", label: "Scratches present", severityKey: "cdscratch", severity: sev(3,6,12) },
          { key: "pinholes", label: "Pinholes visible", severityKey: "pinhole", severity: sev(2,4,7) },
          { key: "bronzing", label: "Bronzing / disc rot", severityKey: "bronze", severity: sev(6,10,15) },
          { key: "skips", label: "Skips or read errors", severityKey: "cdskip", severity: [
            { v: "occasional", label: "Occasional read errors", weight: 6 },
            { v: "frequent", label: "Frequent read errors", weight: 12 },
            { v: "constant", label: "Constant errors", weight: 18 },
          ], extra: "cd-skips" },
        ],
      },
    ],
    packagingSections: [
      {
        title: "Case",
        fields: [
          { key: "jewel_cracked", label: "Jewel case cracked", severityKey: "jewelcrack", severity: sev(2,4,6) },
          { key: "center_broken", label: "Center hub broken", severityKey: "hub", severity: sev(4,7,10) },
        ],
      },
      {
        title: "Booklet / Inlay",
        fields: [
          { key: "booklet_wear", label: "Booklet wear", severityKey: "bookwear", severity: sev(1,3,5) },
          { key: "booklet_tears", label: "Booklet tears", severityKey: "booktear", severity: sev(2,5,8) },
          { key: "water_damage", label: "Water damage", severityKey: "cdwater", severity: sev(3,6,10) },
          { key: "stickers_residue", label: "Stickers / residue", severityKey: "residue", severity: sev(1,3,5) },
          { key: "sealed", label: "Sealed (factory wrap intact)", weight: 0 },
        ],
      },
    ],
  },
};

// ---------- UI State ----------
type ItemState = {
  id: number;
  conditions: Record<string, boolean>;
  severities: Record<string, string>;
  skipSides?: string[];
  tracksAffected?: number;
};

const GRADE_ORDER = ["M","NM","VG+","VG","G+","G","P"] as const;
type Grade = typeof GRADE_ORDER[number];

function worse(a: Grade, b: Grade): Grade {
  return GRADE_ORDER[Math.max(GRADE_ORDER.indexOf(a), GRADE_ORDER.indexOf(b))];
}

// ---------- Component ----------
export default function Page() {
  const [kind, setKind] = useState<MediaKind>("vinyl");
  const cfg = useMemo(()=>configs[kind],[kind]);

  const [mediaOnly, setMediaOnly] = useState(false);
  const [packagingOnly, setPackagingOnly] = useState(false);

  const [items, setItems] = useState<ItemState[]>([
    { id: 1, conditions: {}, severities: {} }
  ]);
  const [packaging, setPackaging] = useState<Record<string, boolean>>({});
  const [packSev, setPackSev] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  const [mediaGrade, setMediaGrade] = useState<Grade>("VG");
  const [packagingGrade, setPackagingGrade] = useState<Grade>("VG");
  const [overallGrade, setOverallGrade] = useState<Grade>("VG");

  // ---------- Handlers (restore removed behavior) ----------
  const addItem = () => setItems(prev => [...prev, { id: (prev.at(-1)?.id ?? 0) + 1, conditions: {}, severities: {} }]);
  const removeItem = (id: number) => setItems(prev => prev.filter(i => i.id !== id));

  const toggleField = (itemId: number, field: Field, checked: boolean) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, conditions: { ...it.conditions, [field.key]: checked } } : it));
  };
  const setSeverity = (itemId: number, field: Field, v: string) => {
    if (!field.severityKey) return;
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, severities: { ...it.severities, [field.severityKey!]: v } } : it));
  };
  const setSkipSide = (itemId: number, side: string, checked: boolean) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      const s = new Set(it.skipSides ?? []);
      if (checked) s.add(side); else s.delete(side);
      return { ...it, skipSides: Array.from(s) };
    }));
  };
  const setTracks = (itemId: number, n: number) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, tracksAffected: isNaN(n) ? 0 : n } : it));
  };
  const togglePack = (key: string, checked: boolean) => {
    setPackaging(prev => ({ ...prev, [key]: checked }));
  };
  const setPackSeverity = (key: string, v: string) => {
    setPackSev(prev => ({ ...prev, [key]: v }));
  };

  // ---------- Grading (working, conservative; sealed→M gate) ----------
const scoreToGrade = (score: number, canMint: boolean): Grade => {
    // Tighter bands
    const bands: {grade: Grade; max: number}[] = [
      { grade: "M",  max: 0 },
      { grade: "NM", max: 3 },
      { grade: "VG+",max: 8 },
      { grade: "VG", max: 15 },
      { grade: "G+", max: 24 },
      { grade: "G",  max: 35 },
      { grade: "P",  max: 999 },
    ];
    for (const b of bands) {
      if (score <= b.max) return (!canMint && b.grade==="M") ? "NM" : b.grade;
    }
    return "P";
  };

  const compute = useCallback(() => {
    // Determine sealed from packaging selections
    const sealed = Object.keys(packaging).some(k => k.includes("sealed") && packaging[k]);

    // Media score
    let mScore = 0;
    const addWeight = (f: Field, item: ItemState) => {
      if (!item.conditions[f.key]) return;
      if (f.severity && f.severityKey) {
        const sel = item.severities[f.severityKey] ?? f.severity[0].v;
        const found = f.severity.find(s => s.v === sel)!.weight;
        mScore += found;
      } else {
        mScore += f.weight ?? 0;
      }
      if (f.extra === "skips" && item.tracksAffected !== undefined) {
        const sides = item.skipSides?.length ?? 0;
        mScore += Math.max(0, sides - 1) * 3;   // additional sides increase impact
        mScore += Math.min(12, item.tracksAffected ?? 0); // per-track penalty (capped)
      }
      if (f.extra === "cd-skips" && item.tracksAffected !== undefined) {
        mScore += Math.min(12, item.tracksAffected ?? 0);
      }
    };
    for (const item of items) {
      for (const section of cfg.mediaSections) {
        for (const f of section.fields) addWeight(f, item);
      }
    }

    // Packaging score
    let pScore = 0;
    for (const section of cfg.packagingSections) {
      for (const f of section.fields) {
        if (!packaging[f.key]) continue;
        if (f.severity && f.severityKey) {
          const sel = packSev[f.severityKey] ?? f.severity[0].v;
          pScore += f.severity.find(s => s.v === sel)!.weight;
        } else {
          pScore += f.weight ?? 0;
        }
      }
    }

    // Caps (conservative)
    let mediaCap: Grade | null = null;
    let packCap: Grade | null = null;
    const cap = (g: Grade) => g; // identity for readability

    if (kind === "vinyl") {
      // skips cap
      const anySkips = items.some(it => it.conditions["skips"]);
      if (anySkips) {
        const worst = items.reduce<number>((acc, it) => Math.max(acc, (it.tracksAffected ?? 0)), 0);
        mediaCap = worst >= 6 ? cap("G") : worst >= 1 ? cap("VG") : mediaCap;
      }
      // warp cap
      const anySevereWarp = items.some(it => it.severities["warp"]==="severe" && it.conditions["warping"]);
      const anyModerateWarp = items.some(it => it.severities["warp"]==="moderate" && it.conditions["warping"]);
      if (anySevereWarp) mediaCap = cap("G");
      else if (anyModerateWarp) mediaCap = mediaCap ?? cap("VG");
      // groove/scratch severe
      const severeGroove = items.some(it => it.severities["groove"]==="severe" && it.conditions["groove_wear"]);
      const severeScratch = items.some(it => it.severities["scratch"]==="severe" && it.conditions["scratches"]);
      if (severeGroove || severeScratch) mediaCap = mediaCap ?? cap("G");
    } else if (kind === "cassette") {
      const padMissing = items.some(it => it.conditions["pressure_pad"] && it.severities["pad"]!=="");
      if (padMissing) mediaCap = cap("G");
      const severePlayback = items.some(it =>
        (it.severities["squeal"]==="severe" && it.conditions["squeal"]) ||
        (it.severities["channel"]==="severe" && it.conditions["channels_drop"])
      );
      if (severePlayback) mediaCap = cap("G");
    } else if (kind === "cd") {
      const cdSkips = items.some(it => it.conditions["skips"]);
      if (cdSkips) mediaCap = cap("VG");
      const rotSevere = items.some(it => it.severities["bronze"]==="severe" && it.conditions["bronzing"]);
      if (rotSevere) mediaCap = cap("G");
    }

    // Packaging caps (shared-ish)
    const severeSplit = packaging["seam_splits"] && packSev["seamsplit"]==="severe";
    const moderateSplit = packaging["seam_splits"] && packSev["seamsplit"]==="moderate";
    if (severeSplit) packCap = cap("G");
    else if (moderateSplit) packCap = cap("VG");
    const severeWater = (packaging["water_damage"] && packSev["water"]==="severe") || (packaging["cdwater"] && packSev["cdwater"]==="severe");
    if (severeWater) packCap = cap("G");

    // Convert scores to grades
    const media = scoreToGrade(mScore, sealed);
    const pack = scoreToGrade(pScore, sealed);

    // Apply caps
    const applyCap = (g: Grade, c: Grade | null): Grade => c ? worse(g, c) : g;
    const mediaFinal = applyCap(media, mediaCap);
    const packFinal = applyCap(pack, packCap);

    // Dealer-safe overall (min of the two)
    const overall = worse(mediaFinal, packFinal);

    setMediaGrade(mediaFinal);
    setPackagingGrade(packFinal);
    setOverallGrade(overall);
  }, [cfg.mediaSections, cfg.packagingSections, items, packaging, packSev, kind]);

  useEffect(()=>{ compute(); }, [compute]);

  // ---------- Render (keeps your structure; only restores sub-criteria) ----------
  const btnStyle = (active: boolean) => ({
    background: active ? "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)" : "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
    color:"#fff", border:"none", padding:"12px 22px", borderRadius: 999, fontWeight:700, cursor:"pointer", boxShadow:"0 8px 16px rgba(0,0,0,.18)"
  });

  const card: React.CSSProperties = { background: "#fff", borderRadius: 12, padding: 18, border: "1px solid #e9ecef" };
  const h5: React.CSSProperties = { margin: "10px 0 8px", fontWeight: 700 };

  return (
    <div className="grading-shell">
      <div className="frame">
        <div className="header">
          <Link className="btn-back" href="/admin">← Back to Dashboard</Link>
          <div className="titleWrap">
            <h1>🔍 Systematic Media Grading Tool</h1>
            <p>Detailed condition assessment with automatic grading calculation</p>
          </div>
        </div>

        <div className="selector">
          <button style={btnStyle(kind==="vinyl")} onClick={()=> setKind("vinyl")}>🎵 Vinyl Records</button>
          <button style={btnStyle(kind==="cassette")} onClick={()=> setKind("cassette")}>📼 Cassette Tapes</button>
          <button style={btnStyle(kind==="cd")} onClick={()=> setKind("cd")}>💿 Compact Discs</button>
        </div>

        <div className="missing">
          <div className="left">
            <label className="chk">
              <input type="checkbox" checked={packagingOnly} onChange={()=>{ setPackagingOnly(v=>!v); if (!packagingOnly) setMediaOnly(false); }}/>
              <span>Only evaluating packaging - no disc/tape/record present</span>
            </label>
          </div>
          <div className="right">
            <label className="chk">
              <input type="checkbox" checked={mediaOnly} onChange={()=>{ setMediaOnly(v=>!v); if (!mediaOnly) setPackagingOnly(false); }}/>
              <span>Only evaluating media - no packaging present</span>
            </label>
          </div>
        </div>

        <div className="admin-media-grading" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, alignItems:"start" }}>
          {/* Left: Media */}
          <div>
            <div style={{ ...card, marginBottom: 16 }}>
              <div className="card-title">{cfg.mediaTitle}</div>

              {items.map(item => (
                <div key={item.id} style={{ background:"#fff", border:"1px solid #eef2f7", borderRadius:10, padding:12, marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ fontWeight:700 }}>Item #{item.id}</div>
                    {items.length > 1 && (
                      <button onClick={()=>removeItem(item.id)} className="btn-danger-ghost">Remove</button>
                    )}
                  </div>

                  {cfg.mediaSections.map((section, si) => (
                    <div key={si}>
                      <h5 style={h5}>{section.title}</h5>
                      {section.fields.map(field => (
                        <div key={field.key} style={{ marginBottom: 10 }}>
                          <label className="chk">
                            <input type="checkbox"
                              checked={!!item.conditions[field.key]}
                              onChange={(e)=>toggleField(item.id, field, e.target.checked)} />
                            <span>{field.label}</span>
                          </label>

                          {/* Severity & extras */}
                          {field.severity && field.severityKey && item.conditions[field.key] && (
                            <div style={{ marginLeft: 26, marginTop: 6 }}>
                              {field.severity.map(s => (
                                <label key={s.v} className="radio" style={{ marginRight: 12 }}>
                                  <input type="radio"
                                    name={`${field.severityKey}-${item.id}`}
                                    checked={(item.severities[field.severityKey] ?? field.severity![0].v) === s.v}
                                    onChange={()=>setSeverity(item.id, field, s.v)} />
                                  <span>{s.label}</span>
                                </label>
                              ))}

                              {field.extra === "skips" && (
                                <div className="skipPanel" style={{ marginTop: 8 }}>
                                  <div>
                                    <div className="lbl">Which side(s) affected</div>
                                    {["Side A","Side B","Side C","Side D"].map(side => (
                                      <label key={side} className="chk-inline" style={{ marginRight: 10 }}>
                                        <input type="checkbox"
                                          checked={(item.skipSides ?? []).includes(side)}
                                          onChange={(e)=>setSkipSide(item.id, side, e.target.checked)} />
                                        <span>{side}</span>
                                      </label>
                                    ))}
                                  </div>
                                  <div style={{ marginTop: 6 }}>
                                    <div className="lbl">Tracks affected</div>
                                    <input type="number" min={0} value={item.tracksAffected ?? 0} onChange={(e)=>setTracks(item.id, Number(e.target.value))} style={{ color:"#222", width:120 }} />
                                  </div>
                                </div>
                              )}

                              {field.extra === "cd-skips" && (
                                <div style={{ marginTop: 8 }}>
                                  <div className="lbl">Tracks affected</div>
                                  <input type="number" min={0} value={item.tracksAffected ?? 0} onChange={(e)=>setTracks(item.id, Number(e.target.value))} style={{ color:"#222", width:120 }} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}

              <button onClick={addItem} className="btn-success">+ {kind==="vinyl"?"Add Another Record":kind==="cassette"?"Add Another Tape":"Add Another Disc"}</button>
            </div>
          </div>

          {/* Right: Packaging */}
          <div>
            <div style={{ ...card }}>
              <div className="card-title">{cfg.packagingTitle}</div>

              {cfg.packagingSections.map((section, si) => (
                <div key={si} style={{ marginBottom: 10 }}>
                  <h5 style={h5}>{section.title}</h5>
                  {section.fields.map(f => (
                    <div key={f.key} style={{ marginBottom: 8 }}>
                      <label className="chk">
                        <input type="checkbox" checked={!!packaging[f.key]} onChange={(e)=>togglePack(f.key, e.target.checked)} />
                        <span>{f.label}</span>
                      </label>
                      {f.severity && f.severityKey && packaging[f.key] && (
                        <div style={{ marginLeft: 26, marginTop: 6 }}>
                          {f.severity.map(s => (
                            <label key={s.v} className="radio" style={{ marginRight: 12 }}>
                              <input type="radio"
                                name={`${f.severityKey}-sev`}
                                checked={(packSev[f.severityKey] ?? f.severity![0].v) === s.v}
                                onChange={()=>setPackSeverity(f.severityKey!, s.v)} />
                              <span>{s.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="notesCard">
          <h3>📝 Custom Condition Notes</h3>
          <textarea className="notes-textarea"
            placeholder="Add any additional condition details not covered by the checkboxes above…"
            value={notes}
            onChange={(e)=>setNotes(e.target.value)}
            style={{ color:"#222" }}
          />
          <div className="helper">Examples: &quot;Light warp does not affect play&quot;, &quot;Minor pressing flaw on track 3&quot;, &quot;Includes original poster&quot;.</div>
        </div>

        {/* Results */}
        <div className="results">
          <h3>📈 Calculated Grading Results</h3>
          <div className="grid3">
            <div className="tile">
              <div className="lbl">{kind==="vinyl"?"Record Grade":kind==="cassette"?"Tape Grade":"Disc Grade"}</div>
              <div className="val" id="media-grade">{mediaGrade}</div>
            </div>
            <div className="tile">
              <div className="lbl">{kind==="vinyl"?"Sleeve Grade":kind==="cassette"?"Case/J‑Card Grade":"Packaging Grade"}</div>
              <div className="val" id="packaging-grade">{packagingGrade}</div>
            </div>
            <div className="tile">
              <div className="lbl">Overall Grade</div>
              <div className="val" id="overall-grade">{overallGrade}</div>
            </div>
          </div>
          <div className="explain">
            <div className="hdr">Grading Explanation</div>
            <div className="txt">
              {`Sealed → Mint gate is enforced via the "Sealed" checkbox in Packaging. Unsealed items top out at NM. Playback-impact defects apply caps; overall is the worse of media vs packaging.`}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
