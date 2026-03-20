"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBingoColumnTextClass } from "src/lib/bingoBall";

const DEFAULT_RULES =
  "See a staff member for a bingo card.\n\nNext game: any five in a row — horizontal, vertical, or diagonal — wins!\n\nGood luck! 🎵";

type Session = {
  session_code: string;
  current_round: number;
  round_count: number;
  seconds_to_next_call: number;
  status: string;
  recent_calls_limit: number;
  show_rounds: boolean;
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

export default function BingoJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const containerRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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
        if (!session || session.status === "paused") return value;
        return Math.max(0, value - 1);
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [session]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // F key shortcut for fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") toggleFullscreen();
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
  const recentLimit = session?.recent_calls_limit ?? 5;
  const recent = called.slice(Math.max(0, called.length - recentLimit));

  // Reveal delay — is the current call still masked?
  const callIsRevealed = useMemo(() => {
    if (!session?.call_reveal_at) return true;
    return now >= new Date(session.call_reveal_at).getTime();
  }, [session?.call_reveal_at, now]);

  // Pre-game countdown to next scheduled session
  const preGameSecondsLeft = useMemo(() => {
    if (!session?.next_game_scheduled_at) return null;
    const diff = Math.ceil((new Date(session.next_game_scheduled_at).getTime() - now) / 1000);
    return Math.max(0, diff);
  }, [session?.next_game_scheduled_at, now]);

  const showPreGame = session?.status === "pending" && preGameSecondsLeft !== null;

  const formatPreGameTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const rulesText = session?.next_game_rules_text || DEFAULT_RULES;

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen w-full bg-[radial-gradient(circle_at_50%_0%,#5a180e,transparent_35%),linear-gradient(180deg,#0a0a0a,#101010)] text-white overflow-hidden"
    >
      {/* Fullscreen toggle button — top-right */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-20 rounded border border-stone-600 bg-black/60 px-3 py-1 text-xs text-stone-400 hover:border-amber-400 hover:text-amber-300"
        title="Toggle fullscreen (F)"
      >
        {isFullscreen ? "Exit Full Screen" : "⛶ Full Screen"}
      </button>

      {/* ─── PRE-GAME COUNTDOWN SCREEN ─── */}
      {showPreGame ? (
        <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
          <h1 className="text-[10vw] font-black uppercase tracking-[0.3em] text-amber-300">BINGO</h1>
          <div className="rounded-3xl border border-amber-700/50 bg-black/50 px-12 py-8">
            <p className="text-[3vw] font-semibold uppercase tracking-[0.2em] text-stone-300">Next Game Starts In</p>
            <p className="mt-2 font-black leading-none text-amber-300" style={{ fontSize: "15vw" }}>
              {formatPreGameTime(preGameSecondsLeft!)}
            </p>
          </div>
          <div className="mt-4 max-w-3xl rounded-2xl border border-stone-700 bg-black/40 p-8">
            <p className="whitespace-pre-line text-[2.2vw] leading-relaxed text-stone-200">{rulesText}</p>
          </div>
        </div>
      ) : (
        /* ─── MAIN GAME SCREEN ─── */
        <div className="flex min-h-screen flex-col gap-[2vw] p-[2vw]">
          {/* Header — BINGO title + timer + status */}
          <header className="rounded-3xl border border-amber-700/40 bg-black/35 px-[3vw] py-[1.5vw]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-[7vw] font-black uppercase leading-none tracking-[0.3em] text-amber-200">BINGO</h1>
              <div className="flex flex-wrap items-center gap-6 text-right">
                {session?.show_rounds ? (
                  <p className="text-[2.5vw] font-semibold text-stone-300">
                    Round {session?.current_round} of {session?.round_count}
                  </p>
                ) : null}
                {session?.show_countdown ? (
                  <p className="font-black leading-none text-amber-300" style={{ fontSize: "7vw" }}>
                    {remaining}s
                  </p>
                ) : null}
                {session?.status === "paused" ? (
                  <p className="font-black text-red-400" style={{ fontSize: "3vw" }}>PAUSED</p>
                ) : null}
              </div>
            </div>
          </header>

          {/* Current call */}
          <section className="flex-1 rounded-3xl border border-stone-700 bg-black/45 p-[3vw] text-center">
            <p className="uppercase tracking-[0.3em] text-stone-400" style={{ fontSize: "1.5vw" }}>Current Column</p>
            <p
              className={`mt-[1vw] leading-none font-black ${
                current && callIsRevealed
                  ? getBingoColumnTextClass(current.column_letter, current.ball_number)
                  : "text-stone-500"
              }`}
              style={{ fontSize: "18vw" }}
            >
              {current && callIsRevealed ? current.column_letter : "?"}
            </p>
            <p
              className="mt-[1vw] font-black leading-tight text-amber-100"
              style={{ fontSize: "6vw" }}
            >
              {current && callIsRevealed ? current.track_title : "…"}
            </p>
            <p
              className="mt-[0.5vw] font-semibold text-stone-300"
              style={{ fontSize: "3.5vw" }}
            >
              {current && callIsRevealed ? current.artist_name : ""}
            </p>
          </section>

          {/* Recently called */}
          <section className="rounded-3xl border border-stone-700 bg-black/45 p-[2vw]">
            <p className="uppercase tracking-[0.2em] text-stone-400" style={{ fontSize: "1.2vw" }}>Recently Called</p>
            <div className="mt-[1vw] grid gap-[0.5vw]" style={{ fontSize: "2.2vw" }}>
              {recent.slice(0, -1).map((call) => (
                <div key={call.id} className="font-semibold text-stone-300">
                  <span className={getBingoColumnTextClass(call.column_letter, call.ball_number)}>
                    {call.column_letter}
                  </span>{" "}
                  · {call.track_title} · {call.artist_name}
                </div>
              ))}
              {recent.length === 0 ? (
                <p className="text-stone-500">Waiting for first call…</p>
              ) : null}
            </div>
          </section>
        </div>
      )}

      {/* ─── BINGO PENDING OVERLAY ─── */}
      {session?.bingo_overlay === "pending" ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-black/85 text-center">
          <img
            src="/images/bingo/bingo-pending.svg"
            alt="Bingo pending"
            className="animate-spin"
            style={{ width: "25vw", maxWidth: "320px", animationDuration: "2s" }}
          />
          <p className="font-black uppercase tracking-[0.2em] text-amber-300" style={{ fontSize: "5vw" }}>
            BINGO PENDING
          </p>
          <p className="text-stone-300" style={{ fontSize: "2.5vw" }}>Verifying winner…</p>
        </div>
      ) : null}

      {/* ─── BINGO WINNER OVERLAY ─── */}
      {session?.bingo_overlay === "winner" ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/80 text-center">
          <img
            src="/images/bingo/bingo-winner.svg"
            alt="Bingo winner"
            className="animate-bounce"
            style={{ width: "35vw", maxWidth: "480px" }}
          />
          <p
            className="font-black uppercase leading-none text-amber-300"
            style={{ fontSize: "8vw", textShadow: "0 0 40px #f59e0b" }}
          >
            WE HAVE A WINNER!
          </p>
        </div>
      ) : null}
    </div>
  );
}
