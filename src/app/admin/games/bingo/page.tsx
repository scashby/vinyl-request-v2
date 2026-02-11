"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, RotateCw, Settings, X } from "lucide-react";

const GAME_TYPES = [
  { value: "standard", label: "Standard Bingo", description: "Free space in the center." },
  { value: "death", label: "Death Bingo", description: "Lose if you get bingo. Last card standing wins." },
  { value: "blackout", label: "Blackout Bingo", description: "Fill every square to win." },
];

type TemplateSummary = {
  id: number;
  name: string;
  description: string | null;
  source: string | null;
  setlist_mode: boolean;
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

const featuredPalette = [
  "from-rose-500 via-red-500 to-orange-400",
  "from-blue-500 via-indigo-500 to-violet-500",
  "from-amber-400 via-yellow-400 to-orange-500",
  "from-purple-500 via-fuchsia-500 to-indigo-600",
  "from-teal-500 via-emerald-500 to-lime-400",
  "from-sky-500 via-blue-500 to-indigo-500",
];

export default function Page() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null);
  const [previewItems, setPreviewItems] = useState<TemplateItem[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showGameType, setShowGameType] = useState(false);
  const [externalPlaylists, setExternalPlaylists] = useState<ExternalPlaylist[]>([]);
  const searchParams = useSearchParams();
  const router = useRouter();

  const variant = searchParams.get("variant") ?? "standard";
  const activeGameType = GAME_TYPES.find((type) => type.value === variant) ?? GAME_TYPES[0];

  const featuredPlaylists = useMemo(
    () => templates.filter((template) => template.source === "featured" || template.source === "system"),
    [templates]
  );

  const customPlaylists = useMemo(
    () => templates.filter((template) => !["featured", "system"].includes(template.source ?? "")),
    [templates]
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
    const match = templates.find((template) => template.id === templateId);
    if (match) {
      void openPreview(match);
    }
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/admin/games" className="text-slate-500 hover:text-slate-900">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Image src="/images/Skulllogo.png" alt="Dead Wax Dialogues" width={28} height={28} />
            <div className="text-center leading-tight">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Dead Wax</div>
              <div className="text-sm font-semibold text-slate-900">Bingo</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full border border-slate-200 p-2 text-slate-400 hover:text-slate-700"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <Link
              href="/admin/games/bingo/settings"
              className="rounded-full border border-slate-200 p-2 text-slate-400 hover:text-slate-700"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Music Bingo</h1>
          <p className="mt-2 text-sm text-slate-500">
            Choose a playlist below to start a game of music bingo.
          </p>
          <button
            type="button"
            onClick={() => setShowGameType((prev) => !prev)}
            className="mt-2 text-xs font-semibold uppercase tracking-wide text-indigo-600"
          >
            Change game type
          </button>
        </div>

        {showGameType ? (
          <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {GAME_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleChangeGameType(type.value)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                  type.value === variant
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">{type.label}</div>
                  <div className="text-xs text-slate-500">{type.description}</div>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {type.value === variant ? "Selected" : ""}
                </span>
              </button>
            ))}
            <div className="text-xs text-slate-500">Active: {activeGameType.label}</div>
          </div>
        ) : null}

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Our Playlists</h2>
          <p className="text-sm text-slate-500">Try one of our suggested playlists.</p>

          {featuredPlaylists.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No featured playlists yet.
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {featuredPlaylists.map((playlist, index) => (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => void openPreview(playlist)}
                  className="group relative h-36 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${
                      featuredPalette[index % featuredPalette.length]
                    }`}
                  />
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="relative z-10 h-full p-4">
                    <div className="mt-auto text-lg font-semibold text-white drop-shadow">
                      {playlist.name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Your Custom Playlists</h2>
            <Link href="/admin/games/bingo/templates" className="text-xs font-semibold text-indigo-600">
              EDIT
            </Link>
          </div>
          <p className="text-sm text-slate-500">Playlists you’ve imported and fine-tuned to perfection.</p>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Link
              href="/admin/games/bingo/playlists/new"
              className="flex h-32 items-center justify-center rounded-2xl border-2 border-dashed border-indigo-400 bg-white text-sm font-semibold text-indigo-600"
            >
              Create a Custom Playlist
            </Link>
            {customPlaylists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => void openPreview(playlist)}
                className="h-32 rounded-2xl border border-slate-200 bg-indigo-600 px-6 py-5 text-left text-white shadow-sm"
              >
                <div className="text-sm font-semibold">{playlist.name}</div>
                <div className="mt-1 text-xs text-indigo-100">Custom Playlist</div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900">Your Spotify Playlists</h2>
            <p className="text-sm text-slate-500">Playlists in your Spotify library with at least 75 songs.</p>
            {externalPlaylists.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
                No Spotify playlists connected yet.
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                {externalPlaylists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {playlist.platform.toUpperCase()} Playlist
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{playlist.embed_url ?? "-"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="md:col-span-1">
            <div className="text-xs uppercase tracking-wide text-slate-400">Spotify Account</div>
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="h-10 w-10 rounded-full bg-slate-200" />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {externalPlaylists.length > 0 ? "Connected" : "Not connected"}
                </div>
                <div className="text-xs text-slate-500">
                  {externalPlaylists.length > 0 ? "Spotify playlists available" : "Connect to Spotify to load playlists"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-10 text-center text-xs text-slate-400">
          By continuing, I acknowledge and confirm that I have read the terms of service and agree to be bound by such terms.
        </div>
      </main>

      {isPreviewOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-6">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Preview: {selectedTemplate?.name ?? "Playlist"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Possible Songs: <span className="rounded-full border border-slate-200 px-2 py-0.5">{previewItems.length}</span>
            </div>

            <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-slate-200">
              {isLoadingPreview ? (
                <div className="p-4 text-sm text-slate-500">Loading playlist...</div>
              ) : previewItems.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">No songs available for this playlist.</div>
              ) : (
                previewItems.map((item) => (
                  <div key={item.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-500">{item.artist}</div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={handleCreateGame}
              className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Create Game
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
