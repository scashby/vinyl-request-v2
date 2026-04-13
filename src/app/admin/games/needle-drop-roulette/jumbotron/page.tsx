"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  id: number;
  title: string;
  session_code: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  show_title: boolean;
  show_logo: boolean;
  show_round: boolean;
  show_scoreboard: boolean;
  status: "pending" | "running" | "paused" | "completed";
  welcome_heading_text: string | null;
  welcome_message_text: string | null;
  intermission_heading_text: string | null;
  intermission_message_text: string | null;
  thanks_heading_text: string | null;
  thanks_subheading_text: string | null;
  host_overlay?: "none" | "welcome" | "countdown" | "intermission" | "thanks";
  host_overlay_remaining_seconds?: number;
  event?: {
    venue_logo_url: string | null;
  } | null;
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  artist: string;
  title: string;
  source_label: string | null;
  status: "pending" | "asked" | "locked" | "answer_revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
};

export default function NeedleDropRouletteJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const containerRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [overlayRemaining, setOverlayRemaining] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/needle-drop-roulette/sessions/${sessionId}`),
      fetch(`/api/games/needle-drop-roulette/sessions/${sessionId}/calls`),
      fetch(`/api/games/needle-drop-roulette/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) {
      const payload = await sessionRes.json();
      setSession(payload);
      setOverlayRemaining(payload.host_overlay_remaining_seconds ?? 0);
    }
    if (callsRes.ok) {
      const payload = await callsRes.json();
      setCalls(payload.data ?? []);
    }
    if (leaderboardRes.ok) {
      const payload = await leaderboardRes.json();
      setLeaderboard(payload.data ?? []);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 2000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (!session) return;
      if (session.host_overlay !== "countdown" && session.host_overlay !== "intermission") return;
      setOverlayRemaining((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearInterval(tick);
  }, [session]);

  const currentCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const revealAnswer = currentCall?.status === "answer_revealed" || currentCall?.status === "scored";
  const topFive = leaderboard.slice(0, 5);

  const overlayMode = session?.host_overlay ?? "none";
  const showThanks = session?.status === "completed" || overlayMode === "thanks";
  const showOverlay =
    overlayMode === "welcome" ||
    (overlayMode === "countdown" && overlayRemaining > 0) ||
    (overlayMode === "intermission" && overlayRemaining > 0);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "f" || event.key === "F") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  return (
    <div ref={containerRef} className="min-h-screen bg-[radial-gradient(circle_at_45%_0%,#6b2f00,transparent_40%),linear-gradient(180deg,#020202,#0a0a0a)] p-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6 rounded-3xl border border-orange-700/40 bg-black/40 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {session?.show_logo && session?.event?.venue_logo_url ? (
              <img
                alt="Venue logo"
                className="mb-3 h-16 w-auto rounded border border-orange-700/40 bg-black/50 p-2"
                src={session.event.venue_logo_url}
              />
            ) : null}
            {session?.show_title ? <h1 className="text-5xl font-black uppercase tracking-tight text-orange-200">{session?.title ?? "Needle Drop Roulette"}</h1> : null}
            {session?.show_round ? (
              <p className="mt-2 text-xl text-stone-100">Round {session?.current_round ?? 0} of {session?.round_count ?? 0}</p>
            ) : null}
          </div>
          <p className="rounded border border-stone-700 px-3 py-1 text-xs uppercase tracking-[0.15em] text-stone-300">{session?.status ?? "pending"}</p>
        </div>

        {!showOverlay && !showThanks ? (
        <section className="rounded-2xl border border-stone-700 bg-stone-950/55 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-orange-300">Current Drop</p>
          <p className="mt-2 text-3xl font-black">
            {revealAnswer && currentCall ? `${currentCall.artist} - ${currentCall.title}` : "Guess Artist + Song"}
          </p>
          <p className="mt-3 text-sm text-stone-300">
            Drop #{currentCall?.call_index ?? 0} · Source: {currentCall?.source_label ?? "-"} · Status: {currentCall?.status ?? "waiting"}
          </p>
        </section>
        ) : null}

        {showOverlay ? (
          <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-8 text-center">
            <div className="max-w-4xl rounded-3xl border border-orange-700/40 bg-black/70 p-8">
              {overlayMode === "welcome" ? (
                <>
                  <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Welcome</p>
                  <p className="mt-2 text-6xl font-black text-orange-200">{session?.welcome_heading_text || "Welcome to Needle Drop Roulette"}</p>
                  <p className="mt-4 text-2xl text-stone-200">{session?.welcome_message_text || "Get your team ready for the next drop."}</p>
                </>
              ) : null}

              {overlayMode === "countdown" ? (
                <>
                  <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Starting Soon</p>
                  <p className="mt-2 text-7xl font-black text-orange-200">{overlayRemaining}s</p>
                  <p className="mt-4 text-2xl text-stone-200">Game starts in</p>
                </>
              ) : null}

              {overlayMode === "intermission" ? (
                <>
                  <p className="text-sm uppercase tracking-[0.2em] text-stone-300">{session?.intermission_heading_text || "Intermission"}</p>
                  <p className="mt-2 text-7xl font-black text-amber-300">{overlayRemaining}s</p>
                  <p className="mt-4 text-2xl text-stone-200">{session?.intermission_message_text || "Quick reset. Next drop starts soon."}</p>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        {session?.show_scoreboard ? (
          <section className="rounded-2xl border border-stone-700 bg-stone-950/55 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-300">Top Teams</p>
            {topFive.length === 0 ? (
              <p className="mt-2 text-sm text-stone-400">No scores yet.</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {topFive.map((row, idx) => (
                  <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-800 bg-black/30 px-3 py-2 text-lg">
                    <p>{idx + 1}. {row.team_name}</p>
                    <p className="font-black text-orange-200">{row.total_points}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <div className="flex flex-wrap gap-2 text-xs">
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/needle-drop-roulette">Setup</Link>
          <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/needle-drop-roulette/host?sessionId=${sessionId}`}>Host</Link>
          <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/needle-drop-roulette/history">History</Link>
        </div>

        {showThanks ? (
          <section className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_50%_0%,#1f2937,transparent_45%),linear-gradient(180deg,#020202,#0b0b0b)] p-8 text-center">
            <div className="max-w-4xl rounded-3xl border border-orange-700/40 bg-black/70 p-10">
              <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Thanks For Playing</p>
              <p className="mt-3 text-6xl font-black text-orange-200">{session?.thanks_heading_text || "Needle Drop Roulette"}</p>
              <p className="mt-4 text-2xl text-stone-200">Session {session?.session_code ?? "-"} is complete</p>
              <p className="mt-6 text-xl text-stone-300">{session?.thanks_subheading_text || "See you at the next round"}</p>
            </div>
          </section>
        ) : null}

        <button
          type="button"
          onClick={toggleFullscreen}
          className="fixed bottom-3 right-3 z-50 rounded border border-stone-600/70 bg-black/55 px-3 py-1 text-xs text-stone-200"
          aria-label="Toggle fullscreen"
        >
          Fullscreen (F)
        </button>
      </div>
    </div>
  );
}
