import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from 'lib/supabaseClient';
import "../styles/queue.css";

// Models for Supabase data
interface Album {
  id: string | number;
  artist: string;
  title: string;
  image_url?: string;
  format?: string;
}

interface RequestEntry {
  id: string | number;
  album_id: string | number;
  side: string;
  votes: number;
  event_id: string;
}

interface QueueItem {
  id: string | number;
  index: number;
  side: string;
  votes: number;
  album: Album;
}

interface QueueSectionProps {
  eventId: string;
}

function getVoteKey(eventId: string, reqId: string | number) {
  return `queue-vote-${eventId}-${reqId}`;
}

export default function QueueSection({ eventId }: QueueSectionProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [voting, setVoting] = useState<{ [key: string]: boolean }>({});
  const router = useRouter();

  useEffect(() => {
    const fetchQueue = async () => {
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
        .select("id, artist, title, image_url, format")
        .in("id", albumIds);

      if (albumError || !albums) {
        console.error("Error fetching albums:", albumError);
        setQueue([]);
        return;
      }

      const mapped: QueueItem[] = requests.map((req: RequestEntry, i: number) => {
        const album = albums.find((a: Album) => a.id === req.album_id) || {
          id: req.album_id,
          artist: "",
          title: "",
          image_url: "",
          format: "",
        };
        return {
          id: req.id,
          index: i + 1,
          side: req.side,
          votes: req.votes || 1,
          album,
        };
      });

      setQueue(mapped);
    };

    fetchQueue();
  }, [eventId]);

  // Upvote handler with spam prevention
  const handleUpvote = async (reqId: string | number) => {
    const key = getVoteKey(eventId, reqId);
    if (typeof window !== "undefined" && localStorage.getItem(key)) {
      alert("You have already voted for this entry.");
      return;
    }
    setVoting((v) => ({ ...v, [reqId]: true }));
    const item = queue.find((q) => q.id === reqId);
    const newVotes = (item?.votes || 1) + 1;
    const { error } = await supabase
      .from("requests")
      .update({ votes: newVotes })
      .eq("id", reqId);
    setVoting((v) => ({ ...v, [reqId]: false }));

    if (!error) {
      if (typeof window !== "undefined") {
        localStorage.setItem(key, "voted");
      }
      setQueue((q) =>
        q.map((entry) =>
          entry.id === reqId ? { ...entry, votes: newVotes } : entry
        )
      );
    } else {
      alert("Error submitting vote!");
    }
  };

  // Navigation for album detail (Next.js style)
  const goToAlbum = (albumId: string | number) => {
    router.push(`/browse/album-detail/${albumId}${eventId ? `?eventId=${eventId}` : ""}`);
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
          The queue is empty. <br />Be the first to <span style={{ color: "#9333ea" }}>add an album side</span> to get started!
        </div>
      ) : (
        <table className="queue-table">
          <thead>
            <tr>
              <th>#</th>
              <th></th>
              <th>Album / Artist</th>
              <th>Side</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {queue.map((item) => {
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
                  <td
                    className="queue-meta"
                    style={{ cursor: "pointer" }}
                    onClick={() => goToAlbum(item.album.id)}
                  >
                    <div className="queue-title">{item.album.title}</div>
                    <div className="queue-artist">{item.album.artist}</div>
                  </td>
                  <td className="queue-side">{item.side}</td>
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
