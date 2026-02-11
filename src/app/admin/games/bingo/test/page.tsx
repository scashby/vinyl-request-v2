// Path: src/app/admin/games/bingo/test/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Moon, Sun } from "lucide-react";

type GameTemplate = {
  id: number;
  name: string;
  description: string | null;
  source: string | null;
  item_count?: number;
};

type SpotifyPlaylist = {
  id: number;
  name: string;
  song_count?: number;
};

const GRADIENTS = [
  "from-pink-500 to-rose-600",
  "from-violet-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-600",
  "from-fuchsia-500 to-pink-600",
  "from-lime-500 to-green-600",
];

export default function BingoPlaylistsPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const rockstarPlaylists = useMemo(
    () => templates.filter((t) => t.source === "featured" || t.source === "system"),
    [templates]
  );

  const customPlaylists = useMemo(
    () => templates.filter((t) => !t.source || t.source === "custom"),
    [templates]
  );

  useEffect(() => {
    async function load() {
      try {
        const [tRes, pRes] = await Promise.all([
          fetch("/api/game-templates"),
          fetch("/api/playlists?platform=spotify"),
        ]);
        if (tRes.ok) {
          const d = await tRes.json();
          setTemplates(d.data ?? d ?? []);
        }
        if (pRes.ok) {
          setSpotifyPlaylists(await pRes.json());
        }
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const selectPlaylist = (id: number) => {
    router.push(`/admin/games/bingo/test/host?templateId=${id}`);
  };

  const selectSpotify = (id: number) => {
    router.push(`/admin/games/bingo/test/host?spotifyId=${id}`);
  };

  const bg = darkMode ? "bg-[#1a1625]" : "bg-gray-100";
  const card = darkMode ? "bg-[#252236]" : "bg-white";
  const text = darkMode ? "text-white" : "text-gray-900";
  const muted = darkMode ? "text-gray-400" : "text-gray-500";
  const border = darkMode ? "border-[#2d2a3e]" : "border-gray-200";

  return (
    <div className={`min-h-screen ${bg} ${text}`}>
      {/* Header */}
      <header className={`border-b ${border} px-6 py-4`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600">
              <span className="text-xl text-white">★</span>
            </div>
            <span className="text-lg font-bold">Rockstar Bingo</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`rounded-lg p-2 transition ${darkMode ? "hover:bg-white/10" : "hover:bg-gray-200"}`}
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button className={`rounded-lg p-2 transition ${darkMode ? "hover:bg-white/10" : "hover:bg-gray-200"}`}>
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-10">
            {/* Rockstar Playlists */}
            <section>
              <h2 className="mb-4 text-lg font-bold">Rockstar Playlists</h2>
              {rockstarPlaylists.length === 0 ? (
                <p className={muted}>No featured playlists available</p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {rockstarPlaylists.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => selectPlaylist(p.id)}
                      className={`group aspect-square overflow-hidden rounded-2xl bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} p-4 text-left shadow-lg transition hover:scale-[1.03] hover:shadow-xl`}
                    >
                      <div className="flex h-full flex-col justify-end">
                        <div className="font-bold text-white drop-shadow">{p.name}</div>
                        {p.item_count && (
                          <div className="text-sm text-white/70">{p.item_count} songs</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Custom Playlists */}
            <section>
              <h2 className="mb-4 text-lg font-bold">Custom Playlists</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {/* Create New */}
                <button
                  onClick={() => router.push("/admin/games/bingo/test/playlists/new")}
                  className={`aspect-square rounded-2xl border-2 border-dashed ${border} transition hover:border-pink-500 hover:bg-pink-500/5`}
                >
                  <div className="flex h-full flex-col items-center justify-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-2xl text-white">
                      +
                    </div>
                    <span className="text-sm font-medium">Create Playlist</span>
                  </div>
                </button>

                {customPlaylists.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => selectPlaylist(p.id)}
                    className={`aspect-square rounded-2xl ${card} border ${border} p-4 text-left shadow transition hover:shadow-lg`}
                  >
                    <div className="flex h-full flex-col">
                      <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${GRADIENTS[(i + 3) % GRADIENTS.length]} text-white`}>
                        ♪
                      </div>
                      <div className="flex-1 font-medium">{p.name}</div>
                      {p.item_count && (
                        <div className={`text-xs ${muted}`}>{p.item_count} songs</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Spotify Playlists */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1DB954]">
                  <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                </div>
                <h2 className="text-lg font-bold">Your Spotify Playlists</h2>
              </div>
              {spotifyPlaylists.length === 0 ? (
                <div className={`rounded-2xl ${card} border ${border} p-6`}>
                  <p className={muted}>No Spotify playlists connected.</p>
                  <button className="mt-3 rounded-full bg-[#1DB954] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1ed760]">
                    Connect Spotify
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {spotifyPlaylists.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => selectSpotify(p.id)}
                      className={`aspect-square rounded-2xl ${card} border ${border} p-4 text-left shadow transition hover:shadow-lg`}
                    >
                      <div className="flex h-full flex-col">
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-[#1DB954]">
                          <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                          </svg>
                        </div>
                        <div className="flex-1 font-medium">{p.name}</div>
                        {p.song_count && (
                          <div className={`text-xs ${muted}`}>{p.song_count} songs</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}