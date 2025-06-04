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
        .order("created_at", { ascending: true, nullsFirst: false })

      if (error) {
        console.error("Error fetching requests:", error);
        return;
      }

      const albumIds = [...new Set(requests.map(r => r.album_id))];
      const { data: albums } = await supabase
        .from("collection")
        .select("id, artist, title, image, format")
        .in("id", albumIds);

      const queueWithAlbumData = requests.map(req => {
        const album = albums.find(a => a.id === req.album_id);
        return {
          id: req.id,
          side: req.side,
          upvotes: req.upvotes,
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
              src={item.album.image}
              alt="cover"
              className="queue-cover"
            />
            <div className="queue-info">
              <div className="queue-title">{item.album.title}</div>
              <div className="queue-artist">{item.album.artist}</div>
            </div>
            <div className="queue-side">{item.side}</div>
            <div className="queue-votes">
              <span className="queue-heart">❤</span>
              <span className="queue-count">x{item.upvotes || 1}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
