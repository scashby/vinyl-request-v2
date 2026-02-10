"use client";

import { useEffect, useState } from "react";
import { Container } from "components/ui/Container";
import { Button } from "components/ui/Button";
import { useSearchParams } from "next/navigation";

type GameSession = {
  id: number;
  game_code: string | null;
  status: string;
};

export default function Page() {
  const [session, setSession] = useState<GameSession | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const load = async () => {
      const eventId = searchParams.get("eventId");
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
    <Container size="md" className="py-8 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900">Lobby</h1>
      <p className="text-sm text-gray-500 mt-2">Share the join code and URL.</p>

      <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm mt-6">
        <div className="text-xs uppercase tracking-wide text-gray-400">Game Code</div>
        <div className="text-2xl font-semibold text-gray-900 mt-2">
          {session?.game_code ?? "---"}
        </div>
        {joinUrl && (
          <div className="text-sm text-gray-600 mt-3">Join URL: {joinUrl}</div>
        )}

        <div className="mt-5 flex gap-3">
          <Button size="sm" disabled={!joinUrl}
            onClick={() => {
              if (!joinUrl) return;
              navigator.clipboard.writeText(window.location.origin + joinUrl);
            }}
          >
            Copy Join Link
          </Button>
          <Button variant="secondary" size="sm" disabled={!session}
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
        </div>
      </div>
    </Container>
  );
}
