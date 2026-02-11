// Path: src/app/admin/games/bingo/test/jumbotron/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Settings, Maximize, Volume2, VolumeX, X } from "lucide-react";

type GameSession = {
  id: number;
  game_code: string;
  status: string;
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

// B-I-N-G-O colors
const COLUMN_COLORS = ["bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-orange-500", "bg-red-500"];
const COLUMN_LETTERS = ["B", "I", "N", "G", "O"];

export default function JumbotronPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<GameSession | null>(null);
  const [picks, setPicks] = useState<PickItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [settings, setSettings] = useState({
    pregameVideo: "",
    defaultVideo: "",
    showQR: true,
    showLogo: true,
  });

  const currentIndex = session?.current_pick_index ?? 0;
  const currentPick = picks.find((p) => p.pick_index === currentIndex);
  const playedPicks = picks.filter((p) => p.status === "played").slice(-3).reverse();

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [sessionRes, picksRes] = await Promise.all([
        fetch(`/api/game-sessions/${sessionId}`),
        fetch(`/api/game-sessions/${sessionId}/picks`),
      ]);

      if (sessionRes.ok) setSession(await sessionRes.json());
      if (picksRes.ok) {
        const data = await picksRes.json();
        setPicks((data.data ?? data).sort((a: PickItem, b: PickItem) => a.pick_index - b.pick_index));
      }
    } catch (error) {
      console.error("Failed to fetch:", error);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const isGameActive = session?.status === "active";
  const isPregame = session?.status === "pending" || !session;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#1a1625]">
      {/* Video Background */}
      {(isPregame && settings.pregameVideo) || (isGameActive && settings.defaultVideo) ? (
        <iframe
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          src={`${isPregame ? settings.pregameVideo : settings.defaultVideo}${
            isMuted ? "&mute=1" : ""
          }&autoplay=1&loop=1&controls=0&showinfo=0`}
          allow="autoplay; fullscreen"
          style={{ border: "none" }}
        />
      ) : (
        /* Animated gradient background when no video */
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1625] via-[#2d1f47] to-[#1a1625]">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute left-1/4 top-1/4 h-96 w-96 animate-pulse rounded-full bg-pink-500/20 blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 h-96 w-96 animate-pulse rounded-full bg-purple-500/20 blur-3xl" style={{ animationDelay: "1s" }} />
          </div>
        </div>
      )}

      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Main Content */}
      <div className="relative z-10 flex h-full flex-col p-8">
        {/* Top Bar: Logo & Controls */}
        <div className="flex items-start justify-between">
          {/* Logo */}
          {settings.showLogo && (
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg">
                <span className="text-2xl text-white">★</span>
              </div>
              <div>
                <div className="text-xl font-bold text-white">Rockstar Bingo</div>
                <div className="text-sm text-white/60">{session?.game_templates.name}</div>
              </div>
            </div>
          )}

          {/* Controls (only visible on hover/tap) */}
          <div className="flex items-center gap-2 opacity-0 transition-opacity hover:opacity-100">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="rounded-lg bg-black/50 p-2 text-white backdrop-blur transition-colors hover:bg-black/70"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="rounded-lg bg-black/50 p-2 text-white backdrop-blur transition-colors hover:bg-black/70"
            >
              <Maximize className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-lg bg-black/50 p-2 text-white backdrop-blur transition-colors hover:bg-black/70"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Center: Current Song or Waiting */}
        <div className="flex flex-1 items-center justify-center">
          {isPregame ? (
            <div className="text-center">
              <div className="mb-4 text-2xl text-white/60">Waiting for game to start...</div>
              <div className="text-8xl font-bold tracking-[0.2em] text-pink-500 drop-shadow-2xl">
                {session?.game_code ?? "----"}
              </div>
              <div className="mt-4 text-xl text-white/60">Join at rockstar.bingo</div>
            </div>
          ) : currentPick ? (
            <div className="text-center">
              {/* B-I-N-G-O Letter */}
              <div
                className={`mx-auto mb-8 flex h-32 w-32 items-center justify-center rounded-3xl text-7xl font-bold text-white shadow-2xl ${
                  COLUMN_COLORS[currentIndex % 5]
                }`}
              >
                {COLUMN_LETTERS[currentIndex % 5]}
              </div>
              {/* Song Info */}
              <div className="text-6xl font-bold text-white drop-shadow-lg">
                {currentPick.game_template_items.title}
              </div>
              <div className="mt-4 text-3xl text-white/80">
                {currentPick.game_template_items.artist}
              </div>
            </div>
          ) : (
            <div className="text-center text-2xl text-white/60">Game finished!</div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="flex items-end justify-between">
          {/* Last 3 Songs */}
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-white/50">Recently Played</div>
            {playedPicks.length === 0 ? (
              <div className="text-sm text-white/40">No songs played yet</div>
            ) : (
              playedPicks.map((pick) => (
                <div key={pick.id} className="flex items-center gap-2">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white ${
                      COLUMN_COLORS[pick.pick_index % 5]
                    }`}
                  >
                    {COLUMN_LETTERS[pick.pick_index % 5]}
                  </div>
                  <div className="text-sm text-white/80">
                    {pick.game_template_items.title} - {pick.game_template_items.artist}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Game Code & QR */}
          <div className="text-right">
            {settings.showQR && (
              <div className="mb-2 inline-block rounded-lg bg-white p-2">
                {/* QR Code placeholder */}
                <div className="flex h-20 w-20 items-center justify-center text-xs text-gray-400">
                  QR
                </div>
              </div>
            )}
            <div className="text-lg text-white/60">Game Code</div>
            <div className="text-4xl font-bold tracking-widest text-pink-500">
              {session?.game_code ?? "----"}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl bg-[#252236] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Jumbotron Settings</h2>
              <button onClick={() => setShowSettings(false)} className="rounded-lg p-2 text-white/60 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-white/60">Pre-game Video URL</label>
                <input
                  type="text"
                  value={settings.pregameVideo}
                  onChange={(e) => setSettings({ ...settings, pregameVideo: e.target.value })}
                  placeholder="YouTube or Vimeo URL"
                  className="w-full rounded-lg bg-[#1a1625] px-3 py-2 text-white placeholder-white/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/60">Default Video URL (during game)</label>
                <input
                  type="text"
                  value={settings.defaultVideo}
                  onChange={(e) => setSettings({ ...settings, defaultVideo: e.target.value })}
                  placeholder="YouTube or Vimeo URL"
                  className="w-full rounded-lg bg-[#1a1625] px-3 py-2 text-white placeholder-white/30"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white">Show QR Code</span>
                <button
                  onClick={() => setSettings({ ...settings, showQR: !settings.showQR })}
                  className={`h-6 w-11 rounded-full transition-colors ${
                    settings.showQR ? "bg-pink-500" : "bg-white/20"
                  }`}
                >
                  <div
                    className={`h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      settings.showQR ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white">Show Logo</span>
                <button
                  onClick={() => setSettings({ ...settings, showLogo: !settings.showLogo })}
                  className={`h-6 w-11 rounded-full transition-colors ${
                    settings.showLogo ? "bg-pink-500" : "bg-white/20"
                  }`}
                >
                  <div
                    className={`h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      settings.showLogo ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="mt-6 w-full rounded-lg bg-gradient-to-r from-pink-500 to-rose-600 py-2 font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}