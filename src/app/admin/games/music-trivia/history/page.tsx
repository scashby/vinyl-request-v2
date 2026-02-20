"use client";

import { useEffect, useState } from "react";

type HistoryRow = {
  id: number;
  session_code: string;
  title: string;
  status: string;
  teams: number;
  questions_asked: number;
  questions_scored: number;
  created_at: string;
};

export default function MusicTriviaHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);

  const load = async () => {
    const res = await fetch("/api/games/trivia/sessions/history");
    if (!res.ok) return;
    const payload = await res.json();
    setRows(payload.data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#141414,#0a0a0a)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-stone-700 bg-black/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-3xl font-black uppercase text-cyan-200">Music Trivia History</h1>
          <button onClick={load} className="rounded border border-stone-700 px-3 py-1 text-sm">Refresh</button>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-stone-400">No session history yet.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {rows.map((row) => (
              <div key={row.id} className="rounded border border-stone-700 bg-stone-950/70 p-3">
                <p>{new Date(row.created_at).toLocaleString()} · {row.session_code} · {row.title}</p>
                <p className="text-stone-400">Teams: {row.teams} · Asked: {row.questions_asked} · Scored: {row.questions_scored} · Status: {row.status}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
