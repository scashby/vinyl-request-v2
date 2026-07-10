"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import InlineEditableCell from "../../_components/InlineEditableCell";
import GameTransportLane, { type TransportCallRow } from "../../_components/GameTransportLane";

type Session = {
  id: number;
  session_code: string;
  title: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  status: "pending" | "running" | "paused" | "completed";
  lock_in_rule: "time_window" | "first_sheet_wins" | "hand_raise";
  lock_in_window_seconds: number;
  default_intermission_seconds: number;
  remaining_seconds: number;
  target_gap_seconds: number;
  transport_queue_call_ids?: number[];
  host_overlay?: "none" | "welcome" | "countdown" | "intermission";
  host_overlay_remaining_seconds?: number;
};

type Call = {
  id: number;
  round_number: number;
  call_index: number;
  playlist_track_key: string | null;
  source_label: string | null;
  artist_answer: string;
  title_answer: string;
  snippet_start_seconds: number;
  snippet_duration_seconds: number;
  host_notes: string | null;
  metadata_locked?: boolean;
  status: "pending" | "asked" | "locked" | "answer_revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  artist_hits: number;
  title_hits: number;
  perfect_calls: number;
};

type ScoreDraft = Record<number, { artist_correct: boolean; title_correct: boolean; awarded_points: string }>;

type InventorySearchCandidate = {
  track_key: string;
  inventory_id: number | null;
  title: string;
  artist: string;
  album_title: string | null;
  side: string | null;
  position: string | null;
  score: number;
};

function getDefaultPoints(artistCorrect: boolean, titleCorrect: boolean): number {
  if (artistCorrect && titleCorrect) return 2;
  if (artistCorrect || titleCorrect) return 1;
  return 0;
}

export default function NameThatTuneHostPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false);
  const [targetGapInput, setTargetGapInput] = useState(45);
  const [savingGap, setSavingGap] = useState(false);
  const [overlaySecondsInput, setOverlaySecondsInput] = useState(600);
  const [overlayBusy, setOverlayBusy] = useState(false);
  const [swapTargetCall, setSwapTargetCall] = useState<Call | null>(null);
  const [swapQuery, setSwapQuery] = useState("");
  const [swapResults, setSwapResults] = useState<InventorySearchCandidate[]>([]);
  const [swapSearching, setSwapSearching] = useState(false);
  const [swapApplyingTrackKey, setSwapApplyingTrackKey] = useState<string | null>(null);
  const [swapMessage, setSwapMessage] = useState<string | null>(null);

  const autoAdvanceLockRef = useRef(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/name-that-tune/sessions/${sessionId}`),
      fetch(`/api/games/name-that-tune/sessions/${sessionId}/calls`),
      fetch(`/api/games/name-that-tune/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) {
      const payload = await sessionRes.json();
      setSession(payload);
      setRemaining(payload.remaining_seconds ?? 0);
      setTargetGapInput(payload.target_gap_seconds ?? 45);
      setOverlaySecondsInput(payload.default_intermission_seconds ?? 600);
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
      if (!session || session.status !== "running" || (session.current_call_index ?? 0) <= 0) return;
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [session]);

  const activeCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const nextPendingCall = useMemo(() => calls.find((call) => call.status === "pending") ?? null, [calls]);
  const callForControls = activeCall ?? nextPendingCall;

  const previousCalls = useMemo(
    () => calls.filter((call) => ["asked", "locked", "answer_revealed", "scored", "skipped"].includes(call.status)).slice(-6),
    [calls]
  );

  const transportCalls = useMemo<TransportCallRow[]>(
    () =>
      calls.map((call) => ({
        id: call.id,
        order_index: call.call_index,
        display_index: `#${call.call_index}`,
        title: call.title_answer?.trim() || "Untitled",
        artist: call.artist_answer?.trim() || "Unknown Artist",
        album: call.source_label?.trim() || null,
        status: call.status,
      })),
    [calls]
  );

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = { artist_correct: false, title_correct: false, awarded_points: "" };
    }
    setScoreDraft(draft);
  }, [callForControls?.id, leaderboard]);

  const patchSession = useCallback(
    async (patch: Record<string, unknown>) => {
      const res = await fetch(`/api/games/name-that-tune/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to update session");
      }
      await load();
    },
    [sessionId, load]
  );

  const patchCallMetadata = useCallback(
    async (callId: number, patch: Record<string, unknown>) => {
      const res = await fetch(`/api/games/name-that-tune/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...patch,
          metadata_locked: true,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to save snippet metadata");
      }
      await load();
    },
    [load]
  );

  const runAction = async (fn: () => Promise<void>) => {
    setWorking(true);
    try {
      await fn();
      await load();
    } finally {
      setWorking(false);
    }
  };

  const advance = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/name-that-tune/sessions/${sessionId}/advance`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to advance");
      }
    });
  };

  const pause = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/name-that-tune/sessions/${sessionId}/pause`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to pause");
      }
    });
  };

  const resume = async () => {
    await runAction(async () => {
      const res = await fetch(`/api/games/name-that-tune/sessions/${sessionId}/resume`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to resume");
      }
    });
  };

  const setOverlay = async (mode: "none" | "welcome" | "countdown" | "intermission", durationSeconds?: number) => {
    setOverlayBusy(true);
    try {
      const res = await fetch(`/api/games/name-that-tune/sessions/${sessionId}/overlay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, duration_seconds: durationSeconds ?? 0 }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to update overlay");
      }
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update overlay");
    } finally {
      setOverlayBusy(false);
    }
  };

  const toggleIntermission = async () => {
    if (!session) return;
    if (session.host_overlay === "intermission") {
      await setOverlay("none");
      if (session.status === "paused") await resume();
      return;
    }
    if (session.status === "running") await pause();
    await setOverlay("intermission", overlaySecondsInput);
  };

  const startGame = async () => {
    if (session?.status === "running") await pause();
    await setOverlay("countdown", 300);
  };

  const startRound = async () => {
    if (!session) return;
    if (session.host_overlay !== "none") await setOverlay("none");
    if (session.status === "paused") await resume();
    if ((session.current_call_index ?? 0) === 0) await advance();
  };

  const endGame = async () => {
    setAutoAdvanceEnabled(false);
    await patchSession({ status: "completed", ended_at: new Date().toISOString() });
    await setOverlay("none");
  };

  const patchCallStatus = async (status: "asked" | "locked" | "answer_revealed" | "scored" | "skipped") => {
    if (!callForControls) return;
    await runAction(async () => {
      const res = await fetch(`/api/games/name-that-tune/calls/${callForControls.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? `Failed to mark ${status}`);
      }
    });
  };

  const submitScores = async () => {
    if (!callForControls) return;
    setSaving(true);

    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? {
          artist_correct: false,
          title_correct: false,
          awarded_points: "",
        };
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: team.team_id,
          artist_correct: draft.artist_correct,
          title_correct: draft.title_correct,
          awarded_points: Number.isFinite(parsedPoints) && draft.awarded_points !== "" ? parsedPoints : undefined,
        };
      });

      const res = await fetch(`/api/games/name-that-tune/sessions/${sessionId}/score`, {
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

  useEffect(() => {
    if (!autoAdvanceEnabled || !session || session.status !== "running" || remaining > 0 || autoAdvanceLockRef.current) {
      return;
    }

    autoAdvanceLockRef.current = true;
    (async () => {
      try {
        await advance();
      } finally {
        autoAdvanceLockRef.current = false;
      }
    })();
  }, [autoAdvanceEnabled, session, remaining]);

  const saveTargetGap = async () => {
    const nextTarget = Math.max(0, Math.min(300, Number(targetGapInput) || 0));
    setSavingGap(true);
    try {
      await patchSession({ target_gap_seconds: nextTarget });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update target gap");
    } finally {
      setSavingGap(false);
    }
  };

  const searchSwapCandidates = useCallback(async () => {
    const query = swapQuery.trim();
    if (query.length < 2) {
      setSwapResults([]);
      return;
    }

    setSwapSearching(true);
    try {
      const url = new URL("/api/library/tracks/search", window.location.origin);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "12");

      const response = await fetch(url.toString(), { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as { results?: Array<Record<string, unknown>>; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Track search failed (${response.status})`);
      }

      const mapped = Array.isArray(payload.results)
        ? payload.results
            .map((row) => ({
              track_key: String(row.track_key ?? "").trim(),
              inventory_id: typeof row.inventory_id === "number" ? row.inventory_id : null,
              title: String(row.track_title ?? row.title ?? "").trim(),
              artist: String(row.track_artist ?? row.artist ?? "").trim(),
              album_title: typeof row.album_title === "string" ? row.album_title : null,
              side: typeof row.side === "string" ? row.side : null,
              position: typeof row.position === "string" ? row.position : null,
              score: typeof row.score === "number" ? row.score : 0,
            }))
            .filter((row) => row.track_key.length > 0)
        : [];

      setSwapResults(mapped);
    } catch (error) {
      setSwapMessage(error instanceof Error ? error.message : "Track search failed");
      setSwapResults([]);
    } finally {
      setSwapSearching(false);
    }
  }, [swapQuery]);

  const runSessionSwap = useCallback(async (candidate: InventorySearchCandidate) => {
    if (!swapTargetCall?.playlist_track_key) return;

    setSwapApplyingTrackKey(candidate.track_key);
    setSwapMessage(null);
    try {
      const response = await fetch(`/api/games/name-that-tune/sessions/${sessionId}/swap-track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromTrackKey: swapTargetCall.playlist_track_key,
          toTrackKey: candidate.track_key,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        counts?: { updated_session_calls?: number };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? `Swap failed (${response.status})`);
      }

      const callsUpdated = payload.counts?.updated_session_calls ?? 0;
      setSwapMessage(`Swap complete. Calls updated: ${callsUpdated}.`);
      setSwapTargetCall(null);
      setSwapQuery("");
      setSwapResults([]);
      await load();
    } catch (error) {
      setSwapMessage(error instanceof Error ? error.message : "Swap failed");
    } finally {
      setSwapApplyingTrackKey(null);
    }
  }, [load, sessionId, swapTargetCall]);

  const openWindow = useCallback((url: string, name: string, features: string) => {
    const opened = window.open(url, name, features);
    if (opened) {
      opened.focus();
    } else {
      window.open(url, "_blank");
    }
  }, []);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0c0c0c,#1b1b1b)] p-5 text-stone-100">
      <div className="mx-auto max-w-[1600px] space-y-3">
        <header className="rounded-2xl border border-red-900/40 bg-black/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black uppercase">Name That Tune Host</h1>
              <p className="text-sm text-stone-400">
                {session?.title} · {session?.session_code} · Round {session?.current_round} of {session?.round_count}
              </p>
            </div>
            <span className="rounded border border-stone-700 px-2 py-1 text-xs text-stone-400 capitalize">
              {session?.status ?? "-"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              className="rounded border border-stone-700 px-2 py-1"
              onClick={() =>
                openWindow(
                  `/admin/games/name-that-tune/assistant?sessionId=${sessionId}`,
                  "name_that_tune_assistant",
                  "width=1024,height=800,left=1300,top=0"
                )
              }
            >
              Assistant
            </button>
            <button
              type="button"
              className="rounded border border-stone-700 px-2 py-1"
              onClick={() =>
                openWindow(
                  `/admin/games/name-that-tune/jumbotron?sessionId=${sessionId}`,
                  "name_that_tune_jumbotron",
                  "width=1920,height=1080,noopener,noreferrer"
                )
              }
            >
              Jumbotron
            </button>
            <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/name-that-tune">Setup</Link>
            <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games">Main</Link>
          </div>
        </header>

        <section className="rounded-2xl border border-stone-700 bg-black/45 p-3">
          <div className="grid gap-3 lg:grid-cols-[1fr,1fr,0.9fr] text-xs">
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <button disabled={overlayBusy || working} onClick={() => setOverlay("welcome")} className="rounded border border-violet-700 bg-violet-900/25 px-3 py-1 font-bold text-violet-300 disabled:opacity-50">Welcome</button>
                <button disabled={overlayBusy || working} onClick={toggleIntermission} className="rounded border border-amber-700 bg-amber-900/25 px-3 py-1 font-bold text-amber-300 disabled:opacity-50">Intermission</button>
                <button disabled={working} onClick={endGame} className="rounded border border-red-700 px-3 py-1 text-red-300 disabled:opacity-50">End Game</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={overlayBusy || working} onClick={startGame} className="rounded border border-sky-700 bg-sky-900/35 px-3 py-1 font-bold text-sky-200 disabled:opacity-50">Start Game</button>
                <button disabled={working} onClick={startRound} className="rounded border border-emerald-700 bg-emerald-900/35 px-3 py-1 font-bold text-emerald-200 disabled:opacity-50">Start Round</button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-stone-400">Overlay: {session?.host_overlay ?? "none"}</p>
              <p className="text-stone-400">
                Overlay Remaining: {(session?.host_overlay === "countdown" || session?.host_overlay === "intermission") ? `${session?.host_overlay_remaining_seconds ?? 0}s` : "-"}
              </p>
              <p className="text-stone-400">Timer Remaining: {remaining}s</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1 text-stone-300">
                  Intermission
                  <input
                    type="number"
                    min={30}
                    max={3600}
                    className="w-20 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                    value={overlaySecondsInput}
                    onChange={(e) => setOverlaySecondsInput(Math.max(30, Number(e.target.value) || 30))}
                  />
                  sec
                </label>
                <button disabled={overlayBusy || working} onClick={() => setOverlay("none")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Clear Overlay</button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1 text-stone-300">
                  Next Gap
                  <input
                    type="number"
                    min={0}
                    max={300}
                    className="w-20 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                    value={targetGapInput}
                    onChange={(e) => setTargetGapInput(Number(e.target.value) || 0)}
                  />
                  sec
                </label>
                <button disabled={savingGap || working} onClick={saveTargetGap} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">{savingGap ? "Saving..." : "Save Gap"}</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={working} onClick={session?.status === "paused" ? resume : pause} className="rounded border border-amber-700 px-2 py-1 text-amber-300 disabled:opacity-50">{session?.status === "paused" ? "Resume" : "Pause"}</button>
                <button disabled={working} onClick={() => setAutoAdvanceEnabled((value) => !value)} className={`rounded border px-2 py-1 disabled:opacity-50 ${autoAdvanceEnabled ? "border-emerald-600 text-emerald-300" : "border-stone-600"}`}>Auto-Call {autoAdvanceEnabled ? "On" : "Off"}</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("asked")} className="rounded bg-blue-700 px-2 py-1 disabled:opacity-50">Mark Asked</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("locked")} className="rounded bg-violet-700 px-2 py-1 disabled:opacity-50">Lock</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("answer_revealed")} className="rounded bg-amber-700 px-2 py-1 disabled:opacity-50">Reveal</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("skipped")} className="rounded bg-red-700 px-2 py-1 disabled:opacity-50">Skip</button>
                <button disabled={working || !callForControls} onClick={() => patchCallStatus("scored")} className="rounded border border-stone-600 px-2 py-1 disabled:opacity-50">Mark Scored</button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-rose-200">Call Order (Game Playlist)</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Artist</th>
                    <th className="pb-2">Title</th>
                    <th className="pb-2">Source</th>
                    <th className="pb-2">Snippet</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 font-bold text-rose-300">{call.call_index}</td>
                      <td className="py-2">{call.round_number}</td>
                      <td className="py-1">
                        <InlineEditableCell
                          onSave={(nextValue) => patchCallMetadata(call.id, { artist_answer: nextValue })}
                          value={call.artist_answer}
                        />
                      </td>
                      <td className="py-1">
                        <InlineEditableCell
                          onSave={(nextValue) => patchCallMetadata(call.id, { title_answer: nextValue })}
                          value={call.title_answer}
                        />
                      </td>
                      <td className="py-1">
                        <InlineEditableCell
                          onSave={(nextValue) => patchCallMetadata(call.id, { source_label: nextValue || null })}
                          value={call.source_label ?? ""}
                        />
                      </td>
                      <td className="py-2">{call.snippet_duration_seconds}s</td>
                      <td className="py-2 text-stone-400">{call.status}</td>
                      <td className="py-2">
                        <button
                          disabled={!call.playlist_track_key}
                          onClick={() => {
                            setSwapTargetCall(call);
                            setSwapQuery("");
                            setSwapResults([]);
                            setSwapMessage(null);
                          }}
                          className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                            call.playlist_track_key
                              ? "border-cyan-700/70 bg-cyan-950/30 text-cyan-200 hover:bg-cyan-900/45"
                              : "cursor-not-allowed border-stone-800 bg-stone-900 text-stone-500"
                          }`}
                        >
                          Swap
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {swapMessage ? <p className="mt-2 text-xs text-cyan-200">{swapMessage}</p> : null}
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-rose-200">Current Snippet</h2>
              <div className="mt-3 rounded border border-rose-700/40 bg-rose-950/20 p-3">
                <p className="text-xs uppercase text-rose-300">
                  {callForControls ? `Snippet ${callForControls.call_index} · Round ${callForControls.round_number}` : "Waiting"}
                </p>
                <p className="mt-1 text-lg font-black">
                  {(callForControls?.status === "answer_revealed" || callForControls?.status === "scored")
                    ? `${callForControls.artist_answer} - ${callForControls.title_answer}`
                    : "Answer hidden until reveal"}
                </p>
                <p className="mt-2 text-sm text-stone-300">
                  Source: {callForControls?.source_label ?? "Unlabeled"} · Snippet: {callForControls?.snippet_duration_seconds ?? 0}s · Lock rule: {session?.lock_in_rule ?? "-"} ({session?.lock_in_window_seconds ?? 0}s)
                </p>
              </div>

              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Recently Played</p>
                <div className="mt-1 max-h-24 overflow-auto text-stone-400">
                  {previousCalls.map((call) => (
                    <div key={call.id}>#{call.call_index} {call.artist_answer} - {call.title_answer} ({call.status})</div>
                  ))}
                </div>
              </div>
            </div>

            <GameTransportLane
              gameSlug="name-that-tune"
              sessionId={sessionId}
              calls={transportCalls}
              currentOrderIndex={session?.current_call_index ?? 0}
              transportQueueCallIds={session?.transport_queue_call_ids ?? []}
              doneStatuses={["asked", "locked", "answer_revealed", "scored", "skipped"]}
              onChanged={load}
              accent="host"
              maxRows={6}
            />

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <p className="text-xs uppercase text-rose-300">Score Entry</p>
              <div className="mt-2 space-y-2 text-xs">
                {leaderboard.map((team) => {
                  const draft = scoreDraft[team.team_id] ?? {
                    artist_correct: false,
                    title_correct: false,
                    awarded_points: "",
                  };
                  const suggestedPoints = getDefaultPoints(draft.artist_correct, draft.title_correct);

                  return (
                    <div key={team.team_id} className="grid grid-cols-[1.1fr,auto,auto,100px] items-center gap-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                      <div>
                        <p className="font-semibold">{team.team_name}</p>
                        <p className="text-[11px] text-stone-400">Total: {team.total_points} · Perfect: {team.perfect_calls}</p>
                      </div>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={draft.artist_correct}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? { title_correct: false, awarded_points: "" }),
                                artist_correct: e.target.checked,
                              },
                            }))
                          }
                        />
                        Artist
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={draft.title_correct}
                          onChange={(e) =>
                            setScoreDraft((current) => ({
                              ...current,
                              [team.team_id]: {
                                ...(current[team.team_id] ?? { artist_correct: false, awarded_points: "" }),
                                title_correct: e.target.checked,
                              },
                            }))
                          }
                        />
                        Title
                      </label>
                      <input
                        className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                        placeholder={`Auto ${suggestedPoints}`}
                        value={draft.awarded_points}
                        onChange={(e) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [team.team_id]: {
                              ...(current[team.team_id] ?? { artist_correct: false, title_correct: false }),
                              awarded_points: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  );
                })}
                {leaderboard.length === 0 ? <p className="text-stone-500">No teams found.</p> : null}
              </div>
              <button disabled={!callForControls || saving} onClick={submitScores} className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold disabled:opacity-50">
                {saving ? "Saving..." : "Save Scores for Current Snippet"}
              </button>
            </div>
          </section>
        </div>
      </div>

      {swapTargetCall ? (
        <div className="fixed inset-0 z-[5000] bg-black/70 p-4" onClick={() => setSwapTargetCall(null)}>
          <div
            className="mx-auto mt-10 w-full max-w-3xl rounded-2xl border border-cyan-900/60 bg-[#0a121d] p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Swap Track</p>
                <p className="mt-1 text-sm text-stone-200">
                  Replacing: <span className="font-semibold">{swapTargetCall.title_answer}</span> - {swapTargetCall.artist_answer}
                </p>
              </div>
              <button
                onClick={() => setSwapTargetCall(null)}
                className="rounded border border-stone-700 px-2 py-1 text-xs text-stone-300 hover:bg-stone-900"
              >
                Close
              </button>
            </div>

            <div className="flex gap-2">
              <input
                value={swapQuery}
                onChange={(event) => setSwapQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchSwapCandidates();
                  }
                }}
                placeholder="Search replacement track by title / artist"
                className="w-full rounded border border-cyan-900/60 bg-[#0d1a2b] px-3 py-2 text-sm text-white"
              />
              <button
                onClick={() => void searchSwapCandidates()}
                disabled={swapSearching}
                className={`rounded px-3 py-2 text-xs font-semibold ${
                  swapSearching ? "bg-stone-700 text-stone-300" : "bg-cyan-800 text-white hover:bg-cyan-700"
                }`}
              >
                {swapSearching ? "Searching..." : "Search"}
              </button>
            </div>

            <div className="mt-3 max-h-[420px] overflow-y-auto rounded border border-cyan-950/60">
              {swapResults.length === 0 ? (
                <div className="px-3 py-6 text-xs text-stone-400">No results yet. Search to find a replacement track.</div>
              ) : (
                <div className="divide-y divide-cyan-950/40">
                  {swapResults.map((row) => (
                    <div key={row.track_key} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-stone-100">{row.title} - {row.artist}</p>
                        <p className="truncate text-[11px] text-stone-400">
                          {row.album_title ?? "Unknown Album"}
                          {row.position ? ` · ${row.position}` : ""}
                          {row.inventory_id ? ` · #${row.inventory_id}` : ""}
                        </p>
                      </div>
                      <button
                        disabled={swapApplyingTrackKey === row.track_key || row.track_key === swapTargetCall.playlist_track_key}
                        onClick={() => void runSessionSwap(row)}
                        className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${
                          swapApplyingTrackKey === row.track_key || row.track_key === swapTargetCall.playlist_track_key
                            ? "bg-stone-700 text-stone-300"
                            : "bg-emerald-700 text-white hover:bg-emerald-600"
                        }`}
                      >
                        {swapApplyingTrackKey === row.track_key ? "Applying..." : row.track_key === swapTargetCall.playlist_track_key ? "Current" : "Swap To This"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
