"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  title: string;
  session_code: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  status: "pending" | "running" | "paused" | "completed";
  show_logo: boolean;
  show_title: boolean;
  show_round: boolean;
  show_scoreboard: boolean;
  show_connection_prompt: boolean;
  connection_points: number;
  detail_bonus_points: number;
  target_gap_seconds: number;
  welcome_heading_text: string | null;
  welcome_message_text: string | null;
  intermission_heading_text: string | null;
  intermission_message_text: string | null;
  thanks_heading_text: string | null;
  thanks_subheading_text: string | null;
  host_overlay: string;
  host_overlay_remaining_seconds: number;
  event: { venue_logo_url: string | null } | null;
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  accepted_connection: string;
  accepted_detail: string | null;
  status: "pending" | "played_track_a" | "played_track_b" | "discussion" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
};

export default function BackToBackConnectionJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const containerRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [overlayRemaining, setOverlayRemaining] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/back-to-back-connection/sessions/${sessionId}`),
      fetch(`/api/games/back-to-back-connection/sessions/${sessionId}/calls`),
      fetch(`/api/games/back-to-back-connection/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) {
      const payload = await sessionRes.json();
      setSession(payload);
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
    const poll = setInterval(load, 3000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const remaining = session?.host_overlay_remaining_seconds ?? 0;
    setOverlayRemaining(remaining);
    if (remaining <= 0) return;
    const tick = setInterval(() => setOverlayRemaining((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(tick);
  }, [session?.host_overlay, session?.host_overlay_remaining_seconds]);

  const currentCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const promptText = useMemo(() => {
    if (!currentCall) return "Waiting for host to start the next pair";
    if (currentCall.status === "played_track_a") return "Track A played. Track B is coming next.";
    if (currentCall.status === "played_track_b") return "Talk with your table. Find the connection.";
    if (currentCall.status === "discussion") return "Lock your connection and detail now.";
    if (currentCall.status === "revealed" || currentCall.status === "scored") {
      return currentCall.accepted_detail
        ? `${currentCall.accepted_connection} · ${currentCall.accepted_detail}`
        : currentCall.accepted_connection;
    }
    if (currentCall.status === "skipped") return "Pair skipped by host.";
    return "Get ready for the next pair.";
  }, [currentCall]);

  const showThanksOverlay = session?.status === "completed" || session?.host_overlay === "thanks";
  const showOverlay = showThanksOverlay || (!!session?.host_overlay && session.host_overlay !== "none");
  const logoUrl = session?.show_logo ? (session?.event?.venue_logo_url ?? null) : null;

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
    <div ref={containerRef} className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#5f3a11,transparent_38%),linear-gradient(180deg,#020202,#0d0d0d)] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        {!showOverlay ? (
          <>
            <header className="rounded-3xl border border-amber-700/40 bg-black/35 p-6">
              {logoUrl ? (
                <img src={logoUrl} alt="Venue logo" className="mb-4 h-16 w-auto object-contain" />
              ) : null}
              {session?.show_title ? <h1 className="text-5xl font-black uppercase tracking-tight text-amber-200">{session?.title ?? "Back-to-Back Connection"}</h1> : null}

              <div className="mt-4 flex flex-wrap gap-6 text-xl font-semibold">
                {session?.show_round ? <p>Round {session?.current_round} of {session?.round_count}</p> : null}
                <p>Pair {session?.current_call_index ?? 0} / {session?.round_count ?? 0}</p>
                <p>Gap Budget: <span className="font-black text-amber-300">{session?.target_gap_seconds ?? 0}s</span></p>
                {session?.status === "paused" ? <p className="text-red-400">Paused</p> : null}
              </div>
            </header>

            <section className="rounded-3xl border border-stone-700 bg-black/45 p-8">
              {session?.show_connection_prompt ? (
                <>
                  <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Connection Prompt</p>
                  <p className="mt-2 text-5xl font-black text-amber-200">{promptText}</p>
                </>
              ) : (
                <p className="text-4xl font-black text-amber-200">Connection prompt hidden by host</p>
              )}

              {(currentCall?.status === "revealed" || currentCall?.status === "scored") ? (
                <p className="mt-4 text-2xl font-semibold text-emerald-300">Answer revealed</p>
              ) : (
                <p className="mt-4 text-2xl font-semibold text-stone-300">Answer remains hidden</p>
              )}

              <p className="mt-6 text-xl text-stone-200">
                Scoring: {session?.connection_points ?? 2} for connection + {session?.detail_bonus_points ?? 1} for detail
              </p>
            </section>

            {session?.show_scoreboard ? (
              <section className="rounded-3xl border border-stone-700 bg-black/45 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Leaderboard</p>
                <div className="mt-3 grid gap-2 text-2xl font-semibold">
                  {leaderboard.slice(0, 6).map((row, index) => (
                    <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-700 bg-stone-950/70 px-3 py-2">
                      <span>{index + 1}. {row.team_name}</span>
                      <span className="text-amber-300">{row.total_points} pts</span>
                    </div>
                  ))}
                  {leaderboard.length === 0 ? <p className="text-stone-400">No scores yet</p> : null}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {/* Welcome overlay */}
        {!showThanksOverlay && session?.host_overlay === "welcome" ? (
          <section className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_50%_0%,#5f3a11,transparent_45%),linear-gradient(180deg,#020202,#0b0b0b)] p-8 text-center">
            <div className="max-w-4xl rounded-3xl border border-amber-700/40 bg-black/70 p-10">
              {logoUrl ? <img src={logoUrl} alt="Venue logo" className="mx-auto mb-6 h-20 w-auto object-contain" /> : null}
              <p className="text-6xl font-black text-amber-200">{session.welcome_heading_text ?? "Welcome to Back-to-Back Connection"}</p>
              <p className="mt-4 text-2xl text-stone-200">{session.welcome_message_text ?? "Identify the hidden musical connection between two back-to-back tracks."}</p>
            </div>
          </section>
        ) : null}

        {/* Countdown overlay */}
        {!showThanksOverlay && session?.host_overlay === "countdown" ? (
          <section className="fixed inset-0 z-40 flex items-center justify-center bg-[linear-gradient(180deg,#020202,#0b0b0b)] p-8 text-center">
            <div className="max-w-xl rounded-3xl border border-amber-700/40 bg-black/70 p-10">
              <p className="text-3xl font-bold uppercase text-stone-300">Starting in…</p>
              <p className="mt-4 text-9xl font-black text-amber-300">{overlayRemaining > 0 ? overlayRemaining : ""}</p>
            </div>
          </section>
        ) : null}

        {/* Intermission overlay */}
        {!showThanksOverlay && session?.host_overlay === "intermission" ? (
          <section className="fixed inset-0 z-40 flex items-center justify-center bg-[linear-gradient(180deg,#020202,#0b0b0b)] p-8 text-center">
            <div className="max-w-4xl rounded-3xl border border-amber-700/40 bg-black/70 p-10">
              {logoUrl ? <img src={logoUrl} alt="Venue logo" className="mx-auto mb-6 h-20 w-auto object-contain" /> : null}
              <p className="text-6xl font-black text-amber-200">{session.intermission_heading_text ?? "Intermission"}</p>
              <p className="mt-4 text-2xl text-stone-200">{session.intermission_message_text ?? "Short break before the next round."}</p>
              {overlayRemaining > 0 ? (
                <p className="mt-6 text-4xl font-bold text-amber-300">{overlayRemaining}s</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Thanks overlay */}
        {showThanksOverlay ? (
          <section className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_50%_0%,#1f2937,transparent_45%),linear-gradient(180deg,#020202,#0b0b0b)] p-8 text-center">
            <div className="max-w-4xl rounded-3xl border border-amber-700/40 bg-black/70 p-10">
              {logoUrl ? <img src={logoUrl} alt="Venue logo" className="mx-auto mb-6 h-20 w-auto object-contain" /> : null}
              <p className="text-6xl font-black text-amber-200">{session?.thanks_heading_text ?? "Thanks for Playing"}</p>
              <p className="mt-4 text-2xl text-stone-200">{session?.thanks_subheading_text ?? "See you at the next round."}</p>
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

