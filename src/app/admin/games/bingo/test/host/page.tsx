// Path: src/app/admin/games/bingo/host/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Settings,
  Monitor,
  UserPlus,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Copy,
  Check,
  Music,
  Radio,
  Eye,
  Volume2,
  Moon,
  Sun,
} from "lucide-react";

type PickItem = {
  id: number;
  pick_index: number;
  called_at: string | null;
  game_template_items: {
    id: number;
    title: string;
    artist: string;
    bpm?: number;
    key_signature?: string;
  } | null;
};

type Session = {
  id: number;
  game_code: string | null;
  status: string;
  variant?: string;
  bingo_target?: string;
};

type Player = {
  id: number;
  display_name: string;
  status: "lobby" | "playing" | "left" | "removed";
  correct_count: number;
  missed_count: number;
  wrong_count: number;
};

const COLUMN_LABELS = ["B", "I", "N", "G", "O"];
const COLUMN_COLORS = [
  "from-blue-500 to-blue-600",
  "from-indigo-500 to-indigo-600",
  "from-violet-500 to-violet-600",
  "from-purple-500 to-purple-600",
  "from-fuchsia-500 to-fuchsia-600",
];

export default function HostDashboard() {
  const searchParams = useSearchParams();
  
  const [session, setSession] = useState<Session | null>(null);
  const [picks, setPicks] = useState<PickItem[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isWorking, setIsWorking] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [showPlayerPanel, setShowPlayerPanel] = useState(false);
  const [origin, setOrigin] = useState("");

  const loadSession = useCallback(async () => {
    const sessionId = searchParams.get("sessionId");
    const eventId = searchParams.get("eventId");

    if (sessionId) {
      const response = await fetch(`/api/game-sessions/${sessionId}`);
      const payload = await response.json();
      setSession(payload.data?.session ?? null);
      setPicks(payload.data?.picks ?? []);
      setPlayers(payload.data?.players ?? []);
      return;
    }

    const response = await fetch(eventId ? `/api/game-sessions?eventId=${eventId}` : "/api/game-sessions");
    const payload = await response.json();
    const latest = payload.data?.[0] ?? null;
    setSession(latest);
    if (latest?.id) {
      const details = await fetch(`/api/game-sessions/${latest.id}`);
      const detailsPayload = await details.json();
      setPicks(detailsPayload.data?.picks ?? []);
      setPlayers(detailsPayload.data?.players ?? []);
    }
  }, [searchParams]);

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (picks.length === 0) return;
    const nextIndex = picks.findIndex((pick) => !pick.called_at);
    setCurrentIndex(nextIndex === -1 ? picks.length - 1 : nextIndex);
  }, [picks]);

  // Auto-refresh every 5 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      void loadSession();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadSession]);

  const currentPick = picks[currentIndex];
  const previousPick = currentIndex > 0 ? picks[currentIndex - 1] : null;
  const nextPick = currentIndex < picks.length - 1 ? picks[currentIndex + 1] : null;

  const playingCount = players.filter((p) => p.status === "playing").length;
  const lobbyCount = players.filter((p) => p.status === "lobby").length;
  const calledCount = picks.filter((p) => p.called_at).length;

  const getColumnIndex = (pickIndex: number) => (pickIndex - 1) % 5;
  const getColumnLabel = (pickIndex: number) => COLUMN_LABELS[getColumnIndex(pickIndex)];
  const getColumnColor = (pickIndex: number) => COLUMN_COLORS[getColumnIndex(pickIndex)];

  const markCalled = async (pickId: number) => {
    await fetch(`/api/game-session-picks/${pickId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calledAt: new Date().toISOString() }),
    });
  };

  const handleNext = async () => {
    if (!currentPick) return;
    setIsWorking(true);
    try {
      await markCalled(currentPick.id);
      setCurrentIndex((prev) => Math.min(picks.length - 1, prev + 1));
      await loadSession();
    } finally {
      setIsWorking(false);
    }
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const updateSessionStatus = async (status: string) => {
    if (!session?.id) return;
    await fetch(`/api/game-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadSession();
  };

  const copyGameCode = () => {
    if (!session?.game_code) return;
    navigator.clipboard.writeText(session.game_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyJoinLink = () => {
    if (!session?.game_code) return;
    navigator.clipboard.writeText(`${origin}/join/${session.game_code}`);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const sortedPlayers = [...players]
    .filter((p) => p.status === "playing")
    .sort((a, b) => b.correct_count - a.correct_count);

  const bgClass = darkMode ? "bg-slate-950" : "bg-slate-100";
  const textClass = darkMode ? "text-slate-100" : "text-slate-900";
  const cardClass = darkMode ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200";
  const mutedClass = darkMode ? "text-slate-400" : "text-slate-500";

  return (
    <div className={`min-h-screen ${bgClass} ${textClass} font-sans`}>
      {/* Top Navigation Bar */}
      <header className={`sticky top-0 z-30 border-b ${darkMode ? "border-slate-800 bg-slate-950/95" : "border-slate-200 bg-white/95"} backdrop-blur-sm`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          {/* Left: Back + Logo */}
          <div className="flex items-center gap-4">
            <Link
              href="/admin/games/bingo"
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${darkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
            >
              ← Exit
            </Link>
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
                <Music className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-violet-400">Dead Wax</div>
                <div className="text-sm font-semibold">Vinyl Bingo</div>
              </div>
            </div>
          </div>

          {/* Center: Game Code */}
          <div className="flex flex-col items-center">
            <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${mutedClass}`}>Game Code</div>
            <button
              onClick={copyGameCode}
              className="group flex items-center gap-2"
            >
              <span className="font-mono text-2xl font-black tracking-wider text-violet-400 sm:text-3xl">
                {session?.game_code ?? "----"}
              </span>
              {copiedCode ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className={`h-4 w-4 ${mutedClass} opacity-0 transition group-hover:opacity-100`} />
              )}
            </button>
          </div>

          {/* Right: Stats + Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Player Stats */}
            <div className="hidden items-center gap-3 sm:flex">
              <button
                onClick={() => setShowPlayerPanel(!showPlayerPanel)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 ${darkMode ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}
              >
                <Users className="h-4 w-4" />
                <span className="font-bold">{playingCount}</span>
                <span className="text-xs">Playing</span>
              </button>
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${darkMode ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-700"}`}>
                <UserPlus className="h-4 w-4" />
                <span className="font-bold">{lobbyCount}</span>
                <span className="text-xs">Lobby</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`rounded-full p-2 ${darkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"}`}
                title="Toggle theme"
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link
                href={`/admin/games/bingo/sidekick?sessionId=${session?.id ?? ""}`}
                className={`rounded-full p-2 ${darkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"}`}
                title="Sidekick View"
                target="_blank"
              >
                <Radio className="h-4 w-4" />
              </Link>
              <Link
                href={`/admin/games/bingo/jumbotron?sessionId=${session?.id ?? ""}`}
                className={`rounded-full p-2 ${darkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"}`}
                title="Jumbotron"
                target="_blank"
              >
                <Monitor className="h-4 w-4" />
              </Link>
              <Link
                href={`/admin/games/bingo/lobby?sessionId=${session?.id ?? ""}`}
                className={`rounded-full p-2 ${darkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"}`}
                title="Lobby"
              >
                <Users className="h-4 w-4" />
              </Link>
              <Link
                href={`/admin/games/bingo/settings?sessionId=${session?.id ?? ""}`}
                className={`rounded-full p-2 ${darkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"}`}
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content - Current Song & Controls */}
          <div className="space-y-6 lg:col-span-2">
            {/* Game Status Bar */}
            <div className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border ${cardClass} p-4`}>
              <div className="flex items-center gap-4">
                <div className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  session?.status === "active"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : session?.status === "paused"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-slate-500/20 text-slate-400"
                }`}>
                  {session?.status ?? "Pending"}
                </div>
                <div className={`text-sm ${mutedClass}`}>
                  Song {calledCount} of {picks.length}
                </div>
              </div>
              <div className="flex gap-2">
                {session?.status !== "active" ? (
                  <button
                    onClick={() => updateSessionStatus("active")}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:shadow-emerald-500/40"
                  >
                    <Play className="h-4 w-4" />
                    Start Game
                  </button>
                ) : (
                  <button
                    onClick={() => updateSessionStatus("paused")}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition ${darkMode ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </button>
                )}
                <button
                  onClick={() => setShowFinishConfirm(true)}
                  className={`rounded-lg border px-4 py-2 text-sm font-bold transition ${darkMode ? "border-rose-500/50 text-rose-400 hover:bg-rose-500/10" : "border-rose-300 text-rose-600 hover:bg-rose-50"}`}
                >
                  End Game
                </button>
              </div>
            </div>

            {/* Current Song Display */}
            <div className={`overflow-hidden rounded-3xl border ${cardClass}`}>
              {/* Column Header */}
              {currentPick && (
                <div className={`bg-gradient-to-r ${getColumnColor(currentPick.pick_index)} px-6 py-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-xl font-black text-white backdrop-blur">
                        {getColumnLabel(currentPick.pick_index)}
                      </span>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-white/70">Now Playing</div>
                        <div className="text-sm font-medium text-white">Column {getColumnLabel(currentPick.pick_index)} · Song #{currentPick.pick_index}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-5 w-5 text-white/70" />
                      <div className="h-1 w-24 overflow-hidden rounded-full bg-white/20">
                        <div className="h-full w-3/4 animate-pulse rounded-full bg-white" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Song Info */}
              <div className="p-8 text-center">
                {currentPick?.game_template_items ? (
                  <>
                    <h2 className="text-3xl font-black sm:text-4xl lg:text-5xl">
                      {currentPick.game_template_items.title}
                    </h2>
                    <p className={`mt-3 text-xl ${mutedClass}`}>
                      {currentPick.game_template_items.artist}
                    </p>
                    {(currentPick.game_template_items.bpm || currentPick.game_template_items.key_signature) && (
                      <div className={`mt-4 flex items-center justify-center gap-4 text-sm ${mutedClass}`}>
                        {currentPick.game_template_items.bpm && (
                          <span className={`rounded-full px-3 py-1 ${darkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                            {currentPick.game_template_items.bpm} BPM
                          </span>
                        )}
                        {currentPick.game_template_items.key_signature && (
                          <span className={`rounded-full px-3 py-1 ${darkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                            Key: {currentPick.game_template_items.key_signature}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className={`text-xl ${mutedClass}`}>No song selected</div>
                )}
              </div>

              {/* Navigation Controls */}
              <div className={`flex items-center justify-between border-t px-6 py-4 ${darkMode ? "border-slate-800" : "border-slate-200"}`}>
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className={`flex items-center gap-2 rounded-xl px-4 py-3 font-bold transition disabled:opacity-30 ${darkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >
                  <SkipBack className="h-5 w-5" />
                  Previous
                </button>

                <div className="text-center">
                  {previousPick?.game_template_items && (
                    <div className={`text-xs ${mutedClass}`}>
                      Last: {previousPick.game_template_items.title}
                    </div>
                  )}
                  {nextPick?.game_template_items && (
                    <div className={`mt-1 text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                      Next: {nextPick.game_template_items.title}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleNext}
                  disabled={currentIndex >= picks.length - 1 || isWorking}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3 font-bold text-white shadow-lg shadow-violet-500/25 transition hover:shadow-violet-500/40 disabled:opacity-30"
                >
                  Next Song
                  <SkipForward className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Pick List */}
            <div className={`rounded-2xl border ${cardClass}`}>
              <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? "border-slate-800" : "border-slate-200"}`}>
                <h3 className="font-bold">Song Queue</h3>
                <span className={`text-sm ${mutedClass}`}>{calledCount} / {picks.length} called</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {picks.map((pick, index) => {
                  const isCurrent = index === currentIndex;
                  const isCalled = Boolean(pick.called_at);
                  const columnIdx = getColumnIndex(pick.pick_index);

                  return (
                    <button
                      key={pick.id}
                      onClick={() => setCurrentIndex(index)}
                      className={`flex w-full items-center gap-4 px-5 py-3 text-left transition ${
                        isCurrent
                          ? darkMode
                            ? "bg-violet-500/10 border-l-4 border-violet-500"
                            : "bg-violet-50 border-l-4 border-violet-500"
                          : isCalled
                          ? darkMode
                            ? "bg-slate-800/50 opacity-60"
                            : "bg-slate-50 opacity-60"
                          : darkMode
                          ? "hover:bg-slate-800/50"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold text-white ${COLUMN_COLORS[columnIdx]}`}
                      >
                        {COLUMN_LABELS[columnIdx]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`truncate font-semibold ${isCalled && !isCurrent ? "line-through opacity-70" : ""}`}>
                          {pick.game_template_items?.title ?? "Unknown"}
                        </div>
                        <div className={`truncate text-sm ${mutedClass}`}>
                          {pick.game_template_items?.artist ?? ""}
                        </div>
                      </div>
                      <div className={`text-sm tabular-nums ${mutedClass}`}>
                        #{pick.pick_index}
                      </div>
                      {isCalled && (
                        <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Players & Info */}
          <div className="space-y-6">
            {/* Join Info Card */}
            <div className={`rounded-2xl border ${cardClass} p-5`}>
              <div className={`text-xs font-bold uppercase tracking-wider ${mutedClass}`}>Join URL</div>
              <div className={`mt-2 break-all rounded-lg p-3 font-mono text-sm ${darkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                {origin}/join/{session?.game_code ?? "----"}
              </div>
              <button
                onClick={copyJoinLink}
                className="mt-3 w-full rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
              >
                {copiedCode ? "Copied!" : "Copy Join Link"}
              </button>
            </div>

            {/* Quick Actions */}
            <div className={`grid grid-cols-2 gap-3`}>
              <Link
                href={`/admin/games/bingo/sidekick?sessionId=${session?.id ?? ""}`}
                target="_blank"
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${darkMode ? "border-slate-800 bg-slate-900/50 hover:bg-slate-800" : "border-slate-200 bg-white hover:bg-slate-50"}`}
              >
                <Radio className="h-6 w-6 text-violet-400" />
                <span className="text-xs font-bold">Sidekick</span>
              </Link>
              <Link
                href={`/admin/games/bingo/jumbotron?sessionId=${session?.id ?? ""}`}
                target="_blank"
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${darkMode ? "border-slate-800 bg-slate-900/50 hover:bg-slate-800" : "border-slate-200 bg-white hover:bg-slate-50"}`}
              >
                <Monitor className="h-6 w-6 text-fuchsia-400" />
                <span className="text-xs font-bold">Jumbotron</span>
              </Link>
            </div>

            {/* Player Leaderboard */}
            <div className={`rounded-2xl border ${cardClass}`}>
              <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? "border-slate-800" : "border-slate-200"}`}>
                <h3 className="font-bold">Player Progress</h3>
                <span className={`text-xs ${mutedClass}`}>Sorted by progress</span>
              </div>
              {sortedPlayers.length === 0 ? (
                <div className={`p-5 text-center text-sm ${mutedClass}`}>
                  No players yet. Share the game code!
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {sortedPlayers.map((player, idx) => (
                    <div
                      key={player.id}
                      className={`flex items-center gap-3 px-5 py-3 ${idx < sortedPlayers.length - 1 ? (darkMode ? "border-b border-slate-800" : "border-b border-slate-100") : ""}`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0 ? "bg-amber-500/20 text-amber-400" :
                        idx === 1 ? "bg-slate-400/20 text-slate-400" :
                        idx === 2 ? "bg-orange-500/20 text-orange-400" :
                        darkMode ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-500"
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{player.display_name}</div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-emerald-400">{player.correct_count} ✓</span>
                          <span className={mutedClass}>{player.missed_count} missed</span>
                          {player.wrong_count > 0 && (
                            <span className="text-rose-400">{player.wrong_count} ✗</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Game Info */}
            <div className={`rounded-2xl border ${cardClass} p-5`}>
              <div className={`text-xs font-bold uppercase tracking-wider ${mutedClass}`}>Game Settings</div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className={mutedClass}>Variant</span>
                  <span className="font-medium capitalize">{session?.variant ?? "Standard"}</span>
                </div>
                <div className="flex justify-between">
                  <span className={mutedClass}>Target</span>
                  <span className="font-medium capitalize">{session?.bingo_target?.replace("_", " ") ?? "One Line"}</span>
                </div>
                <div className="flex justify-between">
                  <span className={mutedClass}>Total Songs</span>
                  <span className="font-medium">{picks.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Finish Game Modal */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl p-6 text-center ${darkMode ? "bg-slate-900" : "bg-white"}`}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/20">
              <Eye className="h-7 w-7 text-rose-400" />
            </div>
            <h3 className="text-xl font-bold">End this game?</h3>
            <p className={`mt-2 text-sm ${mutedClass}`}>
              This will finish the current game for all players and display the final results.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className={`flex-1 rounded-xl px-4 py-3 font-bold transition ${darkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  void updateSessionStatus("finished");
                  setShowFinishConfirm(false);
                }}
                className="flex-1 rounded-xl bg-rose-500 px-4 py-3 font-bold text-white transition hover:bg-rose-600"
              >
                End Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}