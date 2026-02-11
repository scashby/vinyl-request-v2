"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";

type GameSession = {
  id: number;
  game_code: string | null;
  status: string;
};

function LobbySection({
  label,
  count,
  emptyText,
  tone,
}: {
  label: string;
  count: number;
  emptyText: string;
  tone: "green" | "purple" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "purple"
        ? "bg-fuchsia-100 text-fuchsia-700"
        : "bg-rose-100 text-rose-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${toneClass}`}>{count}</span>
        <div>
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          <div className="text-xs text-slate-500">{emptyText}</div>
        </div>
      </div>
    </div>
  );
}

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
      const response = await fetch(eventId ? `/api/game-sessions?eventId=${eventId}` : "/api/game-sessions");
      const payload = await response.json();
      setSession(payload.data?.[0] ?? null);
    };
    void load();
  }, [searchParams]);

  const joinUrl = session?.game_code ? `${origin}/join/${session.game_code}` : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/admin/games/bingo" className="text-slate-500 hover:text-slate-900">
            ←
          </Link>
          <div className="flex items-center gap-2">
            <Image src="/images/Skulllogo.png" alt="Dead Wax Dialogues" width={28} height={28} />
            <div className="text-center leading-tight">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Dead Wax</div>
              <div className="text-sm font-semibold text-slate-900">Lobby</div>
            </div>
          </div>
          <button type="button" onClick={() => router.back()} className="text-slate-500 hover:text-slate-900">
            ×
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Game Code</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{session?.game_code ?? "----"}</div>
          <div className="mt-4 text-xs uppercase tracking-wide text-slate-400">Send guests to:</div>
          <div className="mt-2 text-sm text-slate-700">{joinUrl ?? "-"}</div>
          <button
            type="button"
            onClick={() => {
              if (!joinUrl) return;
              navigator.clipboard.writeText(joinUrl);
            }}
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700"
          >
            Copy Link
          </button>
        </div>

        <div className="mt-8 grid gap-4">
          <LobbySection label="Playing" count={0} emptyText="No guests are in the game." tone="green" />
          <LobbySection label="Left game" count={0} emptyText="No guests have left the game." tone="purple" />
          <LobbySection label="Removed" count={0} emptyText="No guests have been removed." tone="red" />
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
