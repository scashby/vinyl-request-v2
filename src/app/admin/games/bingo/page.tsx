"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, History, Settings, X } from "lucide-react";

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
  "from-rose-600/90 via-rose-500/80 to-orange-400/80",
  "from-indigo-700/90 via-violet-600/80 to-blue-500/75",
  "from-amber-700/85 via-amber-500/80 to-orange-500/70",
  "from-violet-700/90 via-purple-600/80 to-fuchsia-500/75",
  "from-emerald-700/90 via-teal-600/80 to-cyan-500/75",
  "from-blue-700/90 via-sky-600/80 to-indigo-500/75",
];

function getEmbedSrc(embedValue: string | null): string | null {
  if (!embedValue) return null;
  const value = embedValue.trim();
  if (!value) return null;
  if (value.startsWith("<iframe")) {
    const srcMatch = value.match(/src=["']([^"']+)["']/i);
    return srcMatch?.[1] ?? null;
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return null;
}

function getSpotifyPlaylistId(src: string | null): string | null {
  if (!src) return null;
  const direct = src.match(/spotify\.com\/(?:embed\/)?playlist\/([a-zA-Z0-9]+)/i);
  return direct?.[1] ?? null;
}

function getPlaylistHref(src: string | null): string | null {
  const spotifyId = getSpotifyPlaylistId(src);
  if (spotifyId) return `https://open.spotify.com/playlist/${spotifyId}`;
  return src;
}

function toDisplayLabel(platform: string, index: number) {
  const base = platform.replace(/\s*playlist\s*$/i, "").trim();
  if (!base) return `Playlist ${index + 1}`;
  return base;
}

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

  const featuredPlaylists = useMemo(
    () => templates.filter((template) => template.source === "featured" || template.source === "system"),
    [templates]
  );

  const customPlaylists = useMemo(
    () => templates.filter((template) => !["featured", "system"].includes(template.source ?? "")),
    [templates]
  );

  const spotifyPlaylists = useMemo(
    () => externalPlaylists.filter((item) => /spotify/i.test(item.platform) || getSpotifyPlaylistId(getEmbedSrc(item.embed_url))),
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
    <div className="min-h-screen bg-[#f6f6f8] text-[#1e1f25]">
      <div className="border-b border-slate-200 bg-[#f1f1f4]">
        <div className="mx-auto flex w-full max-w-[1160px] items-center justify-between px-6 py-4">
          <Link href="/admin/games" className="text-slate-700 hover:text-black">
            <ChevronLeft className="h-7 w-7" />
          </Link>
          <div className="text-center text-2xl font-bold leading-none tracking-tight md:text-[40px]">
            rockstar<span className="mx-1 text-[#6d3cf1]">★</span>bingo
          </div>
          <div className="flex items-center gap-5 text-slate-900">
            <Link href="/admin/games/bingo/history" aria-label="History" className="hover:text-black">
              <History className="h-7 w-7" />
            </Link>
            <Link href="/admin/games/bingo/settings" aria-label="Settings" className="hover:text-black">
              <Settings className="h-7 w-7" />
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1160px] px-6 pb-14 pt-10">
        <div>
          <h1 className="text-4xl font-black leading-none tracking-tight text-[#1f2028] md:text-[48px]">Music Bingo</h1>
          <p className="mt-3 text-xl font-bold text-[#272832] md:text-[33px]">
            Choose a playlist below to start a game of music bingo.
          </p>
          <button
            type="button"
            onClick={() => setShowGameType((prev) => !prev)}
            className="mt-4 text-xl font-extrabold uppercase tracking-tight text-[#6434ea] md:text-[29px]"
          >
            CHANGE GAME TYPE
          </button>
        </div>

        {showGameType ? (
          <div className="mt-6 grid gap-3 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm md:grid-cols-3">
            {GAME_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleChangeGameType(type.value)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  type.value === variant
                    ? "border-[#6434ea] bg-[#f2ecff]"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">{type.label}</div>
                <div className="text-xs text-slate-500">{type.description}</div>
              </button>
            ))}
          </div>
        ) : null}

        {featuredPlaylists.length > 0 ? (
          <section className="mt-14">
            <h2 className="text-4xl font-black leading-none tracking-tight text-[#1f2028] md:text-[48px]">Our Playlists</h2>
            <p className="mt-2 text-xl font-bold text-[#2b2e39] md:text-[33px]">Try one of our suggested playlists.</p>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {featuredPlaylists.map((playlist, index) => (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => void openPreview(playlist)}
                  className="group relative h-[168px] overflow-hidden rounded-2xl text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${featuredPalette[index % featuredPalette.length]}`} />
                  <div className="absolute inset-0 bg-black/15" />
                  <div className="absolute bottom-5 left-5 right-4 z-10 text-2xl font-black leading-[0.95] tracking-tight text-white md:text-[40px]">
                    {playlist.name}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-14">
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-black leading-none tracking-tight text-[#1f2028] md:text-[48px]">Your Custom Playlists</h2>
            <Link href="/admin/games/bingo/templates" className="text-xl font-extrabold uppercase tracking-tight text-[#6434ea] md:text-[31px]">
              EDIT
            </Link>
          </div>
          <p className="mt-2 text-xl font-bold text-[#2b2e39] md:text-[33px]">Playlists you’ve imported and fine-tuned to perfection.</p>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Link
              href="/admin/games/bingo/playlists/new"
              className="relative flex h-[168px] items-center justify-center rounded-2xl border-4 border-dashed border-[#6d3cf1] bg-[#efeff2] text-3xl font-black leading-[0.95] tracking-tight text-white md:text-[45px]"
            >
              <span className="absolute top-[38%] text-4xl opacity-90">+</span>
              <span className="pt-8">Create a Custom Playlist</span>
            </Link>
            {customPlaylists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => void openPreview(playlist)}
                className="h-[168px] rounded-2xl bg-[#6434ea] px-7 py-6 text-left text-white shadow-sm transition hover:brightness-110"
              >
                <div className="line-clamp-2 text-3xl font-black leading-[0.95] tracking-tight md:text-[50px]">{playlist.name}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-14 grid grid-cols-1 gap-7 xl:grid-cols-[1fr_280px]">
          <div>
            <h2 className="text-4xl font-black leading-none tracking-tight text-[#1f2028] md:text-[48px]">Your Spotify Playlists</h2>
            <p className="mt-2 text-xl font-bold text-[#2b2e39] md:text-[33px]">Playlists in your Spotify library with at least 75 songs.</p>

            {spotifyPlaylists.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                No Spotify playlists connected yet.
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                {spotifyPlaylists.map((playlist, index) => {
                  const src = getEmbedSrc(playlist.embed_url);
                  const href = getPlaylistHref(src);
                  const title = toDisplayLabel(playlist.platform, index);
                  return (
                    <a
                      key={playlist.id}
                      href={href ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative block h-[168px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#f3cadb] via-[#d9d1db] to-[#c4bcc8] p-5 shadow-sm"
                    >
                      <div className="absolute -right-5 bottom-4 h-20 w-20 rounded bg-white/25" />
                      <div className="absolute right-16 bottom-7 h-14 w-14 rounded bg-black/15" />
                      <div className="absolute right-7 bottom-9 h-16 w-16 rounded bg-violet-700/35" />
                      <div className="relative z-10">
                        <div className="line-clamp-2 text-3xl font-black leading-[0.92] tracking-tight text-white md:text-[48px]">
                          {title}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="pt-3 text-sm font-bold uppercase tracking-wide text-[#6f7380] md:text-[23px]">SPOTIFY ACCOUNT:</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-black" />
              <div className="text-xl font-black leading-none tracking-tight text-[#1f2028] md:text-[39px]">
                {spotifyPlaylists.length > 0 ? "Dead Wax Dialogues" : "Not Connected"}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-16 text-center text-base font-medium leading-snug text-[#434754] md:text-[28px]">
          By continuing, I acknowledge and confirm that I have read the{" "}
          <a href="#" className="font-black text-[#6434ea]">terms of service</a>{" "}
          and I agree to be bound by such terms.
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
