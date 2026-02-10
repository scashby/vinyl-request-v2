"use client";

import { useEffect, useState } from "react";
import { Container } from "components/ui/Container";

type GameSession = {
  id: number;
  game_code: string | null;
  variant: string;
  bingo_target: string;
  status: string;
  created_at: string | null;
};

export default function Page() {
  const [sessions, setSessions] = useState<GameSession[]>([]);

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/game-sessions");
      const payload = await response.json();
      setSessions(payload.data ?? []);
    };
    void load();
  }, []);

  return (
    <Container size="md" className="py-8 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900">Game History</h1>
      <p className="text-sm text-gray-500 mt-2">Recent Music Bingo sessions.</p>

      <div className="space-y-4 mt-6">
        {sessions.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-2xl p-6 text-sm text-gray-500">
            No sessions yet.
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Session {session.id}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Code: {session.game_code ?? "-"} | {session.variant} | {session.bingo_target}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {session.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </Container>
  );
}
