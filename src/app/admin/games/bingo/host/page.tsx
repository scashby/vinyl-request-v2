"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/admin/games/bingo" className="text-slate-500 hover:text-slate-900">
            ←
          </Link>
          <div className="flex items-center gap-2">
            <Image src="/images/Skulllogo.png" alt="Dead Wax Dialogues" width={28} height={28} />
            <div className="text-center leading-tight">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Dead Wax</div>
              <div className="text-sm font-semibold text-slate-900">Bingo</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/admin/games/bingo/lobby?sessionId=${session?.id ?? ""}`)}
              className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-900"
              aria-label="Lobby"
            >
              <Users className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => router.push(`/admin/games/bingo/settings?sessionId=${session?.id ?? ""}`)}
              className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-900"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            Game Code: {session?.game_code ?? "----"}
          </div>
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
            className="flex-1 rounded-lg border border-indigo-500/70 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-indigo-700 hover:bg-indigo-50"
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
                  isCurrent ? "border-amber-400 bg-amber-100/70" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${
                      isCurrent ? "bg-amber-400 text-slate-900" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {columnLabel}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{pick.game_template_items?.title ?? "-"}</div>
                    <div className="text-xs text-slate-500">{pick.game_template_items?.artist ?? ""}</div>
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
            className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-700 disabled:opacity-40"
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="text-lg font-semibold text-slate-900">Finish the game?</div>
            <p className="mt-2 text-xs text-slate-500">
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
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
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
