import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "../styles/queue.css";

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

      const albumIds = requests.map(r => r.album_id).filter(Boolean);
      if (!albumIds.length) {
        console.warn("No valid album IDs found in requests.");
        return;
      }

      const { data: albums, error: albumError } = await supabase
        .from("collection")
        .select("id, artist, title, image_url, format")
        .in("id", albumIds);

      if (albumError) {
        console.error("Error fetching albums:", albumError);
        return;
      }

      const mapped = requests.map((req, i) => {
        const album = albums.find(a => a.id === req.album_id);
        return {
          id: req.id,
          index: i + 1,
          side: req.side,
          upvotes: req.upvotes || 1,
          album: album || {}
        };
      });

      setQueue(mapped);
    };

    fetchQueue();
  }, [eventId]);

  if (!queue.length) return null;

  return (
    <div className="queue-wrapper">
      <div className="queue-header">
        <div>#</div>
        <div></div>
        <div>Album / Artist</div>
        <div>Side</div>
        <div></div>
      </div>
      {queue.map((item, idx) => (
        <div key={item.id} className="queue-row">
          <div className="queue-index">{item.index}</div>
          <img src={item.album.image_url} alt="" className="queue-cover" />
          <div className="queue-meta">
            <div className="queue-title">{item.album.title}</div>
            <div className="queue-artist">{item.album.artist}</div>
          </div>
          <div className="queue-side">{item.side}</div>
          <div className="queue-votes">
            <span className="queue-plus">＋</span>
            <span className="queue-heart">♥</span>
            <span className="queue-count">x{item.upvotes}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
