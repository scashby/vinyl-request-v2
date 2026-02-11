// Path: src/app/admin/games/bingo/test/lobby/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  UserPlus,
  UserMinus,
  UserCheck,
  Users,
  Copy,
  Check,
  Moon,
  Sun,
  QrCode,
} from "lucide-react";

type GameSession = {
  id: number;
  game_code: string;
  status: string;
  game_templates: {
    name: string;
  };
};

type Player = {
  id: number;
  display_name: string;
  status: "waiting" | "admitted" | "playing" | "left" | "removed";
  created_at: string;
};

export default function LobbyPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);

  const waitingPlayers = players.filter((p) => p.status === "waiting");
  const admittedPlayers = players.filter((p) => p.status === "admitted" || p.status === "playing");
  const removedPlayers = players.filter((p) => p.status === "removed");

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [sessionRes, playersRes] = await Promise.all([
        fetch(`/api/game-sessions/${sessionId}`),
        fetch(`/api/game-sessions/${sessionId}/players`),
      ]);

      if (sessionRes.ok) setSession(await sessionRes.json());
      if (playersRes.ok) {
        const data = await playersRes.json();
        setPlayers(data.data ?? data);
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

  const admitPlayer = async (playerId: number) => {
    await fetch(`/api/game-players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "admitted" }),
    });
    fetchData();
  };

  const admitAll = async () => {
    await Promise.all(
      waitingPlayers.map((p) =>
        fetch(`/api/game-players/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "admitted" }),
        })
      )
    );
    fetchData();
  };

  const removePlayer = async (playerId: number) => {
    await fetch(`/api/game-players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "removed" }),
    });
    fetchData();
  };

  const copyGameCode = () => {
    if (session?.game_code) {
      navigator.clipboard.writeText(session.game_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyJoinLink = () => {
    const link = `${window.location.origin}/play?code=${session?.game_code}`;
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
              className={`flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-white/10`}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="text-lg font-bold">Game Lobby</div>
              <div className={`text-sm ${theme.muted}`}>{session?.game_templates.name}</div>
            </div>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className={`rounded-lg p-2 ${theme.card} border ${theme.border}`}>
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Game Code Section */}
        <div className={`mb-8 rounded-2xl ${theme.card} border ${theme.border} p-8 text-center`}>
          <div className={`mb-2 text-sm font-medium uppercase tracking-wider ${theme.muted}`}>Game Code</div>
          <div className="mb-6 text-6xl font-bold tracking-[0.3em] text-pink-500">{session?.game_code}</div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={copyGameCode}
              className={`flex items-center gap-2 rounded-lg ${theme.card} border ${theme.border} px-4 py-2 transition-colors hover:border-pink-500`}
            >
              {copiedCode ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
            </button>
            <button
              onClick={copyJoinLink}
              className={`flex items-center gap-2 rounded-lg ${theme.card} border ${theme.border} px-4 py-2 transition-colors hover:border-pink-500`}
            >
              {copiedLink ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              <span>{copiedLink ? "Copied!" : "Copy Join Link"}</span>
            </button>
            <button
              onClick={() => setShowQR(!showQR)}
              className={`flex items-center gap-2 rounded-lg ${theme.card} border ${theme.border} px-4 py-2 transition-colors hover:border-pink-500`}
            >
              <QrCode className="h-4 w-4" />
              <span>QR Code</span>
            </button>
          </div>

          {showQR && (
            <div className="mt-6 flex justify-center">
              <div className={`rounded-xl ${darkMode ? "bg-white" : "bg-gray-100"} p-4`}>
                {/* Placeholder for QR code - would use qrcode.react in production */}
                <div className="flex h-32 w-32 items-center justify-center border-2 border-dashed border-gray-300 text-gray-400">
                  QR Code
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Waiting Players */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-yellow-500" />
              <h2 className="text-lg font-bold">Waiting in Lobby</h2>
              <span className={`rounded-full bg-yellow-500/20 px-2 py-0.5 text-sm text-yellow-500`}>
                {waitingPlayers.length}
              </span>
            </div>
            {waitingPlayers.length > 0 && (
              <button
                onClick={admitAll}
                className="rounded-lg bg-gradient-to-r from-pink-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition-transform hover:scale-105"
              >
                Admit All
              </button>
            )}
          </div>

          {waitingPlayers.length === 0 ? (
            <div className={`rounded-xl ${theme.card} border ${theme.border} p-8 text-center ${theme.muted}`}>
              No players waiting
            </div>
          ) : (
            <div className={`divide-y ${theme.border} overflow-hidden rounded-xl ${theme.card} border ${theme.border}`}>
              {waitingPlayers.map((player) => (
                <div key={player.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 text-sm font-bold text-white">
                    {player.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{player.display_name}</div>
                  </div>
                  <button
                    onClick={() => admitPlayer(player.id)}
                    className="flex items-center gap-1 rounded-lg bg-green-500/20 px-3 py-1.5 text-sm text-green-500 transition-colors hover:bg-green-500/30"
                  >
                    <UserCheck className="h-4 w-4" />
                    Admit
                  </button>
                  <button
                    onClick={() => removePlayer(player.id)}
                    className="flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-500/30"
                  >
                    <UserMinus className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Playing */}
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-bold">Playing</h2>
            <span className={`rounded-full bg-green-500/20 px-2 py-0.5 text-sm text-green-500`}>
              {admittedPlayers.length}
            </span>
          </div>

          {admittedPlayers.length === 0 ? (
            <div className={`rounded-xl ${theme.card} border ${theme.border} p-8 text-center ${theme.muted}`}>
              No players admitted yet
            </div>
          ) : (
            <div className={`divide-y ${theme.border} overflow-hidden rounded-xl ${theme.card} border ${theme.border}`}>
              {admittedPlayers.map((player) => (
                <div key={player.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-sm font-bold text-white">
                    {player.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{player.display_name}</div>
                  </div>
                  <button
                    onClick={() => removePlayer(player.id)}
                    className="flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-500/30"
                  >
                    <UserMinus className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Removed */}
        {removedPlayers.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-bold">Removed</h2>
              <span className={`rounded-full bg-red-500/20 px-2 py-0.5 text-sm text-red-500`}>
                {removedPlayers.length}
              </span>
            </div>

            <div className={`divide-y ${theme.border} overflow-hidden rounded-xl ${theme.card} border ${theme.border} opacity-60`}>
              {removedPlayers.map((player) => (
                <div key={player.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-gray-500 to-gray-600 text-sm font-bold text-white">
                    {player.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{player.display_name}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}