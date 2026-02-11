// Path: src/app/admin/games/bingo/test/history/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

type GameHistoryItem = {
  id: number;
  created_at: string;
  songs_played: number;
  player_count: number;
  bingos: number;
  playback_source: string | null;
  playlist_name: string;
  playlist_type: "system" | "custom" | "spotify";
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function groupByDate(items: GameHistoryItem[]): Record<string, GameHistoryItem[]> {
  return items.reduce((groups, item) => {
    const date = formatDate(item.created_at);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {} as Record<string, GameHistoryItem[]>);
}

export default function GameHistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/game-sessions/history");
        if (res.ok) {
          const d = await res.json();
          setHistory(d.data ?? d ?? []);
        }
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const groupedHistory = groupByDate(history);

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#121212]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">Game History</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          </div>
        ) : history.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-400">No games played yet</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedHistory).map(([date, games]) => (
              <div key={date}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-sm font-bold">
                    {games.length}
                  </div>
                  <h2 className="text-lg font-semibold">{date}</h2>
                </div>
                <div className="space-y-2">
                  {games.map((game) => (
                    <div
                      key={game.id}
                      className="grid grid-cols-[100px_1fr] gap-4 rounded-lg bg-[#1a1a1a] p-4"
                    >
                      <div className="space-y-1 text-sm">
                        <div className="text-white">{formatTime(game.created_at)}</div>
                        <div className="text-gray-400">
                          {game.player_count} player{game.player_count !== 1 ? "s" : ""}
                        </div>
                        <div className="text-gray-400">
                          Bingos: {game.bingos}
                        </div>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div>
                          <span className="text-gray-400">Songs played: </span>
                          <span className="text-white">{game.songs_played}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Playback Source: </span>
                          <span className="text-white">
                            {game.playback_source || "None"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">
                            {game.playlist_type === "system"
                              ? "System Playlist: "
                              : game.playlist_type === "spotify"
                              ? "User's Spotify Library: "
                              : "Custom Playlist: "}
                          </span>
                          <span className="text-white">{game.playlist_name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {history.length > 0 && (
          <div className="mt-8 flex gap-4">
            <button className="flex-1 rounded-lg bg-[#1a1a1a] py-3 font-semibold uppercase tracking-wide text-gray-400 transition hover:bg-[#222] hover:text-white">
              Newer
            </button>
            <button className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 py-3 font-semibold uppercase tracking-wide transition hover:from-purple-500 hover:to-violet-500">
              Older
            </button>
          </div>
        )}
      </main>
    </div>
  );
}