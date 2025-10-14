// components/QueueSection.tsx

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from 'src/lib/supabaseClient';
import "styles/queue.css";

interface Album {
  id: string | number;
  artist: string;
  title: string;
  image_url?: string;
  format?: string;
  is_1001?: boolean | null; // ← added
}

interface RequestEntry {
  id: string | number;
  album_id: string | number;
  side: string | null;
  track_number: string | null;
  track_name: string | null;
  track_duration: string | null;
  votes: number;
  event_id: string;
}

interface QueueItem {
  id: string | number;
  index: number;
  side: string | null;
  track_number: string | null;
  track_name: string | null;
  track_duration: string | null;
  votes: number;
  album: Album;
  queue_type: string;
}

interface QueueSectionProps {
  eventId: string;
}

function getVoteKey(eventId: string, reqId: string | number) {
  return `queue-vote-${eventId}-${reqId}`;
}

export default function QueueSection({ eventId }: QueueSectionProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueType, setQueueType] = useState<string>('side');
  const [voting, setVoting] = useState<{ [key: string]: boolean }>({});
  const router = useRouter();

  useEffect(() => {
    const fetchQueue = async () => {
      // Fetch event to get queue type
      const { data: eventData } = await supabase
        .from("events")
        .select("queue_type")
        .eq("id", eventId)
        .single();

      const currentQueueType = eventData?.queue_type || 'side';
      setQueueType(currentQueueType);

      const { data: requests, error } = await supabase
        .from("requests")
        .select("*")
        .eq("event_id", eventId)
        .order("id", { ascending: true });

      if (error || !requests) {
        console.error("Error fetching requests:", error);
        setQueue([]);
        return;
      }

      const albumIds = requests.map((r: RequestEntry) => r.album_id).filter(Boolean);
      if (!albumIds.length) {
        setQueue([]);
        return;
      }

      const { data: albums, error: albumError } = await supabase
        .from("collection")
        .select("id, artist, title, image_url, format, is_1001") // ← added is_1001
        .in("id", albumIds);

      if (albumError || !albums) {
        console.error("Error fetching albums:", albumError);
        setQueue([]);
        return;
      }

      const mapped: QueueItem[] = requests.map((req: RequestEntry, i: number) => {
        const album =
          (albums as Album[]).find((a: Album) => a.id === req.album_id) || {
            id: req.album_id,
            artist: "",
            title: "",
            image_url: "",
            format: "",
            is_1001: null,
          };
        return {
          id: req.id,
          index: i + 1,
          side: req.side || null,
          track_number: req.track_number || null,
          track_name: req.track_name || null,
          track_duration: req.track_duration || null,
          votes: req.votes || 1,
          queue_type: currentQueueType,
          album,
        };
      });

      setQueue(mapped);
    };

    fetchQueue();
  }, [eventId]);

  const handleUpvote = async (reqId: string | number) => {
    const key = getVoteKey(eventId, reqId);
    if (typeof window !== "undefined" && localStorage.getItem(key)) {
      alert("You have already voted for this entry.");
      return;
    }
    setVoting((v: { [key: string]: boolean }) => ({ ...v, [reqId]: true }));
    const item = queue.find((q: QueueItem) => q.id === reqId);
    const newVotes = (item?.votes || 1) + 1;
    const { error } = await supabase
      .from("requests")
      .update({ votes: newVotes })
      .eq("id", reqId);
    setVoting((v: { [key: string]: boolean }) => ({ ...v, [reqId]: false }));

    if (!error) {
      if (typeof window !== "undefined") {
        localStorage.setItem(key, "voted");
      }
      setQueue((q: QueueItem[]) =>
        q.map((entry: QueueItem) =>
          entry.id === reqId ? { ...entry, votes: newVotes } : entry
        )
      );
    } else {
      alert("Error submitting vote!");
    }
  };

  const goToAlbum = (albumId: string | number) => {
    router.push(`/browse/album-detail/${albumId}${eventId ? `?eventId=${eventId}` : ""}`);
  };

  const getDisplayTitle = (item: QueueItem) => {
    if (queueType === 'track') {
      return item.track_name || item.album.title;
    }
    return item.album.title;
  };

  return (
    <div className="queue-wrapper">
      <h3>View the queue</h3>
      {queue.length === 0 ? (
        <div style={{
          background: "rgba(32,32,48,0.9)",
          borderRadius: 10,
          padding: 32,
          textAlign: "center",
          color: "#fff",
          margin: "32px auto",
          fontSize: 18,
          fontWeight: 500,
          maxWidth: 550
        }}>
          The queue is empty. <br />Be the first to <span style={{ color: "#9333ea" }}>add {queueType === 'track' ? 'a track' : queueType === 'album' ? 'an album' : 'an album side'}</span> to get started!
        </div>
      ) : (
        <table className="queue-table">
          <thead>
            <tr>
              <th>#</th>
              <th></th>
              {/* fixed badge column for stable layout */}
              <th style={{ width: 42 }}></th>
              <th>{queueType === 'track' ? 'Track / Artist' : 'Album / Artist'}</th>
              {queueType === 'side' && <th>Side</th>}
              {queueType === 'track' && <th>Track #</th>}
              {queueType === 'track' && <th>Duration</th>}
              <th>&#x1F44D;</th>
              <th>Votes</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((item: QueueItem) => {
              const disabled =
                voting[item.id] ||
                (typeof window !== "undefined" &&
                  !!localStorage.getItem(getVoteKey(eventId, item.id)));
              return (
                <tr key={item.id}>
                  <td className="queue-index">{item.index}</td>
                  <td>
                    <Image
                      src={item.album.image_url || "/images/placeholder.png"}
                      alt={item.album.title || ""}
                      className="queue-cover"
                      width={64}
                      height={64}
                      style={{ cursor: "pointer", objectFit: "cover" }}
                      onClick={() => goToAlbum(item.album.id)}
                      unoptimized
                    />
                  </td>
                  {/* badge cell (always rendered, may be empty) */}
                  <td className="queue-badge" style={{ width: 42, textAlign: 'center' }}>
                    {item.album.is_1001 ? (
                      <span
                        title="On the 1001 Albums list"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          borderRadius: 999,
                          padding: '2px 6px',
                          fontSize: 10,
                          fontWeight: 700,
                          lineHeight: 1,
                          border: '1px solid rgba(0,0,0,0.2)',
                          background: 'rgba(0,0,0,0.75)',
                          color: '#fff',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        1001
                      </span>
                    ) : null}
                  </td>
                  <td
                    className="queue-meta"
                    style={{ cursor: "pointer" }}
                    onClick={() => goToAlbum(item.album.id)}
                  >
                    <div className="queue-title">{getDisplayTitle(item)}</div>
                    <div className="queue-artist">{item.album.artist}</div>
                  </td>
                  {queueType === 'side' && (
                    <td className="queue-side">{item.side}</td>
                  )}
                  {queueType === 'track' && (
                    <>
                      <td style={{ textAlign: 'center', fontSize: '14px' }}>
                        {item.track_number || '--'}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '14px' }}>
                        {item.track_duration || '--:--'}
                      </td>
                    </>
                  )}
                  <td className="queue-plus">
                    <button
                      className="queue-plus-btn"
                      disabled={disabled}
                      title={
                        typeof window !== "undefined" &&
                        localStorage.getItem(getVoteKey(eventId, item.id))
                          ? "Already voted"
                          : "Vote for this entry"
                      }
                      onClick={() => handleUpvote(item.id)}
                      style={{
                        fontSize: 22,
                        color: voting[item.id] ? "#ccc" : "#2563eb",
                        cursor: voting[item.id] ? "not-allowed" : "pointer",
                        background: "none",
                        border: "none",
                      }}
                    >
                      ＋
                    </button>
                  </td>
                  <td className="queue-votes">
                    <span className="queue-heart">♥</span>
                    <span className="queue-count">x{item.votes}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
