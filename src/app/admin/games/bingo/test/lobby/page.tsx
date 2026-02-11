// Path: src/app/admin/games/bingo/lobby/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  UserPlus,
  UserMinus,
  UserX,
  Copy,
  Check,
  QrCode,
  ArrowRight,
  RefreshCw,
  Music,
} from "lucide-react";

type Player = {
  id: number;
  display_name: string;
  status: "lobby" | "playing" | "left" | "removed";
  joined_at: string;
};

type Session = {
  id: number;
  game_code: string | null;
  status: string;
};

export default function LobbyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isAdmitting, setIsAdmitting] = useState(false);

  const loadData = useCallback(async () => {
    const sessionId = searchParams.get("sessionId");
    const eventId = searchParams.get("eventId");
    
    if (sessionId) {
      const response = await fetch(`/api/game-sessions/${sessionId}`);
      const payload = await response.json();
      setSession(payload.data?.session ?? null);
      setPlayers(payload.data?.players ?? []);
      return;
    }
    
    const response = await fetch(eventId ? `/api/game-sessions?eventId=${eventId}` : "/api/game-sessions");
    const payload = await response.json();
    const latest = payload.data?.[0] ?? null;
    setSession(latest);
    if (latest?.id) {
      const details = await fetch(`/api/game-sessions/${latest.id}`);
      const detailsPayload = await details.json();
      setPlayers(detailsPayload.data?.players ?? []);
    }
  }, [searchParams]);

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadData();
  }, [loadData]);

  // Auto-refresh every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void loadData();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const lobbyPlayers = players.filter((p) => p.status === "lobby");
  const playingPlayers = players.filter((p) => p.status === "playing");
  const leftPlayers = players.filter((p) => p.status === "left");
  const removedPlayers = players.filter((p) => p.status === "removed");

  const joinUrl = session?.game_code ? `${origin}/join/${session.game_code}` : "";

  const copyJoinLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const admitPlayer = async (playerId: number) => {
    await fetch(`/api/game-players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "playing" }),
    });
    await loadData();
  };

  const admitAll = async () => {
    setIsAdmitting(true);
    try {
      await Promise.all(
        lobbyPlayers.map((player) =>
          fetch(`/api/game-players/${player.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "playing" }),
          })
        )
      );
      await loadData();
    } finally {
      setIsAdmitting(false);
    }
  };

  const removePlayer = async (playerId: number) => {
    await fetch(`/api/game-players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "removed" }),
    });
    await loadData();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href={`/admin/games/bingo/host?sessionId=${session?.id ?? ""}`}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            ← Back to Host
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Music className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-violet-400">Lobby</div>
              <div className="text-sm text-slate-400">Player Management</div>
            </div>
          </div>
          <button
            onClick={() => loadData()}
            className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Game Code Card */}
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 backdrop-blur">
          <div className="p-8 text-center">
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">
              Game Code
            </div>
            <div className="font-mono text-5xl font-black tracking-[0.15em] text-white sm:text-6xl">
              {session?.game_code ?? "----"}
            </div>
            <div className="mt-4 text-slate-400">
              Send guests to:
            </div>
            <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-800/50 px-4 py-2 font-mono text-sm text-slate-300">
              {joinUrl || "---"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-slate-800/50">
            <button
              onClick={copyJoinLink}
              className="flex items-center justify-center gap-2 bg-slate-900/80 px-6 py-4 font-bold text-white transition hover:bg-slate-800"
            >
              {copied ? (
                <>
                  <Check className="h-5 w-5 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5" />
                  Copy Link
                </>
              )}
            </button>
            <button
              onClick={() => setShowQR(!showQR)}
              className="flex items-center justify-center gap-2 bg-slate-900/80 px-6 py-4 font-bold text-white transition hover:bg-slate-800"
            >
              <QrCode className="h-5 w-5" />
              {showQR ? "Hide QR" : "Show QR"}
            </button>
          </div>

          {showQR && (
            <div className="border-t border-slate-800 bg-white p-8">
              <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl bg-slate-100">
                <div className="text-center text-slate-400">
                  <QrCode className="mx-auto h-16 w-16" />
                  <p className="mt-2 text-xs">QR Code</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Player Sections */}
        <div className="mt-8 space-y-6">
          {/* Lobby - Waiting to Join */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center justify-between border-b border-amber-500/20 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                  <UserPlus className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <div className="font-bold text-white">Waiting in Lobby</div>
                  <div className="text-xs text-slate-400">{lobbyPlayers.length} guests ready to join</div>
                </div>
              </div>
              {lobbyPlayers.length > 0 && (
                <button
                  onClick={admitAll}
                  disabled={isAdmitting}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
                >
                  {isAdmitting ? "Admitting..." : "Admit All"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
            {lobbyPlayers.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No guests waiting. Share the game code to invite players!
              </div>
            ) : (
              <div className="divide-y divide-amber-500/10">
                {lobbyPlayers.map((player) => (
                  <div key={player.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 font-bold text-slate-300">
                        {player.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-white">{player.display_name}</div>
                        <div className="text-xs text-slate-500">Joined {formatTime(player.joined_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => admitPlayer(player.id)}
                        className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-400 transition hover:bg-emerald-500/30"
                      >
                        Admit
                      </button>
                      <button
                        onClick={() => removePlayer(player.id)}
                        className="rounded-lg bg-rose-500/10 p-2 text-rose-400 transition hover:bg-rose-500/20"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Playing */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5">
            <div className="flex items-center gap-3 border-b border-emerald-500/20 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                <Users className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <div className="font-bold text-white">Playing</div>
                <div className="text-xs text-slate-400">{playingPlayers.length} guests in the game</div>
              </div>
            </div>
            {playingPlayers.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No guests are in the game yet.
              </div>
            ) : (
              <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {playingPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-xl bg-slate-800/50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-400">
                        {player.display_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-white">{player.display_name}</span>
                    </div>
                    <button
                      onClick={() => removePlayer(player.id)}
                      className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/20 hover:text-rose-400"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Left Game */}
          {leftPlayers.length > 0 && (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/50">
              <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800">
                  <UserMinus className="h-5 w-5 text-slate-400" />
                </div>
                <div>
                  <div className="font-bold text-white">Left Game</div>
                  <div className="text-xs text-slate-500">{leftPlayers.length} guests have left</div>
                </div>
              </div>
              <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {leftPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 rounded-xl bg-slate-800/30 px-4 py-3 opacity-60"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-500">
                      {player.display_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-slate-400">{player.display_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Removed */}
          {removedPlayers.length > 0 && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5">
              <div className="flex items-center gap-3 border-b border-rose-500/10 px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20">
                  <UserX className="h-5 w-5 text-rose-400" />
                </div>
                <div>
                  <div className="font-bold text-white">Removed</div>
                  <div className="text-xs text-slate-500">{removedPlayers.length} guests removed from game</div>
                </div>
              </div>
              <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {removedPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 rounded-xl bg-slate-800/30 px-4 py-3 opacity-60"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/20 text-sm font-bold text-rose-400">
                      {player.display_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-slate-400 line-through">{player.display_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Continue Button */}
        <div className="mt-8">
          <button
            onClick={() => router.push(`/admin/games/bingo/host?sessionId=${session?.id ?? ""}`)}
            className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-4 text-lg font-bold text-white shadow-xl shadow-violet-500/25 transition hover:shadow-violet-500/40"
          >
            Continue to Host Dashboard
          </button>
        </div>
      </main>
    </div>
  );
}
