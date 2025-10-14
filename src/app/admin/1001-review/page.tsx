"use client";

/**
 * Admin: 1001 Review
 * - Lists 1001 albums (paginated)
 * - Shows 0..n matched collection rows per 1001 album
 * - Actions: Confirm / Reject / Unlink / Link by Collection ID
 * - Buttons: Run Exact, Run Fuzzy (0.70 ±1y), Same-Artist (0.60 ±1y)
 * - Auto-refreshes after actions
 * - ESLint clean: no 'any', no unused, no console
 */

import type { ReactElement, CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase } from "src/lib/supabaseClient";

type Id = number;

type A1001 = {
  id: Id;
  artist: string;
  album: string;
  year: number | null;
  artist_norm: string | null;
  album_norm: string | null;
};

type MatchStatus = "pending" | "linked" | "confirmed" | "rejected";

type MatchRow = {
  id: Id;
  album_1001_id: Id;
  collection_id: Id;
  review_status: MatchStatus | string;
  confidence: number | null;
  notes: string | null;
};

type CollectionRow = {
  id: Id;
  artist: string | null;
  title: string | null;
  year: number | null;
  format: string | null;
  image_url: string | null;
};

type StatusFilter = "all" | "unlinked" | "linked" | "confirmed" | "rejected" | "pending";

type Toast = { kind: "info" | "ok" | "err"; msg: string };

const PAGE_SIZE = 25;

export default function Page(): ReactElement {
  const [rows, setRows] = useState<A1001[]>([]);
  const [matchesBy, setMatchesBy] = useState<Record<Id, MatchRow[]>>({});
  const [collectionsBy, setCollectionsBy] = useState<Record<Id, CollectionRow>>({});
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [linkInputs, setLinkInputs] = useState<Record<Id, string>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [running, setRunning] = useState<boolean>(false);

  const offset = useMemo(() => (page - 1) * PAGE_SIZE, [page]);

  const pushToast = useCallback((t: Toast) => {
    setToasts((ts) => [...ts, t]);
    window.setTimeout(() => setToasts((ts) => ts.slice(1)), 2500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);

    // 1) Fetch page of 1001 rows
    const { data: a1001, error: e1 } = await supabase
      .from("one_thousand_one_albums")
      .select("id, artist, album, year, artist_norm, album_norm")
      .order("artist", { ascending: true })
      .order("album", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (e1 || !a1001) {
      pushToast({ kind: "err", msg: `Failed loading 1001 list: ${e1?.message ?? "unknown error"}` });
      setRows([]);
      setMatchesBy({});
      setCollectionsBy({});
      setLoading(false);
      return;
    }

    setRows(a1001);

    // 2) Fetch matches for those 1001 ids
    const aIds = a1001.map((r) => r.id);
    if (aIds.length === 0) {
      setMatchesBy({});
      setCollectionsBy({});
      setLoading(false);
      return;
    }

    const { data: mrows, error: e2 } = await supabase
      .from("collection_1001_review")
      .select("id, album_1001_id, collection_id, review_status, confidence, notes")
      .in("album_1001_id", aIds);

    if (e2 || !mrows) {
      pushToast({ kind: "err", msg: `Failed loading matches: ${e2?.message ?? "unknown error"}` });
      setMatchesBy({});
      setCollectionsBy({});
      setLoading(false);
      return;
    }

    const by: Record<Id, MatchRow[]> = {};
    const cids = new Set<Id>();
    for (const m of mrows) {
      if (!by[m.album_1001_id]) by[m.album_1001_id] = [];
      by[m.album_1001_id].push(m);
      cids.add(m.collection_id);
    }
    setMatchesBy(by);

    // 3) Fetch collection rows referenced by matches
    let cmap: Record<Id, CollectionRow> = {};
    if (cids.size > 0) {
      const { data: crows, error: e3 } = await supabase
        .from("collection")
        .select("id, artist, title, year, format, image_url")
        .in("id", Array.from(cids));

      if (e3) {
        pushToast({ kind: "err", msg: `Failed loading collection rows: ${e3.message}` });
      } else if (crows) {
        cmap = crows.reduce<Record<Id, CollectionRow>>((acc, r) => {
          acc[r.id] = r;
          return acc;
        }, {});
      }
    }
    setCollectionsBy(cmap);
    setLoading(false);
  }, [offset, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Filter 1001 rows by match status group
  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => {
      const ms = matchesBy[r.id] ?? [];
      if (statusFilter === "unlinked") return ms.length === 0;
      if (statusFilter === "linked") return ms.some((m) => m.review_status === "linked");
      if (statusFilter === "confirmed") return ms.some((m) => m.review_status === "confirmed");
      if (statusFilter === "rejected") return ms.some((m) => m.review_status === "rejected");
      if (statusFilter === "pending") return ms.some((m) => m.review_status === "pending");
      return true;
    });
  }, [rows, matchesBy, statusFilter]);

  const setLinkInput = (albumId: Id, v: string) =>
    setLinkInputs((s) => ({ ...s, [albumId]: v }));

  const linkById = async (albumId: Id) => {
    const raw = (linkInputs[albumId] ?? "").trim();
    if (!raw) return;
    const cid = Number(raw);
    if (!Number.isFinite(cid)) {
      pushToast({ kind: "err", msg: "Collection ID must be a number" });
      return;
    }
    const { error } = await supabase
      .from("collection_1001_review")
      .insert([
        {
          album_1001_id: albumId,
          collection_id: cid,
          review_status: "linked",
          confidence: 1.0,
          notes: "manual link",
        },
      ]);
    if (error) {
      pushToast({ kind: "err", msg: `Link failed: ${error.message}` });
      return;
    }
    setLinkInputs((s) => ({ ...s, [albumId]: "" }));
    pushToast({ kind: "ok", msg: "Linked" });
    void load();
  };

  const updateStatus = async (matchId: Id, review_status: MatchStatus) => {
    const { error } = await supabase
      .from("collection_1001_review")
      .update({ review_status })
      .eq("id", matchId);
    if (error) {
      pushToast({ kind: "err", msg: `Update failed: ${error.message}` });
      return;
    }
    pushToast({ kind: "ok", msg: "Updated" });
    void load();
  };

  const unlink = async (matchId: Id) => {
    const { error } = await supabase.from("collection_1001_review").delete().eq("id", matchId);
    if (error) {
      pushToast({ kind: "err", msg: `Unlink failed: ${error.message}` });
      return;
    }
    pushToast({ kind: "ok", msg: "Unlinked" });
    void load();
  };

  const runExact = async () => {
    setRunning(true);
    const { data, error } = await supabase.rpc("match_1001_exact");
    setRunning(false);
    if (error) {
      pushToast({ kind: "err", msg: `Exact failed: ${error.message}` });
      return;
    }
    const n = Number.isFinite(Number(data)) ? Number(data) : 0;
    pushToast({ kind: "ok", msg: `Exact added ${n} link(s)` });
    void load();
  };

  const runFuzzy = async (threshold = 0.7, yearSlop = 1) => {
    setRunning(true);
    const { data, error } = await supabase.rpc("match_1001_fuzzy", {
      threshold,
      year_slop: yearSlop,
    });
    setRunning(false);
    if (error) {
      pushToast({ kind: "err", msg: `Fuzzy failed: ${error.message}` });
      return;
    }
    const n = Number.isFinite(Number(data)) ? Number(data) : 0;
    pushToast({ kind: "ok", msg: `Fuzzy added ${n} candidate(s)` });
    void load();
  };

  const runSameArtist = async (threshold = 0.6, yearSlop = 1) => {
    setRunning(true);
    const { data, error } = await supabase.rpc("match_1001_same_artist", {
      threshold,
      year_slop: yearSlop,
    });
    setRunning(false);
    if (error) {
      pushToast({ kind: "err", msg: `Same-artist failed: ${error.message}` });
      return;
    }
    const n = Number.isFinite(Number(data)) ? Number(data) : 0;
    pushToast({ kind: "ok", msg: `Same-artist added ${n} candidate(s)` });
    void load();
  };

  const tone = (s: MatchStatus | string): { bg: string; bd: string; fg: string; label: string } => {
    if (s === "confirmed") return { bg: "#dcfce7", bd: "#86efac", fg: "#065f46", label: "confirmed" };
    if (s === "rejected") return { bg: "#fee2e2", bd: "#fecaca", fg: "#991b1b", label: "rejected" };
    if (s === "linked") return { bg: "#fef3c7", bd: "#fde68a", fg: "#92400e", label: "linked" };
    if (s === "pending") return { bg: "#e5e7eb", bd: "#d1d5db", fg: "#111827", label: "pending" };
    return { bg: "#e5e7eb", bd: "#d1d5db", fg: "#111827", label: String(s) };
  };

  return (
    <div style={{ padding: 20 }}>
      {/* Toasts */}
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {toasts.map((t, i) => (
          <div
            key={`${t.kind}-${i}-${t.msg}`}
            style={{
              background: t.kind === "err" ? "#fee2e2" : t.kind === "ok" ? "#dcfce7" : "#e5e7eb",
              border: `1px solid ${t.kind === "err" ? "#fecaca" : t.kind === "ok" ? "#86efac" : "#d1d5db"}`,
              color: "#111827",
              borderRadius: 8,
              padding: "8px 12px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 6 }}>1001 Review</h1>
      <p style={{ color: "#6b7280", marginBottom: 16 }}>
        Review & curate matches. Linking/confirming updates public badges via <code>collection.is_1001</code>.
      </p>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <label style={{ fontWeight: 600, color: "#111827" }}>Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={{
            minWidth: 160,
            padding: "8px 10px",
            border: "1.5px solid #9ca3af",
            borderRadius: 6,
            background: "#ffffff",
            color: "#111827",
          }}
        >
          <option value="all">All</option>
          <option value="unlinked">Unlinked</option>
          <option value="pending">Pending</option>
          <option value="linked">Linked</option>
          <option value="confirmed">Confirmed</option>
          <option value="rejected">Rejected</option>
        </select>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => void runExact()} disabled={running} style={btn("#2563eb", running)}>
            Run Exact
          </button>
          <button onClick={() => void runFuzzy(0.7, 1)} disabled={running} style={btn("#9333ea", running)}>
            Run Fuzzy (0.70, ±1y)
          </button>
          <button
            onClick={() => void runSameArtist(0.6, 1)}
            disabled={running}
            style={btn("#0ea5e9", running)}
            title="Exact artist, fuzzy title (good for remasters/editions)"
          >
            Same-Artist (0.60, ±1y)
          </button>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={btnOutline()}
            aria-label="Previous page"
          >
            ← Prev
          </button>
          <div style={{ alignSelf: "center", color: "#374151", minWidth: 60, textAlign: "center" }}>Page {page}</div>
          <button onClick={() => setPage((p) => p + 1)} style={btnOutline()} aria-label="Next page">
            Next →
          </button>
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 12,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 1fr) minmax(360px, 1.5fr) 230px",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 700, color: "#111827" }}>1001 Album</div>
          <div style={{ fontWeight: 700, color: "#111827" }}>Matched Collection (0..n)</div>
          <div style={{ fontWeight: 700, color: "#111827" }}>Actions</div>

          {loading ? (
            <div style={{ gridColumn: "1 / -1", color: "#6b7280", padding: 12 }}>Loading…</div>
          ) : filteredRows.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", color: "#6b7280", padding: 12 }}>No rows.</div>
          ) : (
            filteredRows.map((a) => {
              const ms = matchesBy[a.id] ?? [];
              return (
                <div key={`row-${a.id}`} style={{ display: "contents" }}>
                  {/* 1001 Album */}
                  <div>
                    <div style={{ fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                      {a.artist} — {a.album}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      {a.year ?? "—"}{" "}
                      <span
                        style={{
                          marginLeft: 8,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: "#dbeafe",
                          border: "1px solid #bfdbfe",
                          color: "#1e3a8a",
                        }}
                        title="1001 Albums"
                      >
                        1001
                      </span>
                    </div>
                  </div>

                  {/* Matches */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {ms.length === 0 ? (
                      <div style={{ color: "#6b7280" }}>No matches yet.</div>
                    ) : (
                      ms.map((m) => {
                        const c = collectionsBy[m.collection_id];
                        const { bg, bd, fg, label } = tone(m.review_status);
                        return (
                          <div
                            key={m.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "64px 1fr",
                              gap: 10,
                              alignItems: "center",
                              border: "1px solid #e5e7eb",
                              borderRadius: 8,
                              padding: 8,
                            }}
                          >
                            <div>
                              <Image
                                src={
                                  c?.image_url && c.image_url.trim().toLowerCase() !== "no"
                                    ? c.image_url
                                    : "/images/coverplaceholder.png"
                                }
                                alt={c?.title || "cover"}
                                width={64}
                                height={64}
                                unoptimized
                                style={{ borderRadius: 6, objectFit: "cover" }}
                              />
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <div style={{ fontWeight: 600, color: "#111827" }}>
                                  {(c?.artist ?? "—")} — {(c?.title ?? "—")}
                                </div>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    padding: "3px 8px",
                                    borderRadius: 999,
                                    background: bg,
                                    border: `1px solid ${bd}`,
                                    color: fg,
                                  }}
                                >
                                  {label}
                                </span>
                                {typeof m.confidence === "number" && (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      padding: "3px 8px",
                                      borderRadius: 999,
                                      background: "#eef2ff",
                                      border: "1px solid #c7d2fe",
                                      color: "#3730a3",
                                    }}
                                  >
                                    conf: {m.confidence.toFixed(3)}
                                  </span>
                                )}
                              </div>
                              <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                                {(c?.year ?? "—") + (c?.format ? ` · ${c.format}` : "")}
                              </div>
                              {m.notes && (
                                <div style={{ marginTop: 4, color: "#374151", fontSize: 13 }}>
                                  Notes: <em>{m.notes}</em>
                                </div>
                              )}
                              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                <button
                                  onClick={() => void updateStatus(m.id, "confirmed")}
                                  style={btn("#16a34a")}
                                  aria-label="Confirm match"
                                >
                                  ✓ Confirm
                                </button>
                                <button
                                  onClick={() => void updateStatus(m.id, "rejected")}
                                  style={btn("#dc2626")}
                                  aria-label="Reject match"
                                >
                                  ✕ Reject
                                </button>
                                <button onClick={() => void unlink(m.id)} style={btnOutline()} aria-label="Unlink match">
                                  Unlink
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Actions */}
                  <div>
                    <div style={{ fontWeight: 700, color: "#111827", marginBottom: 8 }}>Link by Collection ID</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        value={linkInputs[a.id] ?? ""}
                        onChange={(e) => setLinkInput(a.id, e.target.value)}
                        inputMode="numeric"
                        placeholder="collection id"
                        style={{
                          width: 150,
                          padding: "8px 10px",
                          border: "1.5px solid #9ca3af",
                          borderRadius: 6,
                          background: "#ffffff",
                          color: "#111827",
                        }}
                      />
                      <button onClick={() => void linkById(a.id)} style={btn("#2563eb")} aria-label="Link collection id">
                        Link
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function btn(color: string, disabled = false): CSSProperties {
  return {
    background: color,
    color: "#ffffff",
    border: "1px solid rgba(0,0,0,0.1)",
    borderRadius: 6,
    padding: "8px 12px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
  };
}

function btnOutline(): CSSProperties {
  return {
    background: "#ffffff",
    color: "#111827",
    border: "1px solid #9ca3af",
    borderRadius: 6,
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
  };
}
