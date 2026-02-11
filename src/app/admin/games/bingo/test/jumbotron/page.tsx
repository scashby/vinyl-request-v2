// Path: src/app/admin/games/bingo/test/jumbotron/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Settings, Maximize, Volume2, VolumeX, X } from "lucide-react";

type Session = {
  id: number;
  game_code: string;
  status: string;
  current_pick_index: number;
  game_templates: { name: string };
};

type Pick = {
  id: number;
  pick_index: number;
  status: string;
  game_template_items: { title: string; artist: string };
};

const COLS = [
  { letter: "B", bg: "bg-blue-500" },
  { letter: "I", bg: "bg-green-500" },
  { letter: "N", bg: "bg-yellow-500" },
  { letter: "G", bg: "bg-orange-500" },
  { letter: "O", bg: "bg-red-500" },
];

export default function JumbotronPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<Session | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [muted, setMuted] = useState(true);
  const [settings, setSettings] = useState({ pregameVideo: "", defaultVideo: "", showQR: true, showLogo: true });

  const currentIdx = session?.current_pick_index ?? 0;
  const currentPick = picks.find((p) => p.pick_index === currentIdx);
  const col = COLS[currentIdx % 5];
  const recentPlayed = picks.filter((p) => p.status === "played").slice(-3).reverse();

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    const [sRes, pRes] = await Promise.all([
      fetch(`/api/game-sessions/${sessionId}`),
      fetch(`/api/game-sessions/${sessionId}/picks`),
    ]);
    if (sRes.ok) setSession(await sRes.json());
    if (pRes.ok) {
      const d = await pRes.json();
      setPicks((d.data ?? d).sort((a: Pick, b: Pick) => a.pick_index - b.pick_index));
    }
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const i = setInterval(fetchData, 2000);
    return () => clearInterval(i);
  }, [fetchData]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const isPregame = session?.status === "pending" || !session;
  const videoUrl = isPregame ? settings.pregameVideo : settings.defaultVideo;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0d0a14]">
      {/* Video Background */}
      {videoUrl && (
        <iframe
          className="pointer-events-none absolute inset-0 h-full w-full scale-110"
          src={`${videoUrl}${videoUrl.includes("?") ? "&" : "?"}autoplay=1&loop=1&controls=0&mute=${muted ? 1 : 0}`}
          allow="autoplay; fullscreen"
        />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/50" />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col p-8">
        {/* Top: Logo & Controls */}
        <div className="flex items-start justify-between">
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

          <div className="flex gap-2 opacity-0 transition-opacity hover:opacity-100">
            <button onClick={() => setMuted(!muted)} className="rounded-lg bg-black/50 p-2 text-white backdrop-blur hover:bg-black/70">
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <button onClick={toggleFullscreen} className="rounded-lg bg-black/50 p-2 text-white backdrop-blur hover:bg-black/70">
              <Maximize className="h-5 w-5" />
            </button>
            <button onClick={() => setShowSettings(true)} className="rounded-lg bg-black/50 p-2 text-white backdrop-blur hover:bg-black/70">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Center: Current Song */}
        <div className="flex flex-1 items-center justify-center">
          {isPregame ? (
            <div className="text-center">
              <p className="mb-4 text-2xl text-white/60">Join the game!</p>
              <p className="text-8xl font-bold tracking-[0.25em] text-pink-500 drop-shadow-2xl">{session?.game_code ?? "----"}</p>
              <p className="mt-4 text-xl text-white/60">rockstar.bingo</p>
            </div>
          ) : currentPick ? (
            <div className="text-center">
              <div className={`mx-auto mb-8 flex h-36 w-36 items-center justify-center rounded-3xl text-8xl font-bold text-white shadow-2xl ${col.bg}`}>
                {col.letter}
              </div>
              <h1 className="text-6xl font-bold text-white drop-shadow-lg">{currentPick.game_template_items.title}</h1>
              <p className="mt-4 text-3xl text-white/70">{currentPick.game_template_items.artist}</p>
            </div>
          ) : (
            <p className="text-2xl text-white/60">Game Over!</p>
          )}
        </div>

        {/* Bottom */}
        <div className="flex items-end justify-between">
          {/* Recently Played */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">Recently Played</p>
            {recentPlayed.length === 0 ? (
              <p className="text-sm text-white/30">No songs yet</p>
            ) : (
              <div className="space-y-1">
                {recentPlayed.map((p) => {
                  const c = COLS[p.pick_index % 5];
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white ${c.bg}`}>
                        {c.letter}
                      </div>
                      <span className="text-sm text-white/80">
                        {p.game_template_items.title} - {p.game_template_items.artist}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Game Code & QR */}
          <div className="text-right">
            {settings.showQR && (
              <div className="mb-2 inline-block rounded-lg bg-white p-2">
                <div className="flex h-20 w-20 items-center justify-center text-xs text-gray-400">QR</div>
              </div>
            )}
            <p className="text-sm text-white/50">Game Code</p>
            <p className="text-4xl font-bold tracking-widest text-pink-500">{session?.game_code ?? "----"}</p>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-md rounded-2xl bg-[#252236] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Jumbotron Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-white/60 hover:text-white">
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
                <label className="mb-1 block text-sm text-white/60">Default Video URL</label>
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
                  className={`h-6 w-11 rounded-full transition ${settings.showQR ? "bg-pink-500" : "bg-white/20"}`}
                >
                  <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.showQR ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white">Show Logo</span>
                <button
                  onClick={() => setSettings({ ...settings, showLogo: !settings.showLogo })}
                  className={`h-6 w-11 rounded-full transition ${settings.showLogo ? "bg-pink-500" : "bg-white/20"}`}
                >
                  <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.showLogo ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
            <button onClick={() => setShowSettings(false)} className="mt-6 w-full rounded-lg bg-gradient-to-r from-pink-500 to-rose-600 py-2 font-semibold text-white">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}