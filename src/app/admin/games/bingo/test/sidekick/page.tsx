// Path: src/app/admin/games/bingo/test/sidekick/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Music, Clock, Hash, Copy, Check, Moon, Sun } from "lucide-react";

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
    duration_ms?: number;
    bpm?: number;
    key_signature?: string;
  };
};

// B-I-N-G-O colors
const COLUMN_COLORS = ["bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-orange-500", "bg-red-500"];
const COLUMN_LETTERS = ["B", "I", "N", "G", "O"];

function formatDuration(ms?: number): string {
  if (!ms) return "--:--";
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function SidekickPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<GameSession | null>(null);
  const [picks, setPicks] = useState<PickItem[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const currentIndex = session?.current_pick_index ?? 0;
  const currentPick = picks.find((p) => p.pick_index === currentIndex);
  const upcomingPicks = picks.filter((p) => p.pick_index > currentIndex).slice(0, 5);

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
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const copyShareLink = () => {
    const link = `${window.location.origin}/admin/games/bingo/test/sidekick?sessionId=${sessionId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Theme
  const theme = darkMode
    ? { bg: "bg-[#1a1625]", card: "bg-[#252236]", text: "text-white", muted: "text-gray-400", border: "border-[#2d2a3e]" }
    : { bg: "bg-gray-50", card: "bg-white", text: "text-gray-900", muted: "text-gray-500", border: "border-gray-200" };

  if (isLoading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${theme.bg}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text}`}>
      {/* Header */}
      <header className={`border-b ${theme.border} px-6 py-4`}>
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/games/bingo/test/host?sessionId=${sessionId}`}
              className="rounded-lg p-2 transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="text-lg font-bold">Sidekick View</div>
              <div className={`text-sm ${theme.muted}`}>{session?.game_templates.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyShareLink}
              className={`flex items-center gap-2 rounded-lg ${theme.card} border ${theme.border} px-3 py-2 text-sm transition-colors hover:border-pink-500`}
            >
              {copiedLink ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              <span>{copiedLink ? "Copied!" : "Share Link"}</span>
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className={`rounded-lg p-2 ${theme.card} border ${theme.border}`}>
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Current Song - Large Display */}
        <section className={`mb-8 overflow-hidden rounded-2xl ${theme.card} border ${theme.border}`}>
          <div className={`border-b ${theme.border} px-6 py-3`}>
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-pink-500" />
              <span className="text-sm font-medium">Now Playing</span>
              <span className={`ml-auto text-sm ${theme.muted}`}>
                Song {currentIndex + 1} of {picks.length}
              </span>
            </div>
          </div>

          {currentPick ? (
            <div className="p-8">
              <div className="flex items-start gap-6">
                {/* B-I-N-G-O Letter */}
                <div
                  className={`flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-2xl text-5xl font-bold text-white shadow-lg ${
                    COLUMN_COLORS[currentIndex % 5]
                  }`}
                >
                  {COLUMN_LETTERS[currentIndex % 5]}
                </div>

                {/* Song Info */}
                <div className="flex-1">
                  <div className="text-3xl font-bold">{currentPick.game_template_items.title}</div>
                  <div className={`mt-1 text-xl ${theme.muted}`}>{currentPick.game_template_items.artist}</div>

                  {/* Metadata */}
                  <div className="mt-4 flex flex-wrap gap-4">
                    {currentPick.game_template_items.bpm && (
                      <div className={`flex items-center gap-2 rounded-lg ${darkMode ? "bg-white/10" : "bg-gray-100"} px-3 py-2`}>
                        <Hash className="h-4 w-4 text-pink-500" />
                        <span className="text-sm font-medium">{currentPick.game_template_items.bpm} BPM</span>
                      </div>
                    )}
                    {currentPick.game_template_items.key_signature && (
                      <div className={`flex items-center gap-2 rounded-lg ${darkMode ? "bg-white/10" : "bg-gray-100"} px-3 py-2`}>
                        <Music className="h-4 w-4 text-pink-500" />
                        <span className="text-sm font-medium">Key: {currentPick.game_template_items.key_signature}</span>
                      </div>
                    )}
                    {currentPick.game_template_items.duration_ms && (
                      <div className={`flex items-center gap-2 rounded-lg ${darkMode ? "bg-white/10" : "bg-gray-100"} px-3 py-2`}>
                        <Clock className="h-4 w-4 text-pink-500" />
                        <span className="text-sm font-medium">{formatDuration(currentPick.game_template_items.duration_ms)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Lyrics Section */}
              <div className={`mt-8 rounded-xl ${darkMode ? "bg-white/5" : "bg-gray-50"} p-6`}>
                <div className="mb-3 text-sm font-medium uppercase tracking-wider text-pink-500">Lyrics</div>
                <div className={`text-sm leading-relaxed ${theme.muted}`}>
                  <p className="italic">
                    Lyrics will appear here when connected to a lyrics provider like Genius.
                  </p>
                  <p className="mt-2">
                    Search for &ldquo;{currentPick.game_template_items.title}&rdquo; by {currentPick.game_template_items.artist}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className={`p-8 text-center ${theme.muted}`}>
              {session?.status === "completed" ? "Game finished!" : "Waiting for game to start..."}
            </div>
          )}
        </section>

        {/* Up Next */}
        <section className={`overflow-hidden rounded-2xl ${theme.card} border ${theme.border}`}>
          <div className={`border-b ${theme.border} px-6 py-3`}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Up Next</span>
              <span className={`ml-auto text-sm ${theme.muted}`}>{upcomingPicks.length} songs</span>
            </div>
          </div>

          {upcomingPicks.length === 0 ? (
            <div className={`p-6 text-center text-sm ${theme.muted}`}>No more songs in queue</div>
          ) : (
            <div className={`divide-y ${theme.border}`}>
              {upcomingPicks.map((pick) => (
                <div key={pick.id} className="flex items-center gap-4 px-6 py-3">
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${
                      COLUMN_COLORS[pick.pick_index % 5]
                    }`}
                  >
                    {COLUMN_LETTERS[pick.pick_index % 5]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{pick.game_template_items.title}</div>
                    <div className={`truncate text-sm ${theme.muted}`}>{pick.game_template_items.artist}</div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {pick.game_template_items.bpm && (
                      <span className={theme.muted}>{pick.game_template_items.bpm} BPM</span>
                    )}
                    {pick.game_template_items.key_signature && (
                      <span className={theme.muted}>{pick.game_template_items.key_signature}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Info Box */}
        <div className={`mt-8 rounded-xl ${theme.card} border ${theme.border} p-6`}>
          <div className="text-sm font-medium text-pink-500">About Sidekick View</div>
          <div className={`mt-2 space-y-1 text-sm ${theme.muted}`}>
            <p>This view is designed for band members and co-hosts.</p>
            <p>It automatically syncs with the host&apos;s current song position every 3 seconds.</p>
            <p>Share the link with your bandmates to keep everyone on the same page!</p>
          </div>
        </div>
      </main>
    </div>
  );
}