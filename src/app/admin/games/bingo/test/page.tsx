// Path: src/app/admin/games/bingo/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  Settings,
  RefreshCw,
  Music,
  Disc3,
  ListMusic,
  Clock,
  Sparkles,
  X,
  Play,
  Moon,
  Sun,
  History,
} from "lucide-react";

const GAME_TYPES = [
  { 
    value: "standard", 
    label: "Standard Bingo", 
    description: "Free space in the center. First to complete pattern wins.",
    icon: "🎯",
  },
  { 
    value: "death", 
    label: "Death Bingo", 
    description: "Avoid getting bingo! Last card standing wins.",
    icon: "💀",
  },
  { 
    value: "blackout", 
    label: "Blackout Bingo", 
    description: "Fill every square to win. Marathon mode!",
    icon: "⬛",
  },
];

type TemplateSummary = {
  id: number;
  name: string;
  description: string | null;
  source: string | null;
  setlist_mode: boolean;
  song_count?: number;
};

type TemplateItem = {
  id: number;
  title: string;
  artist: string;
};

type ExternalPlaylist = {
  id: number;
  platform: string;
  embed_url: string | null;
};

function getEmbedSrc(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("<iframe")) {
    const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
    return srcMatch?.[1] ?? null;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return null;
}

export default function BingoHomePage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null);
  const [previewItems, setPreviewItems] = useState<TemplateItem[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showGameType, setShowGameType] = useState(false);
  const [externalPlaylists, setExternalPlaylists] = useState<ExternalPlaylist[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  const variant = searchParams.get("variant") ?? "standard";
  const activeGameType = GAME_TYPES.find((type) => type.value === variant) ?? GAME_TYPES[0];

  const featuredPlaylists = useMemo(
    () => templates.filter((t) => t.source === "featured" || t.source === "system"),
    [templates]
  );

  const customPlaylists = useMemo(() => {
    const base = templates.filter((t) => !["featured", "system"].includes(t.source ?? ""));
    const seen = new Set<string>();
    return base.filter((item) => {
      const key = item.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [templates]);

  const spotifyPlaylists = useMemo(
    () => externalPlaylists.filter((p) => /spotify/i.test(p.platform)),
    [externalPlaylists]
  );

  const refreshTemplates = async () => {
    const response = await fetch("/api/game-templates");
    const payload = await response.json();
    setTemplates(payload.data ?? []);
  };

  useEffect(() => {
    void refreshTemplates();
  }, []);

  useEffect(() => {
    const loadPlaylists = async () => {
      const response = await fetch("/api/playlists");
      const payload = await response.json();
      setExternalPlaylists(payload ?? []);
    };
    void loadPlaylists();
  }, []);

  useEffect(() => {
    const templateId = Number(searchParams.get("templateId"));
    if (!templateId || Number.isNaN(templateId) || templates.length === 0) return;
    const match = templates.find((t) => t.id === templateId);
    if (match) void openPreview(match);
  }, [searchParams, templates]);

  const openPreview = async (template: TemplateSummary) => {
    setIsLoadingPreview(true);
    setIsPreviewOpen(true);
    setSelectedTemplate(template);
    try {
      const response = await fetch(`/api/game-templates/${template.id}`);
      const payload = await response.json();
      setPreviewItems(payload.data?.items ?? []);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleCreateGame = () => {
    if (!selectedTemplate) return;
    router.push(`/admin/games/bingo/setup?templateId=${selectedTemplate.id}&variant=${variant}`);
  };

  const handleChangeGameType = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", value);
    router.replace(`/admin/games/bingo?${params.toString()}`);
    setShowGameType(false);
  };

  const bgClass = darkMode ? "bg-slate-950" : "bg-slate-50";
  const textClass = darkMode ? "text-white" : "text-slate-900";
  const cardClass = darkMode ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200";
  const mutedClass = darkMode ? "text-slate-400" : "text-slate-500";

  return (
    <div className={`min-h-screen ${bgClass} ${textClass} font-sans`}>
      {/* Header */}
      <header className={`sticky top-0 z-30 border-b ${darkMode ? "border-slate-800 bg-slate-950/95" : "border-slate-200 bg-white/95"} backdrop-blur-sm`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            href="/admin/games"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${darkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}
          >
            ← Games
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Music className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-violet-400">Dead Wax</div>
              <div className="text-sm font-semibold">Vinyl Bingo</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`rounded-full p-2 ${darkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => window.location.reload()}
              className={`rounded-full p-2 ${darkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <Link
              href="/admin/games/bingo/history"
              className={`rounded-full p-2 ${darkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
            >
              <History className="h-4 w-4" />
            </Link>
            <Link
              href="/admin/games/bingo/settings"
              className={`rounded-full p-2 ${darkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-black sm:text-4xl">Music Bingo</h1>
          <p className={`mt-2 text-lg ${mutedClass}`}>
            Choose a playlist to start a game of vinyl bingo.
          </p>

          {/* Game Type Selector */}
          <button
            onClick={() => setShowGameType(!showGameType)}
            className={`mt-4 inline-flex items-center gap-3 rounded-xl border px-4 py-3 ${cardClass}`}
          >
            <span className="text-2xl">{activeGameType.icon}</span>
            <div className="text-left">
              <div className="font-bold">{activeGameType.label}</div>
              <div className={`text-xs ${mutedClass}`}>{activeGameType.description}</div>
            </div>
            <ChevronRight className={`h-5 w-5 ${mutedClass} ${showGameType ? "rotate-90" : ""} transition`} />
          </button>

          {showGameType && (
            <div className={`mt-3 overflow-hidden rounded-2xl border ${cardClass}`}>
              {GAME_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleChangeGameType(type.value)}
                  className={`flex w-full items-center gap-4 px-5 py-4 text-left transition ${
                    type.value === variant
                      ? darkMode ? "bg-violet-500/10" : "bg-violet-50"
                      : darkMode ? "hover:bg-slate-800" : "hover:bg-slate-50"
                  } ${type.value !== GAME_TYPES[GAME_TYPES.length - 1].value ? (darkMode ? "border-b border-slate-800" : "border-b border-slate-200") : ""}`}
                >
                  <span className="text-3xl">{type.icon}</span>
                  <div className="flex-1">
                    <div className="font-bold">{type.label}</div>
                    <div className={`text-sm ${mutedClass}`}>{type.description}</div>
                  </div>
                  {type.value === variant && (
                    <span className="rounded-full bg-violet-500 px-3 py-1 text-xs font-bold text-white">Selected</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Featured Playlists */}
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <h2 className="text-xl font-bold">Featured Playlists</h2>
          </div>
          
          {featuredPlaylists.length === 0 ? (
            <div className={`rounded-2xl border-2 border-dashed p-8 text-center ${darkMode ? "border-slate-800" : "border-slate-300"}`}>
              <Disc3 className={`mx-auto h-12 w-12 ${mutedClass}`} />
              <p className={`mt-3 ${mutedClass}`}>No featured playlists available.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {featuredPlaylists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => void openPreview(playlist)}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-6 text-left text-white shadow-xl transition hover:shadow-2xl hover:shadow-violet-500/20"
                >
                  <div className="absolute -right-4 -top-4 opacity-20 transition group-hover:scale-110">
                    <Disc3 className="h-24 w-24" />
                  </div>
                  <div className="relative z-10">
                    <div className="text-xs font-bold uppercase tracking-wider text-white/70">Featured</div>
                    <div className="mt-2 text-lg font-bold">{playlist.name}</div>
                    {playlist.description && (
                      <div className="mt-1 text-sm text-white/80">{playlist.description}</div>
                    )}
                  </div>
                  <Play className="absolute bottom-4 right-4 h-8 w-8 text-white/50 transition group-hover:text-white" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Custom Playlists */}
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ListMusic className="h-5 w-5 text-emerald-400" />
              <h2 className="text-xl font-bold">Your Playlists</h2>
            </div>
            <Link
              href="/admin/games/bingo/templates"
              className="text-sm font-bold text-violet-400 hover:underline"
            >
              Manage All →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/admin/games/bingo/playlists/new"
              className={`flex h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed transition ${
                darkMode 
                  ? "border-violet-500/50 bg-violet-500/5 hover:border-violet-400 hover:bg-violet-500/10" 
                  : "border-violet-400 bg-violet-50 hover:border-violet-500 hover:bg-violet-100"
              }`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${darkMode ? "bg-violet-500/20" : "bg-violet-200"}`}>
                <ListMusic className="h-6 w-6 text-violet-400" />
              </div>
              <span className="mt-3 font-bold text-violet-400">Create New Playlist</span>
            </Link>

            {customPlaylists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => void openPreview(playlist)}
                className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition ${cardClass} hover:shadow-lg`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`text-xs font-bold uppercase tracking-wider ${mutedClass}`}>Custom</div>
                    <div className="mt-1 text-lg font-bold">{playlist.name}</div>
                    {playlist.setlist_mode && (
                      <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${darkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"}`}>
                        <Clock className="h-3 w-3" /> Setlist
                      </span>
                    )}
                  </div>
                  <Disc3 className={`h-8 w-8 ${mutedClass} transition group-hover:rotate-12`} />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Spotify Section */}
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1DB954]">
              <Music className="h-3 w-3 text-white" />
            </div>
            <h2 className="text-xl font-bold">Spotify Playlists</h2>
          </div>

          {spotifyPlaylists.length === 0 ? (
            <div className={`rounded-2xl border p-6 ${cardClass}`}>
              <p className={mutedClass}>No Spotify playlists connected. Connect your account in Settings.</p>
              <Link
                href="/admin/games/bingo/settings"
                className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-violet-400 hover:underline"
              >
                Connect Spotify →
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {spotifyPlaylists.map((playlist) => {
                const src = getEmbedSrc(playlist.embed_url);
                return (
                  <div key={playlist.id} className={`rounded-2xl border p-4 ${cardClass}`}>
                    <div className="mb-3 text-sm font-bold">{playlist.platform}</div>
                    {src ? (
                      <iframe
                        title={`${playlist.platform}-${playlist.id}`}
                        src={src}
                        className="h-[152px] w-full rounded-xl border-0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                      />
                    ) : (
                      <div className={`rounded-xl p-4 text-sm ${darkMode ? "bg-slate-800" : "bg-slate-100"} ${mutedClass}`}>
                        Invalid embed URL
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer */}
        <div className={`mt-12 text-center text-xs ${mutedClass}`}>
          By starting a game, you agree to our terms of service.
        </div>
      </main>

      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-xl overflow-hidden rounded-3xl ${darkMode ? "bg-slate-900" : "bg-white"} shadow-2xl`}>
            {/* Header */}
            <div className={`flex items-center justify-between border-b px-6 py-4 ${darkMode ? "border-slate-800" : "border-slate-200"}`}>
              <div>
                <h3 className="text-xl font-bold">{selectedTemplate?.name ?? "Playlist"}</h3>
                <p className={`text-sm ${mutedClass}`}>
                  {previewItems.length} songs available
                </p>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className={`rounded-full p-2 ${darkMode ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Song List */}
            <div className={`max-h-80 overflow-y-auto border-b ${darkMode ? "border-slate-800" : "border-slate-200"}`}>
              {isLoadingPreview ? (
                <div className={`p-8 text-center ${mutedClass}`}>
                  <Disc3 className="mx-auto h-8 w-8 animate-spin" />
                  <p className="mt-3">Loading playlist...</p>
                </div>
              ) : previewItems.length === 0 ? (
                <div className={`p-8 text-center ${mutedClass}`}>
                  No songs in this playlist.
                </div>
              ) : (
                previewItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 px-6 py-3 ${
                      idx < previewItems.length - 1 ? (darkMode ? "border-b border-slate-800/50" : "border-b border-slate-100") : ""
                    }`}
                  >
                    <span className={`w-6 text-sm tabular-nums ${mutedClass}`}>{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{item.title}</div>
                      <div className={`truncate text-sm ${mutedClass}`}>{item.artist}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-6">
              <button
                onClick={handleCreateGame}
                disabled={isLoadingPreview || previewItems.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-4 font-bold text-white shadow-lg shadow-violet-500/25 transition hover:shadow-violet-500/40 disabled:opacity-50"
              >
                <Play className="h-5 w-5" />
                Create Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
