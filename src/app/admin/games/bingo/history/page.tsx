"use client";

import { useEffect, useState } from "react";

type HistoryItem = {
  id: number;
  created_at: string;
  status: string;
  session_code: string;
  playlist_name: string;
  calls_played: number;
};

export default function BingoHistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/vb/sessions/history");
        if (res.ok) {
          const payload = await res.json();
          setItems(payload.data ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#f2e9dc] p-6">
      <div className="mx-auto max-w-4xl rounded-2xl border border-stone-300 bg-white p-5">
        <h1 className="text-3xl font-black text-stone-900">Bingo History</h1>
        {loading ? (
          <p className="mt-4 text-sm text-stone-600">Loading...</p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-stone-600">No sessions yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-stone-200 p-3 text-sm text-stone-800">
                {new Date(item.created_at).toLocaleString()} · {item.session_code} · {item.playlist_name} · Calls: {item.calls_played} · {item.status}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
