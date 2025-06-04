import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function QueueSection({ eventId }) {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const fetchQueue = async () => {
      const { data: requests, error } = await supabase
        .from("requests")
        .select("*")
        .eq("event_id", eventId)
        .order("id", { ascending: true });

      if (error) {
        console.error("Error fetching requests:", error);
        return;
      }

      const albumIds = [...new Set(
        requests
          .map(r => r.album_id)
          .filter(id => typeof id === "number" && !isNaN(id))
      )];

      if (albumIds.length === 0) {
        console.warn("No valid album IDs found in requests.");
        return;
      }

      const { data: albums, error: albumError } = await supabase
        .from("collection")
        .select("id, artist, title, image, format")
        .in("id", albumIds);

      if (albumError) {
        console.error("Error fetching albums:", albumError);
        return;
      }

      const queueWithAlbumData = requests.map(req => {
        const album = (albums || []).find(a => a.id === req.album_id);
        return {
          id: req.id,
          side: req.side,
          upvotes: typeof req.upvotes === "number" ? req.upvotes : 0,
          album: album || {}
        };
      });

      setQueue(queueWithAlbumData);
    };

    fetchQueue();
  }, [eventId]);

  return (
    <div className="queue-section">
      <div className="queue-grid">
        {queue.map(item => (
          <div key={item.id} className="queue-row">
            <img
              src={item.album.image || "/placeholder.png"}
              alt="cover"
              className="queue-cover"
            />
            <div className="queue-info">
              <div className="queue-title">{item.album.title || "(Unknown Title)"}</div>
              <div className="queue-artist">{item.album.artist || "(Unknown Artist)"}</div>
            </div>
            <div className="queue-side">{item.side || "(Unknown Side)"}</div>
            <div className="queue-votes">
              <span className="queue-heart">❤</span>
              <span className="queue-count">x{item.upvotes}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
