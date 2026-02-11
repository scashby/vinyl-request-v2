// Path: src/app/admin/games/bingo/test/lobby/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy, Check, QrCode, UserCheck, UserMinus, Moon, Sun } from "lucide-react";

type Session = {
  id: number;
  game_code: string;
  game_templates: { name: string };
};

type Player = {
  id: number;
  display_name: string;
  status: "waiting" | "admitted" | "playing" | "left" | "removed";
};

export default function LobbyPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const waiting = players.filter((p) => p.status === "waiting");
  const playing = players.filter((p) => ["admitted", "playing"].includes(p.status));
  const removed = players.filter((p) => p.status === "removed");

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    const [sRes, pRes] = await Promise.all([
      fetch(`/api/game-sessions/${sessionId}`),
      fetch(`/api/game-sessions/${sessionId}/players`),
    ]);
    if (sRes.ok) setSession(await sRes.json());
    if (pRes.ok) {
      const d = await pRes.json();
      setPlayers(d.data ?? d);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const i = setInterval(fetchData, 3000);
    return () => clearInterval(i);
  }, [fetchData]);

  const admit = async (id: number) => {
    await fetch(`/api/game-players/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "admitted" }),
    });
    fetchData();
  };

  const admitAll = async () => {
    await Promise.all(waiting.map((p) => admit(p.id)));
  };

  const remove = async (id: number) => {
    await fetch(`/api/game-players/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "removed" }),
    });
    fetchData();
  };

  const copyCode = () => {
    if (session) {
      navigator.clipboard.writeText(session.game_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/play?code=${session?.game_code}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/admin/games/bingo/test/host?sessionId=${sessionId}`} className="rounded-lg p-2 hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-bold">Game Lobby</h1>
              <p className={`text-sm ${muted}`}>{session?.game_templates.name}</p>
            </div>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className={`rounded-lg p-2 ${card} border ${border}`}>
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        {/* Game Code */}
        <div className={`mb-8 rounded-2xl ${card} border ${border} p-8 text-center`}>
          <p className={`mb-2 text-sm uppercase tracking-wider ${muted}`}>Game Code</p>
          <p className="mb-6 text-6xl font-bold tracking-[0.3em] text-pink-500">{session?.game_code ?? "----"}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={copyCode} className={`flex items-center gap-2 rounded-lg ${card} border ${border} px-4 py-2 transition hover:border-pink-500`}>
              {copiedCode ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copiedCode ? "Copied!" : "Copy Code"}
            </button>
            <button onClick={copyLink} className={`flex items-center gap-2 rounded-lg ${card} border ${border} px-4 py-2 transition hover:border-pink-500`}>
              {copiedLink ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copiedLink ? "Copied!" : "Copy Link"}
            </button>
            <button onClick={() => setShowQR(!showQR)} className={`flex items-center gap-2 rounded-lg ${card} border ${border} px-4 py-2 transition hover:border-pink-500`}>
              <QrCode className="h-4 w-4" />
              QR Code
            </button>
          </div>
          {showQR && (
            <div className="mt-6 inline-block rounded-xl bg-white p-4">
              <div className="flex h-32 w-32 items-center justify-center border-2 border-dashed border-gray-300 text-sm text-gray-400">
                QR Code
              </div>
            </div>
          )}
        </div>

        {/* Waiting */}
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500/20 text-xs text-yellow-500">{waiting.length}</span>
              Waiting in Lobby
            </h2>
            {waiting.length > 0 && (
              <button onClick={admitAll} className="rounded-lg bg-gradient-to-r from-pink-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:scale-105">
                Admit All
              </button>
            )}
          </div>
          {waiting.length === 0 ? (
            <div className={`rounded-xl ${card} border ${border} p-6 text-center ${muted}`}>No players waiting</div>
          ) : (
            <div className={`overflow-hidden rounded-xl ${card} border ${border}`}>
              {waiting.map((p) => (
                <div key={p.id} className={`flex items-center gap-4 border-b ${border} px-4 py-3 last:border-0`}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 text-sm font-bold text-white">
                    {p.display_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 font-medium">{p.display_name}</span>
                  <button onClick={() => admit(p.id)} className="flex items-center gap-1 rounded-lg bg-green-500/20 px-3 py-1.5 text-sm text-green-500 hover:bg-green-500/30">
                    <UserCheck className="h-4 w-4" /> Admit
                  </button>
                  <button onClick={() => remove(p.id)} className="flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/30">
                    <UserMinus className="h-4 w-4" /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Playing */}
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-xs text-green-500">{playing.length}</span>
            Playing
          </h2>
          {playing.length === 0 ? (
            <div className={`rounded-xl ${card} border ${border} p-6 text-center ${muted}`}>No players admitted yet</div>
          ) : (
            <div className={`overflow-hidden rounded-xl ${card} border ${border}`}>
              {playing.map((p) => (
                <div key={p.id} className={`flex items-center gap-4 border-b ${border} px-4 py-3 last:border-0`}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-sm font-bold text-white">
                    {p.display_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 font-medium">{p.display_name}</span>
                  <button onClick={() => remove(p.id)} className="flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/30">
                    <UserMinus className="h-4 w-4" /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Removed */}
        {removed.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-xs text-red-500">{removed.length}</span>
              Removed
            </h2>
            <div className={`overflow-hidden rounded-xl ${card} border ${border} opacity-60`}>
              {removed.map((p) => (
                <div key={p.id} className={`flex items-center gap-4 border-b ${border} px-4 py-3 last:border-0`}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-500 text-sm font-bold text-white">
                    {p.display_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1">{p.display_name}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}