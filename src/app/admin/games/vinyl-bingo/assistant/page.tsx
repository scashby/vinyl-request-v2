"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";

type Session = {
  id: number;
  status: "pending" | "active" | "paused" | "completed";
  current_pick_index: number;
  round_count?: number;
  current_round?: number;
  seconds_to_next_call?: number;
  game_templates: { name: string };
};

type Pick = {
  id: number;
  pick_index: number;
  status: "pending" | "played" | "skipped";
  column_letter?: "B" | "I" | "N" | "G" | "O";
  track_title?: string;
  artist_name?: string;
  album_name?: string | null;
  game_template_items: {
    title: string;
    artist: string;
    album_name?: string | null;
  };
};

const COLS = ["B", "I", "N", "G", "O"] as const;
const DEFAULT_SECONDS_TO_NEXT_CALL = 45;

export default function SidekickPage() {
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
    const i = setInterval(fetchData, 3000);
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
  const callCard = useMemo(() => picks.filter((pick) => pick.status === "played"), [picks]);

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#121212]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href={`/admin/games/vinyl-bingo/host?sessionId=${sessionId}`} className="rounded-lg p-2 hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-semibold">Assistant Card Check</h1>
              <p className="text-sm text-white/60">{session?.game_templates.name}</p>
            </div>
          </div>
          <div className="text-sm text-white/70">
            Round {session?.current_round ?? 1} of {session?.round_count ?? 3}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-white/10 bg-[#1a1a1a] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Round Playlist</h2>
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Clock3 className="h-4 w-4" />
              {session?.status === "paused" ? "Paused" : `Next call in ${countdown}s`}
            </div>
          </div>
          <div className="overflow-auto rounded-xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-white/60">
                <tr>
                  <th className="px-3 py-2">Column</th>
                  <th className="px-3 py-2">Track Name</th>
                  <th className="px-3 py-2">Artist Name</th>
                  <th className="px-3 py-2">Album Name</th>
                </tr>
              </thead>
              <tbody>
                {picks.map((pick) => {
                  const isCurrent = pick.pick_index === currentIdx;
                  return (
                    <tr key={pick.id} className={`border-t border-white/5 ${isCurrent ? "bg-pink-500/10" : ""}`}>
                      <td className="px-3 py-2 font-bold text-pink-300">{pick.column_letter ?? COLS[pick.pick_index % 5]}</td>
                      <td className="px-3 py-2">{pick.track_title ?? pick.game_template_items.title}</td>
                      <td className="px-3 py-2 text-white/80">{pick.artist_name ?? pick.game_template_items.artist}</td>
                      <td className="px-3 py-2 text-white/60">{pick.album_name ?? pick.game_template_items.album_name ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#1a1a1a] p-5">
            <p className="text-xs uppercase tracking-wide text-white/50">Current Call</p>
            {currentPick ? (
              <>
                <p className="mt-2 text-2xl font-bold text-pink-300">
                  {(currentPick.column_letter ?? COLS[currentPick.pick_index % 5])}: {currentPick.track_title ?? currentPick.game_template_items.title}
                </p>
                <p className="mt-1 text-lg text-white/80">{currentPick.artist_name ?? currentPick.game_template_items.artist}</p>
              </>
            ) : (
              <p className="mt-2 text-white/70">Waiting for first call.</p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#1a1a1a] p-5">
            <h3 className="text-lg font-semibold">Call Card</h3>
            <p className="mt-1 text-sm text-white/60">Use this list to verify paper-card claims.</p>
            <ol className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">
              {callCard.length === 0 ? (
                <li className="text-sm text-white/60">No songs called yet.</li>
              ) : (
                callCard.map((pick) => (
                  <li key={pick.id} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
                    <span className="mr-2 font-bold text-pink-300">{pick.column_letter ?? COLS[pick.pick_index % 5]}</span>
                    <span>{pick.track_title ?? pick.game_template_items.title}</span>
                    <span className="text-white/60"> - {pick.artist_name ?? pick.game_template_items.artist}</span>
                  </li>
                ))
              )}
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}
