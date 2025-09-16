// src/app/admin/media-grading/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import "../../../styles/media-grading.css";
import MediaForm from "src/components/MediaForm";
import type { MediaKind } from "./gradingConfig";

export default function Page() {
  const [kind, setKind] = useState<MediaKind>("vinyl");
  const [mediaOnly, setMediaOnly] = useState(false);
  const [packagingOnly, setPackagingOnly] = useState(false);
  const [mediaGrade, setMediaGrade] = useState<string>("—");
  const [packagingGrade, setPackagingGrade] = useState<string>("—");
  const [overallGrade, setOverallGrade] = useState<string>("—");
  const [sealed, setSealed] = useState(false);

  const onGrades = (m: string, p: string, o: string, isSealed: boolean) => {
    setMediaGrade(m);
    setPackagingGrade(p);
    setOverallGrade(o);
    setSealed(isSealed);
  };

  const btn = (active: boolean) => ({ background: active ? "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)" : "linear-gradient(135deg, #3498db 0%, #2980b9 100%)", color:"#fff", border:"none", padding:"12px 22px", borderRadius: 999, fontWeight:700, cursor:"pointer", boxShadow:"0 8px 16px rgba(0,0,0,.18)" });

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
          <button style={btn(kind==="vinyl")} onClick={()=>{ setKind("vinyl")}}>🎵 Vinyl Records</button>
          <button style={btn(kind==="cassette")} onClick={()=>{ setKind("cassette")}}>📼 Cassette Tapes</button>
          <button style={btn(kind==="cd")} onClick={()=>{ setKind("cd")}}>💿 Compact Discs</button>
        </div>

        <div className="missing">
          <div className="left">
            <label className="chk">
              <input type="checkbox" checked={packagingOnly} onChange={()=>{ setPackagingOnly(v=>!v); setMediaOnly(false); }}/>
              <span>Only evaluating packaging - no disc/tape/record present</span>
            </label>
          </div>
          <div className="right">
            <label className="chk">
              <input type="checkbox" checked={mediaOnly} onChange={()=>{ setMediaOnly(v=>!v); setPackagingOnly(false); }}/>
              <span>Only evaluating media - no packaging present</span>
            </label>
          </div>
        </div>

        <div className="admin-media-grading">
          <MediaForm kind={kind} mediaOnly={mediaOnly} packagingOnly={packagingOnly} onGrades={onGrades} />
        </div>

        <div className="results">
          <h3>📈 Calculated Grading Results</h3>
          <div className="grid3">
            <div className="tile">
              <div className="lbl">{kind==="vinyl"?"Record Grade":kind==="cassette"?"Tape Grade":"Disc Grade"}</div>
              <div className="val">{mediaGrade}</div>
            </div>
            <div className="tile">
              <div className="lbl">{kind==="vinyl"?"Sleeve Grade":kind==="cassette"?"Case/J‑Card Grade":"Packaging Grade"}</div>
              <div className="val">{packagingGrade}</div>
            </div>
            <div className="tile">
              <div className="lbl">Overall Grade</div>
              <div className="val">{overallGrade}</div>
            </div>
          </div>
          <div className="explain">
            <div className="hdr">Grading Explanation</div>
            <div className="txt">
              {sealed ? "Sealed grading rules applied. Mint is possible only when sealed and no deductions are present." : "Unsealed: NM is the maximum. Weighted deductions applied based on severity and playback impact."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
