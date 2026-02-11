// Path: src/app/admin/games/bingo/jumbotron/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Volume2, VolumeX, Settings, Maximize, Music } from "lucide-react";

type PickItem = {
  id: number;
  pick_index: number;
  called_at: string | null;
  game_template_items: {
    id: number;
    title: string;
    artist: string;
  } | null;
};

type Session = {
  id: number;
  game_code: string | null;
  status: string;
};

const COLUMN_LABELS = ["B", "I", "N", "G", "O"];
const COLUMN_COLORS = [
  { bg: "bg-blue-500", text: "text-blue-500", glow: "shadow-blue-500/50" },
  { bg: "bg-indigo-500", text: "text-indigo-500", glow: "shadow-indigo-500/50" },
  { bg: "bg-violet-500", text: "text-violet-500", glow: "shadow-violet-500/50" },
  { bg: "bg-purple-500", text: "text-purple-500", glow: "shadow-purple-500/50" },
  { bg: "bg-fuchsia-500", text: "text-fuchsia-500", glow: "shadow-fuchsia-500/50" },
];

export default function JumbotronPage() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [picks, setPicks] = useState<PickItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showGameCode, setShowGameCode] = useState(true);
  const [showCurrentSong, setShowCurrentSong] = useState(true);
  const [videoUrl, setVideoUrl] = useState("");
  const [pregameVideoUrl, setPregameVideoUrl] = useState("");
  const [theme, setTheme] = useState<"dark" | "transparent">("dark");
  const [animateChange, setAnimateChange] = useState(false);
  const [lastSongId, setLastSongId] = useState<number | null>(null);

  const loadSession = useCallback(async () => {
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return;

    const response = await fetch(`/api/game-sessions/${sessionId}`);
    const payload = await response.json();
    setSession(payload.data?.session ?? null);
    setPicks(payload.data?.picks ?? []);
  }, [searchParams]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (picks.length === 0) return;
    const calledPicks = picks.filter((p) => p.called_at);
    const lastCalled = calledPicks.length > 0 ? calledPicks.length - 1 : 0;
    setCurrentIndex(lastCalled);
  }, [picks]);

  // Detect song changes for animation
  useEffect(() => {
    const currentSongId = picks[currentIndex]?.id;
    if (currentSongId && currentSongId !== lastSongId) {
      setAnimateChange(true);
      setLastSongId(currentSongId);
      const timer = setTimeout(() => setAnimateChange(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, picks, lastSongId]);

  // Auto-refresh every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void loadSession();
    }, 2000);
    return () => clearInterval(interval);
  }, [loadSession]);

  const currentPick = picks[currentIndex];
  const isActive = session?.status === "active";
  const isPregame = session?.status === "pending" || !session;

  const getColumnIndex = (pickIndex: number) => (pickIndex - 1) % 5;
  const getColumnLabel = (pickIndex: number) => COLUMN_LABELS[getColumnIndex(pickIndex)];
  const getColumnColors = (pickIndex: number) => COLUMN_COLORS[getColumnIndex(pickIndex)];

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const activeVideoUrl = isPregame ? pregameVideoUrl : videoUrl;

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Video Background */}
      {activeVideoUrl && (
        <div className="absolute inset-0 z-0">
          <iframe
            src={`${activeVideoUrl}${activeVideoUrl.includes("?") ? "&" : "?"}autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&controls=0&showinfo=0&modestbranding=1`}
            className="h-full w-full object-cover"
            allow="autoplay; fullscreen"
            style={{ transform: "scale(1.2)" }}
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}

      {/* Animated Background Gradient (when no video) */}
      {!activeVideoUrl && (
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-violet-950/30 to-slate-950" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] animate-pulse rounded-full bg-violet-500/20 blur-[120px]" />
            <div className="absolute -right-1/4 bottom-0 h-[600px] w-[600px] animate-pulse rounded-full bg-fuchsia-500/20 blur-[150px]" style={{ animationDelay: "1s" }} />
          </div>
        </div>
      )}

      {/* Controls Overlay - Top Right */}
      <div className="absolute right-4 top-4 z-50 flex items-center gap-2">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="rounded-full bg-black/50 p-3 text-white/70 backdrop-blur transition hover:bg-black/70 hover:text-white"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="rounded-full bg-black/50 p-3 text-white/70 backdrop-blur transition hover:bg-black/70 hover:text-white"
        >
          <Settings className="h-5 w-5" />
        </button>
        <button
          onClick={toggleFullscreen}
          className="rounded-full bg-black/50 p-3 text-white/70 backdrop-blur transition hover:bg-black/70 hover:text-white"
        >
          <Maximize className="h-5 w-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-8 py-12">
        {/* Game Code - Top */}
        {showGameCode && (
          <div className="mb-12 text-center">
            <div className="mb-2 text-sm font-bold uppercase tracking-[0.4em] text-white/50">
              Join the Game
            </div>
            <div className="font-mono text-6xl font-black tracking-[0.2em] text-white drop-shadow-2xl sm:text-7xl lg:text-8xl">
              {session?.game_code ?? "----"}
            </div>
            <div className="mt-4 text-lg text-white/60">
              rockstar.bingo/join · {session?.game_code ?? ""}
            </div>
          </div>
        )}

        {/* Current Song Display */}
        {showCurrentSong && currentPick?.game_template_items && isActive && (
          <div className={`text-center transition-all duration-500 ${animateChange ? "scale-110 opacity-100" : "scale-100 opacity-100"}`}>
            {/* Column Badge */}
            <div className="mb-6 flex justify-center">
              <div className={`flex h-24 w-24 items-center justify-center rounded-3xl ${getColumnColors(currentPick.pick_index).bg} text-5xl font-black text-white shadow-2xl ${getColumnColors(currentPick.pick_index).glow}`}>
                {getColumnLabel(currentPick.pick_index)}
              </div>
            </div>

            {/* Song Title */}
            <h1 className={`mb-4 text-5xl font-black leading-tight drop-shadow-2xl sm:text-6xl lg:text-7xl xl:text-8xl ${animateChange ? "animate-pulse" : ""}`}>
              {currentPick.game_template_items.title}
            </h1>

            {/* Artist */}
            <p className="text-2xl text-white/70 sm:text-3xl lg:text-4xl">
              {currentPick.game_template_items.artist}
            </p>

            {/* Progress */}
            <div className="mt-8 flex items-center justify-center gap-4 text-white/50">
              <span className="text-lg">Song {currentIndex + 1} of {picks.length}</span>
              <div className="h-2 w-48 overflow-hidden rounded-full bg-white/20">
                <div
                  className={`h-full rounded-full ${getColumnColors(currentPick.pick_index).bg} transition-all duration-500`}
                  style={{ width: `${((currentIndex + 1) / picks.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Pre-game Screen */}
        {isPregame && (
          <div className="text-center">
            <div className="mb-8 flex justify-center">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-2xl shadow-violet-500/30">
                <Music className="h-16 w-16 text-white" />
              </div>
            </div>
            <h1 className="mb-4 text-5xl font-black sm:text-6xl lg:text-7xl">
              Music Bingo
            </h1>
            <p className="text-2xl text-white/60">
              Game starting soon...
            </p>
          </div>
        )}

        {/* Game Finished */}
        {session?.status === "finished" && (
          <div className="text-center">
            <div className="mb-8 text-8xl">🎉</div>
            <h1 className="mb-4 text-5xl font-black sm:text-6xl">
              Game Over!
            </h1>
            <p className="text-2xl text-white/60">
              Thanks for playing!
            </p>
          </div>
        )}
      </div>

      {/* Branding Footer */}
      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/30">
          Powered by Dead Wax Dialogues
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Jumbotron Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {/* Display Options */}
              <div>
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Display Options</div>
                <div className="space-y-3">
                  <label className="flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3">
                    <span>Show Game Code</span>
                    <button
                      onClick={() => setShowGameCode(!showGameCode)}
                      className={`h-6 w-11 rounded-full p-1 transition ${showGameCode ? "bg-violet-500" : "bg-slate-700"}`}
                    >
                      <span className={`block h-4 w-4 rounded-full bg-white transition ${showGameCode ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3">
                    <span>Show Current Song</span>
                    <button
                      onClick={() => setShowCurrentSong(!showCurrentSong)}
                      className={`h-6 w-11 rounded-full p-1 transition ${showCurrentSong ? "bg-violet-500" : "bg-slate-700"}`}
                    >
                      <span className={`block h-4 w-4 rounded-full bg-white transition ${showCurrentSong ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </label>
                </div>
              </div>

              {/* Video Backgrounds */}
              <div>
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Video Backgrounds</div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-400">Pre-game Video (YouTube/Vimeo URL)</label>
                    <input
                      type="url"
                      value={pregameVideoUrl}
                      onChange={(e) => setPregameVideoUrl(e.target.value)}
                      placeholder="https://youtube.com/embed/..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-400">In-game Video (YouTube/Vimeo URL)</label>
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://youtube.com/embed/..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Theme */}
              <div>
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Theme</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTheme("dark")}
                    className={`rounded-xl px-4 py-3 text-sm font-bold transition ${theme === "dark" ? "bg-violet-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => setTheme("transparent")}
                    className={`rounded-xl px-4 py-3 text-sm font-bold transition ${theme === "transparent" ? "bg-violet-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                  >
                    Transparent
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="mt-6 w-full rounded-xl bg-violet-500 px-4 py-3 font-bold text-white transition hover:bg-violet-600"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* CSS for custom animations */}
      <style jsx global>{`
        @keyframes glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}