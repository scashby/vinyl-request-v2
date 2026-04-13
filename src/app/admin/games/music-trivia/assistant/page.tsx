"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import GameTransportLane, { type TransportCallRow } from "../../_components/GameTransportLane";
import { formatSecondsClock } from "src/lib/triviaBank";

type Session = {
  id: number;
  session_code: string;
  title: string;
  current_round: number;
  round_count: number;
  questions_per_round: number;
  tie_breaker_count: number;
  current_call_index: number;
  status: "pending" | "running" | "paused" | "completed";
  remaining_seconds: number;
  target_gap_seconds: number;
  transport_queue_call_ids?: number[];
};

type Call = {
  id: number;
  question_type: "free_response" | "multiple_choice" | "true_false" | "ordering";
  round_number: number;
  call_index: number;
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
      instruction?: string | null;
    }>;
  };
  effective_display_image_url: string | null;
  source_artist: string | null;
  source_title: string | null;
  source_album: string | null;
  source_side: string | null;
  source_position: string | null;
  base_points: number;
  bonus_points: number;
  status: "pending" | "asked" | "answer_revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  correct_answers: number;
};

type ScoreDraft = Record<number, { correct: boolean; awarded_points: string }>;

type CueSegment = {
  role: string;
  track_label: string | null;
  start_seconds: number;
  end_seconds: number | null;
  instruction: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function readChoiceOptions(call: Call | null): string[] {
  if (!call) return [];
  const optionsPayload = call.options_payload;
  if (Array.isArray(optionsPayload)) return asStringList(optionsPayload);

  const payload = asObject(optionsPayload);
  if (Array.isArray(payload.options)) return asStringList(payload.options);
  if (Array.isArray(payload.choices)) return asStringList(payload.choices);
  return [];
}

function readCueSegments(call: Call | null): CueSegment[] {
  if (!call?.cue_payload || !Array.isArray(call.cue_payload.segments)) return [];
  return call.cue_payload.segments
    .map((segment) => asObject(segment))
    .map((segment) => ({
      role: String(segment.role ?? "primary"),
      track_label: typeof segment.track_label === "string" ? segment.track_label : null,
      start_seconds: Number(segment.start_seconds),
      end_seconds: Number.isFinite(Number(segment.end_seconds)) ? Number(segment.end_seconds) : null,
      instruction: typeof segment.instruction === "string" ? segment.instruction : null,
    }))
    .filter((segment) => Number.isFinite(segment.start_seconds) && segment.start_seconds >= 0)
    .sort((a, b) => a.start_seconds - b.start_seconds);
}

export default function MusicTriviaAssistantPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/trivia/sessions/${sessionId}`),
      fetch(`/api/games/trivia/sessions/${sessionId}/calls`),
      fetch(`/api/games/trivia/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) setSession(await sessionRes.json());
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

  const activeCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const nextPendingMainCall = useMemo(
    () => calls.find((call) => !call.is_tiebreaker && call.status === "pending") ?? null,
    [calls]
  );
  const nextPendingTieBreaker = useMemo(
    () => calls.find((call) => call.is_tiebreaker && call.status === "pending") ?? null,
    [calls]
  );
  const callForControls = activeCall ?? nextPendingMainCall;
  const tieBreakerForControls = activeCall?.is_tiebreaker ? activeCall : nextPendingTieBreaker;
  const currentChoices = useMemo(() => readChoiceOptions(callForControls), [callForControls]);
  const currentCueSegments = useMemo(() => readCueSegments(callForControls), [callForControls]);
  const revealMediaAssets = useMemo(
    () =>
      (callForControls?.reveal_media_assets ??
        callForControls?.reveal_payload?.media_assets ??
        []).filter((asset) => typeof asset?.signed_url === "string" && asset.signed_url.length > 0),
    [callForControls]
  );

  const previousCalls = useMemo(
    () => calls.filter((call) => ["asked", "answer_revealed", "scored", "skipped"].includes(call.status)).slice(-6),
    [calls]
  );

  const transportCalls = useMemo<TransportCallRow[]>(
    () =>
      calls
        .filter((call) => {
          const tieBreakerMode = (session?.current_round ?? 0) > (session?.round_count ?? Number.MAX_SAFE_INTEGER);
          return tieBreakerMode ? call.is_tiebreaker : !call.is_tiebreaker;
        })
        .map((call) => ({
          id: call.id,
          order_index: call.call_index,
          display_index: `#${call.call_index}`,
          title: call.source_title?.trim() || call.question_text,
          artist: call.source_artist?.trim() || "Unknown Artist",
          album: call.source_album?.trim() || null,
          side: call.source_side,
          position: call.source_position,
          status: call.status,
        })),
    [calls, session?.current_round, session?.round_count]
  );

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = { correct: false, awarded_points: "" };
    }
    setScoreDraft(draft);
  }, [callForControls?.id, leaderboard]);

  const advance = async () => {
    await fetch(`/api/games/trivia/sessions/${sessionId}/advance`, { method: "POST" });
    load();
  };

  const advanceTieBreaker = async () => {
    await fetch(`/api/games/trivia/sessions/${sessionId}/advance-tiebreaker`, { method: "POST" });
    load();
  };

  const pause = async () => {
    await fetch(`/api/games/trivia/sessions/${sessionId}/pause`, { method: "POST" });
    load();
  };

  const resume = async () => {
    await fetch(`/api/games/trivia/sessions/${sessionId}/resume`, { method: "POST" });
    load();
  };

  const patchCallStatus = async (status: "asked" | "answer_revealed" | "scored" | "skipped") => {
    if (!callForControls) return;
    await fetch(`/api/games/trivia/calls/${callForControls.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const submitScores = async () => {
    if (!callForControls) return;
    setSaving(true);
    try {
      const awards = leaderboard.map((row) => {
        const draft = scoreDraft[row.team_id] ?? { correct: false, awarded_points: "" };
        const parsedPoints = Number(draft.awarded_points);
        return {
          team_id: row.team_id,
          correct: draft.correct,
          awarded_points: Number.isFinite(parsedPoints) && draft.awarded_points !== "" ? parsedPoints : undefined,
        };
      });

      const res = await fetch(`/api/games/trivia/sessions/${sessionId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: callForControls.id,
          awards,
          scored_by: "assistant",
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to save scores");
      }

      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save scores");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#071b22,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-4 rounded-3xl border border-cyan-900/40 bg-black/50 p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase text-cyan-200">Music Trivia Assistant</h1>
            <p className="mt-2 text-sm text-stone-300">
              {session?.title ?? "Session"} · {session?.session_code ?? "-"} · Round {session?.current_round ?? 0} of {session?.round_count ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-stone-700 bg-stone-950/60 px-4 py-3 text-xs text-stone-300">
            Gap target: {session?.target_gap_seconds ?? 0}s · Remaining: {session?.remaining_seconds ?? 0}s
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">Current Question</p>
              {callForControls ? (
                <>
                  <p className="mt-2 text-lg font-black text-stone-100">#{callForControls.call_index} · {callForControls.category}</p>
                  <p className="mt-2 text-stone-200">{callForControls.question_text}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-stone-400">
                    {callForControls.question_type} · {callForControls.difficulty} · {callForControls.is_tiebreaker ? "Tie-Breaker" : `Round ${callForControls.round_number}`}
                  </p>
                  {(callForControls.source_artist || callForControls.source_title || callForControls.source_album) ? (
                    <p className="mt-3 text-sm text-cyan-200">
                      Source: {[callForControls.source_artist, callForControls.source_title, callForControls.source_album].filter(Boolean).join(" - ")}
                    </p>
                  ) : null}
                  {currentChoices.length > 0 ? (
                    <div className="mt-3 rounded border border-stone-800 bg-black/35 p-3 text-sm text-stone-200">
                      {currentChoices.map((choice, index) => (
                        <p key={`${index}-${choice}`}>{String.fromCharCode(65 + index)}. {choice}</p>
                      ))}
                    </div>
                  ) : null}
                  {currentCueSegments.length > 0 ? (
                    <div className="mt-3 rounded border border-cyan-900/40 bg-cyan-950/20 p-3 text-xs text-cyan-100">
                      <p className="font-semibold uppercase tracking-[0.16em] text-cyan-300">Cue Segments</p>
                      <div className="mt-2 space-y-1">
                        {currentCueSegments.map((segment, index) => (
                          <p key={`${segment.role}-${segment.start_seconds}-${index}`}>
                            {formatSecondsClock(segment.start_seconds)}
                            {segment.end_seconds !== null ? ` - ${formatSecondsClock(segment.end_seconds)}` : ""}
                            {` · ${segment.role}`}
                            {segment.track_label ? ` · ${segment.track_label}` : ""}
                            {segment.instruction ? ` · ${segment.instruction}` : ""}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {callForControls.cue_notes_text ? <p className="mt-3 text-sm text-stone-400">Cue notes: {callForControls.cue_notes_text}</p> : null}
                  {callForControls.effective_display_image_url ? (
                    <img
                      alt={`Trivia asset ${callForControls.call_index}`}
                      className="mt-3 h-48 w-full rounded-2xl border border-cyan-900/40 object-cover"
                      src={callForControls.effective_display_image_url}
                    />
                  ) : null}
                  {(callForControls.status === "answer_revealed" || callForControls.status === "scored") ? (
                    <div className="mt-4 rounded border border-amber-700/40 bg-amber-950/20 p-3">
                      <p className="text-sm font-bold text-amber-300">Answer: {callForControls.answer_key}</p>
                      {callForControls.explanation_text ? <p className="mt-2 text-sm text-stone-200">{callForControls.explanation_text}</p> : null}
                      {revealMediaAssets.length > 0 ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {revealMediaAssets.map((asset, index) => (
                            <img
                              key={`${asset.signed_url}-${index}`}
                              alt={`Reveal asset ${index + 1}`}
                              className="h-32 w-full rounded border border-amber-700/40 object-cover"
                              src={asset.signed_url ?? ""}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-stone-400">Waiting for host to advance.</p>
              )}
            </div>

            <GameTransportLane
              gameSlug="trivia"
              sessionId={sessionId}
              calls={transportCalls}
              currentOrderIndex={session?.current_call_index ?? 0}
              transportQueueCallIds={session?.transport_queue_call_ids ?? []}
              doneStatuses={["asked", "answer_revealed", "scored", "skipped"]}
              onChanged={load}
              accent="assistant"
              maxRows={6}
            />

            <div className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">Recently Played</p>
              <div className="mt-2 max-h-32 space-y-1 overflow-auto text-stone-300">
                {previousCalls.map((call) => (
                  <div key={call.id}>Q{call.call_index}. {call.category} ({call.status})</div>
                ))}
                {previousCalls.length === 0 ? <p className="text-stone-500">No previous questions yet.</p> : null}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">Controls</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button onClick={advance} className="rounded bg-cyan-700 px-2 py-1">Advance Question</button>
                <button onClick={advanceTieBreaker} className="rounded bg-fuchsia-700 px-2 py-1">Advance Tie-Breaker</button>
                <button onClick={() => patchCallStatus("asked")} className="rounded bg-blue-700 px-2 py-1">Mark Asked</button>
                <button onClick={() => patchCallStatus("answer_revealed")} className="rounded bg-amber-700 px-2 py-1">Reveal Answer</button>
                <button onClick={() => patchCallStatus("skipped")} className="rounded bg-red-700 px-2 py-1">Skip</button>
                <button onClick={() => patchCallStatus("scored")} className="rounded border border-stone-600 px-2 py-1">Mark Scored</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button onClick={pause} className="rounded border border-stone-600 px-2 py-1">Pause</button>
                <button onClick={resume} className="rounded border border-stone-600 px-2 py-1">Resume</button>
              </div>
              {tieBreakerForControls ? (
                <p className="mt-3 text-[11px] text-fuchsia-200">
                  Next tie-breaker: Q{tieBreakerForControls.call_index} · {tieBreakerForControls.category}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4 text-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">Score Entry</p>
              <div className="mt-2 space-y-2 text-xs">
                {leaderboard.map((team) => (
                  <div key={team.team_id} className="grid grid-cols-[1.2fr,auto,110px] items-center gap-2 rounded border border-stone-800 bg-black/40 p-2">
                    <div>
                      <p className="font-semibold">{team.team_name}</p>
                      <p className="text-[11px] text-stone-400">Total: {team.total_points} · Correct: {team.correct_answers}</p>
                    </div>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={scoreDraft[team.team_id]?.correct ?? false}
                        onChange={(e) =>
                          setScoreDraft((draft) => ({
                            ...draft,
                            [team.team_id]: {
                              ...(draft[team.team_id] ?? { awarded_points: "" }),
                              correct: e.target.checked,
                            },
                          }))
                        }
                      />
                      Correct
                    </label>
                    <input
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      placeholder="Auto"
                      value={scoreDraft[team.team_id]?.awarded_points ?? ""}
                      onChange={(e) =>
                        setScoreDraft((draft) => ({
                          ...draft,
                          [team.team_id]: {
                            ...(draft[team.team_id] ?? { correct: false }),
                            awarded_points: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                ))}
                {leaderboard.length === 0 ? <p className="text-stone-500">No teams found.</p> : null}
              </div>
              <button disabled={!callForControls || saving} onClick={submitScores} className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold disabled:opacity-50">
                {saving ? "Saving..." : "Save Scores for Current Question"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/music-trivia">Setup</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/music-trivia/host?sessionId=${sessionId}`}>Host</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/music-trivia/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}