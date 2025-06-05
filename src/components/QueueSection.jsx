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
      if (!albumIds.length) return;

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
          {queue.map(item => (
            <tr key={item.id}>
              <td className="queue-index">{item.index}</td>
              <td>
                <img src={item.album.image_url} alt="" className="queue-cover" />
              </td>
              <td className="queue-meta">
                <div className="queue-title">{item.album.title}</div>
                <div className="queue-artist">{item.album.artist}</div>
              </td>
              <td className="queue-side">{item.side}</td>
              <td className="queue-plus">＋</td>
              <td className="queue-votes">
                <span className="queue-heart">♥</span>
                <span className="queue-count">x{item.upvotes}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
