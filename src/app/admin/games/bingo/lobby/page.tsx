"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

type GameSession = {
  id: number;
  game_code: string | null;
  status: string;
};

export default function Page() {
  const [session, setSession] = useState<GameSession | null>(null);
  const [origin, setOrigin] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    setOrigin(window.location.origin);
    const load = async () => {
      const sessionId = searchParams.get("sessionId");
      const eventId = searchParams.get("eventId");
      if (sessionId) {
        const response = await fetch(`/api/game-sessions/${sessionId}`);
        const payload = await response.json();
        setSession(payload.data?.session ?? null);
        return;
      }
      const response = await fetch(
        eventId ? `/api/game-sessions?eventId=${eventId}` : "/api/game-sessions"
      );
      const payload = await response.json();
      const latest = payload.data?.[0] ?? null;
      setSession(latest);
    };
    void load();
  }, [searchParams]);

  const joinUrl = session?.game_code ? `/join/${session.game_code}` : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-900 bg-slate-950/90">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/admin/games/bingo" className="text-slate-400 hover:text-white">
            ←
          </Link>
          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Lobby</div>
            <div className="text-sm font-semibold">Game Lobby</div>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white"
          >
            ×
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Game Code</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">
            {session?.game_code ?? "----"}
          </div>
          <div className="mt-4 text-xs uppercase tracking-wide text-slate-500">Send guests to:</div>
          <div className="mt-2 text-sm text-slate-200">{joinUrl ? `${origin}${joinUrl}` : "-"}</div>
          <button
            type="button"
            onClick={() => {
              if (!joinUrl) return;
              navigator.clipboard.writeText(`${origin}${joinUrl}`);
            }}
            className="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
          >
            Copy Link
          </button>
        </div>

        <div className="mt-8 grid gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-blue-500/30 px-2 py-1 text-xs font-semibold text-blue-200">5</span>
              <div>
                <div className="text-sm font-semibold">Seats Available</div>
                <div className="text-xs text-slate-400">Upgrade your account to host larger games.</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-amber-500/30 px-2 py-1 text-xs font-semibold text-amber-200">0</span>
              <div>
                <div className="text-sm font-semibold">Lobby</div>
                <div className="text-xs text-slate-400">No guests waiting to join the game.</div>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push(`/admin/games/bingo/host?sessionId=${session?.id ?? ""}`)}
          className="mt-8 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Continue
        </button>
      </main>
    </div>
  );
}
