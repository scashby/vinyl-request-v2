// Path: src/app/admin/games/bingo/test/sidekick/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Music, Clock, Hash, Moon, Sun } from "lucide-react";

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
  game_template_items: {
    title: string;
    artist: string;
    duration_ms?: number;
    bpm?: number;
    key_signature?: string;
  };
};

const COLS = [
  { letter: "B", bg: "bg-blue-500" },
  { letter: "I", bg: "bg-green-500" },
  { letter: "N", bg: "bg-yellow-500" },
  { letter: "G", bg: "bg-orange-500" },
  { letter: "O", bg: "bg-red-500" },
];

function formatDuration(ms?: number): string {
  if (!ms) return "--:--";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function SidekickPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<Session | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [copied, setCopied] = useState(false);

  const currentIdx = session?.current_pick_index ?? 0;
  const currentPick = picks.find((p) => p.pick_index === currentIdx);
  const col = COLS[currentIdx % 5];
  const upcoming = picks.filter((p) => p.pick_index > currentIdx).slice(0, 5);

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
    const i = setInterval(fetchData, 3000);
    return () => clearInterval(i);
  }, [fetchData]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/admin/games/bingo/test/host?sessionId=${sessionId}`} className="rounded-lg p-2 hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-bold">Sidekick View</h1>
              <p className={`text-sm ${muted}`}>{session?.game_templates.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyLink} className={`flex items-center gap-2 rounded-lg ${card} border ${border} px-3 py-2 text-sm hover:border-pink-500`}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Share Link"}
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className={`rounded-lg p-2 ${card} border ${border}`}>
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Now Playing */}
        <section className={`mb-6 overflow-hidden rounded-2xl ${card} border ${border}`}>
          <div className={`border-b ${border} px-6 py-3`}>
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-pink-500" />
              <span className="font-medium">Now Playing</span>
              <span className={`ml-auto text-sm ${muted}`}>Song {currentIdx + 1} of {picks.length}</span>
            </div>
          </div>

          {currentPick ? (
            <div className="p-6">
              <div className="flex items-start gap-6">
                <div className={`flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-2xl text-5xl font-bold text-white shadow-lg ${col.bg}`}>
                  {col.letter}
                </div>
                <div className="flex-1">
                  <h2 className="text-3xl font-bold">{currentPick.game_template_items.title}</h2>
                  <p className={`mt-1 text-xl ${muted}`}>{currentPick.game_template_items.artist}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {currentPick.game_template_items.bpm && (
                      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${darkMode ? "bg-white/10" : "bg-gray-100"}`}>
                        <Hash className="h-4 w-4 text-pink-500" />
                        <span className="text-sm font-medium">{currentPick.game_template_items.bpm} BPM</span>
                      </div>
                    )}
                    {currentPick.game_template_items.key_signature && (
                      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${darkMode ? "bg-white/10" : "bg-gray-100"}`}>
                        <Music className="h-4 w-4 text-pink-500" />
                        <span className="text-sm font-medium">Key: {currentPick.game_template_items.key_signature}</span>
                      </div>
                    )}
                    {currentPick.game_template_items.duration_ms && (
                      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${darkMode ? "bg-white/10" : "bg-gray-100"}`}>
                        <Clock className="h-4 w-4 text-pink-500" />
                        <span className="text-sm font-medium">{formatDuration(currentPick.game_template_items.duration_ms)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Lyrics */}
              <div className={`mt-6 rounded-xl p-6 ${darkMode ? "bg-white/5" : "bg-gray-50"}`}>
                <p className="mb-2 text-sm font-medium uppercase tracking-wider text-pink-500">Lyrics</p>
                <p className={`text-sm italic ${muted}`}>
                  Lyrics will appear here when connected to a lyrics provider like Genius.
                </p>
                <p className={`mt-2 text-sm ${muted}`}>
                  Search for &ldquo;{currentPick.game_template_items.title}&rdquo; by {currentPick.game_template_items.artist}
                </p>
              </div>
            </div>
          ) : (
            <div className={`p-8 text-center ${muted}`}>
              {session?.status === "completed" ? "Game finished!" : "Waiting for game to start..."}
            </div>
          )}
        </section>

        {/* Up Next */}
        <section className={`overflow-hidden rounded-2xl ${card} border ${border}`}>
          <div className={`border-b ${border} px-6 py-3`}>
            <span className="font-medium">Up Next</span>
            <span className={`ml-2 text-sm ${muted}`}>{upcoming.length} songs</span>
          </div>
          {upcoming.length === 0 ? (
            <div className={`p-6 text-center text-sm ${muted}`}>No more songs</div>
          ) : (
            <div>
              {upcoming.map((p) => {
                const c = COLS[p.pick_index % 5];
                return (
                  <div key={p.id} className={`flex items-center gap-4 border-b ${border} px-6 py-3 last:border-0`}>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white ${c.bg}`}>
                      {c.letter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{p.game_template_items.title}</div>
                      <div className={`truncate text-sm ${muted}`}>{p.game_template_items.artist}</div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {p.game_template_items.bpm && <span className={muted}>{p.game_template_items.bpm} BPM</span>}
                      {p.game_template_items.key_signature && <span className={muted}>{p.game_template_items.key_signature}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Info */}
        <div className={`mt-6 rounded-xl ${card} border ${border} p-6`}>
          <p className="text-sm font-medium text-pink-500">About Sidekick View</p>
          <p className={`mt-2 text-sm ${muted}`}>
            This view is for band members and co-hosts. It syncs with the host every 3 seconds. Share the link with your bandmates!
          </p>
        </div>
      </main>
    </div>
  );
}