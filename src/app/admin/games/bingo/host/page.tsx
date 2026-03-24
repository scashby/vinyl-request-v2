"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatBallLabel, getBingoColumnTextClass } from "src/lib/bingoBall";
import type { GameMode } from "src/lib/bingoEngine";
import { GAME_MODE_OPTIONS, getModesForRound, normalizeRoundModes } from "src/lib/bingoModes";
import InlineEditableCell from "../../_components/InlineEditableCell";
import BingoTransportLane, { type BingoTransportCall } from "../_components/BingoTransportLane";

type Session = {
  id: number;
  session_code: string;
  playlist_name: string;
  game_mode: GameMode;
  round_modes: { round: number; modes: GameMode[] }[] | null;
  next_game_rules_text: string | null;
  current_call_index: number;
  current_round: number;
  round_count: number;
  status: string;
  transport_queue_call_ids?: number[];
  seconds_to_next_call: number;
  call_reveal_delay_seconds: number;
  next_game_scheduled_at: string | null;
  bingo_overlay: string;
};

type Call = BingoTransportCall & {
  metadata_locked?: boolean;
  side?: string | null;
  position?: string | null;
};

export default function BingoHostPage() {
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("sessionId"));

  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [revealDelayInput, setRevealDelayInput] = useState<number>(5);
  const [intermissionLengthSeconds, setIntermissionLengthSeconds] = useState<number>(180);
  const [secondsToNextCallInput, setSecondsToNextCallInput] = useState<number>(0);
  const [autoCallEnabled, setAutoCallEnabled] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);
  const [savingOverlay, setSavingOverlay] = useState(false);
  const currentCallRowRef = useRef<HTMLTableRowElement>(null);
  const autoCallLockRef = useRef(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/games/bingo/sessions/${sessionId}`, { cache: 'no-store' }),
      fetch(`/api/games/bingo/sessions/${sessionId}/calls`, { cache: 'no-store' }),
    ]);

    if (sRes.ok) {
      const payload = await sRes.json();
      setSession(payload);
      setRevealDelayInput(payload.call_reveal_delay_seconds ?? 5);
      setSecondsToNextCallInput(payload.seconds_to_next_call ?? 0);
      setRemaining(payload.seconds_to_next_call ?? 0);
    }

    if (cRes.ok) {
      const payload = await cRes.json();
      setCalls(payload.data ?? []);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 3500);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (!session || session.status === "paused" || session.status === "completed") return;
      setRemaining((v) => Math.max(0, v - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [session]);

  const currentCall = useMemo(() => {
    const byCurrentIndex = calls.find(
      (call) => call.call_index === (session?.current_call_index ?? 0) && call.status === "called"
    );
    if (byCurrentIndex) return byCurrentIndex;
    return [...calls].reverse().find((call) => call.status === "called") ?? null;
  }, [calls, session?.current_call_index]);

  const activeRoundModes = useMemo(() => {
    if (!session) return [] as GameMode[];
    return getModesForRound(session.round_modes ?? [], session.current_round, session.game_mode);
  }, [session]);

  useEffect(() => {
    currentCallRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentCall?.id]);

  useEffect(() => {
    if (!autoCallEnabled || !session || session.status !== "running" || remaining > 0 || autoCallLockRef.current) return;

    autoCallLockRef.current = true;
    (async () => {
      try {
        const response = await fetch(`/api/games/bingo/sessions/${sessionId}/advance`, { method: "POST" });
        if (!response.ok) {
          if (response.status === 409) setAutoCallEnabled(false);
          return;
        }
        await load();
      } finally {
        autoCallLockRef.current = false;
      }
    })();
  }, [autoCallEnabled, remaining, session, sessionId, load]);

  const openWindow = useCallback((url: string, name: string, features: string) => {
    const opened = window.open(url, name, features);
    if (opened) {
      opened.focus();
    } else {
      // Fallback for stricter popup policies
      window.open(url, "_blank");
    }
  }, []);

  const patchSession = useCallback(
    async (patch: Record<string, unknown>) => {
      await fetch(`/api/games/bingo/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await load();
    },
    [sessionId, load]
  );

  const pause = async () => {
    await fetch(`/api/games/bingo/sessions/${sessionId}/pause`, { method: "POST" });
    load();
  };

  const resume = async () => {
    await fetch(`/api/games/bingo/sessions/${sessionId}/resume`, { method: "POST" });
    await patchSession({ bingo_overlay: "none" });
    load();
  };

  const startGame = async () => {
    await patchSession({ bingo_overlay: "welcome" });
  };

  const startRound = async () => {
    if (!session) return;

    const activateResponse = await fetch(`/api/games/bingo/sessions/${sessionId}/activate-round`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        round: 1,
        intermission_seconds: 0,
      }),
    });

    if (!activateResponse.ok) {
      const payload = (await activateResponse.json().catch(() => null)) as { error?: string } | null;
      alert(payload?.error ?? "Failed to start round 1");
      return;
    }

    await fetch(`/api/games/bingo/sessions/${sessionId}/resume`, { method: "POST" });
    setAutoCallEnabled(false);
    autoCallLockRef.current = false;
    await patchSession({ bingo_overlay: "none", next_game_scheduled_at: null });
    await load();
  };

  const setModeForActiveRound = async (mode: GameMode) => {
    if (!session) return;
    const hasMode = activeRoundModes.includes(mode);
    const nextModes = hasMode
      ? activeRoundModes.filter((value) => value !== mode)
      : [...activeRoundModes, mode];

    const existing = normalizeRoundModes(session.round_modes, session.round_count);
    const withoutCurrentRound = existing.filter((entry) => entry.round !== session.current_round);
    const nextRoundModes = nextModes.length > 0
      ? [...withoutCurrentRound, { round: session.current_round, modes: nextModes }].sort((a, b) => a.round - b.round)
      : withoutCurrentRound;

    await patchSession({ round_modes: nextRoundModes });
  };

  const resetRound = async () => {
    if (!session) return;

    const confirmed = window.confirm(`Reset round ${session.current_round} to the beginning? Calls from this round will be cleared and the round will restart.`);
    if (!confirmed) return;

    const activateResponse = await fetch(`/api/games/bingo/sessions/${sessionId}/activate-round`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        round: Math.max(1, session.current_round || 1),
        intermission_seconds: 0,
      }),
    });

    if (!activateResponse.ok) {
      const payload = (await activateResponse.json().catch(() => null)) as { error?: string } | null;
      alert(payload?.error ?? "Failed to reset round");
      return;
    }

    await fetch(`/api/games/bingo/sessions/${sessionId}/resume`, { method: "POST" });
    setAutoCallEnabled(false);
    autoCallLockRef.current = false;
    setRevealDelayInput(5);
    setSecondsToNextCallInput(0);
    setRemaining(0);
    setResetCounter((v) => v + 1);
    await patchSession({ bingo_overlay: "none", next_game_scheduled_at: null });
    await load();
  };

  const resetGame = async () => {
    const confirmed = window.confirm("Reset this game to a fresh start? All calls will be cleared and the session will return to the welcome screen.");
    if (!confirmed) return;
    setAutoCallEnabled(false);
    autoCallLockRef.current = false;
    const resetResponse = await fetch(`/api/games/bingo/sessions/${sessionId}/reset`, { method: "POST" });
    if (!resetResponse.ok) {
      const payload = (await resetResponse.json().catch(() => null)) as { error?: string } | null;
      alert(payload?.error ?? "Failed to reset game");
      return;
    }
    setRevealDelayInput(5);
    setSecondsToNextCallInput(0);
    setRemaining(0);
    setResetCounter((v) => v + 1);
    await load();
  };

  const saveSecondsToNextCall = async () => {
    const updatedSeconds = Math.max(0, Math.min(300, secondsToNextCallInput));
    setSecondsToNextCallInput(updatedSeconds);
    setRemaining(updatedSeconds);

    await patchSession({
      seconds_to_next_call: updatedSeconds,
      countdown_started_at: new Date().toISOString(),
      paused_remaining_seconds: session?.status === "paused" ? updatedSeconds : null,
    });
  };

  const saveRevealDelay = async () => {
    const updatedDelay = Math.max(0, Math.min(300, revealDelayInput));
    setRevealDelayInput(updatedDelay);
    await patchSession({ call_reveal_delay_seconds: updatedDelay });
  };

  const nextRound = async () => {
    if (!session) return;
    const nextRoundValue = Math.min(session.round_count, session.current_round + 1);
    if (nextRoundValue === session.current_round) {
      alert("Already on the final round.");
      return;
    }
    const response = await fetch(`/api/games/bingo/sessions/${sessionId}/activate-round`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        round: nextRoundValue,
        intermission_seconds: Math.max(0, intermissionLengthSeconds),
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      alert(payload?.error ?? "Failed to activate next round");
      return;
    }
    setAutoCallEnabled(false);
    await patchSession({ bingo_overlay: "none" });
    await load();
  };

  const endGame = async () => {
    await patchSession({ status: "completed", ended_at: new Date().toISOString(), bingo_overlay: "thanks" });
    setAutoCallEnabled(false);
    await load();
  };

  const setOverlay = async (overlay: "none" | "pending" | "winner") => {
    setSavingOverlay(true);
    if ((overlay === "pending" || overlay === "winner") && session?.status === "running") {
      setAutoCallEnabled(false);
      autoCallLockRef.current = false;
      await fetch(`/api/games/bingo/sessions/${sessionId}/pause`, { method: "POST" });
    }
    await patchSession({ bingo_overlay: overlay });
    setSavingOverlay(false);
  };

  const patchCallMetadata = useCallback(
    async (callId: number, patch: Record<string, unknown>) => {
      const response = await fetch(`/api/games/bingo/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...patch,
          metadata_locked: true,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to save call metadata");
      }
      await load();
    },
    [load]
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0c0c0c,#1b1b1b)] p-5 text-stone-100">
      <div className="mx-auto max-w-[1600px] space-y-3">
        <header className="rounded-2xl border border-red-900/40 bg-black/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black uppercase">Music Bingo Host</h1>
              <p className="text-sm text-stone-400">{session?.playlist_name} · {session?.session_code}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded border border-stone-700 bg-black/40 px-3 py-2 text-right">
                <p className="text-[11px] uppercase tracking-[0.15em] text-stone-400">Time Until Next Call</p>
                <p
                  className={`text-4xl font-black leading-none tabular-nums ${
                    remaining < 0 || remaining <= 10 ? "text-red-400" : remaining <= 20 ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {remaining}s
                </p>
              </div>
              <span className="rounded border border-stone-700 px-2 py-1 text-xs text-stone-400 capitalize">
                {session?.status ?? "—"}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button
              className="rounded border border-stone-600 px-2 py-1"
              onClick={() => openWindow(`/admin/games/bingo/assistant?sessionId=${sessionId}`, "bingo_assistant", "width=1024,height=800,left=1300,top=0")}
            >
              Assistant
            </button>
            <button
              className="rounded border border-stone-600 px-2 py-1"
              onClick={() => openWindow(`/admin/games/bingo/jumbotron?sessionId=${sessionId}`, "bingo_jumbotron", "width=1920,height=1080,noopener,noreferrer")}
            >
              Jumbotron
            </button>
            <button
              className="rounded border border-stone-600 px-2 py-1"
              onClick={() => window.open("/admin/games/bingo", "_blank", "noopener,noreferrer")}
            >
              Setup
            </button>
            <button className="rounded border border-stone-600 px-2 py-1" onClick={() => (window.location.href = "/admin/games")}>
              Main
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-stone-700 bg-black/45 p-3">
          <div className="grid grid-cols-3 gap-3">
            {/* Left column: Game controls (top), round controls (bottom) */}
            <div className="space-y-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={startGame} className="rounded border border-violet-700 bg-violet-900/35 px-3 py-1 font-bold text-violet-200 hover:bg-violet-900/55">Start Game</button>
                <button onClick={resetGame} className="rounded border border-amber-700 bg-amber-900/40 px-3 py-1 text-amber-100 hover:bg-amber-900/60">Reset Game</button>
                <button onClick={endGame} className="rounded border border-red-700 px-3 py-1 text-red-300 hover:bg-red-900/20">End Game</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={startRound} className="rounded border border-emerald-700 bg-emerald-900/35 px-3 py-1 font-bold text-emerald-200 hover:bg-emerald-900/55">Start Round</button>
                <button onClick={resetRound} className="rounded border border-red-700 bg-red-900/40 px-3 py-1 text-red-100 hover:bg-red-900/60">Reset Round</button>
                <button onClick={nextRound} className="rounded border border-sky-700 px-3 py-1 text-sky-300 hover:bg-sky-900/20">End Round</button>
              </div>
            </div>

            {/* Middle column: Overlay + timing controls */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <button
                onClick={() => {
                  setOverlay("pending");
                }}
                disabled={savingOverlay}
                className="rounded border border-yellow-700 bg-yellow-900/30 px-3 py-1 font-bold text-yellow-200 hover:bg-yellow-900/60 disabled:opacity-50"
              >
                Bingo Pending
              </button>
              <button
                onClick={() => {
                  setOverlay("winner");
                }}
                disabled={savingOverlay}
                className="rounded border border-emerald-700 bg-emerald-900/30 px-3 py-1 font-bold text-emerald-200 hover:bg-emerald-900/60 disabled:opacity-50"
              >
                Bingo Winner!
              </button>
              <div className="flex items-center gap-1">
                <label className="text-stone-400 whitespace-nowrap">Reveal Delay (sec)</label>
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={revealDelayInput}
                  onChange={(e) => setRevealDelayInput(Math.max(0, Math.min(300, Number(e.target.value) || 0)))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      saveRevealDelay();
                    }
                  }}
                  className="w-14 rounded border border-stone-700 bg-stone-950 px-2 py-1 text-center"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-stone-400 whitespace-nowrap">Intermission (sec)</label>
                <input
                  type="number"
                  min={0}
                  value={intermissionLengthSeconds}
                  onChange={(e) => setIntermissionLengthSeconds(Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 rounded border border-stone-700 bg-stone-950 px-2 py-1 text-center"
                />
              </div>
              {session ? (
                <div className="w-full rounded border border-stone-700/80 bg-stone-950/40 p-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-stone-400">Round {session.current_round} win modes (any mode wins)</p>
                  <div className="mt-1 flex flex-wrap justify-center gap-2">
                    {GAME_MODE_OPTIONS.map((mode) => {
                      const selected = activeRoundModes.includes(mode.value);
                      return (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => setModeForActiveRound(mode.value)}
                          className={`rounded border px-2 py-1 text-[11px] ${selected ? "border-amber-500 bg-amber-900/30 text-amber-100" : "border-stone-700 text-stone-300 hover:border-stone-500"}`}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Right column: Next Call (sec) on top, Pause/Resume below */}
            <div className="ml-auto space-y-2 text-xs">
              <div className="flex items-center justify-end gap-2">
                <label className="text-stone-400 whitespace-nowrap">Next Call (sec)</label>
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={secondsToNextCallInput}
                  onChange={(e) => setSecondsToNextCallInput(Math.max(0, Math.min(300, Number(e.target.value) || 0)))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      saveSecondsToNextCall();
                    }
                  }}
                  className="w-16 rounded border border-stone-700 bg-stone-950 px-2 py-1 text-center"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={pause} className="rounded border border-stone-600 px-2 py-1 hover:border-stone-400">Pause</button>
                <button onClick={resume} className="rounded border border-stone-600 px-2 py-1 hover:border-stone-400">Resume</button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-[1.55fr,1fr]">
          <section className="flex h-[68vh] flex-col rounded-2xl border border-stone-700 bg-black/50 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">Crate (Call Order)</h2>
            <div className="mt-3 flex-1 overflow-x-auto overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[#111]">
                  <tr className="text-stone-300">
                    <th className="pb-2 pr-2">Draw</th>
                    <th className="pb-2 pr-2">Call</th>
                    <th className="pb-2 pr-2">Track</th>
                    <th className="pb-2 pr-2">Artist</th>
                    <th className="pb-2">Album</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => {
                    const ballLabel = formatBallLabel(call.ball_number, call.column_letter);
                    const ballToneClass = getBingoColumnTextClass(call.column_letter, call.ball_number);
                    const isCurrent = call.id === currentCall?.id;
                    const isDone = call.status === "completed" || call.status === "skipped";

                    return (
                      <tr
                        key={call.id}
                        ref={isCurrent ? currentCallRowRef : undefined}
                        className={`border-t border-stone-800 align-top transition-colors ${
                          isCurrent
                            ? "bg-amber-900/30 ring-1 ring-inset ring-amber-500/60"
                            : isDone
                            ? "opacity-40"
                            : ""
                        }`}
                      >
                        <td className="py-2 pr-2 text-stone-400">{call.call_index}</td>
                        <td className={`py-2 pr-2 font-bold ${ballToneClass} ${isDone ? "line-through" : ""}`}>{ballLabel}</td>
                        <td className="py-1 pr-2">
                          <InlineEditableCell
                            onSave={(nextValue) => patchCallMetadata(call.id, { track_title: nextValue })}
                            value={call.track_title}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <InlineEditableCell
                            onSave={(nextValue) => patchCallMetadata(call.id, { artist_name: nextValue })}
                            value={call.artist_name}
                          />
                        </td>
                        <td className="py-1 text-stone-400">
                          <InlineEditableCell
                            onSave={(nextValue) => patchCallMetadata(call.id, { album_name: nextValue || null })}
                            value={call.album_name ?? ""}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <BingoTransportLane
            key={`transport-lane-${resetCounter}`}
            sessionId={sessionId}
            calls={calls}
            currentCallIndex={session?.current_call_index ?? 0}
            transportQueueCallIds={session?.transport_queue_call_ids ?? []}
            onChanged={load}
            accent="host"
            maxRows={7}
            className="h-[68vh]"
            callsContainerClassName="max-h-[58vh] overflow-y-auto pr-1"
            headerRight={
              <div className="flex items-center gap-2 rounded border border-stone-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-stone-300">
                <span>Auto-Call</span>
                <button
                  onClick={() => setAutoCallEnabled((value) => !value)}
                  className={`rounded px-2 py-0.5 font-black ${autoCallEnabled ? "bg-emerald-600 text-black" : "bg-stone-700 text-stone-200"}`}
                >
                  {autoCallEnabled ? "On" : "Off"}
                </button>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
