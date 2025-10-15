"use client";

/**
 * Admin: 1001 Review - COMPACT SPREADSHEET DESIGN
 * Exception-focused interface for matching collection albums to 1001 list
 */

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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

type MatchStatus = "pending" | "linked" | "confirmed";

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

type StatusFilter = "unmatched" | "pending" | "confirmed" | "all";

type Toast = { kind: "info" | "ok" | "err"; msg: string };

export default function Page(): ReactElement {
  const [rows, setRows] = useState<A1001[]>([]);
  const [matchesBy, setMatchesBy] = useState<Record<Id, MatchRow[]>>({});
  const [collectionsBy, setCollectionsBy] = useState<Record<Id, CollectionRow>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("unmatched");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [running, setRunning] = useState<boolean>(false);
  const [searchInputs, setSearchInputs] = useState<Record<Id, string>>({});
  const [searchResults, setSearchResults] = useState<Record<Id, CollectionRow[]>>({});
  const [searchLoading, setSearchLoading] = useState<Record<Id, boolean>>({});
  const searchTimeouts = useRef<Record<Id, NodeJS.Timeout>>({});
  const [hasAutoMatchedSession, setHasAutoMatchedSession] = useState(false);
  const albumRefs = useRef<Record<Id, HTMLDivElement | null>>({});
  const [expandedAlbums, setExpandedAlbums] = useState<Record<Id, boolean>>({});

  const pushToast = useCallback((t: Toast) => {
    setToasts((ts) => [...ts, t]);
    window.setTimeout(() => setToasts((ts) => ts.slice(1)), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);

    // Fetch albums in two batches to bypass 1000-row limit
    const { data: batch1, error: e1a } = await supabase
      .from("one_thousand_one_albums")
      .select("id, artist, album, year, artist_norm, album_norm")
      .order("artist", { ascending: true })
      .order("album", { ascending: true })
      .range(0, 999);

    const { data: batch2, error: e1b } = await supabase
      .from("one_thousand_one_albums")
      .select("id, artist, album, year, artist_norm, album_norm")
      .order("artist", { ascending: true })
      .order("album", { ascending: true })
      .range(1000, 1999);

    if ((e1a && !batch1) || (e1b && !batch2)) {
      pushToast({ kind: "err", msg: `Failed loading 1001 list` });
      setRows([]);
      setMatchesBy({});
      setCollectionsBy({});
      setLoading(false);
      return;
    }

    const a1001 = [...(batch1 || []), ...(batch2 || [])];

    setRows(a1001);

    // Fetch matches
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

    // Fetch collection rows
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
  }, [pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const runExact = useCallback(async () => {
    setRunning(true);
    const { data, error } = await supabase.rpc("match_1001_exact");
    setRunning(false);
    if (error) {
      pushToast({ kind: "err", msg: `Exact match failed: ${error.message}` });
      return;
    }
    const n = Number.isFinite(Number(data)) ? Number(data) : 0;
    pushToast({ kind: "ok", msg: `Found ${n} exact match${n !== 1 ? "es" : ""}` });
    await load();
  }, [pushToast, load]);

  const runFuzzy = useCallback(async (threshold = 0.7, yearSlop = 1) => {
    setRunning(true);
    const { data, error } = await supabase.rpc("match_1001_fuzzy", {
      threshold: parseFloat(threshold.toString()),
      year_slop: parseInt(yearSlop.toString()),
    });
    setRunning(false);
    if (error) {
      pushToast({ kind: "err", msg: `Fuzzy match failed: ${error.message}` });
      return;
    }
    const n = Number.isFinite(Number(data)) ? Number(data) : 0;
    pushToast({ kind: "ok", msg: `Found ${n} fuzzy match${n !== 1 ? "es" : ""}` });
    await load();
  }, [pushToast, load]);

  const runSameArtist = useCallback(async (threshold = 0.6, yearSlop = 1) => {
    setRunning(true);
    const { data, error } = await supabase.rpc("match_1001_same_artist", {
      threshold: parseFloat(threshold.toString()),
      year_slop: parseInt(yearSlop.toString()),
    });
    setRunning(false);
    if (error) {
      pushToast({ kind: "err", msg: `Same-artist match failed: ${error.message}` });
      return;
    }
    const n = Number.isFinite(Number(data)) ? Number(data) : 0;
    pushToast({ kind: "ok", msg: `Found ${n} same-artist match${n !== 1 ? "es" : ""}` });
    await load();
  }, [pushToast, load]);

  // Auto-match only once when page first opens
  useEffect(() => {
    if (hasAutoMatchedSession) return;
    if (loading || running || rows.length === 0) return;

    const unmatched = rows.filter((r) => {
      const ms = matchesBy[r.id] ?? [];
      return ms.length === 0;
    });

    if (unmatched.length > 0) {
      setHasAutoMatchedSession(true);
      pushToast({ kind: "info", msg: `Found ${unmatched.length} unmatched albums. Running auto-match...` });
      setTimeout(() => {
        void runExact();
      }, 500);
    }
  }, [rows, matchesBy, loading, running, pushToast, runExact, hasAutoMatchedSession]);

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      const ms = matchesBy[r.id] ?? [];
      if (statusFilter === "all") return true;
      if (statusFilter === "unmatched") return ms.length === 0;
      if (statusFilter === "pending")
        return ms.some((m) => m.review_status === "pending" || m.review_status === "linked");
      if (statusFilter === "confirmed") return ms.some((m) => m.review_status === "confirmed");
      return true;
    });

    // For "All Albums" tab, sort alphabetically by artist
    if (statusFilter === "all") {
      return filtered.sort((a, b) => {
        const artistA = (a.artist || "").toLowerCase();
        const artistB = (b.artist || "").toLowerCase();
        return artistA.localeCompare(artistB);
      });
    }

    // For other tabs, sort: pending first, then unmatched, then confirmed last
    return filtered.sort((a, b) => {
      const aMatches = matchesBy[a.id] ?? [];
      const bMatches = matchesBy[b.id] ?? [];

      const aHasPending = aMatches.some((m) => m.review_status === "pending" || m.review_status === "linked");
      const bHasPending = bMatches.some((m) => m.review_status === "pending" || m.review_status === "linked");
      const aUnmatched = aMatches.length === 0;
      const bUnmatched = bMatches.length === 0;
      const aConfirmed = aMatches.length > 0 && aMatches.every((m) => m.review_status === "confirmed");
      const bConfirmed = bMatches.length > 0 && bMatches.every((m) => m.review_status === "confirmed");

      // Pending first
      if (aHasPending && !bHasPending) return -1;
      if (!aHasPending && bHasPending) return 1;

      // Then unmatched
      if (aUnmatched && !bUnmatched) return -1;
      if (!aUnmatched && bUnmatched) return 1;

      // Confirmed last
      if (aConfirmed && !bConfirmed) return 1;
      if (!aConfirmed && bConfirmed) return -1;

      return 0;
    });
  }, [rows, matchesBy, statusFilter]);

  const updateStatus = async (matchId: Id, albumId: Id, review_status: MatchStatus) => {
    const { error } = await supabase
      .from("collection_1001_review")
      .update({ review_status })
      .eq("id", matchId);
    if (error) {
      pushToast({ kind: "err", msg: `Update failed: ${error.message}` });
      return;
    }
    pushToast({ kind: "ok", msg: "Confirmed!" });
    await load();
    setTimeout(() => {
      albumRefs.current[albumId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const deleteMatch = async (matchId: Id, albumId: Id) => {
    const { error } = await supabase.from("collection_1001_review").delete().eq("id", matchId);
    if (error) {
      pushToast({ kind: "err", msg: `Delete failed: ${error.message}` });
      return;
    }
    pushToast({ kind: "ok", msg: "Removed" });
    await load();
    setTimeout(() => {
      albumRefs.current[albumId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const searchCollection = async (albumId: Id, query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults((s) => ({ ...s, [albumId]: [] }));
      return;
    }

    setSearchLoading((s) => ({ ...s, [albumId]: true }));

    const { data, error } = await supabase
      .from("collection")
      .select("id, artist, title, year, format, image_url")
      .or(`artist.ilike.%${query}%,title.ilike.%${query}%`)
      .order("artist", { ascending: true })
      .limit(20);

    setSearchLoading((s) => ({ ...s, [albumId]: false }));

    if (error) {
      pushToast({ kind: "err", msg: `Search failed: ${error.message}` });
      return;
    }

    setSearchResults((s) => ({ ...s, [albumId]: data || [] }));
  };

  const handleSearchInput = (albumId: Id, value: string) => {
    setSearchInputs((s) => ({ ...s, [albumId]: value }));

    if (searchTimeouts.current[albumId]) {
      clearTimeout(searchTimeouts.current[albumId]);
    }

    searchTimeouts.current[albumId] = setTimeout(() => {
      void searchCollection(albumId, value);
    }, 300);
  };

  const linkFromSearch = async (albumId: Id, collectionId: Id) => {
    const { error } = await supabase.from("collection_1001_review").insert([
      {
        album_1001_id: albumId,
        collection_id: collectionId,
        review_status: "confirmed",
        confidence: 1.0,
        notes: "manual link via search",
      },
    ]);

    if (error) {
      pushToast({ kind: "err", msg: `Link failed: ${error.message}` });
      return;
    }

    setSearchInputs((s) => ({ ...s, [albumId]: "" }));
    setSearchResults((s) => ({ ...s, [albumId]: [] }));
    pushToast({ kind: "ok", msg: "Linked & Confirmed!" });
    await load();
    setTimeout(() => {
      albumRefs.current[albumId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const getCounts = () => {
    const unmatched = rows.filter((r) => (matchesBy[r.id] ?? []).length === 0).length;
    const pending = rows.filter((r) =>
      (matchesBy[r.id] ?? []).some((m) => m.review_status === "pending" || m.review_status === "linked")
    ).length;
    const confirmed = rows.filter((r) => (matchesBy[r.id] ?? []).some((m) => m.review_status === "confirmed"))
      .length;
    return { unmatched, pending, confirmed };
  };

  const counts = getCounts();

  const toggleExpanded = (albumId: Id) => {
    setExpandedAlbums((prev) => ({ ...prev, [albumId]: !prev[albumId] }));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "24px 16px" }}>
      {/* Toast Notifications */}
      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxWidth: 400,
        }}
      >
        {toasts.map((t, i) => (
          <div
            key={`${t.kind}-${i}-${t.msg}`}
            style={{
              background: t.kind === "err" ? "#fee2e2" : t.kind === "ok" ? "#d1fae5" : "#dbeafe",
              border: `2px solid ${t.kind === "err" ? "#f87171" : t.kind === "ok" ? "#34d399" : "#60a5fa"}`,
              color: t.kind === "err" ? "#991b1b" : t.kind === "ok" ? "#065f46" : "#1e40af",
              borderRadius: 10,
              padding: "14px 18px",
              fontWeight: 600,
              fontSize: 14,
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#111827", marginBottom: 8, letterSpacing: "-0.02em" }}>
            1001 Albums Review
          </h1>
          <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.5 }}>
            Match albums from your collection to the <strong>1001 Albums You Must Hear Before You Die</strong> list.
          </p>
        </div>

        {/* Sticky Controls */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "#ffffff",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            border: "1px solid #e5e7eb",
          }}
        >
          {/* Filter Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {[
              { value: "unmatched", label: "Need Attention", count: counts.unmatched, color: "#ef4444", bg: "#fef2f2" },
              { value: "pending", label: "Pending Review", count: counts.pending, color: "#f59e0b", bg: "#fffbeb" },
              { value: "confirmed", label: "Confirmed", count: counts.confirmed, color: "#10b981", bg: "#f0fdf4" },
              { value: "all", label: "All Albums", count: rows.length, color: "#6b7280", bg: "#f9fafb" },
            ].map((tab) => {
              const isActive = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value as StatusFilter)}
                  style={{
                    flex: "1 1 auto",
                    minWidth: 120,
                    padding: "10px 16px",
                    border: isActive ? `2px solid ${tab.color}` : "2px solid #e5e7eb",
                    borderRadius: 8,
                    background: isActive ? tab.bg : "#ffffff",
                    color: isActive ? tab.color : "#6b7280",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      background: isActive ? tab.color : "#d1d5db",
                      color: "#ffffff",
                      borderRadius: 999,
                      padding: "2px 8px",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Batch Actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => void runExact()}
              disabled={running}
              style={{
                padding: "8px 14px",
                background: running ? "#9ca3af" : "#3b82f6",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                cursor: running ? "not-allowed" : "pointer",
                opacity: running ? 0.6 : 1,
              }}
            >
              {running ? "Running..." : "Run Exact Match"}
            </button>
            <button
              onClick={() => void runFuzzy(0.7, 1)}
              disabled={running}
              style={{
                padding: "8px 14px",
                background: running ? "#9ca3af" : "#8b5cf6",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                cursor: running ? "not-allowed" : "pointer",
                opacity: running ? 0.6 : 1,
              }}
            >
              Run Fuzzy (0.70, ±1y)
            </button>
            <button
              onClick={() => void runSameArtist(0.6, 1)}
              disabled={running}
              style={{
                padding: "8px 14px",
                background: running ? "#9ca3af" : "#06b6d4",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                cursor: running ? "not-allowed" : "pointer",
                opacity: running ? 0.6 : 1,
              }}
              title="Exact artist match, fuzzy title match"
            >
              Same-Artist (0.60, ±1y)
            </button>
          </div>
        </div>

        {/* Table Header */}
        {!loading && filteredRows.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "50px 1fr 1fr 70px 120px 100px 150px",
              gap: 12,
              padding: "12px 16px",
              background: "#f9fafb",
              borderRadius: 8,
              marginBottom: 8,
              fontSize: 12,
              fontWeight: 700,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <div></div>
            <div>Artist</div>
            <div>Album</div>
            <div>Year</div>
            <div>Status</div>
            <div>Matches</div>
            <div>Actions</div>
          </div>
        )}

        {/* Albums List - Compact Table */}
        {loading ? (
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              padding: 40,
              textAlign: "center",
              color: "#6b7280",
              fontSize: 15,
            }}
          >
            Loading albums...
          </div>
        ) : filteredRows.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              padding: 40,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 6 }}>All done!</div>
            <div style={{ color: "#6b7280", fontSize: 14 }}>
              {statusFilter === "unmatched"
                ? "No unmatched albums. Switch to another tab to see matched albums."
                : "No albums in this category."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {filteredRows.map((album) => {
              const matches = matchesBy[album.id] ?? [];
              const isUnmatched = matches.length === 0;
              const hasPending = matches.some((m) => m.review_status === "pending" || m.review_status === "linked");
              const allConfirmed = matches.length > 0 && matches.every((m) => m.review_status === "confirmed");
              const isExpanded = expandedAlbums[album.id] ?? hasPending;
              
              // Debug logging for Led Zeppelin I
              if (album.artist === "Led Zeppelin" && album.album === "Led Zeppelin I") {
                console.log("Led Zep I - Tab:", statusFilter, "matches:", matches, "hasPending:", hasPending, "expandedAlbums value:", expandedAlbums[album.id], "isExpanded:", isExpanded);
              }
              return (
                <div
                  key={album.id}
                  ref={(el) => {
                    albumRefs.current[album.id] = el;
                  }}
                  style={{
                    background: "#ffffff",
                    border: isUnmatched
                      ? "2px solid #fca5a5"
                      : hasPending
                      ? "2px solid #fbbf24"
                      : "1px solid #e5e7eb",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  {/* Main Row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "50px 1fr 1fr 70px 120px 100px 150px",
                      gap: 12,
                      padding: "12px 16px",
                      alignItems: "center",
                      cursor: matches.length > 0 || isUnmatched ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (matches.length > 0 || isUnmatched) toggleExpanded(album.id);
                    }}
                  >
                    {/* Badge */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ textAlign: "center", color: "#ffffff" }}>
                        <div style={{ fontSize: 11, fontWeight: 900, lineHeight: 1 }}>1001</div>
                      </div>
                    </div>

                    {/* Artist */}
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#111827",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {album.artist}
                    </div>

                    {/* Album */}
                    <div
                      style={{
                        fontSize: 14,
                        color: "#374151",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {album.album}
                    </div>

                    {/* Year */}
                    <div style={{ fontSize: 13, color: "#6b7280" }}>{album.year ?? "—"}</div>

                    {/* Status */}
                    <div>
                      {isUnmatched && (
                        <span
                          style={{
                            background: "#fee2e2",
                            color: "#991b1b",
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}
                        >
                          Unmatched
                        </span>
                      )}
                      {hasPending && (
                        <span
                          style={{
                            background: "#fef3c7",
                            color: "#92400e",
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}
                        >
                          Pending
                        </span>
                      )}
                      {allConfirmed && (
                        <span
                          style={{
                            background: "#d1fae5",
                            color: "#065f46",
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          Confirmed
                        </span>
                      )}
                    </div>

                    {/* Matches Count */}
                    <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>
                      {matches.length > 0 ? `${matches.length} pressing${matches.length > 1 ? "s" : ""}` : "—"}
                    </div>

                    {/* Expand/Collapse */}
                    <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>
                      {(matches.length > 0 || isUnmatched) && (isExpanded ? "▼ Collapse" : "▶ Expand")}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: "16px",
                        background: "#f9fafb",
                        borderTop: "1px solid #e5e7eb",
                      }}
                    >
                      {/* Search Box */}
                      {(isUnmatched || allConfirmed) && (
                        <div style={{ marginBottom: matches.length > 0 ? 16 : 0 }}>
                          <label
                            style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}
                          >
                            Search your collection to link:
                          </label>
                          <div style={{ position: "relative" }}>
                            <input
                              value={searchInputs[album.id] ?? ""}
                              onChange={(e) => handleSearchInput(album.id, e.target.value)}
                              placeholder={`Try "${album.artist}" or "${album.album}"`}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                border: "2px solid #d1d5db",
                                borderRadius: 6,
                                fontSize: 14,
                                outline: "none",
                                transition: "border-color 0.2s",
                                color: "#111827",
                                backgroundColor: "#ffffff",
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = "#3b82f6";
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = "#d1d5db";
                              }}
                            />
                            {searchLoading[album.id] && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "100%",
                                  left: 0,
                                  right: 0,
                                  marginTop: 6,
                                  padding: 10,
                                  background: "#f9fafb",
                                  border: "2px solid #e5e7eb",
                                  borderRadius: 6,
                                  color: "#6b7280",
                                  fontSize: 13,
                                }}
                              >
                                Searching...
                              </div>
                            )}
                            {searchResults[album.id] && searchResults[album.id].length > 0 && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "100%",
                                  left: 0,
                                  right: 0,
                                  marginTop: 6,
                                  background: "#ffffff",
                                  border: "2px solid #e5e7eb",
                                  borderRadius: 6,
                                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                                  maxHeight: 300,
                                  overflowY: "auto",
                                  zIndex: 10,
                                }}
                              >
                                {searchResults[album.id].map((result) => (
                                  <div
                                    key={result.id}
                                    onClick={() => void linkFromSearch(album.id, result.id)}
                                    style={{
                                      display: "flex",
                                      gap: 10,
                                      padding: 10,
                                      cursor: "pointer",
                                      borderBottom: "1px solid #f3f4f6",
                                      transition: "background 0.2s",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = "#f9fafb";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = "#ffffff";
                                    }}
                                  >
                                    <Image
                                      src={
                                        result.image_url && result.image_url.trim().toLowerCase() !== "no"
                                          ? result.image_url
                                          : "/images/coverplaceholder.png"
                                      }
                                      alt={result.title || "cover"}
                                      width={40}
                                      height={40}
                                      unoptimized
                                      style={{ borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontWeight: 700,
                                          fontSize: 13,
                                          color: "#111827",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {result.artist || "Unknown Artist"}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 12,
                                          color: "#6b7280",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {result.title || "Unknown Title"}
                                      </div>
                                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                                        {result.year || "—"} • {result.format || "—"}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {searchInputs[album.id] &&
                              searchResults[album.id] &&
                              searchResults[album.id].length === 0 &&
                              !searchLoading[album.id] && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    right: 0,
                                    marginTop: 6,
                                    padding: 10,
                                    background: "#fef2f2",
                                    border: "2px solid #fecaca",
                                    borderRadius: 6,
                                    color: "#991b1b",
                                    fontSize: 13,
                                  }}
                                >
                                  No matches found. Try different search terms.
                                </div>
                              )}
                          </div>
                        </div>
                      )}

                      {/* Matched Albums */}
                      {matches.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {matches.map((match) => {
                            const collection = collectionsBy[match.collection_id];
                            const isConfirmed = match.review_status === "confirmed";
                            return (
                              <div
                                key={match.id}
                                style={{
                                  display: "flex",
                                  gap: 12,
                                  padding: 12,
                                  background: isConfirmed ? "#f0fdf4" : "#fffbeb",
                                  border: `2px solid ${isConfirmed ? "#86efac" : "#fde68a"}`,
                                  borderRadius: 6,
                                  alignItems: "center",
                                }}
                              >
                                <Image
                                  src={
                                    collection?.image_url && collection.image_url.trim().toLowerCase() !== "no"
                                      ? collection.image_url
                                      : "/images/coverplaceholder.png"
                                  }
                                  alt={collection?.title || "cover"}
                                  width={50}
                                  height={50}
                                  unoptimized
                                  style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                                    <div
                                      style={{
                                        fontWeight: 700,
                                        fontSize: 14,
                                        color: "#111827",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {collection?.artist || "Unknown"} — {collection?.title || "Unknown"}
                                    </div>
                                    <span
                                      style={{
                                        background: isConfirmed ? "#10b981" : "#f59e0b",
                                        color: "#ffffff",
                                        padding: "2px 6px",
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      {isConfirmed ? "Confirmed" : "Pending"}
                                    </span>
                                    {typeof match.confidence === "number" && (
                                      <span
                                        style={{
                                          background: "#eef2ff",
                                          color: "#4f46e5",
                                          padding: "2px 6px",
                                          borderRadius: 4,
                                          fontSize: 10,
                                          fontWeight: 700,
                                        }}
                                      >
                                        {(match.confidence * 100).toFixed(0)}%
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                                    {collection?.year || "—"} • {collection?.format || "—"}
                                  </div>
                                  {match.notes && (
                                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, fontStyle: "italic" }}>
                                      {match.notes}
                                    </div>
                                  )}
                                </div>
                                {!isConfirmed && (
                                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                    <button
                                      onClick={() => void updateStatus(match.id, album.id, "confirmed")}
                                      style={{
                                        padding: "6px 12px",
                                        background: "#10b981",
                                        color: "#ffffff",
                                        border: "none",
                                        borderRadius: 6,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      ✓ Confirm
                                    </button>
                                    <button
                                      onClick={() => void deleteMatch(match.id, album.id)}
                                      style={{
                                        padding: "6px 12px",
                                        background: "#ef4444",
                                        color: "#ffffff",
                                        border: "none",
                                        borderRadius: 6,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      ✕ Remove
                                    </button>
                                  </div>
                                )}
                                {isConfirmed && (
                                  <button
                                    onClick={() => void deleteMatch(match.id, album.id)}
                                    style={{
                                      padding: "6px 12px",
                                      background: "#ffffff",
                                      color: "#6b7280",
                                      border: "2px solid #d1d5db",
                                      borderRadius: 6,
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Unlink
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}