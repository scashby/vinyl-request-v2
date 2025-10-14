"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "src/lib/supabaseClient";
import Link from "next/link";
import "styles/internal.css";

/** DB shapes */
type A1001 = {
  id: number | string;
  artist: string;
  album: string;
  year: number | string | null;
  artist_norm?: string | null;
  album_norm?: string | null;
};

type MatchRow = {
  album_1001_id: number | string;
  collection_id: number | string | null;
  confirmed: boolean;
  match_method?: string | null;
  confidence?: number | null;
};

type CollectionRow = {
  id: number | string;
  artist: string | null;
  title: string | null;
  year: number | string | null;
  format?: string | null;
  image_url?: string | null;
  is_1001?: boolean | null;
};

type JoinedRow = {
  a: A1001;
  matches: Array<{ m: MatchRow; c: CollectionRow | null }>;
};

const PAGE_SIZE = 50;

export default function Admin1001ReviewPage() {
  const [status, setStatus] =
    useState<"all" | "matched" | "unmatched" | "unconfirmed">("all");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<JoinedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Minimal picker used ONLY when you click “Link”
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerForId, setPickerForId] = useState<number | string | null>(null);
  const [pickerQ, setPickerQ] = useState("");
  const [pickerResults, setPickerResults] = useState<CollectionRow[]>([]);
  const [pickerBusy, setPickerBusy] = useState(false);

  /** Load a page of 1001 rows + their matches + matched collection rows */
  useEffect(() => {
    let aborted = false;

    async function load() {
      setLoading(true);

      // Count all 1001 rows (no search gate)
      const { count, error: countErr } = await supabase
        .from("albums_1001")
        .select("id", { count: "exact", head: true });

      if (countErr) {
        console.error(countErr);
        if (!aborted) {
          setRows([]);
          setTotal(0);
          setLoading(false);
        }
        return;
      }

      const totalCount = typeof count === "number" ? count : 0;
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Pull current slice of 1001
      const { data: aRows, error: aErr } = await supabase
        .from("albums_1001")
        .select("*")
        .order("artist", { ascending: true })
        .order("album", { ascending: true })
        .range(from, to);

      if (aErr) {
        console.error(aErr);
        if (!aborted) {
          setRows([]);
          setTotal(0);
          setLoading(false);
        }
        return;
      }

      const ids = (aRows ?? []).map((r) => r.id);
      if (ids.length === 0) {
        if (!aborted) {
          setRows([]);
          setTotal(totalCount);
          setLoading(false);
        }
        return;
      }

      // All matches for these 1001 ids (may be multiple per 1001 row)
      const { data: mRows, error: mErr } = await supabase
        .from("albums_1001_match")
        .select("*")
        .in("album_1001_id", ids);

      if (mErr) {
        console.error(mErr);
      }

      // Collect all collection ids referenced by matches
      const colIds = (mRows ?? [])
        .map((m) => m.collection_id)
        .filter(
          (v): v is number | string => v !== null && v !== undefined
        );

      let cById = new Map<number | string, CollectionRow>();
      if (colIds.length > 0) {
        const { data: cRows, error: cErr } = await supabase
          .from("collection")
          .select("id, artist, title, year, format, image_url, is_1001")
          .in("id", colIds);

        if (!cErr && cRows) {
          cById = new Map(cRows.map((c) => [c.id, c]));
        }
      }

      // Group matches by album_1001_id
      const matchesBy1001 = new Map<
        number | string,
        Array<{ m: MatchRow; c: CollectionRow | null }>
      >();
      (mRows ?? []).forEach((m) => {
        const list = matchesBy1001.get(m.album_1001_id) ?? [];
        const c = m.collection_id ? cById.get(m.collection_id) ?? null : null;
        list.push({ m, c });
        matchesBy1001.set(m.album_1001_id, list);
      });

      // Compose display rows
      let composed: JoinedRow[] = (aRows ?? []).map((a) => {
        const list = matchesBy1001.get(a.id) ?? [];
        return { a: a as A1001, matches: list };
      });

      // Status filter
      if (status === "matched") {
        composed = composed.filter((r) => r.matches.length > 0);
      } else if (status === "unmatched") {
        composed = composed.filter((r) => r.matches.length === 0);
      } else if (status === "unconfirmed") {
        composed = composed.filter(
          (r) => r.matches.some(({ m }) => !m.confirmed)
        );
      }

      if (!aborted) {
        setRows(composed);
        setTotal(totalCount);
        setLoading(false);
      }
    }

    void load();
    return () => {
      aborted = true;
    };
  }, [page, status]);

  const maxPage = useMemo(
    () => Math.max(0, Math.ceil(total / PAGE_SIZE) - 1),
    [total]
  );

  /** Actions */
  async function link(album_1001_id: number | string, collection_id: number | string) {
    const { error } = await supabase
      .from("albums_1001_match")
      .insert({
        album_1001_id,
        collection_id,
        confirmed: false,
        match_method: "manual",
        confidence: 1.0,
      });

    if (error) {
      alert(`Link failed: ${error.message}`);
      return;
    }

    // Optional: mark the collection row
    await supabase.from("collection").update({ is_1001: true }).eq("id", collection_id);
    // refresh
    setPage((p) => p);
  }

  async function unlink(album_1001_id: number | string, collection_id: number | string) {
    const { error } = await supabase
      .from("albums_1001_match")
      .delete()
      .eq("album_1001_id", album_1001_id)
      .eq("collection_id", collection_id);

    if (error) {
      alert(`Unlink failed: ${error.message}`);
      return;
    }
    setPage((p) => p);
  }

  async function confirm(album_1001_id: number | string, collection_id: number | string) {
    const { error } = await supabase
      .from("albums_1001_match")
      .update({ confirmed: true })
      .eq("album_1001_id", album_1001_id)
      .eq("collection_id", collection_id);

    if (error) {
      alert(`Confirm failed: ${error.message}`);
      return;
    }
    setPage((p) => p);
  }

  /** Picker helpers */
  function openPicker(forId: number | string) {
    setPickerForId(forId);
    setPickerQ("");
    setPickerResults([]);
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
    setPickerForId(null);
    setPickerQ("");
    setPickerResults([]);
  }

  async function runPickerSearch() {
    const term = pickerQ.trim();
    if (!term) {
      setPickerResults([]);
      return;
    }
    setPickerBusy(true);
    const { data, error } = await supabase
      .from("collection")
      .select("id, artist, title, year, format, image_url, is_1001")
      .or(`artist.ilike.%${term}%,title.ilike.%${term}%`)
      .order("artist", { ascending: true })
      .order("title", { ascending: true })
      .limit(25);
    setPickerBusy(false);
    if (error) {
      alert(`Search failed: ${error.message}`);
      return;
    }
    setPickerResults(data ?? []);
  }

  /** Render */
  return (
    <div style={{ background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ padding: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 6 }}>
          1001 Review
        </h1>
        <p style={{ color: "#4b5563", marginBottom: 18 }}>
          See each 1001 album with its current collection match(es). Link, confirm, or unlink.
        </p>

        {/* Controls — high-contrast */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 14, color: "#111827" }}>Status</label>
            <select
              value={status}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setStatus(e.target.value as "all" | "matched" | "unmatched" | "unconfirmed")
              }
              style={{
                color: "#111827",
                backgroundColor: "#ffffff",
                border: "2px solid #374151",
                borderRadius: 8,
                padding: "8px 10px",
                minWidth: 190,
                fontSize: 14,
              }}
            >
              <option value="all" style={{ color: "#111827", backgroundColor: "#ffffff" }}>
                All
              </option>
              <option value="unmatched" style={{ color: "#111827", backgroundColor: "#ffffff" }}>
                Unmatched
              </option>
              <option value="matched" style={{ color: "#111827", backgroundColor: "#ffffff" }}>
                Matched
              </option>
              <option value="unconfirmed" style={{ color: "#111827", backgroundColor: "#ffffff" }}>
                Matched (Unconfirmed)
              </option>
            </select>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page <= 0 || loading}
                style={btnSecondary}
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                disabled={page >= maxPage || loading}
                style={btnSecondary}
              >
                Next →
              </button>
            </div>
          </div>
          <div style={{ marginTop: 8, color: "#6b7280", fontSize: 14 }}>
            Page {page + 1} of {Math.max(1, maxPage + 1)} • {total} total
          </div>
        </div>

        {/* Data table */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1.4fr 230px",
              background: "#f9fafb",
              padding: "10px 12px",
              fontWeight: 700,
              color: "#111827",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div>1001 Album</div>
            <div>Matched Collection (zero, one, or many)</div>
            <div>Actions</div>
          </div>

          {loading ? (
            <div style={{ padding: 24, color: "#6b7280" }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 24, color: "#6b7280" }}>No rows.</div>
          ) : (
            rows.map((r) => (
              <div
                key={String(r.a.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1.4fr 230px",
                  gap: 0,
                  padding: "12px",
                  borderTop: "1px solid #f3f4f6",
                  alignItems: "center",
                }}
              >
                {/* 1001 side */}
                <div>
                  <div style={{ fontWeight: 700, color: "#111827" }}>
                    {r.a.album} <span style={{ color: "#6b7280" }}>— {r.a.artist}</span>
                    {r.a.year ? <span style={{ color: "#6b7280" }}> · {r.a.year}</span> : null}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    id: {String(r.a.id)}
                  </div>
                </div>

                {/* matches list */}
                <div>
                  {r.matches.length === 0 ? (
                    <span style={{ color: "#ef4444", fontWeight: 600 }}>No match</span>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {r.matches.map(({ m, c }) => (
                        <li key={`${String(m.album_1001_id)}-${String(m.collection_id)}`} style={{ marginBottom: 6 }}>
                          {c ? (
                            <>
                              <strong style={{ color: "#111827" }}>{c.title}</strong>
                              <span style={{ color: "#6b7280" }}> — {c.artist}</span>
                              {c.year ? <span style={{ color: "#6b7280" }}> · {c.year}</span> : null}
                              {m.confirmed ? (
                                <span style={chipConfirmed}>confirmed</span>
                              ) : (
                                <span style={chipUnconfirmed}>unconfirmed</span>
                              )}
                              {c.is_1001 ? (
                                <span style={chip1001} title="On the 1001 list">1001</span>
                              ) : null}
                              <span style={{ color: "#9ca3af", marginLeft: 8, fontSize: 12 }}>
                                (id: {String(c.id)})
                              </span>
                            </>
                          ) : (
                            <span style={{ color: "#ef4444" }}>Missing collection row</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={btnPrimary} onClick={() => openPicker(r.a.id)}>
                    Link
                  </button>
                  {r.matches.map(({ m }) => (
                    <div key={`act-${String(m.album_1001_id)}-${String(m.collection_id)}`} style={{ display: "flex", gap: 8 }}>
                      {!m.confirmed ? (
                        <button
                          style={btnSuccess}
                          onClick={() =>
                            confirm(m.album_1001_id, m.collection_id as number | string)
                          }
                        >
                          Confirm
                        </button>
                      ) : null}
                      <button
                        style={btnWarn}
                        onClick={() =>
                          unlink(m.album_1001_id, m.collection_id as number | string)
                        }
                      >
                        Unlink
                      </button>
                      {m.collection_id ? (
                        <Link href={`/browse/album-detail/${m.collection_id}`} style={btnGhostLink}>
                          View
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Picker (Link) */}
      {pickerOpen && (
        <div
          onClick={closePicker}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(900px, 92vw)",
              maxHeight: "80vh",
              background: "#ffffff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: 14,
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <input
                autoFocus
                value={pickerQ}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPickerQ(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") void runPickerSearch();
                }}
                placeholder="Search collection by artist / title"
                style={{
                  flex: 1,
                  border: "2px solid #374151",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 16,
                  color: "#111827",
                  backgroundColor: "#ffffff",
                }}
              />
              <button onClick={runPickerSearch} disabled={pickerBusy} style={btnPrimary}>
                {pickerBusy ? "Searching…" : "Search"}
              </button>
              <button onClick={closePicker} style={btnSecondary}>
                Close
              </button>
            </div>

            <div style={{ overflow: "auto" }}>
              {pickerResults.length === 0 ? (
                <div style={{ padding: 20, color: "#6b7280" }}>
                  {pickerBusy ? "Searching…" : "No results"}
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      <th style={th}>Title — Artist</th>
                      <th style={th}>Year</th>
                      <th style={th}>Format</th>
                      <th style={th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickerResults.map((c) => (
                      <tr key={String(c.id)} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={td}>
                          <strong>{c.title}</strong>
                          <span style={{ color: "#6b7280" }}> — {c.artist}</span>
                        </td>
                        <td style={td}>{c.year ?? "—"}</td>
                        <td style={td}>{c.format ?? "—"}</td>
                        <td style={td}>
                          <button
                            style={btnSuccess}
                            onClick={async () => {
                              if (pickerForId == null) return;
                              await link(pickerForId, c.id);
                              closePicker();
                            }}
                          >
                            Link
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Buttons & chips (admin look, high-contrast) */
const btnBase: React.CSSProperties = {
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  fontWeight: 700,
  border: "2px solid transparent",
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "#3b82f6",
  color: "#ffffff",
  borderColor: "#1d4ed8",
};

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: "#f3f4f6",
  color: "#111827",
  borderColor: "#374151",
};

const btnSuccess: React.CSSProperties = {
  ...btnBase,
  background: "#10b981",
  color: "#ffffff",
  borderColor: "#059669",
};

const btnWarn: React.CSSProperties = {
  ...btnBase,
  background: "#fee2e2",
  color: "#991b1b",
  borderColor: "#ef4444",
};

const btnGhostLink: React.CSSProperties = {
  ...btnBase,
  background: "#ffffff",
  color: "#111827",
  borderColor: "#d1d5db",
  textDecoration: "none",
};

const chipConfirmed: React.CSSProperties = {
  marginLeft: 8,
  padding: "2px 6px",
  fontSize: 10,
  fontWeight: 800,
  borderRadius: 999,
  background: "#10b981",
  color: "#ffffff",
};

const chipUnconfirmed: React.CSSProperties = {
  marginLeft: 8,
  padding: "2px 6px",
  fontSize: 10,
  fontWeight: 800,
  borderRadius: 999,
  background: "#fde68a",
  color: "#92400e",
};

const chip1001: React.CSSProperties = {
  marginLeft: 8,
  padding: "2px 6px",
  fontSize: 10,
  fontWeight: 800,
  borderRadius: 999,
  background: "#111827",
  color: "#ffffff",
  border: "1px solid rgba(0,0,0,.2)",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  color: "#111827",
  borderBottom: "1px solid #e5e7eb",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 14,
  color: "#111827",
};
