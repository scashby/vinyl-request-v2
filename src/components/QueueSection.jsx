import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function QueueSection({ eventId }) {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const fetchQueue = async () => {
      const { data: requests, error } = await supabase
        .from("requests")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

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
    <div className="mt-6 bg-black text-white p-4 rounded-lg">
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center">
        {queue.map(item => (
          <div
            key={item.id}
            className="contents border-t border-gray-700 py-3"
          >
            <img
              src={item.album.image}
              alt="cover"
              className="w-12 h-12 object-cover"
            />
            <div>
              <div className="font-semibold text-blue-600">{item.album.title}</div>
              <div className="text-sm text-gray-400">{item.album.artist}</div>
            </div>
            <div className="text-sm text-gray-300">{item.side}</div>
            <div className="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 24 24"
                className="w-5 h-5 text-red-500"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42..." />
              </svg>
              <span className="text-sm text-gray-300">x{item.upvotes || 1}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
