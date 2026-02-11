"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import BingoHeader from "./_components/BingoHeader";

const GAME_TYPES = [
  { value: "standard", label: "Standard Bingo", description: "Free space in the center." },
  { value: "death", label: "Death Bingo", description: "Avoid bingos. Last card standing wins." },
  { value: "blackout", label: "Blackout Bingo", description: "Fill the entire card to win." },
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

const getVariant = (value?: string | null) =>
  GAME_TYPES.find((type) => type.value === value)?.value ?? "standard";

export default function Page() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null);
  const [previewItems, setPreviewItems] = useState<TemplateItem[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showGameType, setShowGameType] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const variant = getVariant(searchParams.get("variant"));
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
      <BingoHeader backHref="/admin/games" />

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Music Bingo</h1>
          <p className="text-sm text-slate-500">Choose a playlist below to start a game of music bingo.</p>
          <button
            type="button"
            onClick={() => setShowGameType((prev) => !prev)}
            className="w-fit text-xs font-semibold uppercase tracking-wide text-indigo-600"
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
                <span className="text-xs font-semibold text-slate-400">{type.value === variant ? "Selected" : ""}</span>
              </button>
            ))}
            <div className="text-xs text-slate-500">Active: {activeGameType.label}</div>
          </div>
        ) : null}

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Our Playlists</h2>
              <p className="text-sm text-slate-500">Suggested playlists built from your vinyl collection.</p>
            </div>
          </div>

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
                  className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg`}
                >
                  <div
                    className={`h-28 w-full ${
                      index % 4 === 0
                        ? "bg-gradient-to-br from-rose-500 via-red-500 to-orange-400"
                        : index % 4 === 1
                        ? "bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500"
                        : index % 4 === 2
                        ? "bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-500"
                        : "bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600"
                    }`}
                  />
                  <div className="p-4">
                    <div className="text-sm font-semibold text-slate-900">{playlist.name}</div>
                    <div className="text-xs text-slate-500">{playlist.description ?? "Vinyl playlist"}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Your Custom Playlists</h2>
              <p className="text-sm text-slate-500">Playlists you’ve imported and fine-tuned.</p>
            </div>
            <Link
              href="/admin/games/bingo/templates"
              className="text-xs font-semibold uppercase tracking-wide text-indigo-600"
            >
              Edit
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Link
              href="/admin/games/bingo/playlists/new"
              className="flex min-h-[120px] items-center justify-center rounded-2xl border-2 border-dashed border-indigo-400 bg-white text-sm font-semibold text-indigo-600 transition hover:border-indigo-500"
            >
              <div className="flex flex-col items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50">
                  <Plus className="h-5 w-5" />
                </span>
                Create a Custom Playlist
              </div>
            </Link>
            {customPlaylists.map((playlist, index) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => void openPreview(playlist)}
                className={`min-h-[120px] rounded-2xl border border-slate-200 px-6 py-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                  index % 2 === 0
                    ? "bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 text-white"
                    : "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white"
                }`}
              >
                <div className="text-sm uppercase tracking-[0.2em] text-white/70">Playlist</div>
                <div className="mt-3 text-lg font-semibold">{playlist.name}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Use your playlists on Spotify</div>
            <p className="mt-2 text-xs text-slate-500">
              Connect a Spotify Premium account to play bingo with streaming playlists. Vinyl playlists will continue to use manual playback.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              Connect to Spotify (Coming soon)
            </button>
          </div>
        </section>

        <div className="mt-10 text-center text-xs text-slate-400">
          By continuing, I acknowledge and confirm that I have read the terms of service and agree to be bound by such terms.
        </div>
      </main>

      {isPreviewOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Preview: {selectedTemplate?.name ?? "Playlist"}
                </h3>
                <div className="mt-2 text-xs text-slate-500">
                  Possible Songs: <span className="rounded-full border border-slate-200 px-2 py-0.5">{previewItems.length}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
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
