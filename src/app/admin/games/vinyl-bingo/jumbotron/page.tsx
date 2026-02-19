"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Maximize } from "lucide-react";

type Session = {
  id: number;
  game_code: string;
  status: "pending" | "active" | "paused" | "completed";
  current_pick_index: number;
  round_count?: number;
  current_round?: number;
  seconds_to_next_call?: number;
  jumbotron_settings?: {
    recent_calls_limit?: number;
    show_title?: boolean;
    show_logo?: boolean;
    show_rounds?: boolean;
    show_countdown?: boolean;
  };
  game_templates: { name: string };
};

type Pick = {
  id: number;
  pick_index: number;
  status: "pending" | "played" | "skipped";
  column_letter?: "B" | "I" | "N" | "G" | "O";
  track_title?: string;
  artist_name?: string;
  game_template_items: { title: string; artist: string };
};

const COLS = ["B", "I", "N", "G", "O"] as const;
const DEFAULT_SECONDS_TO_NEXT_CALL = 45;
const RECENT_CALLS_LIMIT = 5;

export default function JumbotronPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<Session | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [countdown, setCountdown] = useState(DEFAULT_SECONDS_TO_NEXT_CALL);

  const fetchData = useCallback(async () => {
    if (!sessionId) return;

    const [sRes, pRes] = await Promise.all([
      fetch(`/api/game-sessions/${sessionId}`),
      fetch(`/api/game-sessions/${sessionId}/picks`),
    ]);

    if (sRes.ok) {
      const raw = await sRes.json();
      const nextSession = (raw.data ?? raw) as Session;
      setSession((prev) => {
        const shouldResetCountdown =
          !prev ||
          prev.current_pick_index !== nextSession.current_pick_index ||
          prev.status !== nextSession.status;
        if (shouldResetCountdown) {
          setCountdown(nextSession.seconds_to_next_call ?? DEFAULT_SECONDS_TO_NEXT_CALL);
        }
        return nextSession;
      });
    }

    if (pRes.ok) {
      const d = await pRes.json();
      setPicks((d.data ?? d).sort((a: Pick, b: Pick) => a.pick_index - b.pick_index));
    }
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const i = setInterval(fetchData, 2000);
    return () => clearInterval(i);
  }, [fetchData]);

  useEffect(() => {
    if (!session || session.status !== "active") return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [session?.status, session?.current_pick_index]);

  const currentIdx = session?.current_pick_index ?? 0;
  const currentPick = picks.find((p) => p.pick_index === currentIdx) ?? null;
  const currentLetter = currentPick?.column_letter ?? COLS[currentIdx % 5];

  const recentPlayed = useMemo(
    () =>
      picks
        .filter((p) => p.status === "played")
        .slice(-(session?.jumbotron_settings?.recent_calls_limit ?? RECENT_CALLS_LIMIT))
        .reverse(),
    [picks, session?.jumbotron_settings?.recent_calls_limit]
  );

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0d0a14] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(236,72,153,0.25),transparent_35%),radial-gradient(circle_at_90%_85%,rgba(59,130,246,0.25),transparent_35%),linear-gradient(180deg,#100b1a,#0a0810)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/30" />

      <div className="relative z-10 flex h-full flex-col p-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {(session?.jumbotron_settings?.show_logo ?? true) && (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-red-600 text-2xl font-black">★</div>
            )}
            {(session?.jumbotron_settings?.show_title ?? true) && (
              <div>
                <div className="text-2xl font-extrabold uppercase tracking-wide">Rockstar Bingo</div>
                <div className="text-sm text-white/70">{session?.game_templates.name ?? "Vinyl Session"}</div>
              </div>
            )}
          </div>
          <button onClick={toggleFullscreen} className="rounded-lg bg-black/40 p-2 text-white/80 hover:text-white">
            <Maximize className="h-5 w-5" />
          </button>
        </header>

        <div className="mt-4 flex items-center justify-between text-lg text-white/80">
          <div>
            {(session?.jumbotron_settings?.show_rounds ?? true)
              ? `Round ${session?.current_round ?? 1} of ${session?.round_count ?? 3}`
              : ""}
          </div>
          <div className="font-semibold">
            {(session?.jumbotron_settings?.show_countdown ?? true)
              ? session?.status === "paused"
                ? "Paused"
                : `Time Until Next Call: ${countdown}s`
              : ""}
          </div>
        </div>

        <main className="flex flex-1 items-center justify-center">
          {session?.status === "paused" ? (
            <div className="rounded-2xl border border-yellow-400/40 bg-yellow-500/10 px-10 py-8 text-center">
              <p className="text-6xl font-black uppercase tracking-wide text-yellow-300">Paused</p>
            </div>
          ) : currentPick ? (
            <div className="text-center">
              <div className="mx-auto mb-6 inline-flex items-center justify-center rounded-2xl bg-pink-500 px-8 py-4 text-7xl font-black">{currentLetter}</div>
              <h1 className="text-6xl font-black leading-tight">{currentPick.track_title ?? currentPick.game_template_items.title}</h1>
              <p className="mt-3 text-3xl text-white/75">{currentPick.artist_name ?? currentPick.game_template_items.artist}</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-5xl font-bold">Waiting for first call</p>
              <p className="mt-4 text-2xl text-white/70">Game Code: {session?.game_code ?? "----"}</p>
            </div>
          )}
        </main>

        <footer className="grid grid-cols-[1fr_auto] items-end gap-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Recently Called</p>
            <div className="space-y-1">
              {recentPlayed.length === 0 ? (
                <div className="text-sm text-white/40">No calls yet</div>
              ) : (
                recentPlayed.map((pick) => (
                  <div key={pick.id} className="flex items-center gap-2 text-sm text-white/85">
                    <span className="inline-flex w-6 justify-center rounded bg-white/15 font-bold">
                      {pick.column_letter ?? COLS[pick.pick_index % 5]}
                    </span>
                    <span>{pick.track_title ?? pick.game_template_items.title}</span>
                    <span className="text-white/60">- {pick.artist_name ?? pick.game_template_items.artist}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-white/50">Game Code</p>
            <p className="text-5xl font-black tracking-[0.2em] text-pink-400">{session?.game_code ?? "----"}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
