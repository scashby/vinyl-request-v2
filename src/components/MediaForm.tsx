// src/components/MediaForm.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import type { MediaKind, MediaConfig, Field } from "src/app/admin/media-grading/gradingConfig";
import { configs, gradeBands } from "src/app/admin/media-grading/gradingConfig";

type ItemState = {
  id: number;
  conditions: Record<string, boolean>;
  severities: Record<string, string>;
  skipSides?: string[];
  tracksAffected?: number;
};

type Props = {
  kind: MediaKind;
  mediaOnly: boolean;
  packagingOnly: boolean;
  onGrades: (mediaGrade: string, packagingGrade: string, overallGrade: string, sealed: boolean) => void;
};

const card: React.CSSProperties = { background: "#fff", borderRadius: 12, padding: 18, border: "1px solid #e9ecef" };
const h5: React.CSSProperties = { margin: "10px 0 8px", fontWeight: 700 };

const scoreToGrade = (score: number, canMint: boolean) => {
  for (const band of gradeBands) {
    if (score <= band.max) {
      if (!canMint && band.grade === "M") continue;
      return band.grade;
    }
  }
  return "P";
};

export default function MediaForm({ kind, mediaOnly, packagingOnly, onGrades }: Props) {
  const cfg: MediaConfig = configs[kind];
  const [items, setItems] = useState<ItemState[]>([{ id: 1, conditions: {}, severities: {} }]);
  const [packaging, setPackaging] = useState<Record<string, boolean>>({});
  const [packSev, setPackSev] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  const addItem = () => setItems(prev => [...prev, { id: (prev.at(-1)?.id ?? 0) + 1, conditions: {}, severities: {} }]);
  const removeItem = (id: number) => setItems(prev => prev.filter(i => i.id !== id));

  const toggleField = (itemId: number, field: Field, checked: boolean) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, conditions: { ...it.conditions, [field.key]: checked } } : it));
    if (field.severityKey) {
      const el = document.getElementById(`${field.severityKey}-${itemId}`);
      if (el) el.style.display = checked ? "block" : "none";
    }
  };
  const setSeverity = (itemId: number, field: Field, v: string) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, severities: { ...it.severities, [field.severityKey as string]: v } } : it));
  };
  const setSkipSide = (itemId: number, side: string, checked: boolean) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      const curr = new Set(it.skipSides ?? []);
      if (checked) curr.add(side); else curr.delete(side);
      return { ...it, skipSides: Array.from(curr) };
    }));
  };
  const setTracks = (itemId: number, n: number) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, tracksAffected: isNaN(n) ? 0 : n } : it));
  };
  const togglePack = (key: string, checked: boolean) => {
    setPackaging(prev => ({ ...prev, [key]: checked }));
    const el = document.getElementById(`${key}-sev`);
    if (el) el.style.display = checked ? "block" : "none";
  };
  const setPackSeverity = (key: string, v: string) => setPackSev(prev => ({ ...prev, [key]: v }));

  const compute = useCallback(() => {
    let mediaScore = 0;
    const sealed = Object.keys(packaging).some(k => k.endsWith("sealed") && packaging[k]);

    const addWeight = (field: Field, item: ItemState) => {
      if (!item.conditions[field.key]) return;
      if (field.severity && field.severityKey) {
        const sel = item.severities[field.severityKey] ?? field.severity[0].v;
        const found = field.severity.find(s => s.v === sel)!.weight;
        mediaScore += found;
      } else {
        mediaScore += field.weight ?? 0;
      }
      if (field.extra === "skips" && item.tracksAffected !== undefined) {
        const sides = item.skipSides?.length ?? 0;
        mediaScore += Math.max(0, sides - 1) * 3;
        mediaScore += Math.min(12, item.tracksAffected ?? 0);
      }
      if (field.extra === "cd-skips" && item.tracksAffected !== undefined) {
        mediaScore += Math.min(12, item.tracksAffected ?? 0);
      }
    };

    for (const item of items) {
      for (const section of cfg.mediaSections) {
        for (const f of section.fields) addWeight(f, item);
      }
    }

    let packScore = 0;
    for (const section of cfg.packagingSections) {
      for (const f of section.fields) {
        if (!packaging[f.key]) continue;
        if (f.severity && f.severityKey) {
          const sel = packSev[`${f.severityKey}`] ?? f.severity[0].v;
          const w = f.severity.find(s => s.v === sel)!.weight;
          packScore += w;
        } else {
          packScore += f.weight ?? 0;
        }
      }
    }

    const canMint = sealed;
    const mediaGrade = scoreToGrade(mediaScore, canMint);
    const packagingGrade = scoreToGrade(packScore, canMint);

    let overall: string;
    if (sealed && mediaScore === 0 && packScore === 0) overall = "M (Sealed)";
    else if (sealed && mediaScore === 0 && packScore > 0) overall = "NM (Sealed)";
    else if (mediaOnly) overall = mediaGrade;
    else if (packagingOnly) overall = packagingGrade;
    else {
      const composite = Math.round(mediaScore * 0.7 + packScore * 0.3);
      overall = scoreToGrade(composite, false);
    }

    onGrades(mediaGrade, packagingGrade, overall, sealed);
  }, [cfg.mediaSections, cfg.packagingSections, items, packaging, packSev, mediaOnly, packagingOnly, onGrades]);

  useEffect(() => { compute(); }, [compute]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        <div>
          <div style={{ ...card, marginBottom: 16 }}>
            <div className="card-title">{configs[kind].mediaTitle}</div>
            {items.map(item => (
              <div key={item.id} style={{ background: "#fff", border: "1px solid #eef2f7", borderRadius: 10, padding: 12, marginBottom: 10 }}>
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
                        {field.severity && field.severityKey && (
                          <div id={`${field.severityKey}-${item.id}`} style={{ display:"none", marginLeft: 26, marginTop: 6 }}>
                            {field.severity.map(s => (
                              <label key={s.v} className="radio">
                                <input type="radio" name={`${field.severityKey}-${item.id}`}
                                       onChange={()=>setSeverity(item.id, field, s.v)} />
                                <span>{s.label}</span>
                              </label>
                            ))}
                            {field.extra === "skips" && (
                              <div className="skipPanel">
                                <div>
                                  <div className="lbl">Which side(s) affected</div>
                                  {["Side A","Side B","Side C","Side D"].map(side => (
                                    <label key={side} className="chk-inline">
                                      <input type="checkbox"
                                             checked={(item.skipSides ?? []).includes(side)}
                                             onChange={(e)=>setSkipSide(item.id, side, e.target.checked)} />
                                      <span>{side}</span>
                                    </label>
                                  ))}
                                </div>
                                <div>
                                  <div className="lbl">Tracks affected</div>
                                  <input type="number" value={item.tracksAffected ?? 0} onChange={(e)=>setTracks(item.id, Number(e.target.value))} />
                                </div>
                              </div>
                            )}
                            {field.extra === "cd-skips" && (
                              <div style={{ marginTop: 8 }}>
                                <div className="lbl">Tracks affected</div>
                                <input type="number" value={item.tracksAffected ?? 0} onChange={(e)=>setTracks(item.id, Number(e.target.value))} />
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
            <button onClick={()=>addItem()} className="btn-success">+ {kind==="vinyl"?"Add Another Record":kind==="cassette"?"Add Another Tape":"Add Another Disc"}</button>
          </div>
        </div>

        <div>
          <div style={{ ...card }}>
            <div className="card-title">{configs[kind].packagingTitle}</div>
            {cfg.packagingSections.map((section, si) => (
              <div key={si} style={{ marginBottom: 10 }}>
                <h5 style={h5}>{section.title}</h5>
                {section.fields.map(f => (
                  <div key={f.key} style={{ marginBottom: 8 }}>
                    <label className="chk">
                      <input type="checkbox" checked={!!packaging[f.key]} onChange={e=>togglePack(f.key, e.target.checked)} />
                      <span>{f.label}</span>
                    </label>
                    {f.severity && f.severityKey && (
                      <div id={`${f.severityKey}-sev`} style={{ display:"none", marginLeft: 26, marginTop: 6 }}>
                        {f.severity.map(s => (
                          <label key={s.v} className="radio">
                            <input type="radio" name={`${f.severityKey}-sev`} onChange={()=>setPackSeverity(`${f.severityKey}`, s.v)} />
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

      <div className="notesCard">
        <h3>📝 Custom Condition Notes</h3>
        <textarea className="notes-textarea" placeholder="Add any additional condition details not covered by the checkboxes above…" value={notes} onChange={e=>setNotes(e.target.value)} />
        <div className="helper">Examples: &quot;Light warp does not affect play&quot;, &quot;Minor pressing flaw on track 3&quot;, &quot;Includes original poster&quot;, etc.</div>
      </div>

      <div style={{ textAlign: "center", margin: "18px 0 6px" }}>
        <button onClick={compute} className="btn-primary">📊 Calculate Grades</button>
      </div>
    </div>
  );
}
