"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBingoColumnTextClass } from "src/lib/bingoBall";

type Session = {
  session_code: string;
  current_round: number;
  round_count: number;
  seconds_to_next_call: number;
  status: string;
  recent_calls_limit: number;
  show_countdown: boolean;
  next_game_scheduled_at: string | null;
  call_reveal_at: string | null;
  bingo_overlay: string;
};

type Call = {
  id: number;
  call_index: number;
  ball_number: number | null;
  column_letter: string;
  track_title: string;
  artist_name: string;
  status: string;
};

const COLUMN_ROTATION = ["B", "I", "N", "G", "O"];

function asContestantLine(call: Call) {
  return `Column ${call.column_letter} - ${call.track_title} - ${call.artist_name}`;
}

export default function BingoJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const containerRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [columnRotationIndex, setColumnRotationIndex] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/games/bingo/sessions/${sessionId}`),
      fetch(`/api/games/bingo/sessions/${sessionId}/calls`),
    ]);

    if (sRes.ok) {
      const payload = await sRes.json();
      setSession(payload);
      setRemaining(payload.seconds_to_next_call ?? 0);
    }

    if (cRes.ok) {
      const payload = await cRes.json();
      setCalls(payload.data ?? []);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 3000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => {
      setNow(Date.now());
      setRemaining((value) => {
        if (!session || session.status === "paused" || session.status === "completed") return value;
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [session]);

  // Rotate called-history column every 6 seconds so contestants can still catch up.
  useEffect(() => {
    const timer = setInterval(() => {
      setColumnRotationIndex((index) => (index + 1) % COLUMN_ROTATION.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // F key shortcut for fullscreen. Keep control hidden on-screen.
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "f" || event.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  const called = useMemo(
    () =>
      calls
        .filter((call) => ["called", "completed", "skipped"].includes(call.status))
        .sort((a, b) => a.call_index - b.call_index),
    [calls]
  );

  const current = called.at(-1) ?? null;
  const previous = called.at(-2) ?? null;

  const callIsRevealed = useMemo(() => {
    if (!session?.call_reveal_at) return true;
    return now >= new Date(session.call_reveal_at).getTime();
  }, [session?.call_reveal_at, now]);

  const calledByColumn = useMemo(() => {
    const byCol: Record<string, typeof called> = {};
    for (const col of COLUMN_ROTATION) {
      byCol[col] = called.filter((c) => c.column_letter === col);
    }
    return byCol;
  }, [called]);

  const intermissionSecondsLeft = useMemo(() => {
    if (!session?.next_game_scheduled_at) return null;
    const diff = Math.ceil((new Date(session.next_game_scheduled_at).getTime() - now) / 1000);
    return Math.max(0, diff);
  }, [session?.next_game_scheduled_at, now]);

  const showIntermission = session?.status === "paused" && intermissionSecondsLeft !== null && intermissionSecondsLeft > 0;

  const statusLabel = session?.status === "paused" ? "Paused" : null;

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#5a180e,transparent_35%),linear-gradient(180deg,#0a0a0a,#101010)] text-white"
    >
      {/* Hidden fullscreen hotspot in upper-right corner */}
      <button
        onClick={toggleFullscreen}
        className="absolute right-0 top-0 z-20 h-12 w-12 opacity-0"
        aria-label="Toggle fullscreen"
        title="Toggle fullscreen (F)"
      />

      <div className="grid min-h-screen grid-rows-[auto_1fr_auto] gap-[1.2vw] p-[1.6vw]">
        <header className="rounded-3xl border border-amber-700/40 bg-black/35 px-[2.2vw] py-[1vw]">
          <h1 className="text-center text-[4.2vw] font-black uppercase leading-none tracking-[0.12em] text-amber-200">
            Vinyl Music Bingo
          </h1>
        </header>

        <section className="grid min-h-0 grid-cols-[20vw_1fr_26vw] gap-[1vw]">
          <aside className="rounded-3xl border border-stone-700 bg-black/45 p-[1vw]">
            <p className="text-[1vw] font-semibold uppercase tracking-[0.2em] text-stone-400">Last Called</p>
            {previous ? (
              <div className="mt-[0.8vw] space-y-[0.5vw]">
                <p className={`text-[3.2vw] font-black leading-none ${getBingoColumnTextClass(previous.column_letter, previous.ball_number)}`}>
                  {previous.column_letter}
                </p>
                <p className="text-[1.2vw] font-bold text-amber-100">{previous.track_title}</p>
                <p className="text-[1vw] text-stone-300">{previous.artist_name}</p>
              </div>
            ) : (
              <p className="mt-[0.8vw] text-[1vw] text-stone-500">Waiting for first call...</p>
            )}
          </aside>

          <div className="rounded-3xl border border-stone-700 bg-black/45 p-[1.4vw] text-center">
            {showIntermission ? (
              <div className="flex h-full flex-col items-center justify-center gap-[1vw]">
                <p className="text-[2.2vw] font-semibold uppercase tracking-[0.2em] text-amber-300">Intermission</p>
                <p className="text-[10vw] font-black leading-none text-amber-200 tabular-nums">{intermissionSecondsLeft}s</p>
                <p className="text-[1.4vw] text-stone-300">Crate reset in progress. Next round starts shortly.</p>
              </div>
            ) : (
              <>
                <p className={`font-black leading-none ${current && callIsRevealed ? getBingoColumnTextClass(current.column_letter, current.ball_number) : "text-stone-500"}`} style={{ fontSize: "16vw" }}>
                  {current && callIsRevealed ? current.column_letter : current ? current.column_letter : "?"}
                </p>
                <p className="mt-[0.4vw] font-black leading-tight text-amber-100" style={{ fontSize: "4.5vw" }}>
                  {current && callIsRevealed ? current.track_title : "..."}
                </p>
                <p className="mt-[0.2vw] font-semibold text-stone-300" style={{ fontSize: "2.7vw" }}>
                  {current && callIsRevealed ? current.artist_name : ""}
                </p>
              </>
            )}
          </div>

          <aside className="rounded-3xl border border-stone-700 bg-black/45 p-[1vw]">
            <p className="text-[0.95vw] font-semibold uppercase tracking-[0.18em] text-stone-400">
              Already Called
            </p>
            <div className="mt-[0.6vw] max-h-[58vh] space-y-[0.35vw] overflow-y-auto pr-1">
              {called.length === 0 ? (
                <p className="text-[0.9vw] text-stone-500">No called songs yet.</p>
              ) : (
                COLUMN_ROTATION.map((col, colIndex) => (
                  <div key={col}>
                    {calledByColumn[col] && calledByColumn[col].length > 0 && (
                      <>
                        {colIndex > 0 && <div className="my-[0.3vw] border-t border-stone-600/30" />}
                        {calledByColumn[col].map((call) => (
                          <p
                            key={call.id}
                            className={`text-[0.9vw] py-[0.15vw] ${getBingoColumnTextClass(call.column_letter, call.ball_number)}`}
                          >
                            {call.track_title} - {call.artist_name}
                          </p>
                        ))}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        </section>

        <footer className="rounded-3xl border border-stone-700 bg-black/45 px-[2vw] py-[0.8vw]">
          <div className="grid grid-cols-3 items-center">
            <div className="text-left">
              <p className="text-[0.8vw] uppercase tracking-[0.1em] text-stone-400">Time Until Next Call</p>
              {session?.show_countdown ? (
                remaining <= 0 ? (
                  <p className="text-[3.2vw] font-black leading-none text-amber-300">Next Call Upcoming</p>
                ) : (
                  <p className="text-[3.2vw] font-black leading-none text-amber-300 tabular-nums">{remaining}s</p>
                )
              ) : null}
            </div>
            <div className="text-center">
              {statusLabel && <p className="text-[1.6vw] font-semibold uppercase tracking-[0.14em] text-amber-300">{statusLabel}</p>}
            </div>
            <div className="text-right">
              <p className="text-[1.6vw] font-semibold text-stone-300">Round {session?.current_round} of {session?.round_count}</p>
            </div>
          </div>
        </footer>
      </div>

      {session?.bingo_overlay === "pending" ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-black/85 text-center">
          <img
            src="/images/bingo/bingo-pending.svg"
            alt="Bingo pending"
            className="animate-spin"
            style={{ width: "25vw", maxWidth: "320px", animationDuration: "2s" }}
          />
          <p className="text-[5vw] font-black uppercase tracking-[0.2em] text-amber-300">BINGO PENDING</p>
          <p className="text-[2.5vw] text-stone-300">Verifying winner...</p>
        </div>
      ) : null}

      {session?.bingo_overlay === "winner" ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/80 text-center">
          <img
            src="/images/bingo/bingo-winner.svg"
            alt="Bingo winner"
            className="animate-bounce"
            style={{ width: "35vw", maxWidth: "480px" }}
          />
          <p className="text-[8vw] font-black uppercase leading-none text-amber-300" style={{ textShadow: "0 0 40px #f59e0b" }}>
            WE HAVE A WINNER!
          </p>
        </div>
      ) : null}
    </div>
  );
}
