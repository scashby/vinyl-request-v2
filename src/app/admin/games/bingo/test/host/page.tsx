// Path: src/app/admin/games/bingo/test/host/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Users,
  UserPlus,
  Monitor,
  Music2,
  Settings,
  Copy,
  Check,
  Moon,
  Sun,
  Square,
} from "lucide-react";

type Session = {
  id: number;
  game_code: string;
  status: "pending" | "active" | "paused" | "completed";
  current_pick_index: number;
  game_templates: { name: string };
};

type Pick = {
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

const COLS = [
  { letter: "B", bg: "bg-blue-500", border: "border-blue-500", glow: "shadow-blue-500/50" },
  { letter: "I", bg: "bg-green-500", border: "border-green-500", glow: "shadow-green-500/50" },
  { letter: "N", bg: "bg-yellow-500", border: "border-yellow-500", glow: "shadow-yellow-500/50" },
  { letter: "G", bg: "bg-orange-500", border: "border-orange-500", glow: "shadow-orange-500/50" },
  { letter: "O", bg: "bg-red-500", border: "border-red-500", glow: "shadow-red-500/50" },
];

export default function HostDashboard() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<Session | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [target, setTarget] = useState("one_line");

  const currentIdx = session?.current_pick_index ?? 0;
  const currentPick = picks.find((p) => p.pick_index === currentIdx);
  const col = COLS[currentIdx % 5];

  const lobbyCount = players.filter((p) => p.status === "waiting").length;
  const playingCount = players.filter((p) => ["admitted", "playing"].includes(p.status)).length;

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    const [sRes, pRes, plRes] = await Promise.all([
      fetch(`/api/game-sessions/${sessionId}`),
      fetch(`/api/game-sessions/${sessionId}/picks`),
      fetch(`/api/game-sessions/${sessionId}/players`),
    ]);
    if (sRes.ok) setSession(await sRes.json());
    if (pRes.ok) {
      const d = await pRes.json();
      setPicks((d.data ?? d).sort((a: Pick, b: Pick) => a.pick_index - b.pick_index));
    }
    if (plRes.ok) {
      const d = await plRes.json();
      setPlayers(d.data ?? d);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const i = setInterval(fetchData, 5000);
    return () => clearInterval(i);
  }, [fetchData]);

  const movePick = async (delta: number) => {
    if (!session) return;
    const newIdx = currentIdx + delta;
    if (newIdx < 0 || newIdx >= picks.length) return;

    if (delta > 0 && currentPick) {
      await fetch(`/api/game-session-picks/${currentPick.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "played" }),
      });
    }

    await fetch(`/api/game-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_pick_index: newIdx }),
    });
    fetchData();
  };

  const togglePlay = async () => {
    if (!session) return;
    await fetch(`/api/game-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: session.status === "active" ? "paused" : "active" }),
    });
    fetchData();
  };

  const copyCode = () => {
    if (session) {
      navigator.clipboard.writeText(session.game_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const bg = darkMode ? "bg-[#1a1625]" : "bg-gray-100";
  const card = darkMode ? "bg-[#252236]" : "bg-white";
  const text = darkMode ? "text-white" : "text-gray-900";
  const muted = darkMode ? "text-gray-400" : "text-gray-500";
  const border = darkMode ? "border-[#2d2a3e]" : "border-gray-200";

  if (!session) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${bg} ${text}`}>
        <div className="text-center">
          <p>No active session</p>
          <Link href="/admin/games/bingo/test" className="mt-2 text-pink-500 hover:underline">
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen flex-col ${bg} ${text}`}>
      {/* Header */}
      <header className={`flex items-center justify-between border-b ${border} px-4 py-2`}>
        <div className="flex items-center gap-4">
          <Link href="/admin/games/bingo/test" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-600">
              <span className="text-white">★</span>
            </div>
            <span className="font-bold">Rockstar Bingo</span>
          </Link>
          <span className={`text-sm ${muted}`}>{session.game_templates.name}</span>
        </div>

        {/* Game Code */}
        <button onClick={copyCode} className="flex items-center gap-2 rounded-lg bg-pink-500/10 px-4 py-2">
          <span className={`text-sm ${muted}`}>Code:</span>
          <span className="text-2xl font-bold tracking-widest text-pink-500">{session.game_code}</span>
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-pink-500" />}
        </button>

        {/* Stats & Links */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-green-500/20 px-3 py-1 text-sm text-green-400">
            <Users className="h-4 w-4" />
            <span>{playingCount}</span>
          </div>
          {lobbyCount > 0 && (
            <Link
              href={`/admin/games/bingo/test/lobby?sessionId=${session.id}`}
              className="flex items-center gap-1 rounded-lg bg-yellow-500/20 px-3 py-1 text-sm text-yellow-400"
            >
              <UserPlus className="h-4 w-4" />
              <span>{lobbyCount}</span>
            </Link>
          )}
          <Link href={`/admin/games/bingo/test/lobby?sessionId=${session.id}`} className={`rounded-lg p-2 ${card} border ${border}`}>
            <UserPlus className="h-4 w-4" />
          </Link>
          <Link href={`/admin/games/bingo/test/sidekick?sessionId=${session.id}`} className={`rounded-lg p-2 ${card} border ${border}`}>
            <Music2 className="h-4 w-4" />
          </Link>
          <Link href={`/admin/games/bingo/test/jumbotron?sessionId=${session.id}`} className={`rounded-lg p-2 ${card} border ${border}`}>
            <Monitor className="h-4 w-4" />
          </Link>
          <button onClick={() => setShowTargetModal(true)} className={`rounded-lg p-2 ${card} border ${border}`}>
            <Square className="h-4 w-4" />
          </button>
          <button onClick={() => setDarkMode(!darkMode)} className={`rounded-lg p-2 ${card} border ${border}`}>
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button className={`rounded-lg p-2 ${card} border ${border}`}>
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Song List */}
        <aside className={`w-72 flex-shrink-0 overflow-y-auto border-r ${border} ${card}`}>
          <div className={`sticky top-0 z-10 border-b ${border} ${card} px-4 py-2`}>
            <span className="font-semibold">Songs</span>
            <span className={`ml-2 text-sm ${muted}`}>{picks.length}</span>
          </div>
          <div>
            {picks.map((pick) => {
              const c = COLS[pick.pick_index % 5];
              const isCurrent = pick.pick_index === currentIdx;
              const isPlayed = pick.status === "played";
              return (
                <div
                  key={pick.id}
                  className={`flex items-center gap-3 border-b ${border} px-4 py-2 ${isCurrent ? "bg-pink-500/10" : ""} ${isPlayed && !isCurrent ? "opacity-50" : ""}`}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-white ${c.bg}`}>
                    {c.letter}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-medium ${isCurrent ? "text-pink-500" : ""}`}>
                      {pick.game_template_items.title}
                    </div>
                    <div className={`truncate text-xs ${muted}`}>{pick.game_template_items.artist}</div>
                  </div>
                  {isPlayed && <Check className="h-4 w-4 text-green-500" />}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center */}
        <main className="flex flex-1 flex-col">
          {/* B-I-N-G-O Headers */}
          <div className={`flex justify-center gap-2 border-b ${border} py-4`}>
            {COLS.map((c, i) => {
              const isActive = i === currentIdx % 5;
              return (
                <div
                  key={c.letter}
                  className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold text-white transition-all ${c.bg} ${isActive ? `scale-110 shadow-lg ${c.glow}` : "opacity-40"}`}
                >
                  {c.letter}
                </div>
              );
            })}
          </div>

          {/* Current Song */}
          <div className="flex flex-1 flex-col items-center justify-center">
            {currentPick ? (
              <>
                <div className={`mb-6 flex h-28 w-28 items-center justify-center rounded-2xl text-6xl font-bold text-white shadow-xl ${col.bg} ${col.glow}`}>
                  {col.letter}
                </div>
                <div className="text-center">
                  <h1 className="text-4xl font-bold">{currentPick.game_template_items.title}</h1>
                  <p className={`mt-2 text-2xl ${muted}`}>{currentPick.game_template_items.artist}</p>
                </div>
                <p className={`mt-4 text-sm ${muted}`}>Song {currentIdx + 1} of {picks.length}</p>
              </>
            ) : (
              <p className={muted}>No song selected</p>
            )}
          </div>

          {/* Controls */}
          <div className={`flex items-center justify-center gap-4 border-t ${border} py-4`}>
            <button
              onClick={() => movePick(-1)}
              disabled={currentIdx <= 0}
              className={`flex h-12 w-12 items-center justify-center rounded-full ${card} border ${border} transition hover:border-pink-500 disabled:opacity-30`}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={togglePlay}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-lg transition hover:scale-105"
            >
              {session.status === "active" ? <Pause className="h-6 w-6" /> : <Play className="ml-1 h-6 w-6" />}
            </button>
            <button
              onClick={() => movePick(1)}
              disabled={currentIdx >= picks.length - 1}
              className={`flex h-12 w-12 items-center justify-center rounded-full ${card} border ${border} transition hover:border-pink-500 disabled:opacity-30`}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </main>

        {/* Right: Players */}
        <aside className={`w-56 flex-shrink-0 overflow-y-auto border-l ${border} ${card}`}>
          <div className={`sticky top-0 z-10 border-b ${border} ${card} px-4 py-2`}>
            <span className="font-semibold">Players</span>
            <span className={`ml-2 text-sm ${muted}`}>{playingCount}</span>
          </div>
          <div>
            {players
              .filter((p) => ["admitted", "playing"].includes(p.status))
              .sort((a, b) => b.correct_count - a.correct_count)
              .map((p) => (
                <div key={p.id} className={`flex items-center gap-3 border-b ${border} px-4 py-2`}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-xs font-bold text-white">
                    {p.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{p.display_name}</div>
                  </div>
                  <div className="text-sm font-semibold text-green-500">{p.correct_count}</div>
                </div>
              ))}
            {playingCount === 0 && <p className={`p-4 text-center text-sm ${muted}`}>No players yet</p>}
          </div>
        </aside>
      </div>

      {/* Target Modal */}
      {showTargetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowTargetModal(false)}>
          <div className={`w-full max-w-md rounded-2xl ${card} p-6`} onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold">Select Target</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "one_line", label: "One Line" },
                { id: "two_lines", label: "Two Lines" },
                { id: "four_corners", label: "Four Corners" },
                { id: "x_shape", label: "X Shape" },
                { id: "full_card", label: "Full Card" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTarget(t.id); setShowTargetModal(false); }}
                  className={`rounded-xl border-2 p-4 text-center transition ${target === t.id ? "border-pink-500 bg-pink-500/10" : `${border} hover:border-pink-500`}`}
                >
                  <div className="mb-2 mx-auto grid h-12 w-12 grid-cols-5 gap-0.5">
                    {Array.from({ length: 25 }).map((_, i) => {
                      let active = false;
                      if (t.id === "one_line") active = i >= 10 && i <= 14;
                      if (t.id === "two_lines") active = (i >= 5 && i <= 9) || (i >= 15 && i <= 19);
                      if (t.id === "four_corners") active = [0, 4, 20, 24].includes(i);
                      if (t.id === "x_shape") active = [0, 4, 6, 8, 12, 16, 18, 20, 24].includes(i);
                      if (t.id === "full_card") active = true;
                      return <div key={i} className={`rounded-sm ${active ? "bg-pink-500" : darkMode ? "bg-white/10" : "bg-gray-200"}`} />;
                    })}
                  </div>
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}