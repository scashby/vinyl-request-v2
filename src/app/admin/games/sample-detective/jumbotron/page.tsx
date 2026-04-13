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
  show_title: boolean;
  show_logo: boolean;
  show_round: boolean;
  show_scoreboard: boolean;
  show_scoring_hint: boolean;
  points_correct_pair: number;
  bonus_both_artists_points: number;
  target_gap_seconds: number;
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
  call_index: number;
  round_number: number;
  sampled_artist: string;
  sampled_title: string;
  source_artist: string;
  source_title: string;
  source_label: string | null;
  sample_timestamp: string | null;
  status: "pending" | "asked" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
};

export default function SampleDetectiveJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const containerRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [overlayRemaining, setOverlayRemaining] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/sample-detective/sessions/${sessionId}`),
      fetch(`/api/games/sample-detective/sessions/${sessionId}/calls`),
      fetch(`/api/games/sample-detective/sessions/${sessionId}/leaderboard`),
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
    const poll = setInterval(load, 3000);
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

  const revealVisible = currentCall?.status === "revealed" || currentCall?.status === "scored";

  const showThanks = session?.status === "completed";
  const overlayMode = session?.host_overlay ?? "none";
  const showOverlay =
    overlayMode === "welcome" ||
    (overlayMode === "countdown" && overlayRemaining > 0) ||
    (overlayMode === "intermission" && overlayRemaining > 0);
  const showThanksOverlay = showThanks || overlayMode === "thanks";

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
    <div ref={containerRef} className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#123f29,transparent_40%),linear-gradient(180deg,#050505,#0d0d0d)] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-green-700/40 bg-black/35 p-6">
          {session?.show_logo && session?.event?.venue_logo_url ? (
            <img
              alt="Venue logo"
              className="mb-3 h-16 w-auto rounded border border-green-700/40 bg-black/50 p-2"
              src={session.event.venue_logo_url}
            />
          ) : null}
          {session?.show_title ? <h1 className="text-5xl font-black uppercase tracking-tight text-green-200">{session?.title ?? "Sample Detective"}</h1> : null}

          <div className="mt-4 flex flex-wrap gap-6 text-xl font-semibold">
            {session?.show_round ? <p>Round {session?.current_round} of {session?.round_count}</p> : null}
            <p>Call {session?.current_call_index ?? 0}</p>
            <p>Reset Target: <span className="font-black text-green-300">{session?.target_gap_seconds ?? 0}s</span></p>
            {session?.status === "paused" ? <p className="text-red-400">Paused</p> : null}
            {session?.status === "completed" ? <p className="text-amber-300">Completed</p> : null}
          </div>
        </header>

        {!showOverlay && !showThanksOverlay ? (
        <section className="rounded-3xl border border-stone-700 bg-black/45 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Current Prompt</p>
          <p className="mt-2 text-5xl font-black text-green-200">
            {currentCall ? `${currentCall.sampled_artist} - ${currentCall.sampled_title}` : "Waiting for host"}
          </p>
          <p className="mt-3 text-xl text-stone-200">
            {currentCall?.source_label ?? "Sample/source reveal format"}
            {currentCall?.sample_timestamp ? ` · Sample ts ${currentCall.sample_timestamp}` : ""}
          </p>

          {revealVisible ? (
            <p className="mt-4 text-3xl font-bold text-amber-300">Source: {currentCall?.source_artist} - {currentCall?.source_title}</p>
          ) : (
            <p className="mt-4 text-2xl font-semibold text-stone-300">Write your source match now</p>
          )}

          {session?.show_scoring_hint ? (
            <p className="mt-5 text-lg text-stone-200">
              Scoring: <span className="font-black text-green-300">{session.points_correct_pair}</span> for correct pair +
              <span className="font-black text-green-300"> {session.bonus_both_artists_points}</span> for naming both artists
            </p>
          ) : null}
        </section>
        ) : null}

        {showOverlay ? (
          <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-8 text-center">
            <div className="max-w-4xl rounded-3xl border border-green-700/40 bg-black/70 p-8">
              {overlayMode === "welcome" ? (
                <>
                  <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Welcome</p>
                  <p className="mt-2 text-6xl font-black text-green-200">{session?.welcome_heading_text || "Welcome to Sample Detective"}</p>
                  <p className="mt-4 text-2xl text-stone-200">{session?.welcome_message_text || "Match each sampled track to its original source."}</p>
                </>
              ) : null}

              {overlayMode === "countdown" ? (
                <>
                  <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Starting Soon</p>
                  <p className="mt-2 text-7xl font-black text-green-200">{overlayRemaining}s</p>
                  <p className="mt-4 text-2xl text-stone-200">Game starts in</p>
                </>
              ) : null}

              {overlayMode === "intermission" ? (
                <>
                  <p className="text-sm uppercase tracking-[0.2em] text-stone-300">{session?.intermission_heading_text || "Intermission"}</p>
                  <p className="mt-2 text-7xl font-black text-emerald-300">{overlayRemaining}s</p>
                  <p className="mt-4 text-2xl text-stone-200">{session?.intermission_message_text || "Short break before the next round."}</p>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        {session?.show_scoreboard ? (
          <section className="rounded-3xl border border-stone-700 bg-black/45 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Leaderboard</p>
            <div className="mt-3 grid gap-2 text-2xl font-semibold">
              {leaderboard.slice(0, 8).map((row, index) => (
                <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-700 bg-stone-950/70 px-3 py-2">
                  <span>{index + 1}. {row.team_name}</span>
                  <span className="text-green-300">{row.total_points} pts</span>
                </div>
              ))}
              {leaderboard.length === 0 ? <p className="text-stone-400">No scores yet</p> : null}
            </div>
          </section>
        ) : null}

        {showThanksOverlay ? (
          <section className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_50%_0%,#1f2937,transparent_45%),linear-gradient(180deg,#020202,#0b0b0b)] p-8 text-center">
            <div className="max-w-4xl rounded-3xl border border-green-700/40 bg-black/70 p-10">
              <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Thanks For Playing</p>
              <p className="mt-3 text-6xl font-black text-green-200">{session?.thanks_heading_text || "Sample Detective"}</p>
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
