"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Settings } from "lucide-react";

type PickItem = {
  id: number;
  pick_index: number;
  called_at: string | null;
  game_template_items: {
    id: number;
    title: string;
    artist: string;
  } | null;
};

type Session = {
  id: number;
  game_code: string | null;
  status: string;
};

const COLUMN_LABELS = ["B", "I", "N", "G", "O"];

export default function Page() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [picks, setPicks] = useState<PickItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isWorking, setIsWorking] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  const loadSession = async () => {
    const sessionId = searchParams.get("sessionId");
    const eventId = searchParams.get("eventId");

    if (sessionId) {
      const response = await fetch(`/api/game-sessions/${sessionId}`);
      const payload = await response.json();
      setSession(payload.data?.session ?? null);
      setPicks(payload.data?.picks ?? []);
      return;
    }

    const response = await fetch(eventId ? `/api/game-sessions?eventId=${eventId}` : "/api/game-sessions");
    const payload = await response.json();
    const latest = payload.data?.[0] ?? null;
    setSession(latest);
    if (latest?.id) {
      const details = await fetch(`/api/game-sessions/${latest.id}`);
      const detailsPayload = await details.json();
      setPicks(detailsPayload.data?.picks ?? []);
    }
  };

  useEffect(() => {
    void loadSession();
  }, [searchParams]);

  useEffect(() => {
    if (picks.length === 0) return;
    const nextIndex = picks.findIndex((pick) => !pick.called_at);
    setCurrentIndex(nextIndex === -1 ? picks.length - 1 : nextIndex);
  }, [picks]);

  const currentPick = picks[currentIndex];

  const markCalled = async (pickId: number) => {
    await fetch(`/api/game-session-picks/${pickId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calledAt: new Date().toISOString() }),
    });
  };

  const handleNext = async () => {
    if (!currentPick) return;
    setIsWorking(true);
    try {
      await markCalled(currentPick.id);
      setCurrentIndex((prev) => Math.min(picks.length - 1, prev + 1));
      await loadSession();
    } finally {
      setIsWorking(false);
    }
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const updateSessionStatus = async (status: string) => {
    if (!session?.id) return;
    await fetch(`/api/game-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadSession();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-900 bg-slate-950/95">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/admin/games/bingo" className="text-slate-400 hover:text-white">
            ←
          </Link>
          <div className="flex items-center gap-6 text-xs">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Game Code</div>
              <div className="mt-1 rounded-md border border-indigo-500 px-3 py-1 text-sm font-semibold text-indigo-200">
                {session?.game_code ?? "----"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Playing</div>
              <div className="mt-1 rounded-md bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-200">0</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Lobby</div>
              <div className="mt-1 rounded-md bg-amber-500/20 px-3 py-1 text-sm font-semibold text-amber-200">0</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/admin/games/bingo/lobby?sessionId=${session?.id ?? ""}`)}
              className="rounded-full border border-slate-800 p-2 text-slate-300 hover:text-white"
              aria-label="Lobby"
            >
              <Users className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => router.push(`/admin/games/bingo/settings?sessionId=${session?.id ?? ""}`)}
              className="rounded-full border border-slate-800 p-2 text-slate-300 hover:text-white"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {session?.status !== "active" ? (
            <button
              type="button"
              onClick={() => updateSessionStatus("active")}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white hover:bg-indigo-700"
            >
              Start Game
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowFinishConfirm(true)}
            className="flex-1 rounded-lg border border-indigo-500/70 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-indigo-200 hover:bg-indigo-600"
          >
            Finish Game
          </button>
        </div>

        <div className="space-y-3">
          {picks.map((pick, index) => {
            const columnLabel = COLUMN_LABELS[(pick.pick_index - 1) % COLUMN_LABELS.length];
            const isCurrent = index === currentIndex;
            return (
              <div
                key={pick.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  isCurrent
                    ? "border-amber-400 bg-amber-500/10"
                    : "border-slate-800 bg-slate-900/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${
                      isCurrent ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {columnLabel}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      {pick.game_template_items?.title ?? "-"}
                    </div>
                    <div className="text-xs text-slate-400">{pick.game_template_items?.artist ?? ""}</div>
                  </div>
                </div>
                <div className="text-xs text-slate-500">{pick.pick_index}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex-1 rounded-lg border border-slate-800 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-200 hover:border-slate-600 disabled:opacity-40"
          >
            Previous Song
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={currentIndex >= picks.length - 1 || isWorking}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            Next Song
          </button>
        </div>
      </main>

      {showFinishConfirm ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 p-6 text-center">
            <div className="text-lg font-semibold">Finish the game?</div>
            <p className="mt-2 text-xs text-slate-400">
              This will end the current game for all players and display a game summary.
            </p>
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => {
                  updateSessionStatus("finished");
                  setShowFinishConfirm(false);
                }}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setShowFinishConfirm(false)}
                className="w-full rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
