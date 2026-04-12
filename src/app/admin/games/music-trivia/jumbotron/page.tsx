"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatSecondsClock } from "src/lib/triviaBank";

type Session = {
  title: string;
  session_code: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  questions_per_round: number;
  tie_breaker_count: number;
  remaining_seconds: number;
  status: "pending" | "running" | "paused" | "completed";
  show_title: boolean;
  show_rounds: boolean;
  show_question_counter: boolean;
  show_leaderboard: boolean;
  show_cue_hints: boolean;
};

type Call = {
  id: number;
  call_index: number;
  question_type: "free_response" | "multiple_choice" | "true_false" | "ordering";
  is_tiebreaker: boolean;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  question_text: string;
  answer_key: string;
  options_payload: unknown;
  explanation_text: string | null;
  reveal_payload: {
    media_assets?: Array<{
      signed_url?: string | null;
      asset_type?: string;
      asset_role?: string;
    }>;
  };
  reveal_media_assets?: Array<{
    signed_url?: string | null;
    asset_type?: string;
    asset_role?: string;
  }>;
  cue_notes_text: string | null;
  cue_payload: {
    segments?: Array<{
      role?: string;
      track_label?: string | null;
      start_seconds?: number;
      end_seconds?: number | null;
    }>;
  };
  display_element_type: "song" | "artist" | "album" | "cover_art" | "vinyl_label";
  effective_display_image_url: string | null;
  status: "pending" | "asked" | "answer_revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  correct_answers: number;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function readChoices(call: Call | null): string[] {
  if (!call) return [];
  const optionsPayload = call.options_payload;
  if (Array.isArray(optionsPayload)) return asStringList(optionsPayload);
  const payload = asObject(optionsPayload);
  if (Array.isArray(payload.options)) return asStringList(payload.options);
  if (Array.isArray(payload.choices)) return asStringList(payload.choices);
  return [];
}

export default function MusicTriviaJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const containerRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [remaining, setRemaining] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/trivia/sessions/${sessionId}`),
      fetch(`/api/games/trivia/sessions/${sessionId}/calls`),
      fetch(`/api/games/trivia/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) {
      const payload = await sessionRes.json();
      setSession(payload);
      setRemaining(payload.remaining_seconds ?? 0);
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
      setRemaining((value) => {
        if (!session || session.status === "paused") return value;
        return Math.max(0, value - 1);
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [session]);

  const currentCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const currentQuestionNumber = currentCall?.call_index ?? 0;
  const tieBreakers = useMemo(() => calls.filter((call) => call.is_tiebreaker), [calls]);
  const tieBreakerIndex = useMemo(() => {
    if (!currentCall?.is_tiebreaker) return null;
    const index = tieBreakers.findIndex((call) => call.id === currentCall.id);
    return index >= 0 ? index + 1 : null;
  }, [currentCall, tieBreakers]);
  const choiceOptions = useMemo(() => readChoices(currentCall), [currentCall]);
  const safeCueHints = useMemo(() => {
    if (!currentCall?.cue_payload?.segments || !Array.isArray(currentCall.cue_payload.segments)) return [];
    return currentCall.cue_payload.segments
      .map((segment) => asObject(segment))
      .map((segment) => ({
        role: String(segment.role ?? "cue"),
        trackLabel: typeof segment.track_label === "string" ? segment.track_label : null,
        startSeconds: Number(segment.start_seconds),
      }))
      .filter((segment) => Number.isFinite(segment.startSeconds) && segment.startSeconds >= 0)
      .sort((a, b) => a.startSeconds - b.startSeconds);
  }, [currentCall]);
  const revealMediaAssets = useMemo(
    () =>
      (currentCall?.reveal_media_assets ??
        currentCall?.reveal_payload?.media_assets ??
        []).filter((asset) => typeof asset?.signed_url === "string" && asset.signed_url.length > 0),
    [currentCall]
  );

  const showThanks = session?.status === "completed";

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
    <div ref={containerRef} className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#0a4453,transparent_38%),linear-gradient(180deg,#020202,#0d0d0d)] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-cyan-700/40 bg-black/35 p-6">
          {session?.show_title ? <h1 className="text-5xl font-black uppercase tracking-tight text-cyan-200">{session?.title ?? "Music Trivia"}</h1> : null}

          <div className="mt-4 flex flex-wrap gap-6 text-xl font-semibold">
            {session?.show_rounds ? (
              <p>
                {currentCall?.is_tiebreaker ? "Tie-Breaker" : `Round ${session?.current_round} of ${session?.round_count}`}
              </p>
            ) : null}
            {session?.show_question_counter ? (
              <p>
                {currentCall?.is_tiebreaker
                  ? `Tie-Breaker ${tieBreakerIndex ?? "-"} / ${session?.tie_breaker_count ?? 0}`
                  : `Question ${currentQuestionNumber} / ${(session?.round_count ?? 0) * (session?.questions_per_round ?? 0)}`}
              </p>
            ) : null}
            <p>Next Gap: <span className="font-black text-cyan-300">{remaining}s</span></p>
            {session?.status === "paused" ? <p className="text-red-400">Paused</p> : null}
          </div>
        </header>

        <section className="rounded-3xl border border-stone-700 bg-black/45 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Current Question</p>
          {currentCall?.effective_display_image_url ? (
            <img
              alt={`Trivia display asset for question ${currentCall.call_index}`}
              className="mt-3 h-64 w-full rounded-2xl border border-cyan-700/40 object-cover"
              src={currentCall.effective_display_image_url}
            />
          ) : (
            <div className="mt-3 flex h-64 items-center justify-center rounded-2xl border border-stone-700 bg-stone-950/60 text-xl font-semibold text-stone-400">
              No image available
            </div>
          )}
          <p className="mt-2 text-5xl font-black text-cyan-200">{currentCall?.question_text ?? "Waiting for host"}</p>
          <p className="mt-3 text-xl text-stone-200">{currentCall ? `${currentCall.category} · ${currentCall.difficulty.toUpperCase()} · ${currentCall.display_element_type}` : ""}</p>
          {choiceOptions.length > 0 ? (
            <div className="mt-3 rounded-xl border border-stone-700 bg-stone-950/70 p-4 text-left text-2xl">
              {choiceOptions.map((choice, index) => (
                <p key={`${index}-${choice}`}>{String.fromCharCode(65 + index)}. {choice}</p>
              ))}
            </div>
          ) : null}
          {session?.show_cue_hints && safeCueHints.length > 0 ? (
            <div className="mt-3 rounded-xl border border-cyan-700/40 bg-cyan-950/20 p-3 text-left">
              <p className="text-sm uppercase tracking-[0.18em] text-cyan-300">Cue Hints</p>
              <div className="mt-2 space-y-1 text-lg text-cyan-100">
                {safeCueHints.map((hint, index) => (
                  <p key={`${hint.role}-${hint.startSeconds}-${index}`}>
                    {formatSecondsClock(hint.startSeconds)} · {hint.role}{hint.trackLabel ? ` · ${hint.trackLabel}` : ""}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
          {(currentCall?.status === "answer_revealed" || currentCall?.status === "scored") ? (
            <div className="mt-4 rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 text-left">
              <p className="text-3xl font-bold text-amber-300">Answer: {currentCall.answer_key}</p>
              {currentCall.explanation_text ? <p className="mt-2 text-xl text-stone-100">{currentCall.explanation_text}</p> : null}
              {revealMediaAssets.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {revealMediaAssets.map((asset, index) => (
                    <img
                      key={`${asset.signed_url}-${index}`}
                      alt={`Reveal media ${index + 1}`}
                      className="h-48 w-full rounded border border-amber-700/40 object-cover"
                      src={asset.signed_url ?? ""}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-2xl font-semibold text-stone-300">Submit your answers now</p>
          )}
        </section>

        {session?.show_leaderboard ? (
          <section className="rounded-3xl border border-stone-700 bg-black/45 p-6">
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

        {showThanks ? (
          <section className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_50%_0%,#1f2937,transparent_45%),linear-gradient(180deg,#020202,#0b0b0b)] p-8 text-center">
            <div className="max-w-4xl rounded-3xl border border-cyan-700/40 bg-black/70 p-10">
              <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Thanks For Playing</p>
              <p className="mt-3 text-6xl font-black text-cyan-200">Music Trivia</p>
              <p className="mt-4 text-2xl text-stone-200">Session {session?.session_code ?? "-"} is complete</p>
              <p className="mt-6 text-xl text-stone-300">See you at the next round</p>
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
