// Path: src/app/admin/games/bingo/test/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, History, Settings, X, Plus } from "lucide-react";

type GameTemplate = {
  id: number;
  name: string;
  description: string | null;
  image_url?: string | null;
  item_count?: number;
  source?: string;
};

type TemplateItem = {
  id: number;
  title: string;
  artist: string;
};

// Placeholder images for demo - in production these come from the database
const PLAYLIST_IMAGES: Record<string, string> = {
  "Sing A Long Hits Vol. 1": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=200&fit=crop",
  "Sing A Long Hits Vol. 2": "https://images.unsplash.com/photo-1529518969858-8baa65152fc8?w=400&h=200&fit=crop",
  "One Hit Wonders": "https://images.unsplash.com/photo-1619983081563-430f63602796?w=400&h=200&fit=crop",
  "80's Hits": "https://images.unsplash.com/photo-1557683316-973673baf926?w=400&h=200&fit=crop",
  "Party Jamz": "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=200&fit=crop",
  "Christmas": "https://images.unsplash.com/photo-1512389142860-9c449e58a814?w=400&h=200&fit=crop",
  "90's Hits": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=200&fit=crop",
  "70's Hits": "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&h=200&fit=crop",
  "2000's Hits": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=200&fit=crop",
  "Women of Pop": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=200&fit=crop",
  "Yacht Rock": "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=400&h=200&fit=crop",
  "Boybands vs Girlbands": "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=400&h=200&fit=crop",
};

// Gradient fallbacks for playlists without images
const GRADIENTS = [
  "from-orange-500 to-red-600",
  "from-cyan-500 to-blue-600",
  "from-pink-500 to-purple-600",
  "from-violet-500 to-purple-700",
  "from-yellow-400 to-orange-500",
  "from-green-400 to-cyan-500",
  "from-rose-400 to-pink-600",
  "from-indigo-500 to-violet-600",
];

export default function BingoPlaylistsPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [previewPlaylist, setPreviewPlaylist] = useState<GameTemplate | null>(null);
  const [previewItems, setPreviewItems] = useState<TemplateItem[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const systemPlaylists = templates.filter(
    (t) => t.source === "featured" || t.source === "system"
  );
  const customPlaylists = templates.filter(
    (t) => !t.source || t.source === "custom"
  );

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/game-templates");
        if (res.ok) {
          const d = await res.json();
          setTemplates(d.data ?? d ?? []);
        }
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const openPreview = async (playlist: GameTemplate) => {
    setPreviewPlaylist(playlist);
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/game-templates/${playlist.id}/items`);
      if (res.ok) {
        const d = await res.json();
        setPreviewItems(d.data ?? d ?? []);
      }
    } finally {
      setLoadingPreview(false);
    }
  };

  const startGame = () => {
    if (previewPlaylist) {
      router.push(`/admin/games/bingo/test/setup?templateId=${previewPlaylist.id}`);
    }
  };

  const getPlaylistImage = (name: string) => {
    return PLAYLIST_IMAGES[name] || null;
  };

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
          <div className="flex items-center gap-1 text-lg font-medium tracking-wide">
            <span>rockstar</span>
            <span className="text-purple-400">★</span>
            <span>bingo</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push("/admin/games/bingo/test/history")}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
            >
              <History className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-10">
            {/* Title Section */}
            <div>
              <h1 className="text-2xl font-bold">Music Bingo</h1>
              <p className="mt-1 text-gray-400">
                Choose a playlist below to start a game of music bingo.
              </p>
              <button className="mt-2 text-sm font-medium uppercase tracking-wide text-cyan-400 hover:text-cyan-300">
                Change Game Type
              </button>
            </div>

            {/* Our Playlists */}
            <section>
              <h2 className="mb-2 text-lg font-semibold">Our Playlists</h2>
              <p className="mb-4 text-sm text-gray-400">
                Try one of our suggested playlists.
              </p>
              {systemPlaylists.length === 0 ? (
                <p className="text-gray-500">No featured playlists available</p>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {systemPlaylists.map((p, i) => {
                    const img = getPlaylistImage(p.name);
                    return (
                      <button
                        key={p.id}
                        onClick={() => openPreview(p)}
                        className="group relative aspect-[2/1] overflow-hidden rounded-lg text-left transition-transform hover:scale-[1.02]"
                      >
                        {img ? (
                          <Image
                            src={img}
                            alt={p.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div
                            className={`absolute inset-0 bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]}`}
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 p-3">
                          <div className="font-semibold text-white drop-shadow-lg">
                            {p.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Your Custom Playlists */}
            <section>
              <div className="mb-2 flex items-center gap-3">
                <h2 className="text-lg font-semibold">Your Custom Playlists</h2>
                <button className="text-sm font-medium uppercase tracking-wide text-cyan-400 hover:text-cyan-300">
                  Edit
                </button>
              </div>
              <p className="mb-4 text-sm text-gray-400">
                Playlists you&apos;ve imported and fine-tuned to perfection.
              </p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {/* Create New */}
                <button
                  onClick={() =>
                    router.push("/admin/games/bingo/test/playlists/create")
                  }
                  className="group flex aspect-[2/1] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-purple-500/50 bg-transparent transition-colors hover:border-purple-400 hover:bg-purple-500/5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-current text-purple-400 group-hover:text-purple-300">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-300 group-hover:text-white">
                    Create a Custom Playlist
                  </span>
                </button>

                {customPlaylists.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => openPreview(p)}
                    className={`group relative aspect-[2/1] overflow-hidden rounded-lg text-left transition-transform hover:scale-[1.02] bg-gradient-to-br ${GRADIENTS[(i + 3) % GRADIENTS.length]}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-0 left-0 p-3">
                      <div className="font-semibold text-white">{p.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Vinyl Section */}
            <section>
              <div className="rounded-xl bg-[#1a1a1a] p-6">
                <h2 className="text-lg font-semibold">
                  Vinyl-First Playback
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  All game calls are played from your vinyl collection. Build large crates (75-100 tracks)
                  and randomize each session from that curated pool.
                </p>
                <div className="mt-4 rounded-lg border border-white/10 bg-[#202020] px-4 py-3 text-sm text-gray-300">
                  Tip: stage upcoming records by round and keep backup tracks from the same session pool.
                </div>
              </div>
            </section>

            {/* Terms */}
            <p className="text-center text-xs text-gray-500">
              By continuing, I acknowledge and confirm that I have read the{" "}
              <a href="#" className="text-cyan-400 hover:underline">
                terms of service
              </a>{" "}
              and I agree to be bound by such terms.
            </p>
          </div>
        )}
      </main>

      {/* Preview Modal */}
      {previewPlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-lg rounded-xl bg-[#1a1a1a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <h2 className="text-lg font-semibold">
                Preview: {previewPlaylist.name}
              </h2>
              <button
                onClick={() => setPreviewPlaylist(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-gray-400">Possible Songs:</span>
                <span className="rounded bg-purple-600 px-2 py-0.5 text-sm font-semibold">
                  {previewPlaylist.item_count || previewItems.length}
                </span>
              </div>
              <div className="max-h-80 space-y-1 overflow-y-auto">
                {loadingPreview ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  </div>
                ) : previewItems.length === 0 ? (
                  <p className="py-8 text-center text-gray-500">
                    No songs in this playlist
                  </p>
                ) : (
                  previewItems.map((item) => (
                    <div key={item.id} className="py-2">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm uppercase tracking-wide text-gray-400">
                        {item.artist}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="p-4">
              <button
                onClick={startGame}
                className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 py-3 font-semibold uppercase tracking-wide transition hover:from-purple-500 hover:to-violet-500"
              >
                Create Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-lg rounded-xl bg-[#1a1a1a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-semibold">Settings</h2>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              {/* Account */}
              <div className="rounded-lg bg-[#252525] p-4">
                <h3 className="font-semibold">Account</h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-gray-400">steve@deadwaxdialogues.com</span>
                  <span className="rounded bg-green-600 px-2 py-0.5 text-xs font-semibold uppercase">
                    Free
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  You can host up to <strong className="text-white">5 guests</strong> per game
                </p>
                <button className="mt-3 w-full rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 py-2.5 font-semibold uppercase tracking-wide">
                  Upgrade Account
                </button>
                <button className="mt-2 w-full rounded-lg border border-purple-500 py-2.5 font-semibold uppercase tracking-wide text-purple-400 hover:bg-purple-500/10">
                  Logout
                </button>
              </div>

              {/* Playback */}
              <div className="rounded-lg bg-[#252525] p-4">
                <h3 className="font-semibold">Playback Source</h3>
                <p className="mt-1 text-sm text-gray-400">
                  This game mode is vinyl-only. No external streaming account is required.
                </p>
                <div className="mt-3 rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-gray-300">
                  Vinyl mode enabled
                </div>
              </div>

              {/* Color Mode */}
              <div className="rounded-lg bg-[#252525] p-4">
                <h3 className="font-semibold">Color Mode</h3>
                <div className="mt-3 flex rounded-lg bg-[#1a1a1a] p-1">
                  <button className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-gray-400 transition hover:text-white">
                    AUTO
                  </button>
                  <button className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-gray-400 transition hover:text-white">
                    LIGHT
                  </button>
                  <button className="flex-1 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white">
                    ✓ DARK
                  </button>
                </div>
              </div>

              {/* Links */}
              <button className="flex w-full items-center justify-between rounded-lg bg-[#252525] p-4 text-left hover:bg-[#2a2a2a]">
                <div>
                  <h3 className="font-semibold">Branding Settings</h3>
                  <p className="text-sm text-gray-400">
                    Customize how your brand appears throughout the application.
                  </p>
                </div>
                <ChevronLeft className="h-5 w-5 rotate-180 text-gray-400" />
              </button>

              <button className="flex w-full items-center justify-between rounded-lg bg-[#252525] p-4 text-left hover:bg-[#2a2a2a]">
                <div>
                  <h3 className="font-semibold">Join Screen URL</h3>
                  <p className="text-sm text-gray-400">
                    Customize the web address guests join games from.
                  </p>
                </div>
                <ChevronLeft className="h-5 w-5 rotate-180 text-gray-400" />
              </button>

              <button className="flex w-full items-center justify-between rounded-lg bg-[#252525] p-4 text-left hover:bg-[#2a2a2a]">
                <div>
                  <h3 className="font-semibold">Venues</h3>
                  <p className="text-sm text-gray-400">
                    Manage the locations you host games at.
                  </p>
                </div>
                <ChevronLeft className="h-5 w-5 rotate-180 text-gray-400" />
              </button>
            </div>
            <div className="p-4">
              <button
                onClick={() => setShowSettings(false)}
                className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 py-3 font-semibold uppercase tracking-wide"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
