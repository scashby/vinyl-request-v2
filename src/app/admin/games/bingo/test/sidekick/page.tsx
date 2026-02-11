// Path: src/app/admin/games/bingo/sidekick/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Music, Copy, Check, ExternalLink, RefreshCw } from "lucide-react";

type PickItem = {
  id: number;
  pick_index: number;
  called_at: string | null;
  game_template_items: {
    id: number;
    title: string;
    artist: string;
    bpm?: number;
    key_signature?: string;
    duration_ms?: number;
    spotify_uri?: string;
    lyrics_url?: string;
  } | null;
};

type Session = {
  id: number;
  game_code: string | null;
  status: string;
};

const COLUMN_LABELS = ["B", "I", "N", "G", "O"];
const COLUMN_COLORS = [
  "from-blue-500 to-blue-600",
  "from-indigo-500 to-indigo-600",
  "from-violet-500 to-violet-600",
  "from-purple-500 to-purple-600",
  "from-fuchsia-500 to-fuchsia-600",
];

export default function SidekickPage() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [picks, setPicks] = useState<PickItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showLyrics, setShowLyrics] = useState(true);

  const loadSession = useCallback(async () => {
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return;

    const response = await fetch(`/api/game-sessions/${sessionId}`);
    const payload = await response.json();
    setSession(payload.data?.session ?? null);
    setPicks(payload.data?.picks ?? []);
  }, [searchParams]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (picks.length === 0) return;
    const nextIndex = picks.findIndex((pick) => !pick.called_at);
    setCurrentIndex(nextIndex === -1 ? picks.length - 1 : Math.max(0, nextIndex - 1));
  }, [picks]);

  // Auto-refresh every 3 seconds to stay in sync with host
  useEffect(() => {
    const interval = setInterval(() => {
      void loadSession();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadSession]);

  const currentPick = picks[currentIndex];
  const nextPick = currentIndex < picks.length - 1 ? picks[currentIndex + 1] : null;
  const upcomingPicks = picks.slice(currentIndex + 1, currentIndex + 6);

  const getColumnIndex = (pickIndex: number) => (pickIndex - 1) % 5;
  const getColumnLabel = (pickIndex: number) => COLUMN_LABELS[getColumnIndex(pickIndex)];
  const getColumnColor = (pickIndex: number) => COLUMN_COLORS[getColumnIndex(pickIndex)];

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Music className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-violet-400">Sidekick View</div>
              <div className="text-sm text-slate-400">Co-Host Dashboard</div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Game Code</div>
              <div className="font-mono text-xl font-black text-violet-400">{session?.game_code ?? "----"}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyShareLink}
                className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                Share
              </button>
              <button
                onClick={() => loadSession()}
                className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main: Current Song */}
          <div className="lg:col-span-2 space-y-6">
            {/* Now Playing Card */}
            <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 backdrop-blur">
              {currentPick && (
                <div className={`bg-gradient-to-r ${getColumnColor(currentPick.pick_index)} p-1`}>
                  <div className="flex items-center justify-between bg-slate-950/90 px-6 py-4 backdrop-blur">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${getColumnColor(currentPick.pick_index)} text-3xl font-black text-white shadow-lg`}>
                        {getColumnLabel(currentPick.pick_index)}
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Now Playing</div>
                        <div className="text-sm text-slate-300">Column {getColumnLabel(currentPick.pick_index)} · Song #{currentPick.pick_index}</div>
                      </div>
                    </div>
                    <div className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide ${
                      session?.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"
                    }`}>
                      {session?.status ?? "Pending"}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-8">
                {currentPick?.game_template_items ? (
                  <div className="text-center">
                    <h1 className="text-4xl font-black sm:text-5xl lg:text-6xl bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                      {currentPick.game_template_items.title}
                    </h1>
                    <p className="mt-4 text-2xl text-slate-400">
                      {currentPick.game_template_items.artist}
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-xl text-slate-500">Waiting for next song...</div>
                )}
              </div>

              {/* Music Metadata - BPM, Key, Duration */}
              {currentPick?.game_template_items && (
                <div className="grid grid-cols-3 gap-px bg-slate-800/50">
                  <div className="bg-slate-900/80 p-6 text-center">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Tempo</div>
                    <div className="mt-2 text-3xl font-black text-violet-400">
                      {currentPick.game_template_items.bpm ?? "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">BPM</div>
                  </div>
                  <div className="bg-slate-900/80 p-6 text-center">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Key</div>
                    <div className="mt-2 text-3xl font-black text-fuchsia-400">
                      {currentPick.game_template_items.key_signature ?? "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Signature</div>
                  </div>
                  <div className="bg-slate-900/80 p-6 text-center">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Duration</div>
                    <div className="mt-2 text-3xl font-black text-emerald-400">
                      {currentPick.game_template_items.duration_ms 
                        ? formatDuration(currentPick.game_template_items.duration_ms) 
                        : "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Length</div>
                  </div>
                </div>
              )}
            </div>

            {/* Lyrics Section */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur">
              <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold">Lyrics</h3>
                  {currentPick?.game_template_items?.lyrics_url && (
                    <a
                      href={currentPick.game_template_items.lyrics_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-violet-400 hover:underline"
                    >
                      Open in Genius <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <button
                  onClick={() => setShowLyrics(!showLyrics)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    showLyrics ? "bg-violet-500/20 text-violet-400" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {showLyrics ? "Hide" : "Show"}
                </button>
              </div>
              {showLyrics && (
                <div className="max-h-80 overflow-y-auto p-6">
                  {currentPick?.game_template_items ? (
                    <div className="space-y-4 text-center font-mono text-sm leading-relaxed text-slate-400">
                      <p className="italic text-slate-600">
                        Lyrics will appear here when connected to a lyrics provider like Genius.
                      </p>
                      <p className="text-slate-600">
                        Search for &ldquo;{currentPick.game_template_items.title}&rdquo; by {currentPick.game_template_items.artist}
                      </p>
                    </div>
                  ) : (
                    <p className="text-center text-slate-500">No song playing</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: Upcoming Songs */}
          <div className="space-y-6">
            {/* Next Up */}
            {nextPick?.game_template_items && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                <div className="text-xs font-bold uppercase tracking-widest text-amber-400">Up Next</div>
                <div className="mt-3 flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${getColumnColor(nextPick.pick_index)} font-bold text-white`}>
                    {getColumnLabel(nextPick.pick_index)}
                  </div>
                  <div>
                    <div className="font-bold text-white">{nextPick.game_template_items.title}</div>
                    <div className="text-sm text-slate-400">{nextPick.game_template_items.artist}</div>
                  </div>
                </div>
                {(nextPick.game_template_items.bpm || nextPick.game_template_items.key_signature) && (
                  <div className="mt-3 flex gap-3 text-xs">
                    {nextPick.game_template_items.bpm && (
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-400">
                        {nextPick.game_template_items.bpm} BPM
                      </span>
                    )}
                    {nextPick.game_template_items.key_signature && (
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-400">
                        {nextPick.game_template_items.key_signature}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Coming Up List */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50">
              <div className="border-b border-slate-800 px-5 py-4">
                <h3 className="font-bold">Coming Up</h3>
              </div>
              <div className="divide-y divide-slate-800/50">
                {upcomingPicks.length === 0 ? (
                  <div className="p-5 text-center text-sm text-slate-500">
                    No more songs in queue
                  </div>
                ) : (
                  upcomingPicks.map((pick) => (
                    <div key={pick.id} className="flex items-center gap-3 px-5 py-3">
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${getColumnColor(pick.pick_index)} text-xs font-bold text-white`}>
                        {getColumnLabel(pick.pick_index)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">
                          {pick.game_template_items?.title ?? "Unknown"}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {pick.game_template_items?.artist ?? ""}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {pick.game_template_items?.bpm && (
                          <span className="text-[10px] text-slate-500">{pick.game_template_items.bpm} BPM</span>
                        )}
                        {pick.game_template_items?.key_signature && (
                          <span className="text-[10px] text-violet-400">{pick.game_template_items.key_signature}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Band Notes */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Band Notes</div>
              <div className="mt-3 space-y-2 text-sm text-slate-400">
                <p>This view is designed for band members and co-hosts.</p>
                <p>It automatically syncs with the host&apos;s current song position every 3 seconds.</p>
                <p>Share this link with your bandmates to keep everyone on the same page!</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-800/50 py-6 text-center text-xs text-slate-600">
        Dead Wax Dialogues · Sidekick View · Auto-refreshing every 3s
      </footer>
    </div>
  );
}