"use client";

import { useEffect, useMemo, useState } from "react";
import { Container } from "components/ui/Container";
import { Button } from "components/ui/Button";

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

export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [picks, setPicks] = useState<PickItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isWorking, setIsWorking] = useState(false);

  const loadLatestSession = async () => {
    const response = await fetch("/api/game-sessions");
    const payload = await response.json();
    const latest = payload.data?.[0] ?? null;
    setSession(latest);
    if (latest?.id) {
      const detailsResponse = await fetch(`/api/game-sessions/${latest.id}`);
      const detailsPayload = await detailsResponse.json();
      setPicks(detailsPayload.data?.picks ?? []);
    }
  };

  useEffect(() => {
    void loadLatestSession();
  }, []);

  const currentPick = picks[currentIndex];
  const currentItem = currentPick?.game_template_items;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < picks.length - 1;

  const history = useMemo(() => picks.slice(0, currentIndex), [picks, currentIndex]);

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
    await loadLatestSession();
  };

  return (
    <Container size="md" className="py-8 min-h-screen">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Music Bingo Host</h1>
          <p className="text-sm text-gray-500 mt-2">
            Manual vinyl playback. Advance the pick list as you play each track.
          </p>
          {session?.game_code && (
            <p className="text-xs text-gray-500 mt-2">Game code: {session.game_code}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!session}
            onClick={() => updateSessionStatus("finished")}
          >
            Finish Game
          </Button>
          <Button
            size="sm"
            disabled={!session}
            onClick={() => updateSessionStatus("active")}
          >
            Start Game
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-400">Now Playing</div>
          <div className="mt-3 p-4 border border-gray-200 rounded-xl bg-gray-50">
            <div className="text-lg font-semibold text-gray-900">
              {currentItem?.title ?? "No pick loaded"}
            </div>
            <div className="text-sm text-gray-600">{currentItem?.artist ?? "-"}</div>
          </div>

          <div className="flex gap-3 mt-5">
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasPrev}
              onClick={handlePrev}
            >
              Previous Song
            </Button>
            <Button
              size="sm"
              disabled={!hasNext || isWorking}
              onClick={handleNext}
            >
              Next Song
            </Button>
          </div>
        </section>

        <aside className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-400">Called Songs</div>
          <div className="mt-4 space-y-3">
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">No songs called yet.</p>
            ) : (
              history.map((pick, index) => (
                <div key={pick.id} className="text-sm text-gray-700">
                  {index + 1}. {pick.game_template_items?.title ?? "-"} - {pick.game_template_items?.artist ?? "-"}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </Container>
  );
}
