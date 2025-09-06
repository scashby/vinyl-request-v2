// src/app/browse/album-detail/[id]/page.js
"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "src/lib/supabaseClient";
import { addOrVoteRequest } from "src/lib/addOrVoteRequest";
import "styles/internal.css";
import "styles/album-detail.css";

function AlbumDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id;
  const eventId = searchParams.get("eventId");

  const [album, setAlbum] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestStatus, setRequestStatus] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const fetchAlbum = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("collection")
        .select("*")
        .eq("id", id)
        .single();
      if (error) setError(error.message);
      else setAlbum(data);
    } catch {
      setError("Failed to load album");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchEventData = useCallback(async () => {
    if (!eventId) return;
    const { data } = await supabase.from("events").select("*").eq("id", eventId).single();
    if (data) setEventData(data);
  }, [eventId]);

  useEffect(() => {
    if (id) fetchAlbum();
    if (eventId) fetchEventData();
  }, [id, eventId, fetchAlbum, fetchEventData]);

  const handleAddToQueue = async (side) => {
    if (!eventId || !album) {
      setRequestStatus(!eventId ? "No event selected" : "Album not loaded");
      return;
    }
    setSubmittingRequest(true);
    try {
      const updated = await addOrVoteRequest({
        eventId,
        albumId: id,
        side,
        artist: album.artist,
        title: album.title,
        status: "open",
        year: album.year ?? null,
        format: album.format ?? null,
        folder: album.folder ?? "Unknown",
      });
      setRequestStatus(`Queued ${album.title} — Side ${side}. Votes: x${updated?.votes ?? 1}`);
    } catch (e) {
      console.error(e);
      setRequestStatus("Failed to add to queue");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const goToEvent = () => eventId && router.push(`/events/event-detail/${eventId}`);
  const goToBrowse = () =>
    router.push(eventId ? `/browse/browse-albums?eventId=${eventId}` : "/browse/browse-albums");
  const goToQueue = () => eventId && router.push(`/browse/browse-queue?eventId=${eventId}`);

  // Tracklists: render exactly as before (position if present, else 1..N)
  const renderTracks = () => {
    const raw = album?.tracklists;
    if (!raw) return null;

    let rows = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        rows = parsed.map((t, i) => ({
          pos: t.position || String(i + 1),
          title: t.title || t.name || "Unknown Track",
          artist: t.artist || album.artist,
          duration: t.duration || "--:--",
        }));
      } else {
        throw new Error("Unexpected JSON shape");
      }
    } catch {
      const lines = String(raw).split("\n").map((l) => l.trim()).filter(Boolean);
      rows = lines.map((line, i) => ({
        pos: String(i + 1),
        title: line,
        artist: album.artist,
        duration: "--:--",
      }));
    }

    return (
      <div className="track-table">
        <div className="track head">
          <div>#</div>
          <div>Title</div>
          <div>Artist</div>
          <div>Duration</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="track">
            <div>{r.pos}</div>
            <div style={{ color: "#fff", fontWeight: 500 }}>{r.title}</div>
            <div style={{ color: "#ccc" }}>{r.artist}</div>
            <div style={{ color: "#aaa", fontSize: "14px" }}>{r.duration}</div>
          </div>
        ))}
      </div>
    );
  };

  const getAvailableSides = () => {
    const sides = new Set();
    const raw = album?.tracklists;

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((t) => {
            const p = String(t.position || "").trim();
            if (/^[A-Za-z]/.test(p)) sides.add(p[0].toUpperCase());
          });
        }
      } catch {
        const lines = String(raw).split("\n").map((l) => l.trim()).filter(Boolean);
        lines.forEach((line) => {
          const m = line.match(/^([A-Za-z])\d+/);
          if (m) sides.add(m[1].toUpperCase());
        });
      }
    }

    if (sides.size === 0 && album?.sides) {
      Object.keys(album.sides).forEach((s) => sides.add(s.toUpperCase()));
    }

    return Array.from(sides.size ? sides : new Set(["A", "B"])).sort();
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div style={{ padding: 40, textAlign: "center" }}>Loading album...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <div style={{ padding: 40, textAlign: "center", color: "red" }}>Error: {error}</div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="page-wrapper">
        <div style={{ padding: 40, textAlign: "center" }}>Album not found</div>
      </div>
    );
  }

  const imageUrl =
    album.image_url && album.image_url.toLowerCase() !== "no"
      ? album.image_url
      : "/images/coverplaceholder.png";

  return (
    <div className="album-detail">
      {eventId && (
        <div
          style={{
            position: "relative",
            zIndex: 10,
            background: "rgba(0, 0, 0, 0.8)",
            padding: "12px 24px",
            paddingLeft: "60px",
            display: "flex",
            gap: "16px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={goToBrowse}
            style={{
              background: "#059669",
              color: "white",
              border: "none",
              borderRadius: "6px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            ← Browse Collection
          </button>

          <button
            onClick={goToQueue}
            style={{
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            🎵 View Queue
          </button>

          <button
            onClick={goToEvent}
            style={{
              background: "#9333ea",
              color: "white",
              border: "none",
              borderRadius: "6px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            📅 Event Details
          </button>

          {eventData && (
            <span style={{ color: "#fff", fontSize: "14px", marginLeft: "auto", opacity: 0.9 }}>
              Event: {eventData.title}
            </span>
          )}
        </div>
      )}

      <div className="album-header">
        <Image
          src={imageUrl}
          alt={`${album.artist} - ${album.title}`}
          width={200}
          height={200}
          className="album-art"
          unoptimized
        />

        <div className="album-info">
          <h1 className="title">{album.title}</h1>
          <h2 className="artist">{album.artist}</h2>

          <div className="meta">
            {album.year && <span>Year: {album.year} • </span>}
            {album.format && <span>Format: {album.format} • </span>}
            {album.folder && <span>Category: {album.folder}</span>}
          </div>

          {album.media_condition && (
            <div className="meta" style={{ marginTop: "8px" }}>
              Condition: {album.media_condition}
            </div>
          )}

          {album.folder && <span className="badge">{album.folder}</span>}

          {eventId && (
            <div style={{ marginTop: "20px" }}>
              <h3 style={{ color: "#fff", marginBottom: "12px", fontSize: "18px" }}>
                Add to Event Queue:
              </h3>
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                {getAvailableSides().map((side, index) => (
                  <button
                    key={side}
                    onClick={() => handleAddToQueue(side)}
                    disabled={submittingRequest}
                    style={{
                      background:
                        index % 4 === 0
                          ? "#3b82f6"
                          : index % 4 === 1
                          ? "#10b981"
                          : index % 4 === 2
                          ? "#f59e0b"
                          : "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      padding: "12px 24px",
                      cursor: submittingRequest ? "not-allowed" : "pointer",
                      fontSize: 16,
                      fontWeight: "bold",
                      opacity: submittingRequest ? 0.7 : 1,
                    }}
                  >
                    Side {side}
                  </button>
                ))}
              </div>

              {requestStatus && (
                <p
                  style={{
                    color: requestStatus.includes("Error") ? "#ef4444" : "#10b981",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  {requestStatus}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="album-tracks">
        <h3>Tracks</h3>
        {renderTracks()}
      </div>
    </div>
  );
}

export default function AlbumDetailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AlbumDetailContent />
    </Suspense>
  );
}
