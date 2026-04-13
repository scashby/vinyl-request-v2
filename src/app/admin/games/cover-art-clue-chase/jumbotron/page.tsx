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
  show_round: boolean;
  show_scoreboard: boolean;
  show_stage_hint: boolean;
  status: "pending" | "running" | "paused" | "completed";
  show_logo: boolean;
  welcome_heading_text: string | null;
  welcome_message_text: string | null;
  intermission_heading_text: string | null;
  intermission_message_text: string | null;
  thanks_heading_text: string | null;
  thanks_subheading_text: string | null;
  default_intermission_seconds: number;
  host_overlay: string;
  host_overlay_remaining_seconds: number;
  event: {
    venue_logo_url: string | null;
  } | null;
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  artist: string;
  title: string;
  source_label: string | null;
  reveal_level_1_image_url: string | null;
  reveal_level_2_image_url: string | null;
  reveal_level_3_image_url: string | null;
  audio_clue_source: string | null;
  status: "pending" | "stage_1" | "stage_2" | "final_reveal" | "scored" | "skipped";
  stage_revealed: number;
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
};

function stageLabel(stage: number): string {
  if (stage <= 1) return "Stage 1";
  if (stage === 2) return "Stage 2";
  return "Final Reveal";
}

function imageForStage(call: Call | null): string | null {
  if (!call) return null;
  if (call.stage_revealed <= 1) return call.reveal_level_1_image_url;
  if (call.stage_revealed === 2) return call.reveal_level_2_image_url ?? call.reveal_level_1_image_url;
  return call.reveal_level_3_image_url ?? call.reveal_level_2_image_url ?? call.reveal_level_1_image_url;
}

export default function CoverArtClueChaseJumbotronPage() {
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("sessionId"));
  const containerRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [overlayRemaining, setOverlayRemaining] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/cover-art-clue-chase/sessions/${sessionId}`),
      fetch(`/api/games/cover-art-clue-chase/sessions/${sessionId}/calls`),
      fetch(`/api/games/cover-art-clue-chase/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) setSession((await sessionRes.json()) as Session);
    if (callsRes.ok) setCalls(((await callsRes.json()).data ?? []) as Call[]);
    if (leaderboardRes.ok) setLeaderboard(((await leaderboardRes.json()).data ?? []) as LeaderboardRow[]);
  }, [sessionId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 3000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    if (!session?.host_overlay_remaining_seconds) {
      setOverlayRemaining(0);
      return;
    }
    setOverlayRemaining(session.host_overlay_remaining_seconds);
    const interval = setInterval(() => {
      setOverlayRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.host_overlay_remaining_seconds]);

  const showThanksOverlay = session?.host_overlay === "thanks" && session.host_overlay_remaining_seconds > 0;
  const showOverlay = showThanksOverlay || (!!session?.host_overlay && session.host_overlay !== "none");
  const logoUrl = session?.event?.venue_logo_url ?? "";

  const currentCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const stageImage = useMemo(() => imageForStage(currentCall), [currentCall]);
  const showWelcome = session?.status === "pending";
  const showThanks = session?.status === "completed";
  const showAnswer = currentCall?.status === "final_reveal" || currentCall?.status === "scored";

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
    <div ref={containerRef} className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#155e75,transparent_38%),linear-gradient(180deg,#020202,#0d0d0d)] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        {!showOverlay ? (
          <>
            <section className="rounded-3xl border border-stone-700 bg-black/45 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Current Cover</p>
              {stageImage ? (
                <img
                  alt={`Cover reveal for call ${currentCall?.call_index ?? 0}`}
                  className="mt-3 h-[56vh] w-full rounded-2xl border border-cyan-700/40 object-cover"
                  src={stageImage}
                />
              ) : (
                <div className="mt-3 flex h-[56vh] items-center justify-center rounded-2xl border border-stone-700 bg-stone-950/60 text-xl font-semibold text-stone-400">
                  Waiting for host to reveal cover art
                </div>
              )}

              {session?.show_stage_hint ? (
                <p className="mt-3 text-3xl font-black text-cyan-200">{stageLabel(currentCall?.stage_revealed ?? 1)}</p>
              ) : null}
              <p className="mt-2 text-xl text-stone-200">{currentCall ? `${currentCall.artist} - ${currentCall.title}` : "Get ready for the next reveal"}</p>
              {currentCall?.source_label ? <p className="mt-1 text-sm text-stone-400">{currentCall.source_label}</p> : null}
              {showAnswer ? (
                <p className="mt-4 text-2xl font-semibold text-amber-300">
                  Answer locked: {currentCall?.artist} - {currentCall?.title}
                </p>
              ) : (
                <p className="mt-4 text-2xl font-semibold text-stone-300">Submit your guesses now</p>
              )}
              {currentCall?.audio_clue_source ? <p className="mt-2 text-lg text-cyan-300">Audio clue available</p> : null}
            </section>

            {session?.show_scoreboard ? (
              <section className="rounded-3xl border border-stone-700 bg-black/45 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Leaderboard</p>
                <div className="mt-3 grid gap-2 text-2xl font-semibold">
                  {leaderboard.slice(0, 6).map((row, index) => (
                    <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-700 bg-stone-950/70 px-3 py-2">
                      <span>{index + 1}. {row.team_name}</span>
                      <span className="text-cyan-300">{row.total_points} pts</span>
                    </div>
                  ))}
                  {leaderboard.length === 0 ? <p className="text-stone-400">No scores yet</p> : null}
                </div>
              </section>
            ) : null}

            {showWelcome ? (
              <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-8 text-center">
                <div className="max-w-4xl rounded-3xl border border-cyan-700/40 bg-black/70 p-8">
                  <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Welcome</p>
                  <p className="mt-2 text-6xl font-black text-cyan-200">Cover Art Clue Chase</p>
                  <p className="mt-4 text-2xl text-stone-200">Guess the album from each reveal stage</p>
                </div>
              </section>
            ) : null}

            {showThanks ? (
              <section className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_50%_0%,#134e4a,transparent_45%),linear-gradient(180deg,#020202,#0b0b0b)] p-8 text-center">
                <div className="max-w-4xl rounded-3xl border border-emerald-700/40 bg-black/70 p-10">
                  <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Thanks For Playing</p>
                  <p className="mt-3 text-6xl font-black text-emerald-200">Cover Art Clue Chase</p>
                  <p className="mt-4 text-2xl text-stone-200">Session {session?.session_code ?? "-"} is complete</p>
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {/* Welcome Overlay */}
        {session?.host_overlay === "welcome" && !showThanksOverlay && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-b from-teal-900/90 via-stone-900/80 to-stone-950/90 backdrop-blur-sm">
            {logoUrl && session.show_logo && <img src={logoUrl} alt="Venue" className="h-16 mb-4 object-contain" />}
            <div className="text-center">
              <h2 className="text-4xl font-black text-teal-300 mb-4">{session?.welcome_heading_text}</h2>
              <p className="text-lg text-stone-300">{session?.welcome_message_text}</p>
            </div>
          </div>
        )}

        {/* Countdown Overlay */}
        {session?.host_overlay === "countdown" && !showThanksOverlay && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-b from-teal-900/90 via-stone-900/80 to-stone-950/90 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-xl text-stone-300 mb-2">Starting in…</p>
              <p className="text-6xl font-black text-teal-300">{overlayRemaining}</p>
            </div>
          </div>
        )}

        {/* Intermission Overlay */}
        {session?.host_overlay === "intermission" && !showThanksOverlay && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-b from-teal-900/90 via-stone-900/80 to-stone-950/90 backdrop-blur-sm">
            <div className="text-center">
              <h2 className="text-4xl font-black text-teal-300 mb-4">{session?.intermission_heading_text}</h2>
              <p className="text-lg text-stone-300 mb-4">{session?.intermission_message_text}</p>
              <p className="text-2xl font-bold text-teal-400">{overlayRemaining}s</p>
            </div>
          </div>
        )}

        {/* Thanks Overlay */}
        {showThanksOverlay && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-b from-teal-900/90 via-stone-900/80 to-stone-950/90 backdrop-blur-sm">
            {logoUrl && session.show_logo && <img src={logoUrl} alt="Venue" className="h-20 mb-6 object-contain" />}
            <div className="text-center">
              <h2 className="text-5xl font-black text-teal-300 mb-4">{session?.thanks_heading_text}</h2>
              <p className="text-2xl text-stone-300">{session?.thanks_subheading_text}</p>
            </div>
          </div>
        )}

        {showThanks ? (
          <section className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_50%_0%,#1f2937,transparent_45%),linear-gradient(180deg,#020202,#0b0b0b)] p-8 text-center">
            <div className="max-w-4xl rounded-3xl border border-cyan-700/40 bg-black/70 p-8">
              <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Thanks For Playing</p>
            </div>
          </section>
        ) : null}

        {showThanks ? (
          <section className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_50%_0%,#134e4a,transparent_45%),linear-gradient(180deg,#020202,#0b0b0b)] p-8 text-center">
            <div className="max-w-4xl rounded-3xl border border-emerald-700/40 bg-black/70 p-10">
              <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Thanks For Playing</p>
              <p className="mt-3 text-6xl font-black text-emerald-200">Cover Art Clue Chase</p>
              <p className="mt-4 text-2xl text-stone-200">Session {session?.session_code ?? "-"} is complete</p>
            </div>
          </section>
        ) : null}
      </div>

      <button
        type="button"
        onClick={toggleFullscreen}
        className="fixed bottom-3 right-3 z-50 rounded border border-stone-600/70 bg-black/55 px-3 py-1 text-xs text-stone-200"
        aria-label="Toggle fullscreen"
      >
        Fullscreen (F)
      </button>
    </div>
  );
}
