"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import InlineEditableCell from "../../_components/InlineEditableCell";
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
  prep_ready_main: number;
  prep_ready_tiebreakers: number;
  prep_total_main: number;
  prep_total_tiebreakers: number;
  transport_queue_call_ids?: number[];
};

type Call = {
  id: number;
  question_id: number | null;
  question_type: "free_response" | "multiple_choice" | "true_false" | "ordering";
  round_number: number;
  call_index: number;
  is_tiebreaker: boolean;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  question_text: string;
  answer_key: string;
  options_payload: unknown;
  answer_payload: unknown;
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
  cue_source_type: "inventory_track" | "uploaded_clip" | null;
  cue_source_payload: {
    inventory_id?: number;
    release_id?: number | null;
    release_track_id?: number | null;
    artist?: string;
    album?: string;
    title?: string;
    side?: string | null;
    position?: string | null;
    bucket?: string;
    object_path?: string;
  };
  cue_source_signed_url?: string | null;
  primary_cue_start_seconds: number | null;
  primary_cue_end_seconds: number | null;
  primary_cue_instruction: string | null;
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
  prep_status: "draft" | "ready";
  display_element_type: "song" | "artist" | "album" | "cover_art" | "vinyl_label";
  effective_display_image_url: string | null;
  source_artist: string | null;
  source_title: string | null;
  source_album: string | null;
  source_side: string | null;
  source_position: string | null;
  metadata_locked?: boolean;
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

function readCueSourceSummary(call: Call | null): string {
  if (!call) return "No cue source selected";
  const payload = asObject(call.cue_source_payload);
  if (call.cue_source_type === "inventory_track") {
    const artist = typeof payload.artist === "string" ? payload.artist.trim() : "";
    const album = typeof payload.album === "string" ? payload.album.trim() : "";
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const side = typeof payload.side === "string" ? payload.side.trim() : "";
    const position = typeof payload.position === "string" ? payload.position.trim() : "";
    const sidePosition = [side, position].filter(Boolean).join(" ");
    const line = [artist, album, title].filter(Boolean).join(" - ");
    if (!line) return "Inventory cue source selected";
    return sidePosition ? `${line} (${sidePosition})` : line;
  }
  if (call.cue_source_type === "uploaded_clip") {
    const objectPath = typeof payload.object_path === "string" ? payload.object_path.trim() : "";
    return objectPath ? `Uploaded clip: ${objectPath}` : "Uploaded clip source";
  }
  return "No cue source selected";
}

export default function MusicTriviaHostPage() {
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
  const cueSourceSummary = useMemo(() => readCueSourceSummary(callForControls), [callForControls]);
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

  const patchCallMetadata = useCallback(
    async (callId: number, patch: Record<string, unknown>) => {
      const response = await fetch(`/api/games/trivia/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...patch,
          metadata_locked: true,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to save source metadata");
      }
      await load();
    },
    [load]
  );

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
          scored_by: "host",
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#171717)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-cyan-900/40 bg-black/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Host Console</p>
              <h1 className="text-3xl font-black uppercase">Music Trivia Host</h1>
              <p className="text-sm text-stone-400">
                {session?.title} · {session?.session_code} · {session && session.current_round > session.round_count ? "Tie-Breaker" : `Round ${session?.current_round} of ${session?.round_count}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button className="rounded border border-stone-700 px-2 py-1" type="button" onClick={() => window.open(`/admin/games/music-trivia/prep?sessionId=${sessionId}`, "music_trivia_prep", "width=1024,height=800,left=1300,top=0")}>Prep</button>
              <button className="rounded border border-stone-700 px-2 py-1" type="button" onClick={() => window.open(`/admin/games/music-trivia/jumbotron?sessionId=${sessionId}`, "music_trivia_jumbotron", "width=1920,height=1080,noopener,noreferrer")}>Jumbotron</button>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/music-trivia/history">History</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/music-trivia">Setup</Link>
            </div>
          </div>

          {session ? (
            <p className={`mt-3 text-xs ${((session.prep_total_main - session.prep_ready_main) + (session.prep_total_tiebreakers - session.prep_ready_tiebreakers) > 0) ? "text-amber-300" : "text-emerald-300"}`}>
              Prep readiness · Main {session.prep_ready_main}/{session.prep_total_main} · Tie-breaker {session.prep_ready_tiebreakers}/{session.prep_total_tiebreakers}
            </p>
          ) : null}
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-cyan-200">Question Stack</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Source Artist</th>
                    <th className="pb-2">Source Title</th>
                    <th className="pb-2">Source Album</th>
                    <th className="pb-2">Category</th>
                    <th className="pb-2">Difficulty</th>
                    <th className="pb-2">Prep</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-cyan-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-2">{call.is_tiebreaker ? "Tie" : "Main"}</td>
                      <td className="py-1">
                        <InlineEditableCell
                          onSave={(nextValue) => patchCallMetadata(call.id, { source_artist: nextValue })}
                          value={call.source_artist ?? ""}
                        />
                      </td>
                      <td className="py-1">
                        <InlineEditableCell
                          onSave={(nextValue) => patchCallMetadata(call.id, { source_title: nextValue })}
                          value={call.source_title ?? ""}
                        />
                      </td>
                      <td className="py-1">
                        <InlineEditableCell
                          onSave={(nextValue) => patchCallMetadata(call.id, { source_album: nextValue || null })}
                          value={call.source_album ?? ""}
                        />
                      </td>
                      <td className="py-2">{call.category}</td>
                      <td className="py-2 uppercase">{call.difficulty}</td>
                      <td className="py-2">{call.prep_status}</td>
                      <td className="py-2 text-stone-400">{call.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-cyan-200">Current Question</h2>
              <div className="mt-3 rounded border border-cyan-700/40 bg-cyan-950/20 p-3">
                <p className="text-xs uppercase text-cyan-300">
                  {callForControls ? `Q${callForControls.call_index} · Round ${callForControls.round_number} · ${callForControls.category}` : "Waiting"}
                </p>
                <p className="mt-1 text-lg font-black">{callForControls?.question_text ?? "No active question"}</p>
                <p className="mt-2 text-sm text-stone-300">Difficulty: {callForControls?.difficulty ?? "-"}</p>
                <p className="mt-1 text-xs text-stone-400">Display: {callForControls?.display_element_type ?? "-"}</p>
                {currentChoices.length > 0 ? (
                  <div className="mt-2 rounded border border-stone-700/70 bg-stone-950/60 p-2 text-xs">
                    <p className="font-semibold text-cyan-200">Choices</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-stone-200">
                      {currentChoices.map((choice, index) => (
                        <li key={`${index}-${choice}`}>{choice}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-2 rounded border border-cyan-800/70 bg-cyan-950/20 p-2 text-xs">
                  <p className="font-semibold uppercase tracking-wide text-cyan-200">Cue Panel</p>
                  <p className="mt-1 text-stone-100">{cueSourceSummary}</p>
                  <p className="mt-1 text-stone-200">
                    Primary cue: {callForControls?.primary_cue_start_seconds !== null && callForControls?.primary_cue_start_seconds !== undefined
                      ? formatSecondsClock(callForControls.primary_cue_start_seconds)
                      : "--:--"}
                    {callForControls?.primary_cue_end_seconds !== null && callForControls?.primary_cue_end_seconds !== undefined
                      ? ` - ${formatSecondsClock(callForControls.primary_cue_end_seconds)}`
                      : ""}
                  </p>
                  {callForControls?.primary_cue_instruction ? (
                    <p className="mt-1 text-stone-200">Instruction: {callForControls.primary_cue_instruction}</p>
                  ) : (
                    <p className="mt-1 text-stone-400">Instruction: none</p>
                  )}
                  {callForControls?.cue_notes_text ? <p className="mt-1 text-stone-200">Notes: {callForControls.cue_notes_text}</p> : null}
                  {currentCueSegments.length > 0 ? (
                    <div className="mt-2 space-y-1 text-stone-200">
                      {currentCueSegments.map((segment, index) => (
                        <p key={`${segment.role}-${segment.start_seconds}-${index}`}>
                          [{segment.end_seconds !== null ? `${formatSecondsClock(segment.start_seconds)}-${formatSecondsClock(segment.end_seconds)}` : formatSecondsClock(segment.start_seconds)}] {segment.role}
                          {segment.track_label ? ` · ${segment.track_label}` : ""}
                          {segment.instruction ? ` · ${segment.instruction}` : ""}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-stone-400">No structured cue segments.</p>
                  )}
                  {callForControls?.cue_source_type === "uploaded_clip" && callForControls?.cue_source_signed_url ? (
                    <audio className="mt-2 w-full" controls src={callForControls.cue_source_signed_url} />
                  ) : null}
                </div>

                <p className="mt-2 text-sm text-amber-300">
                  {(callForControls?.status === "answer_revealed" || callForControls?.status === "scored")
                    ? `Answer: ${callForControls.answer_key}`
                    : "Answer hidden until reveal"}
                </p>
                {callForControls?.effective_display_image_url ? (
                  <img
                    alt={`Display asset for question ${callForControls.call_index}`}
                    className="mt-3 h-28 w-full rounded border border-cyan-700/40 object-cover"
                    src={callForControls.effective_display_image_url}
                  />
                ) : null}

                {(callForControls?.status === "answer_revealed" || callForControls?.status === "scored") ? (
                  <div className="mt-3 rounded border border-amber-700/40 bg-amber-950/20 p-2 text-xs">
                    <p className="font-semibold uppercase tracking-wide text-amber-300">Reveal Panel</p>
                    {callForControls.explanation_text ? (
                      <p className="mt-1 text-stone-200">{callForControls.explanation_text}</p>
                    ) : (
                      <p className="mt-1 text-stone-400">No explanation provided.</p>
                    )}
                    {revealMediaAssets.length > 0 ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {revealMediaAssets.map((asset, index) => (
                          <img
                            key={`${asset.signed_url}-${index}`}
                            alt={`Reveal asset ${index + 1}`}
                            className="h-28 w-full rounded border border-amber-700/40 object-cover"
                            src={asset.signed_url ?? ""}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <p className="mt-1 text-[11px] text-stone-500">
                  Click source fields in Question Stack to edit inline. Press Enter to save.
                </p>
              </div>

              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Recently Played</p>
                <div className="mt-1 max-h-24 overflow-auto text-stone-400">
                  {previousCalls.map((call) => (
                    <div key={call.id}>Q{call.call_index}. {call.category} ({call.status})</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-cyan-300">Controls</p>
              <p className="mt-1 text-xs text-stone-400">Gap timer target: {session?.target_gap_seconds ?? 0}s · Remaining: {session?.remaining_seconds ?? 0}s</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button onClick={advance} className="rounded bg-cyan-700 px-2 py-1">Advance Question</button>
                <button onClick={advanceTieBreaker} className="rounded bg-fuchsia-700 px-2 py-1">Advance Tie-Breaker</button>
                <button onClick={() => patchCallStatus("asked")} className="rounded bg-blue-700 px-2 py-1">Mark Asked</button>
                <button onClick={() => patchCallStatus("answer_revealed")} className="rounded bg-amber-700 px-2 py-1">Reveal Answer</button>
                <button onClick={() => patchCallStatus("skipped")} className="rounded bg-red-700 px-2 py-1">Skip</button>
              </div>
              {tieBreakerForControls ? (
                <p className="mt-2 text-[11px] text-fuchsia-200">
                  Next tie-breaker: Q{tieBreakerForControls.call_index} · {tieBreakerForControls.category}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button onClick={pause} className="rounded border border-stone-600 px-2 py-1">Pause</button>
                <button onClick={resume} className="rounded border border-stone-600 px-2 py-1">Resume</button>
                <button onClick={() => patchCallStatus("scored")} className="rounded border border-stone-600 px-2 py-1">Mark Scored</button>
              </div>
            </div>

            <GameTransportLane
              gameSlug="trivia"
              sessionId={sessionId}
              calls={transportCalls}
              currentOrderIndex={session?.current_call_index ?? 0}
              transportQueueCallIds={session?.transport_queue_call_ids ?? []}
              doneStatuses={["asked", "answer_revealed", "scored", "skipped"]}
              onChanged={load}
              accent="host"
              maxRows={6}
            />

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-cyan-300">Score Entry</p>
              <div className="mt-2 space-y-2 text-xs">
                {leaderboard.map((team) => (
                  <div key={team.team_id} className="grid grid-cols-[1.2fr,auto,110px] items-center gap-2 rounded border border-stone-800 bg-stone-950/70 p-2">
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
          </section>
        </div>
      </div>
    </div>
  );
}
