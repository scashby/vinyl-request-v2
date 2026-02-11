// Path: src/app/admin/games/bingo/test/host/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Settings,
  Play,
  Pause,
  Monitor,
  UserPlus,
  Music2,
  Moon,
  Sun,
  Copy,
  Check,
} from "lucide-react";

type GameSession = {
  id: number;
  game_code: string;
  status: "pending" | "active" | "paused" | "completed";
  current_pick_index: number;
  game_templates: {
    name: string;
  };
};

type PickItem = {
  id: number;
  pick_index: number;
  status: "pending" | "played" | "skipped";
  game_template_items: {
    title: string;
    artist: string;
  };
};

type Player = {
  id: number;
  display_name: string;
  status: "waiting" | "admitted" | "playing" | "left";
  correct_count: number;
};

// B-I-N-G-O column colors matching Rockstar Bingo
const COLUMN_COLORS = [
  { letter: "B", bg: "bg-blue-500", text: "text-blue-500", glow: "shadow-blue-500/50" },
  { letter: "I", bg: "bg-green-500", text: "text-green-500", glow: "shadow-green-500/50" },
  { letter: "N", bg: "bg-yellow-500", text: "text-yellow-500", glow: "shadow-yellow-500/50" },
  { letter: "G", bg: "bg-orange-500", text: "text-orange-500", glow: "shadow-orange-500/50" },
  { letter: "O", bg: "bg-red-500", text: "text-red-500", glow: "shadow-red-500/50" },
];

function getColumnInfo(index: number) {
  return COLUMN_COLORS[index % 5];
}

export default function HostDashboard() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<GameSession | null>(null);
  const [picks, setPicks] = useState<PickItem[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const currentIndex = session?.current_pick_index ?? 0;
  const currentPick = picks.find((p) => p.pick_index === currentIndex);
  const columnInfo = getColumnInfo(currentIndex);

  const activePlayers = players.filter((p) => p.status === "playing" || p.status === "admitted");
  const lobbyPlayers = players.filter((p) => p.status === "waiting");

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [sessionRes, picksRes, playersRes] = await Promise.all([
        fetch(`/api/game-sessions/${sessionId}`),
        fetch(`/api/game-sessions/${sessionId}/picks`),
        fetch(`/api/game-sessions/${sessionId}/players`),
      ]);

      if (sessionRes.ok) setSession(await sessionRes.json());
      if (picksRes.ok) {
        const data = await picksRes.json();
        setPicks((data.data ?? data).sort((a: PickItem, b: PickItem) => a.pick_index - b.pick_index));
      }
      if (playersRes.ok) {
        const data = await playersRes.json();
        setPlayers(data.data ?? data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handlePrevious = async () => {
    if (!session || currentIndex <= 0) return;
    await fetch(`/api/game-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_pick_index: currentIndex - 1 }),
    });
    fetchData();
  };

  const handleNext = async () => {
    if (!session || currentIndex >= picks.length - 1) return;
    
    // Mark current as played
    if (currentPick) {
      await fetch(`/api/game-session-picks/${currentPick.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "played" }),
      });
    }
    
    await fetch(`/api/game-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_pick_index: currentIndex + 1 }),
    });
    fetchData();
  };

  const handleToggleStatus = async () => {
    if (!session) return;
    const newStatus = session.status === "active" ? "paused" : "active";
    await fetch(`/api/game-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchData();
  };

  const copyGameCode = () => {
    if (session?.game_code) {
      navigator.clipboard.writeText(session.game_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Theme
  const theme = darkMode
    ? { bg: "bg-[#1a1625]", card: "bg-[#252236]", text: "text-white", muted: "text-gray-400", border: "border-[#2d2a3e]" }
    : { bg: "bg-gray-50", card: "bg-white", text: "text-gray-900", muted: "text-gray-500", border: "border-gray-200" };

  if (isLoading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${theme.bg}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${theme.bg} ${theme.text}`}>
        <div className="text-center">
          <p className="text-xl">No active game session</p>
          <Link href="/admin/games/bingo/test" className="mt-4 inline-block text-pink-500 hover:underline">
            ← Back to playlists
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text}`}>
      {/* Header */}
      <header className={`border-b ${theme.border} px-4 py-3`}>
        <div className="flex items-center justify-between">
          {/* Left: Logo & Game Info */}
          <div className="flex items-center gap-4">
            <Link href="/admin/games/bingo/test" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-600">
                <span className="text-sm text-white">★</span>
              </div>
              <span className="font-bold">Rockstar Bingo</span>
            </Link>
            <div className={`text-sm ${theme.muted}`}>{session.game_templates.name}</div>
          </div>

          {/* Center: Game Code */}
          <button
            onClick={copyGameCode}
            className={`flex items-center gap-2 rounded-lg ${theme.card} border ${theme.border} px-4 py-2 transition-colors hover:border-pink-500`}
          >
            <span className={`text-sm ${theme.muted}`}>Game Code:</span>
            <span className="text-2xl font-bold tracking-widest text-pink-500">{session.game_code}</span>
            {copiedCode ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/games/bingo/test/lobby?sessionId=${session.id}`}
              className={`relative flex items-center gap-2 rounded-lg px-3 py-2 ${theme.card} border ${theme.border}`}
            >
              <UserPlus className="h-4 w-4" />
              <span className="text-sm">Lobby</span>
              {lobbyPlayers.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-xs text-white">
                  {lobbyPlayers.length}
                </span>
              )}
            </Link>
            <Link
              href={`/admin/games/bingo/test/sidekick?sessionId=${session.id}`}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 ${theme.card} border ${theme.border}`}
            >
              <Music2 className="h-4 w-4" />
              <span className="text-sm">Sidekick</span>
            </Link>
            <Link
              href={`/admin/games/bingo/test/jumbotron?sessionId=${session.id}`}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 ${theme.card} border ${theme.border}`}
            >
              <Monitor className="h-4 w-4" />
              <span className="text-sm">Jumbotron</span>
            </Link>
            <button onClick={() => setDarkMode(!darkMode)} className={`rounded-lg p-2 ${theme.card} border ${theme.border}`}>
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button className={`rounded-lg p-2 ${theme.card} border ${theme.border}`}>
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Left Sidebar: Song List */}
        <div className={`w-80 flex-shrink-0 overflow-y-auto border-r ${theme.border} ${theme.card}`}>
          <div className={`sticky top-0 border-b ${theme.border} ${theme.card} p-3`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Songs</span>
              <span className={`text-sm ${theme.muted}`}>{picks.length} total</span>
            </div>
          </div>
          <div className="divide-y divide-[#2d2a3e]">
            {picks.map((pick) => {
              const col = getColumnInfo(pick.pick_index);
              const isCurrent = pick.pick_index === currentIndex;
              const isPlayed = pick.status === "played";

              return (
                <div
                  key={pick.id}
                  className={`flex items-center gap-3 px-3 py-2 ${
                    isCurrent ? "bg-pink-500/10" : isPlayed ? "opacity-50" : ""
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${col.bg}`}
                  >
                    {col.letter}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-medium ${isCurrent ? "text-pink-500" : ""}`}>
                      {pick.game_template_items.title}
                    </div>
                    <div className={`truncate text-xs ${theme.muted}`}>{pick.game_template_items.artist}</div>
                  </div>
                  {isPlayed && <Check className="h-4 w-4 flex-shrink-0 text-green-500" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content: Current Song */}
        <div className="flex flex-1 flex-col">
          {/* B-I-N-G-O Header */}
          <div className={`flex justify-center gap-2 border-b ${theme.border} py-4`}>
            {COLUMN_COLORS.map((col, idx) => (
              <div
                key={col.letter}
                className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold text-white transition-all ${col.bg} ${
                  idx === currentIndex % 5 ? `scale-110 shadow-lg ${col.glow}` : "opacity-50"
                }`}
              >
                {col.letter}
              </div>
            ))}
          </div>

          {/* Current Song Display */}
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            {currentPick ? (
              <>
                <div
                  className={`mb-6 flex h-24 w-24 items-center justify-center rounded-2xl text-5xl font-bold text-white shadow-xl ${columnInfo.bg} ${columnInfo.glow}`}
                >
                  {columnInfo.letter}
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold">{currentPick.game_template_items.title}</div>
                  <div className={`mt-2 text-2xl ${theme.muted}`}>{currentPick.game_template_items.artist}</div>
                </div>
                <div className={`mt-6 text-sm ${theme.muted}`}>
                  Song {currentIndex + 1} of {picks.length}
                </div>
              </>
            ) : (
              <div className={theme.muted}>No song selected</div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className={`flex items-center justify-center gap-4 border-t ${theme.border} py-6`}>
            <button
              onClick={handlePrevious}
              disabled={currentIndex <= 0}
              className={`flex h-14 w-14 items-center justify-center rounded-full ${theme.card} border ${theme.border} transition-colors hover:border-pink-500 disabled:opacity-30`}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            <button
              onClick={handleToggleStatus}
              className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-lg shadow-pink-500/25 transition-transform hover:scale-105`}
            >
              {session.status === "active" ? <Pause className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7" />}
            </button>

            <button
              onClick={handleNext}
              disabled={currentIndex >= picks.length - 1}
              className={`flex h-14 w-14 items-center justify-center rounded-full ${theme.card} border ${theme.border} transition-colors hover:border-pink-500 disabled:opacity-30`}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Right Sidebar: Players */}
        <div className={`w-64 flex-shrink-0 overflow-y-auto border-l ${theme.border} ${theme.card}`}>
          <div className={`sticky top-0 border-b ${theme.border} ${theme.card} p-3`}>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="font-semibold">Players</span>
              <span className={`ml-auto text-sm ${theme.muted}`}>{activePlayers.length}</span>
            </div>
          </div>
          <div className="divide-y divide-[#2d2a3e]">
            {activePlayers.length === 0 ? (
              <div className={`p-4 text-center text-sm ${theme.muted}`}>No players yet</div>
            ) : (
              activePlayers
                .sort((a, b) => b.correct_count - a.correct_count)
                .map((player) => (
                  <div key={player.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-xs font-bold text-white">
                      {player.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{player.display_name}</div>
                    </div>
                    <div className="text-sm font-medium text-green-500">{player.correct_count}</div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}