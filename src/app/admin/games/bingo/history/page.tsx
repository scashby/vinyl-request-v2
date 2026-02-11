"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const formatDate = (value: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

type GameSession = {
  id: number;
  game_code: string | null;
  variant: string;
  bingo_target: string;
  status: string;
  created_at: string | null;
};

export default function Page() {
  const [sessions, setSessions] = useState<GameSession[]>([]);

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/game-sessions");
      const payload = await response.json();
      setSessions(payload.data ?? []);
    };
    void load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, GameSession[]>();
    sessions.forEach((session) => {
      const key = formatDate(session.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(session);
    });
    return Array.from(map.entries());
  }, [sessions]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/admin/games/bingo" className="text-slate-500 hover:text-slate-900">←</Link>
          <div className="text-center">
            <div className="text-sm font-semibold text-slate-900">Game History</div>
          </div>
          <div className="w-6" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        {grouped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            No sessions yet.
          </div>
        ) : (
          grouped.map(([date, entries]) => (
            <div key={date} className="mb-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/20 text-xs font-semibold text-blue-600">
                  {entries.length}
                </span>
                <div className="text-sm font-semibold text-slate-700">{date}</div>
              </div>
              <div className="mt-3 space-y-3">
                {entries.map((session) => (
                  <div key={session.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs text-slate-500">Session {session.id}</div>
                    <div className="mt-2 text-sm text-slate-700">
                      Code: {session.game_code ?? "-"} · {session.variant} · {session.bingo_target}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Status: {session.status}</div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        <div className="mt-10 flex gap-4">
          <button
            type="button"
            className="flex-1 rounded-lg bg-indigo-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-indigo-700"
          >
            Newer
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white"
          >
            Older
          </button>
        </div>
      </main>
    </div>
  );
}
