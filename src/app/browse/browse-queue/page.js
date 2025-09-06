// Browse Queue page — clean table version with fixed alignment
// File: src/app/browse/browse-queue/page.js

"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import AlbumSuggestionBox from "components/AlbumSuggestionBox";
import { supabase } from "src/lib/supabaseClient";
import "styles/internal.css";
import "styles/browse-queue.css";

function BrowseQueueContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");

  const [queueItems, setQueueItems] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);

  const loadEventAndQueue = useCallback(async () => {
    try {
      if (!eventId) {
        setEventData({
          id: "placeholder",
          title: "Event Name Placeholder",
          date: "June 2, 2025",
          image_url: "/images/event-header-still.jpg",
        });
        setQueueItems([
          { id: 1, artist: "Pink Floyd", title: "The Dark Side of the Moon", side: "A", votes: 4, created_at: new Date().toISOString() },
          { id: 2, artist: "The Beatles", title: "Abbey Road", side: "B", votes: 5, created_at: new Date().toISOString() },
        ]);
        setLoading(false);
        return;
      }

      const { data: event } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();
      setEventData(event || null);

      const { data: requests } = await supabase
        .from("requests")
        .select("*")
        .eq("event_id", eventId)
        .order("id", { ascending: true });

      if (!requests?.length) {
        setQueueItems([]);
        return;
      }

      const albumIds = requests.map(r => r.album_id).filter(Boolean);
      let albums = [];

      if (albumIds.length) {
        const res = await supabase
          .from("collection")
          .select("id, artist, title, image_url, year, format")
          .in("id", albumIds);
        albums = res.data || [];
      }

      const mapped = requests.map(req => {
        const album = albums.find(a => a.id === req.album_id);
        return {
          id: req.id,
          artist: req.artist || album?.artist || "",
          title: req.title || album?.title || "",
          side: req.side || "A",
          votes: req.votes ?? 1,
          created_at: req.created_at,
          collection: album
            ? { id: album.id, image_url: album.image_url, year: album.year, format: album.format }
            : null,
        };
      });

      mapped.sort((a, b) => (b.votes !== a.votes ? b.votes - a.votes : new Date(a.created_at) - new Date(b.created_at)));
      setQueueItems(mapped);
    } catch (e) {
      console.error("Error loading event and queue:", e);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEventAndQueue();
  }, [loadEventAndQueue]);

  const voteForItem = async (itemId) => {
    try {
      const currentItem = queueItems.find(item => item.id === itemId);
      const newVotes = (currentItem?.votes ?? 1) + 1;

      const { error } = await supabase.from("requests").update({ votes: newVotes }).eq("id", itemId);
      if (!error) {
        setQueueItems(prev =>
          prev
            .map(item => (item.id === itemId ? { ...item, votes: newVotes } : item))
            .sort((a, b) => (b.votes !== a.votes ? b.votes - a.votes : new Date(a.created_at) - new Date(b.created_at)))
        );
      }
    } catch (e) {
      console.error("Error voting:", e);
    }
  };

  const formatDate = (dateString) =>
    dateString
      ? new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "";

  if (loading) {
    return (
      <div className="page-wrapper" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400, color: "#666", fontSize: 18 }}>
        Loading event queue...
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <div style={{ textAlign: "center" }}>
            <h1>{eventData?.title || "Event Queue"}</h1>
            {eventData?.date && <p style={{ fontSize: 18, opacity: 0.9, margin: "16px 0 0", fontWeight: 500 }}>{formatDate(eventData.date)}</p>}
          </div>
        </div>
      </header>

      <main className="page-body browse-queue">
        <aside className="event-sidebar">
          <article className="event-card">
            <Image
              src={eventData?.image_url || "/images/event-header-still.jpg"}
              alt={eventData?.title || "Event"}
              className="card-square"
              width={250}
              height={250}
              priority
              unoptimized
            />
            <h2>{eventData?.title || "Event Name"}</h2>
            <p>{eventData?.date ? formatDate(eventData.date) : "Date TBD"}</p>
          </article>
        </aside>

        <section className="queue-display">
          {/* Header w/ stats & actions (kept) */}
          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <h3 style={{ margin: 0, marginBottom: 16, fontSize: "1.5rem", fontWeight: 700, color: "#1f2937" }}>Current Queue</h3>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 24, fontSize: 14, color: "#6b7280", fontWeight: 500, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>📀</span> {queueItems.length} requests
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🗳️</span> {queueItems.reduce((sum, i) => sum + (i.votes ?? 0), 0)} total votes
                </div>
                {queueItems.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🏆</span> Top: {queueItems[0]?.votes ?? 0} votes
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                {!showSuggestionBox && (
                  <button
                    onClick={() => setShowSuggestionBox(true)}
                    style={{
                      background: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
                      color: "#fff",
                      border: 0,
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(59,130,246,.2)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    💡 Suggest an Album
                  </button>
                )}
                <a
                  href={`/browse/browse-albums?eventId=${eventId}`}
                  style={{ background: "#059669", color: "#fff", padding: "10px 16px", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 600 }}
                >
                  📚 Browse Collection
                </a>
                <a
                  href={`/events/event-detail/${eventId}`}
                  style={{ background: "#9333ea", color: "#fff", padding: "10px 16px", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 600 }}
                >
                  📅 Event Details
                </a>
              </div>
            </div>
          </div>

          {/* Suggestion Box */}
          {showSuggestionBox && (
            <div style={{ marginBottom: 24 }}>
              <AlbumSuggestionBox context="general" onClose={() => setShowSuggestionBox(false)} />
            </div>
          )}

          {/* The table */}
          {queueItems.length > 0 ? (
            <div className="queue-wrapper">
              <table className="queue-table">
                <colgroup>
                  <col style={{ width: "50px" }} />   {/* # */}
                  <col style={{ width: "60px" }} />   {/* cover */}
                  <col />                              {/* album/artist */}
                  <col style={{ width: "60px" }} />   {/* side */}
                  <col style={{ width: "60px" }} />   {/* + */}
                  <col style={{ width: "80px" }} />   {/* votes */}
                </colgroup>
                <thead>
                  <tr>
                    <th className="queue-index" scope="col">#</th>
                    <th scope="col"><span className="sr-only">Cover</span></th>
                    <th scope="col">Album / Artist</th>
                    <th scope="col">Side</th>
                    <th scope="col">👍</th>
                    <th scope="col">Votes</th>
                  </tr>
                </thead>
                <tbody>
                  {queueItems.map((item, index) => (
                    <tr key={item.id}>
                      <td className="queue-index">{index + 1}</td>
                      <td>
                        <Image
                          src={item.collection?.image_url || "/images/placeholder.png"}
                          alt={item.title || ""}
                          className="queue-cover"
                          width={48}
                          height={48}
                          unoptimized
                        />
                      </td>
                      <td>
                        <div className="queue-title">
                          {index < 3 && <span style={{ marginRight: 8 }}>{index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}</span>}
                          {item.title}
                        </div>
                        <div className="queue-artist">{item.artist}</div>
                      </td>
                      <td>
                        <span className="queue-side-badge">{item.side}</span>
                      </td>
                      <td>
                        <button className="queue-plus-btn" title="Vote for this entry" onClick={() => voteForItem(item.id)}>
                          ＋
                        </button>
                      </td>
                      <td>
                        <div className="queue-votes-inner">
                          <span className="queue-heart">♥</span>
                          <span className="queue-count">x{item.votes}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 12, border: "2px dashed #d1d5db", margin: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
              <h3 style={{ fontSize: 24, fontWeight: "bold", margin: "0 0 12px", color: "#374151" }}>Queue is Empty</h3>
              <p style={{ fontSize: 16, color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>
                No albums have been added to the queue yet.
                {eventId ? " Browse the collection to add some!" : " Start by suggesting albums below!"}
              </p>
              {eventId ? (
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <a href={`/browse/browse-albums?eventId=${eventId}`} style={{ background: "#059669", color: "#fff", padding: "12px 24px", borderRadius: 8, textDecoration: "none", fontSize: 16, fontWeight: 600 }}>
                    📚 Browse Collection
                  </a>
                  {!showSuggestionBox && (
                    <button onClick={() => setShowSuggestionBox(true)} style={{ background: "#3b82f6", color: "#fff", border: 0, padding: "12px 24px", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
                      💡 Suggest an Album
                    </button>
                  )}
                </div>
              ) : (
                <AlbumSuggestionBox context="general" />
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function BrowseQueuePage() {
  return (
    <Suspense fallback={<div>Loading queue...</div>}>
      <BrowseQueueContent />
    </Suspense>
  );
}
