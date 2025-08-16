// Album Detail page ("/browse/album-detail/[id]")
// Displays album details, tracks, and allows adding a side to an event queue.

"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from 'src/lib/supabaseClient';

import Image from "next/image";
import 'styles/album-detail.css';
import 'styles/internal.css';


export default function Page() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const id = params.id;
  const eventId = searchParams.get("eventId");
  // const fromQueue = searchParams.get("fromQueue") === "true";
  const allowedFormats = searchParams.get("allowedFormats") || null;
  const eventTitle = searchParams.get("eventTitle") || null;

  const [album, setAlbum] = useState(null);
  const [side, setSide] = useState("A");
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const fetchAlbum = async () => {
      const { data, error } = await supabase
        .from("collection")
        .select("*")
        .eq("id", id)
        .single();
      if (!error) setAlbum(data);
    };
    if (id) fetchAlbum();
  }, [id]);

  // Memoized tracklist (prevents unnecessary recomputation)
  const tracklist = useMemo(() => {
    try {
      if (album && album.tracklists && album.tracklists !== "None") {
        const parsed = JSON.parse(album.tracklists);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && Array.isArray(parsed[0])) {
            return parsed;
          } else if (parsed.length > 0 && typeof parsed[0] === "object") {
            return parsed.map((t, idx) => [
              t.position || idx + 1,
              t.title || "",
              t.artist || "",
              t.duration || t.time || "",
            ]);
          }
        }
      }
    } catch {
      return [];
    }
    return [];
  }, [album]);

  // Memoized sides from tracklist
  const sides = useMemo(() => {
    if (!tracklist.length) return [];
    const rawSides = tracklist
      .map((t) => {
        const pos = Array.isArray(t) ? t[0] : t.position || "";
        const match = typeof pos === "string" && pos.match(/^([A-Za-z0-9])/);
        return match ? match[1].toUpperCase() : null;
      })
      .filter(Boolean);
    return Array.from(new Set(rawSides)).sort();
  }, [tracklist]);

  async function handleAddToQueue() {
    if (!eventId || !album) return;
    setAdding(true);
    setStatus("");

    const { data: existing, error: fetchError } = await supabase
      .from("requests")
      .select("*")
      .eq("event_id", eventId)
      .eq("album_id", album.id)
      .eq("side", side)
      .maybeSingle();

    if (fetchError) {
      setStatus("Error checking requests.");
      setAdding(false);
      return;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from("requests")
        .update({ votes: (existing.votes || 0) + 1 })
        .eq("id", existing.id);
      if (updateError) {
        setStatus("Error updating votes.");
      } else {
        setStatus("Vote added!");
      }
    } else {
      const { error: insertError } = await supabase.from("requests").insert([
        {
          artist: album.artist,
          title: album.title,
          side,
          votes: 0,
          folder: album.folder,
          year: album.year,
          format: album.format,
          album_id: album.id,
          event_id: eventId,
          status: "open",
        },
      ]);
      if (insertError) {
        setStatus("Error adding to requests.");
      } else {
        setStatus("Added to queue!");
      }
    }
    setAdding(false);
  }

  if (!album) return <div className="page-wrapper">Loading...</div>;

  const goToEvent = () => {
    if (eventId) {
      router.push(`/events/event-detail/${eventId}`);
    }
  };

  const goToBrowse = () => {
    if (eventId) {
      const params = new URLSearchParams();
      if (allowedFormats) params.set("allowedFormats", allowedFormats);
      if (eventTitle) params.set("eventTitle", eventTitle);
      params.set("eventId", eventId);
      params.set("fromQueue", "true");
      router.push(`/browse/browse-albums?${params.toString()}`);
    } else {
      router.push("/browse/browse-albums");
    }
  };

  return (
    <div className="album-detail">
      {album?.image_url && (<div className="background-blur" style={{ backgroundImage: `url(${album.image_url})` }}></div>)}
      <div
        className="album-header"
        style={{
          display: "flex",
          gap: 32,
          alignItems: "center",
          position: "relative",
        }}
      >
        <div style={{ position: "relative", width: 180, minWidth: 180 }}>
          <Image
            className="album-art"
            src={album.image_url || "/images/coverplaceholder.png"}
            alt={album.title}
            width={180}
            height={180}
            style={{
              borderRadius: 12,
              objectFit: "cover",
              boxShadow: "0 2px 12px #1116",
            }}
            unoptimized
          />
          {/* Format badge */}
          <span
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "#9333ea",
              color: "white",
              fontSize: 12,
              padding: "4px 12px",
              borderRadius: 8,
              fontWeight: 700,
              boxShadow: "0 1px 4px #0004",
            }}
          >
            {album.folder}
          </span>
        </div>
        <div className="album-info" style={{ flex: 1 }}>
          <h1 className="title text-white text-3xl font-bold">{album.title}</h1>
          <p className="artist text-gray-200 mb-2" style={{ fontSize: 20 }}>
            {album.artist} • {album.year}
          </p>
          <p className="meta text-gray-400 text-sm mb-4">
            {tracklist.length} TRACKS
          </p>
          <div
            className="queue-controls"
            style={{
              background: "rgba(38,38,56,0.75)",
              borderRadius: 12,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 1px 6px #0002",
              marginBottom: 8,
              maxWidth: 900,
              flexWrap: "wrap",
            }}
          >
            {eventId && (
              <>
                <label
                  style={{
                    color: "#fff",
                    fontWeight: 500,
                    marginRight: 6,
                    fontSize: 15,
                  }}
                >
                  Choose Side:
                </label>
                <select
                  value={side}
                  onChange={(e) => setSide(e.target.value)}
                  style={{
                    color: "#222",
                    background: "#fff",
                    borderRadius: 6,
                    padding: "5px 12px",
                    fontSize: 15,
                    marginRight: 6,
                    border: "none",
                  }}
                >
                  {sides.length > 0
                    ? sides.map((s) => (
                        <option key={s} value={s}>
                          Side {s}
                        </option>
                      ))
                    : [
                        <option key="A" value="A">
                          Side A
                        </option>,
                        <option key="B" value="B">
                          Side B
                        </option>,
                      ]}
                </select>
                <button
                  style={{
                    background: "#2563eb",
                    color: "white",
                    fontWeight: 700,
                    padding: "8px 22px",
                    borderRadius: 8,
                    border: "none",
                    fontSize: 16,
                    marginRight: 12,
                    transition: "background 0.2s",
                  }}
                  onClick={handleAddToQueue}
                  disabled={adding}
                >
                  Add to Queue
                </button>
                <span
                  style={{
                    color: status.startsWith("Error") ? "#f55" : "#3fb950",
                    fontWeight: 500,
                    fontSize: 14,
                    marginRight: 20,
                  }}
                >
                  {status}
                </span>
              </>
            )}
            <button
              onClick={goToBrowse}
              style={{
                background: "#fff",
                color: "#222",
                borderRadius: 8,
                padding: "8px 20px",
                fontWeight: 600,
                fontSize: 15,
                border: "none",
                cursor: "pointer",
                marginRight: 6,
                boxShadow: "0 1px 3px #0002",
              }}
            >
              Browse the Collection
            </button>
            {eventId && (
              <button
                onClick={goToEvent}
                style={{
                  background: "#9333ea",
                  color: "white",
                  borderRadius: 8,
                  padding: "8px 20px",
                  fontWeight: 600,
                  fontSize: 15,
                  border: "none",
                  cursor: "pointer",
                  marginRight: 6,
                  boxShadow: "0 1px 3px #0002",
                }}
              >
                Back to Event Details
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Tracklist section */}
      <div className="tracklist text-white" style={{ marginTop: 28 }}>
        <div className="tracklist-header font-bold text-sm border-b border-gray-600 pb-2 mb-2 grid grid-cols-4 gap-4">
          <span>#</span>
          <span>Title</span>
          <span>Artist</span>
          <span>Time</span>
        </div>
        {tracklist.map(([num, title, artist, time], idx) => (
          <div key={idx} className="track grid grid-cols-4 gap-4 py-1">
            <span>{num}</span>
            <span>{title}</span>
            <span>{artist}</span>
            <span>{time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
