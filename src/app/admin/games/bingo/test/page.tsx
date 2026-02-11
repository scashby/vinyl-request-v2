// Path: src/app/admin/games/bingo/test/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Moon, Sun, ChevronRight } from "lucide-react";

type GameTemplate = {
  id: number;
  name: string;
  description: string | null;
  source: string | null;
  setlist_mode: boolean;
  item_count?: number;
  cover_image?: string | null;
};

type SpotifyPlaylist = {
  id: number;
  platform: string;
  name: string;
  song_count?: number;
  image_url?: string | null;
};

// Gradient presets for playlist cards (matching Rockstar Bingo's colorful style)
const CARD_GRADIENTS = [
  "from-pink-500 via-rose-500 to-red-500",
  "from-purple-500 via-violet-500 to-indigo-500",
  "from-blue-500 via-cyan-500 to-teal-500",
  "from-emerald-500 via-green-500 to-lime-500",
  "from-amber-500 via-orange-500 to-red-500",
  "from-fuchsia-500 via-pink-500 to-rose-500",
  "from-indigo-500 via-purple-500 to-pink-500",
  "from-cyan-500 via-blue-500 to-indigo-500",
  "from-teal-500 via-emerald-500 to-green-500",
  "from-orange-500 via-amber-500 to-yellow-500",
];

function getGradient(index: number): string {
  return CARD_GRADIENTS[index % CARD_GRADIENTS.length];
}

export default function MusicBingoPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Rockstar Playlists = featured/system templates
  const rockstarPlaylists = useMemo(
    () => templates.filter((t) => t.source === "featured" || t.source === "system"),
    [templates]
  );

  // Custom Playlists = user-created
  const customPlaylists = useMemo(
    () => templates.filter((t) => !t.source || t.source === "custom" || !["featured", "system"].includes(t.source)),
    [templates]
  );

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [templatesRes, playlistsRes] = await Promise.all([
          fetch("/api/game-templates"),
          fetch("/api/playlists?platform=spotify"),
        ]);
        
        if (templatesRes.ok) {
          const data = await templatesRes.json();
          setTemplates(data.data ?? data ?? []);
        }
        
        if (playlistsRes.ok) {
          const data = await playlistsRes.json();
          setSpotifyPlaylists(data ?? []);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, []);

  const handleHostGame = (templateId: number) => {
    router.push(`/admin/games/bingo/test/setup?templateId=${templateId}`);
  };

  const handleSpotifyPlaylist = (playlistId: number) => {
    router.push(`/admin/games/bingo/test/setup?spotifyId=${playlistId}`);
  };

  const handleCreatePlaylist = () => {
    router.push("/admin/games/bingo/test/playlists/new");
  };

  // Theme styles
  const theme = darkMode
    ? {
        bg: "bg-[#1a1625]",
        cardBg: "bg-[#252236]",
        text: "text-white",
        textMuted: "text-gray-400",
        border: "border-[#2d2a3e]",
        hover: "hover:bg-[#2d2a3e]",
      }
    : {
        bg: "bg-gray-50",
        cardBg: "bg-white",
        text: "text-gray-900",
        textMuted: "text-gray-500",
        border: "border-gray-200",
        hover: "hover:bg-gray-100",
      };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text}`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 ${theme.bg} border-b ${theme.border}`}>
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg shadow-pink-500/25">
                <span className="text-xl text-white">★</span>
              </div>
              <div>
                <div className="text-lg font-bold">Rockstar Bingo</div>
                <div className={`text-xs ${theme.textMuted}`}>Music</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`rounded-lg p-2.5 transition-colors ${theme.hover}`}
                title={darkMode ? "Light mode" : "Dark mode"}
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button
                className={`rounded-lg p-2.5 transition-colors ${theme.hover}`}
                title="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-12">
            {/* Rockstar Playlists */}
            <section>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">Rockstar Playlists</h2>
                {rockstarPlaylists.length > 5 && (
                  <button className={`flex items-center gap-1 text-sm ${theme.textMuted} hover:text-pink-500`}>
                    See all <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>

              {rockstarPlaylists.length === 0 ? (
                <div className={`rounded-2xl border-2 border-dashed ${theme.border} p-12 text-center`}>
                  <p className={theme.textMuted}>No featured playlists available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {rockstarPlaylists.map((playlist, idx) => (
                    <button
                      key={playlist.id}
                      onClick={() => handleHostGame(playlist.id)}
                      className="group relative aspect-square overflow-hidden rounded-2xl shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
                    >
                      {/* Gradient Background */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${getGradient(idx)}`} />
                      
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/0" />
                      
                      {/* Content */}
                      <div className="relative flex h-full flex-col justify-end p-4">
                        <div className="font-bold text-white drop-shadow-md">
                          {playlist.name}
                        </div>
                        {playlist.item_count && (
                          <div className="mt-1 text-xs text-white/80">
                            {playlist.item_count} songs
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Custom Playlists */}
            <section>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">Custom Playlists</h2>
                {customPlaylists.length > 4 && (
                  <button className={`flex items-center gap-1 text-sm ${theme.textMuted} hover:text-pink-500`}>
                    See all <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {/* Create New Playlist Card */}
                <button
                  onClick={handleCreatePlaylist}
                  className={`group aspect-square rounded-2xl border-2 border-dashed ${theme.border} transition-all duration-200 hover:border-pink-500 hover:bg-pink-500/5`}
                >
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-2xl text-white shadow-lg shadow-pink-500/25 transition-transform group-hover:scale-110">
                      +
                    </div>
                    <span className="text-sm font-medium">Create Playlist</span>
                  </div>
                </button>

                {/* Custom Playlist Cards */}
                {customPlaylists.map((playlist, idx) => (
                  <button
                    key={playlist.id}
                    onClick={() => handleHostGame(playlist.id)}
                    className={`group aspect-square rounded-2xl ${theme.cardBg} border ${theme.border} p-4 text-left shadow transition-all duration-200 hover:shadow-lg ${darkMode ? "hover:border-pink-500/50" : "hover:border-pink-500"}`}
                  >
                    <div className="flex h-full flex-col">
                      {/* Mini gradient icon */}
                      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${getGradient(idx + 5)} text-lg text-white shadow`}>
                        ♪
                      </div>
                      
                      {/* Playlist name */}
                      <div className="flex-1">
                        <div className="font-semibold leading-tight">{playlist.name}</div>
                      </div>
                      
                      {/* Meta */}
                      <div className={`mt-2 text-xs ${theme.textMuted}`}>
                        {playlist.setlist_mode ? "Setlist" : "Shuffle"}
                        {playlist.item_count && ` · ${playlist.item_count} songs`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Spotify Playlists */}
            <section>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1DB954]">
                  <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold">Your Spotify Playlists</h2>
              </div>

              {spotifyPlaylists.length === 0 ? (
                <div className={`rounded-2xl ${theme.cardBg} border ${theme.border} p-8`}>
                  <p className={theme.textMuted}>
                    No Spotify playlists connected. Connect your Spotify account to import playlists with 75+ songs.
                  </p>
                  <button className="mt-4 rounded-full bg-[#1DB954] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1ed760]">
                    Connect Spotify
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {spotifyPlaylists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => handleSpotifyPlaylist(playlist.id)}
                      className={`group aspect-square rounded-2xl ${theme.cardBg} border ${theme.border} p-4 text-left shadow transition-all duration-200 hover:shadow-lg ${darkMode ? "hover:border-[#1DB954]/50" : "hover:border-[#1DB954]"}`}
                    >
                      <div className="flex h-full flex-col">
                        {/* Spotify icon */}
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#1DB954] shadow">
                          <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                          </svg>
                        </div>
                        
                        {/* Playlist name */}
                        <div className="flex-1">
                          <div className="font-semibold leading-tight">{playlist.name}</div>
                        </div>
                        
                        {/* Song count */}
                        {playlist.song_count && (
                          <div className={`mt-2 text-xs ${theme.textMuted}`}>
                            {playlist.song_count} songs
                          </div>
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