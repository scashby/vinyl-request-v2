"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBingoColumnTextClass } from "src/lib/bingoBall";

type Session = {
  session_code: string;
  current_call_index: number;
  current_round: number;
  round_count: number;
  seconds_to_next_call: number;
  status: string;
  recent_calls_limit: number;
  show_countdown: boolean;
  next_game_scheduled_at: string | null;
  next_game_rules_text: string | null;
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

// Deterministic positions to avoid hydration mismatches with Math.random
const VINYL_DROPS = [
  { left:  3, size: 4.5, delay: 0.0, dur: 6.2 },
  { left:  9, size: 6.5, delay: 1.3, dur: 7.1 },
  { left: 16, size: 5.0, delay: 0.5, dur: 5.8 },
  { left: 22, size: 7.5, delay: 2.1, dur: 8.0 },
  { left: 28, size: 4.0, delay: 0.9, dur: 6.5 },
  { left: 35, size: 6.0, delay: 1.7, dur: 7.4 },
  { left: 41, size: 5.5, delay: 0.3, dur: 6.8 },
  { left: 47, size: 8.0, delay: 2.5, dur: 7.9 },
  { left: 53, size: 4.5, delay: 1.1, dur: 5.5 },
  { left: 59, size: 6.5, delay: 0.6, dur: 6.3 },
  { left: 65, size: 5.0, delay: 1.9, dur: 7.2 },
  { left: 71, size: 7.0, delay: 0.2, dur: 8.1 },
  { left: 77, size: 4.0, delay: 2.8, dur: 5.9 },
  { left: 83, size: 6.0, delay: 1.4, dur: 6.7 },
  { left: 88, size: 5.5, delay: 0.8, dur: 7.5 },
  { left: 93, size: 7.5, delay: 2.2, dur: 6.0 },
  { left: 50, size: 5.0, delay: 3.0, dur: 6.4 },
  { left: 97, size: 4.5, delay: 1.6, dur: 7.8 },
];

function formatMinSec(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function VinylSVG() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" style={{ display: "block", width: "100%", height: "100%" }}>
      {/* Outer disc */}
      <circle cx="50" cy="50" r="49" fill="#0d0d0d" />
      {/* Groove rings */}
      <circle cx="50" cy="50" r="44" fill="none" stroke="#1e1e1e" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="39" fill="none" stroke="#1e1e1e" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="34" fill="none" stroke="#1e1e1e" strokeWidth="1.0" />
      <circle cx="50" cy="50" r="29" fill="none" stroke="#1e1e1e" strokeWidth="0.8" />
      {/* Centre label */}
      <circle cx="50" cy="50" r="22" fill="#92400e" />
      <circle cx="50" cy="50" r="14" fill="#78350f" />
      <text x="50" y="47" textAnchor="middle" fill="#fcd34d" fontSize="5.5" fontWeight="bold" fontFamily="sans-serif">VINYL</text>
      <text x="50" y="55" textAnchor="middle" fill="#fcd34d" fontSize="4.2"               fontFamily="sans-serif">BINGO</text>
      {/* Spindle hole */}
      <circle cx="50" cy="50" r="3.5" fill="#0d0d0d" />
    </svg>
  );
}

function VinylCascade() {
  return (
    <>
      <style>{`
        @keyframes vinyl-fall {
          0%   { transform: translateY(-14vh) rotate(0deg);   opacity: 0; }
          7%   { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translateY(112vh) rotate(540deg); opacity: 0; }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {VINYL_DROPS.map((v, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${v.left}%`,
              top: 0,
              width: `${v.size}vw`,
              height: `${v.size}vw`,
              animation: `vinyl-fall ${v.dur}s ease-in ${v.delay}s infinite`,
            }}
          >
            <VinylSVG />
          </div>
        ))}
      </div>
    </>
  );
}

export default function BingoJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const containerRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/games/bingo/sessions/${sessionId}`, { cache: "no-store" }),
      fetch(`/api/games/bingo/sessions/${sessionId}/calls`, { cache: "no-store" }),
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
        // Only freeze the countdown for the pending overlay
        if (session.bingo_overlay === "pending") return value;
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [session]);

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
  const lastCalled = useMemo(() => called.slice(Math.max(0, called.length - 5)).reverse(), [called]);

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
  const showWelcome = !showIntermission && session?.bingo_overlay === "welcome";
  const showWinner = session?.bingo_overlay === "winner";
  const showThanks = session?.bingo_overlay === "thanks";

  const statusLabel = session?.status === "paused" ? "Paused" : null;

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#5a180e,transparent_35%),linear-gradient(180deg,#0a0a0a,#101010)] text-white"
    >
      {/* Hidden fullscreen hotspot — always present regardless of screen state */}
      <button
        onClick={toggleFullscreen}
        className="absolute right-0 top-0 z-[100] h-12 w-12 opacity-0"
        aria-label="Toggle fullscreen"
        title="Toggle fullscreen (F)"
      />

      {showWinner ? (
        /* ── WINNER SCREEN — full-page replace, NOT an overlay ── */
        <div className="relative flex min-h-screen flex-col items-center justify-center gap-[2.5vw] px-8 text-center">
          <VinylCascade />
          <p
            className="relative z-10 font-black uppercase leading-none tracking-tight text-amber-300"
            style={{ fontSize: "13vw", textShadow: "0 0 60px #f59e0b, 0 0 120px #d97706" }}
          >
            WE HAVE A<br />WINNER!
          </p>
          <p className="relative z-10 text-[2.5vw] font-semibold text-amber-100">
            Round {session!.current_round} of {session!.round_count} &middot; {called.length} songs called
          </p>
        </div>
      ) : showThanks ? (
        /* ── THANKS SCREEN — full-page replace, NOT an overlay ── */
        <div className="relative flex min-h-screen flex-col items-center justify-center gap-[2vw] px-8 text-center">
          <VinylCascade />
          <h2
            className="relative z-10 font-black uppercase leading-none tracking-[0.06em] text-amber-300"
            style={{ fontSize: "8vw" }}
          >
            Thank You For Playing!
          </h2>
          <p className="relative z-10 text-[3.5vw] font-semibold text-amber-100">Vinyl Music Bingo</p>
          {session ? (
            <p className="relative z-10 text-[1.8vw] text-stone-400">
              Round {session.current_round} of {session.round_count} &middot; {called.length} songs called
            </p>
          ) : null}
        </div>
      ) : (
        /* ── NORMAL GAME LAYOUT (welcome + running game) ── */
        <>
          <div className="grid min-h-screen grid-rows-[auto_1fr_auto] gap-[1.2vw] p-[1.6vw]">
            <header className="rounded-3xl border border-amber-700/40 bg-black/35 px-[2.2vw] py-[1vw]">
              <h1 className="text-center text-[4.2vw] font-black uppercase leading-none tracking-[0.12em] text-amber-200">
                Vinyl Music Bingo
              </h1>
            </header>

            <section className="grid min-h-0 grid-cols-[20vw_1fr_26vw] gap-[1vw]">
              <aside className="rounded-3xl border border-stone-700 bg-black/45 p-[1vw]">
                <p className="text-[1vw] font-semibold uppercase tracking-[0.2em] text-stone-400">Last Called</p>
                {lastCalled.length > 0 ? (
                  <div className="mt-[0.8vw] space-y-[0.35vw]">
                    {lastCalled.map((call) => (
                      <div key={call.id} className="rounded-xl border border-stone-700/70 bg-black/25 px-[0.6vw] py-[0.45vw]">
                        <p className={`text-[1.2vw] font-black leading-none ${getBingoColumnTextClass(call.column_letter, call.ball_number)}`}>
                          {call.column_letter}
                        </p>
                        <p className="text-[0.95vw] font-semibold leading-tight text-amber-100">{call.track_title}</p>
                        <p className="text-[0.82vw] text-stone-300">{call.artist_name}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-[0.8vw] text-[1vw] text-stone-500">Waiting for first call...</p>
                )}
              </aside>

              <div className="rounded-3xl border border-stone-700 bg-black/45 p-[1.4vw] text-center">
                {showWelcome ? (
                  <div className="flex h-full flex-col items-center justify-center gap-[1.2vw] px-[1vw]">
                    <h2 className="text-[4vw] font-black uppercase leading-none tracking-[0.12em] text-amber-300">
                      Welcome To Vinyl Music Bingo
                    </h2>
                    <p className="text-[1.5vw] text-stone-200">
                      Listen for each track. If the song is on your card, mark that square. Get five in a row to call BINGO.
                    </p>
                    <div className="mt-[0.5vw] rounded-2xl border border-amber-700/40 bg-amber-950/20 px-[1.4vw] py-[1vw] text-left">
                      <p className="text-[1.4vw] font-semibold uppercase tracking-[0.08em] text-amber-200">How To Play</p>
                      <p className="mt-[0.4vw] text-[1.15vw] text-stone-200">1) Keep your bingo card visible.</p>
                      <p className="text-[1.15vw] text-stone-200">2) Match each called song to your card and mark it.</p>
                      <p className="text-[1.15vw] text-stone-200">3) When you have five in a row, shout BINGO.</p>
                    </div>
                    {session?.next_game_rules_text ? (
                      <p className="text-[1vw] text-stone-400">{session.next_game_rules_text}</p>
                    ) : null}
                  </div>
                ) : showIntermission ? (
                  <div className="flex h-full flex-col items-center justify-center gap-[1vw]">
                    <p className="text-[2.2vw] font-semibold uppercase tracking-[0.2em] text-amber-300">Intermission</p>
                    <p className="text-[1.6vw] text-stone-300">
                      Round {session!.current_round} of {session!.round_count} begins in
                    </p>
                    <p className="text-[10vw] font-black leading-none text-amber-200 tabular-nums">{formatMinSec(intermissionSecondsLeft!)}</p>
                    <p className="text-[1.4vw] text-stone-300">Crate reset in progress. Next round starts shortly.</p>
                  </div>
                ) : (
                  <>
                    <p
                      className={`font-black leading-none ${current && callIsRevealed ? getBingoColumnTextClass(current.column_letter, current.ball_number) : "text-stone-500"}`}
                      style={{ fontSize: "16vw" }}
                    >
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
                            <p className={`text-[0.85vw] font-black uppercase tracking-[0.14em] ${getBingoColumnTextClass(col, null)}`}>Column {col}</p>
                            {calledByColumn[col].map((call) => (
                              <div key={call.id} className="py-[0.2vw] leading-tight">
                                <p className={`text-[0.9vw] font-black ${getBingoColumnTextClass(call.column_letter, call.ball_number)}`}>{call.column_letter}</p>
                                <p className="text-[0.84vw] font-semibold text-amber-100">{call.track_title}</p>
                                <p className="text-[0.78vw] text-stone-300">{call.artist_name}</p>
                              </div>
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

          {/* ── PENDING is the ONLY overlay ── */}
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
        </>
      )}
    </div>
  );
}

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/games/bingo/sessions/${sessionId}`, { cache: "no-store" }),
      fetch(`/api/games/bingo/sessions/${sessionId}/calls`, { cache: "no-store" }),
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
        if (session.bingo_overlay === "pending" || session.bingo_overlay === "winner") return value;
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [session]);

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
  const lastCalled = useMemo(() => called.slice(Math.max(0, called.length - 5)).reverse(), [called]);

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
  const showWelcome = !showIntermission && session?.bingo_overlay === "welcome";
  const showThanks = session?.bingo_overlay === "thanks";

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
            {lastCalled.length > 0 ? (
              <div className="mt-[0.8vw] space-y-[0.35vw]">
                {lastCalled.map((call) => (
                  <div key={call.id} className="rounded-xl border border-stone-700/70 bg-black/25 px-[0.6vw] py-[0.45vw]">
                    <p className={`text-[1.2vw] font-black leading-none ${getBingoColumnTextClass(call.column_letter, call.ball_number)}`}>
                      {call.column_letter}
                    </p>
                    <p className="text-[0.95vw] font-semibold leading-tight text-amber-100">{call.track_title}</p>
                    <p className="text-[0.82vw] text-stone-300">{call.artist_name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-[0.8vw] text-[1vw] text-stone-500">Waiting for first call...</p>
            )}
          </aside>

          <div className="rounded-3xl border border-stone-700 bg-black/45 p-[1.4vw] text-center">
            {showIntermission ? (
              <div className="flex h-full flex-col items-center justify-center gap-[1vw]">
                <p className="text-[2.2vw] font-semibold uppercase tracking-[0.2em] text-amber-300">Intermission</p>
                <p className="text-[1.6vw] text-stone-300">
                  Round {session!.current_round} of {session!.round_count} begins in
                </p>
                <p className="text-[10vw] font-black leading-none text-amber-200 tabular-nums">{formatMinSec(intermissionSecondsLeft!)}</p>
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
                        <p className={`text-[0.85vw] font-black uppercase tracking-[0.14em] ${getBingoColumnTextClass(col, null)}`}>Column {col}</p>
                        {calledByColumn[col].map((call) => (
                          <div key={call.id} className="py-[0.2vw] leading-tight">
                            <p className={`text-[0.9vw] font-black ${getBingoColumnTextClass(call.column_letter, call.ball_number)}`}>{call.column_letter}</p>
                            <p className="text-[0.84vw] font-semibold text-amber-100">{call.track_title}</p>
                            <p className="text-[0.78vw] text-stone-300">{call.artist_name}</p>
                          </div>
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
            src="/images/bingo/bingo-jackpot.svg"
            alt="Bingo jackpot winner"
            className="animate-pulse"
            style={{ width: "35vw", maxWidth: "480px" }}
          />
          <p className="text-[8vw] font-black uppercase leading-none text-amber-300" style={{ textShadow: "0 0 40px #f59e0b" }}>
            WE HAVE A WINNER!
          </p>
        </div>
      ) : null}

      {showWelcome ? (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-[1.2vw] bg-black/88 px-[3vw] text-center">
          <h2 className="text-[6vw] font-black uppercase leading-none tracking-[0.12em] text-amber-300">Welcome To Vinyl Music Bingo</h2>
          <p className="max-w-[70vw] text-[1.9vw] text-stone-200">Listen for each track. If the song is on your card, mark that square. Get five in a row to call BINGO.</p>
          <div className="max-w-[72vw] rounded-2xl border border-amber-700/40 bg-amber-950/20 px-[1.8vw] py-[1.3vw]">
            <p className="text-[1.6vw] font-semibold uppercase tracking-[0.08em] text-amber-200">How To Play</p>
            <p className="mt-[0.6vw] text-[1.25vw] text-stone-200">1) Keep your bingo card visible.</p>
            <p className="text-[1.25vw] text-stone-200">2) Match each called song to your card and mark it.</p>
            <p className="text-[1.25vw] text-stone-200">3) When you have five in a row, shout BINGO.</p>
          </div>
          {session?.next_game_rules_text ? <p className="max-w-[70vw] text-[1.1vw] text-stone-400">{session.next_game_rules_text}</p> : null}
        </div>
      ) : null}

      {showThanks ? (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-[1.5vw] bg-black/90 px-[3vw] text-center">
          <h2 className="text-[7vw] font-black uppercase leading-none tracking-[0.1em] text-amber-300">Thank You For Playing!</h2>
          <p className="text-[3vw] font-semibold text-amber-100">Vinyl Music Bingo</p>
          {session ? (
            <p className="text-[1.6vw] text-stone-400">
              Round {session.current_round} of {session.round_count} · {called.length} songs called
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
