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
  event?: {
    id: number;
    title: string | null;
    venue_logo_url: string | null;
  } | null;
};

type UpcomingEvent = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
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

function BrandingLogos({
  venueLogoUrl,
  venueName,
  tone = "dark",
}: {
  venueLogoUrl?: string | null;
  venueName?: string | null;
  tone?: "dark" | "light";
}) {
  const deadWaxShellClass = tone === "light"
    ? "rounded-2xl border border-amber-400/60 bg-white/70 px-5 py-3 shadow-[0_20px_50px_rgba(245,158,11,0.18)] backdrop-blur-sm"
    : "rounded-2xl border border-amber-700/40 bg-black/35 px-5 py-3";
  const venueShellClass = tone === "light"
    ? "rounded-2xl border border-stone-300 bg-white/65 px-5 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm"
    : "rounded-2xl border border-stone-700 bg-black/35 px-5 py-3";

  return (
    <div className="relative z-10 flex flex-wrap items-center justify-center gap-4">
      <div className={deadWaxShellClass}>
        <img
          src="/images/dwd-logo.PNG"
          alt="Dead Wax Dialogues"
          className="h-[5.8vw] min-h-[52px] max-h-[96px] w-auto object-contain"
        />
      </div>
      {venueLogoUrl ? (
        <div className={venueShellClass}>
          <img
            src={venueLogoUrl}
            alt={venueName ? `${venueName} logo` : "Venue logo"}
            className="h-[5.8vw] min-h-[52px] max-h-[96px] w-auto object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}

export default function BingoJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const containerRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);

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

  // Fetch upcoming events once when the Thanks screen appears.
  useEffect(() => {
    if (session?.bingo_overlay !== "thanks") return;
    const today = new Date().toISOString().split("T")[0]!;
    fetch("/api/games/bingo/events", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { data?: UpcomingEvent[] }) => {
        const upcoming = (data.data ?? [])
          .filter((e) => e.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 4);
        setUpcomingEvents(upcoming);
      })
      .catch(() => undefined);
  }, [session?.bingo_overlay]);

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
  const showGame = !showWelcome && !showWinner && !showThanks && !showIntermission;
  const useLightScreenTheme = showWelcome || showWinner || showThanks || showIntermission;

  const statusLabel = session?.status === "paused" ? "Paused" : null;

  return (
    <div
      ref={containerRef}
      className={`relative min-h-screen w-full overflow-hidden ${
        useLightScreenTheme
          ? "bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.34),transparent_30%),linear-gradient(180deg,#fff8e8,#fde8c6_45%,#f8d7aa)] text-stone-950"
          : "bg-[radial-gradient(circle_at_50%_0%,#5a180e,transparent_35%),linear-gradient(180deg,#0a0a0a,#101010)] text-white"
      }`}
    >
      {/* Hidden fullscreen hotspot — always present regardless of screen state */}
      <button
        onClick={toggleFullscreen}
        className="absolute right-0 top-0 z-[100] h-12 w-12 opacity-0"
        aria-label="Toggle fullscreen"
        title="Toggle fullscreen (F)"
      />

      {showWelcome ? (
        <div className="relative flex min-h-screen flex-col items-center justify-center gap-[2vw] px-8 py-[4vh] text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,0.12),transparent_26%),radial-gradient(circle_at_80%_30%,rgba(120,53,15,0.12),transparent_24%)]" />
          <BrandingLogos
            venueLogoUrl={session?.event?.venue_logo_url}
            venueName={session?.event?.title ?? null}
            tone="light"
          />
          <div className="relative z-10 max-w-[78vw] rounded-[2.5rem] border border-amber-400/60 bg-white/72 px-[4vw] py-[3vw] shadow-[0_30px_80px_rgba(120,53,15,0.16)] backdrop-blur-sm">
            <p className="text-[1.4vw] font-semibold uppercase tracking-[0.34em] text-amber-800">Welcome Screen</p>
            <h2 className="mt-[1vw] text-[5.5vw] font-black uppercase leading-[0.92] tracking-[0.08em] text-amber-600">
              Welcome To Vinyl Music Bingo
            </h2>
            <p className="mx-auto mt-[1.4vw] max-w-[54vw] text-[1.65vw] leading-relaxed text-stone-700">
              Listen for each track. If the song is on your card, mark that square. Get five in a row to call BINGO.
            </p>
            <div className="mx-auto mt-[1.8vw] max-w-[44vw] rounded-[2rem] border border-amber-300/70 bg-amber-50/85 px-[2vw] py-[1.5vw] text-left shadow-[0_18px_40px_rgba(245,158,11,0.12)]">
              <p className="text-[1.45vw] font-semibold uppercase tracking-[0.08em] text-amber-800">How To Play</p>
              <p className="mt-[0.5vw] text-[1.2vw] text-stone-700">1) Keep your bingo card visible.</p>
              <p className="text-[1.2vw] text-stone-700">2) Match each called song to your card and mark it.</p>
              <p className="text-[1.2vw] text-stone-700">3) When you have five in a row, shout BINGO.</p>
            </div>
            {session?.next_game_rules_text ? (
              <p className="mx-auto mt-[1.5vw] max-w-[52vw] text-[1.05vw] text-stone-600">{session.next_game_rules_text}</p>
            ) : null}
          </div>
          <p className="relative z-10 text-[1.5vw] font-semibold text-stone-700">
            Round {session?.current_round ?? 1} of {session?.round_count ?? 1}
          </p>
        </div>
      ) : showWinner ? (
        <div className="relative flex min-h-screen flex-col items-center justify-center gap-[2.5vw] px-8 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(251,191,36,0.24),transparent_28%),radial-gradient(circle_at_14%_72%,rgba(120,53,15,0.12),transparent_26%),radial-gradient(circle_at_84%_24%,rgba(146,64,14,0.14),transparent_22%)]" />
          <VinylCascade />
          <BrandingLogos
            venueLogoUrl={session?.event?.venue_logo_url}
            venueName={session?.event?.title ?? null}
            tone="light"
          />
          <p
            className="relative z-10 font-black uppercase leading-none tracking-tight text-amber-600"
            style={{ fontSize: "13vw", textShadow: "0 10px 35px rgba(245,158,11,0.28)" }}
          >
            WE HAVE A<br />WINNER!
          </p>
          <p className="relative z-10 text-[2.5vw] font-semibold text-stone-700">
            Round {session!.current_round} of {session!.round_count} &middot; {called.length} songs called
          </p>
        </div>
      ) : showIntermission ? (
        <div className="relative flex min-h-screen flex-col items-center justify-center gap-[1.5vw] px-8 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(251,191,36,0.2),transparent_26%),radial-gradient(circle_at_20%_78%,rgba(120,53,15,0.08),transparent_24%)]" />
          <BrandingLogos
            venueLogoUrl={session?.event?.venue_logo_url}
            venueName={session?.event?.title ?? null}
            tone="light"
          />
          <div className="relative z-10 w-full max-w-[74vw] rounded-[2.5rem] border border-amber-300/70 bg-white/76 px-[4vw] py-[3vw] shadow-[0_30px_80px_rgba(120,53,15,0.14)] backdrop-blur-sm">
            <p className="text-[1.5vw] font-semibold uppercase tracking-[0.28em] text-amber-800">Intermission</p>
            <p className="mt-[1vw] text-[2.1vw] text-stone-700">
              Round {session!.current_round} of {session!.round_count} begins in
            </p>
            <p className="mt-[0.8vw] text-[10vw] font-black leading-none text-amber-600 tabular-nums">{formatMinSec(intermissionSecondsLeft!)}</p>
            <p className="mt-[0.8vw] text-[1.45vw] text-stone-600">Crate reset in progress. Next round starts shortly.</p>
          </div>
        </div>
      ) : showThanks ? (
        <div className="relative flex min-h-screen flex-col items-center justify-center gap-[2.2vw] px-[4vw] py-[4vh] text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(251,191,36,0.2),transparent_26%),radial-gradient(circle_at_78%_70%,rgba(120,53,15,0.1),transparent_24%)]" />
          <BrandingLogos
            venueLogoUrl={session?.event?.venue_logo_url}
            venueName={session?.event?.title ?? null}
            tone="light"
          />
          <h2
            className="relative z-10 font-black uppercase leading-none tracking-[0.06em] text-amber-700"
            style={{ fontSize: "7.5vw" }}
          >
            Thank You For Playing!
          </h2>
          <p className="relative z-10 text-[3vw] font-semibold text-stone-700">Vinyl Music Bingo</p>

          {upcomingEvents.length > 0 ? (
            <div className="relative z-10 w-full max-w-[80vw]">
              <p className="mb-[1.4vw] text-[1.6vw] font-semibold uppercase tracking-[0.26em] text-amber-800">
                Find Us Next At
              </p>
              <div className={`grid gap-[1.2vw] ${
                upcomingEvents.length === 1 ? "grid-cols-1" :
                upcomingEvents.length === 2 ? "grid-cols-2" :
                "grid-cols-2 lg:grid-cols-4"
              }`}>
                {upcomingEvents.map((event) => {
                  const [year, month, day] = event.date.split("-");
                  const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
                  const dateLabel = dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
                  const [hourRaw, minuteRaw] = (event.time ?? "").split(":");
                  let timeLabel: string | null = null;
                  if (hourRaw && minuteRaw) {
                    const h = Number(hourRaw);
                    const m = minuteRaw;
                    const ampm = h >= 12 ? "pm" : "am";
                    const hour12 = h % 12 || 12;
                    timeLabel = `${hour12}:${m}${ampm}`;
                  }
                  return (
                    <div
                      key={event.id}
                      className="rounded-[1.5rem] border border-amber-300/70 bg-white/76 px-[1.6vw] py-[1.4vw] shadow-[0_18px_40px_rgba(120,53,15,0.1)] text-left"
                    >
                      <p className="text-[1.1vw] font-semibold uppercase tracking-[0.16em] text-amber-700">{dateLabel}</p>
                      {timeLabel ? <p className="mt-[0.2vw] text-[1vw] text-stone-500">{timeLabel}</p> : null}
                      <p className="mt-[0.5vw] text-[1.4vw] font-black leading-snug text-stone-900">{event.title}</p>
                      {event.location ? (
                        <p className="mt-[0.3vw] text-[1vw] text-stone-600">{event.location}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
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
                {showGame ? (
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
                ) : null}
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
