"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatBallLabel, getBingoColumnTextClass } from "src/lib/bingoBall";
import type { GameMode } from "src/lib/bingoEngine";
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
  default_intermission_seconds: number;
  active_crate_letter_by_round: { round: number; letter: string }[] | null;
};

type BingoCrate = {
  id: number;
  session_id: number;
  round_number: number;
  crate_name: string;
  crate_letter: string;
  created_at: string;
};

type Call = BingoTransportCall & {
  metadata_locked?: boolean;
  side?: string | null;
  position?: string | null;
};

type CardValidationResponse = {
  card_identifier: string;
  is_winner: boolean;
  active_modes: GameMode[];
  winning_patterns: Array<{ mode: GameMode; label: string }>;
  mistakes: Array<{ mode: GameMode; message: string; missing_cells: Array<{ label: string }> }>;
  expected_free_square_count: number;
  actual_free_square_count: number;
  marked_square_count: number;
  playable_square_count: number;
};

export default function BingoHostPage() {
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("sessionId"));

  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [crates, setCrates] = useState<BingoCrate[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [revealDelayInput, setRevealDelayInput] = useState<number>(10);
  // Stored as minutes for display; converted to seconds for persistence
  const [intermissionLengthMinutes, setIntermissionLengthMinutes] = useState<number>(10);
  const [secondsToNextCallInput, setSecondsToNextCallInput] = useState<number>(0);
  const [autoCallEnabled, setAutoCallEnabled] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);
  const [savingOverlay, setSavingOverlay] = useState(false);
  const [switchingCrate, setSwitchingCrate] = useState(false);
  const [winnerCheckInput, setWinnerCheckInput] = useState("");
  const [winnerCheckResult, setWinnerCheckResult] = useState<CardValidationResponse | null>(null);
  const [winnerCheckError, setWinnerCheckError] = useState<string | null>(null);
  const [checkingWinner, setCheckingWinner] = useState(false);
  const currentCallRowRef = useRef<HTMLTableRowElement>(null);
  const autoCallLockRef = useRef(false);
  const revealDelayEditingRef = useRef(false);
  const intermissionEditingRef = useRef(false);
  const START_GAME_COUNTDOWN_SECONDS = 300;

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    const [sRes, cRes, cratesRes] = await Promise.all([
      fetch(`/api/games/bingo/sessions/${sessionId}`, { cache: 'no-store' }),
      fetch(`/api/games/bingo/sessions/${sessionId}/calls`, { cache: 'no-store' }),
      fetch(`/api/games/bingo/sessions/${sessionId}/crates`, { cache: 'no-store' }),
    ]);

    if (sRes.ok) {
      const payload = await sRes.json();
      setSession(payload);
      if (!revealDelayEditingRef.current) {
        setRevealDelayInput(payload.call_reveal_delay_seconds ?? 10);
      }
      setSecondsToNextCallInput(payload.seconds_to_next_call ?? 0);
      setRemaining(payload.seconds_to_next_call ?? 0);
      if (!intermissionEditingRef.current) {
        // Convert stored seconds to minutes for display
        setIntermissionLengthMinutes(Math.round((payload.default_intermission_seconds ?? 600) / 60));
      }
    }

    if (cRes.ok) {
      const payload = await cRes.json();
      setCalls(payload.data ?? []);
    }

    if (cratesRes.ok) {
      const payload = await cratesRes.json();
      setCrates(payload.data ?? []);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 3500);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (!session || session.status !== "running" || (session.current_call_index ?? 0) <= 0) return;
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

  const toggleWelcome = async () => {
    const next = session?.bingo_overlay === "welcome" ? "none" : "welcome";
    await patchSession({ bingo_overlay: next });
  };

  const startGame = async () => {
    const startsAt = new Date(Date.now() + START_GAME_COUNTDOWN_SECONDS * 1000).toISOString();
    await patchSession({ bingo_overlay: "countdown", next_game_scheduled_at: startsAt });
  };

  const startRound = async () => {
    if (!session) return;
    const resumeResponse = await fetch(`/api/games/bingo/sessions/${sessionId}/resume`, { method: "POST" });
    if (!resumeResponse.ok) {
      const payload = (await resumeResponse.json().catch(() => null)) as { error?: string } | null;
      alert(payload?.error ?? `Failed to start round ${session.current_round}`);
      return;
    }

    setAutoCallEnabled(false);
    autoCallLockRef.current = false;
    await patchSession({ bingo_overlay: "none", next_game_scheduled_at: null });
    await fetch(`/api/games/bingo/sessions/${sessionId}/advance`, { method: "POST" });
    await load();
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
    setRevealDelayInput(10);
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
    setRevealDelayInput(10);
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
    revealDelayEditingRef.current = false;
    await patchSession({ call_reveal_delay_seconds: updatedDelay });
  };

  const saveIntermissionMinutes = async () => {
    const updatedMinutes = Math.max(0, Math.floor(intermissionLengthMinutes));
    setIntermissionLengthMinutes(updatedMinutes);
    intermissionEditingRef.current = false;
    await patchSession({ default_intermission_seconds: updatedMinutes * 60 });
  };

  const endGame = async () => {
    await patchSession({ status: "completed", ended_at: new Date().toISOString(), bingo_overlay: "thanks" });
    setAutoCallEnabled(false);
    await load();
  };

  const setOverlay = async (overlay: "none" | "pending" | "winner" | "tiebreaker") => {
    setSavingOverlay(true);
    if ((overlay === "pending" || overlay === "winner") && session?.status === "running") {
      setAutoCallEnabled(false);
      autoCallLockRef.current = false;
      await fetch(`/api/games/bingo/sessions/${sessionId}/pause`, { method: "POST" });
    }
    await patchSession({ bingo_overlay: overlay });
    setSavingOverlay(false);
  };

  const toggleTie = async () => {
    if (!session) return;

    setSavingOverlay(true);
    try {
      if (session.bingo_overlay === "tiebreaker") {
        await fetch(`/api/games/bingo/sessions/${sessionId}/resume`, { method: "POST" });
        await patchSession({ bingo_overlay: "none" });
      } else {
        if (session.status === "running") {
          setAutoCallEnabled(false);
          autoCallLockRef.current = false;
          await fetch(`/api/games/bingo/sessions/${sessionId}/pause`, { method: "POST" });
        }
        await patchSession({ bingo_overlay: "tiebreaker" });
      }
    } finally {
      setSavingOverlay(false);
    }
  };

  const switchCrate = useCallback(async (crateLetter: string) => {
    if (!session) return;
    setSwitchingCrate(true);
    try {
      const patchResponse = await fetch(`/api/games/bingo/sessions/${sessionId}/crates`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round_number: session.current_round, crate_letter: crateLetter }),
      });

      if (!patchResponse.ok) {
        const payload = (await patchResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to assign crate to this round");
      }

      // If current round has not started yet, immediately rebuild live call rows
      // from the newly-selected crate so the table reflects the chosen order.
      if (!roundIsStarted) {
        const activateResponse = await fetch(`/api/games/bingo/sessions/${sessionId}/activate-round`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round: Math.max(1, session.current_round || 1), intermission_seconds: 0 }),
        });

        if (!activateResponse.ok) {
          const payload = (await activateResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to load selected crate into call order");
        }
      }

      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to switch crate";
      alert(message);
    } finally {
      setSwitchingCrate(false);
    }
  }, [session, sessionId, roundIsStarted, load]);

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

  const checkWinner = useCallback(async () => {
    const cardIdentifier = winnerCheckInput.trim().toUpperCase();
    if (!cardIdentifier) return;

    setCheckingWinner(true);
    setWinnerCheckError(null);
    try {
      const response = await fetch(
        `/api/games/bingo/cards/validate?sessionId=${sessionId}&cardIdentifier=${encodeURIComponent(cardIdentifier)}`,
        { cache: "no-store" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? "Failed to validate card");
      }
      setWinnerCheckResult(payload as CardValidationResponse);
    } catch (error) {
      setWinnerCheckResult(null);
      setWinnerCheckError(error instanceof Error ? error.message : "Failed to validate card");
    } finally {
      setCheckingWinner(false);
    }
  }, [sessionId, winnerCheckInput]);

  // Derive crate state for current round
  const currentRoundCrates = useMemo(
    () => crates.filter((c) => c.round_number === (session?.current_round ?? 1)),
    [crates, session?.current_round]
  );

  const cratesByRound = useMemo(
    () => [...crates].sort((left, right) => left.round_number - right.round_number || left.crate_letter.localeCompare(right.crate_letter)),
    [crates]
  );

  const activeCrateLetter = useMemo(() => {
    if (!session?.active_crate_letter_by_round) return null;
    return session.active_crate_letter_by_round.find((e) => e.round === session.current_round)?.letter ?? null;
  }, [session]);

  const roundIsStarted = useMemo(() => {
    const calledCount = calls.filter((c) => ["called", "completed", "skipped"].includes(c.status)).length;
    return calledCount > 0;
  }, [calls]);

  const resetRoundDisabled = useMemo(() => {
    const calledCount = calls.filter((c) => ["called", "completed", "skipped"].includes(c.status)).length;
    // Disabled if more than 10 calls have been made in this round (re-enabled when round changes)
    return calledCount > 10;
  }, [calls]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0c0c0c,#1b1b1b)] p-5 text-stone-100">
      <div className="mx-auto max-w-[1600px] space-y-3">
        <header className="rounded-2xl border border-red-900/40 bg-black/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black uppercase">Music Bingo Host</h1>
              <p className="text-sm text-stone-400">{session?.playlist_name} · {session?.session_code}</p>
            </div>

            <span className="rounded border border-stone-700 px-2 py-1 text-xs text-stone-400 capitalize">
              {session?.status ?? "—"}
            </span>
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

        {/* ─── Control Panel ──────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-stone-700 bg-black/45 p-3">
          <div className="grid gap-3 lg:grid-cols-[1fr,1fr,0.9fr]">

            {/* Left column: CSV-required host controls */}
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => void toggleWelcome()}
                  className={`rounded border px-3 py-1 font-bold transition ${
                    session?.bingo_overlay === "welcome"
                      ? "border-violet-400 bg-violet-800/60 text-violet-100"
                      : "border-violet-700 bg-violet-900/25 text-violet-300 hover:bg-violet-900/45"
                  }`}
                >
                  {session?.bingo_overlay === "welcome" ? "Welcome ✓" : "Welcome"}
                </button>
                <button
                  onClick={() => void startGame()}
                  className="rounded border border-sky-700 bg-sky-900/35 px-3 py-1 font-bold text-sky-200 hover:bg-sky-900/55"
                >
                  Start Game
                </button>
                <button onClick={() => void resetGame()} className="rounded border border-amber-700 bg-amber-900/40 px-3 py-1 text-amber-100 hover:bg-amber-900/60">
                  Reset Game
                </button>
                <button onClick={() => void endGame()} className="rounded border border-red-700 px-3 py-1 text-red-300 hover:bg-red-900/20">
                  End Game
                </button>
                <button onClick={() => void startRound()} className="rounded border border-emerald-700 bg-emerald-900/35 px-3 py-1 font-bold text-emerald-200 hover:bg-emerald-900/55">
                  Start Round
                </button>
                <button
                  onClick={() => void resetRound()}
                  disabled={resetRoundDisabled}
                  title={resetRoundDisabled ? "Disabled after 10 calls — re-enables next round" : "Reset current round"}
                  className="rounded border border-red-700 bg-red-900/40 px-3 py-1 text-red-100 hover:bg-red-900/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reset Round
                </button>
              </div>

              <div className="border-t border-stone-800 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-stone-400 whitespace-nowrap">Load Crate</label>
                  {cratesByRound.length === 0 ? (
                    <span className="text-stone-500 italic">No crates generated yet</span>
                  ) : (
                    <select
                      value={activeCrateLetter ?? ""}
                      disabled={switchingCrate || roundIsStarted}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        void switchCrate(e.target.value);
                      }}
                      className="rounded border border-stone-600 bg-stone-950 px-2 py-1 text-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">— select —</option>
                      {cratesByRound.map((crate) => (
                        <option key={`${crate.round_number}:${crate.crate_letter}`} value={crate.crate_letter}>
                          {`Round ${crate.round_number} · ${crate.crate_name}`}
                        </option>
                      ))}
                    </select>
                  )}
                  {roundIsStarted ? <span className="text-[10px] text-stone-500 italic">Locked (round started)</span> : null}
                </div>
              </div>
            </div>

            {/* Center column: Bingo Pending / Check / Tie / Winner */}
            <div className="space-y-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void setOverlay("pending")}
                  disabled={savingOverlay}
                  className="rounded border border-yellow-700 bg-yellow-900/30 px-3 py-1 font-bold text-yellow-200 hover:bg-yellow-900/60 disabled:opacity-50"
                >
                  Bingo Pending
                </button>
                <button
                  onClick={() => void toggleTie()}
                  disabled={savingOverlay}
                  className={`rounded border px-3 py-1 font-bold transition disabled:opacity-50 ${
                    session?.bingo_overlay === "tiebreaker"
                      ? "border-pink-400 bg-pink-800/60 text-pink-100"
                      : "border-pink-700 bg-pink-900/25 text-pink-300 hover:bg-pink-900/45"
                  }`}
                >
                  Tie
                </button>
                <button
                  onClick={() => void setOverlay("winner")}
                  disabled={savingOverlay}
                  className="rounded border border-emerald-700 bg-emerald-900/30 px-3 py-1 font-bold text-emerald-200 hover:bg-emerald-900/60 disabled:opacity-50"
                >
                  Bingo Winner!
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded border border-stone-700/80 bg-stone-950/50 px-2 py-1">
                <label className="text-stone-400 whitespace-nowrap">Check Winner</label>
                <input
                  type="text"
                  value={winnerCheckInput}
                  onChange={(e) => setWinnerCheckInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void checkWinner();
                  }}
                  placeholder="CARD ID"
                  className="w-28 rounded border border-stone-700 bg-black px-2 py-1 text-center uppercase tracking-[0.08em]"
                />
                <button
                  type="button"
                  onClick={() => void checkWinner()}
                  disabled={checkingWinner}
                  className="rounded border border-sky-700 px-2 py-1 text-sky-300 hover:bg-sky-900/20 disabled:opacity-50"
                >
                  {checkingWinner ? "Checking" : "Run"}
                </button>
              </div>

              {winnerCheckError ? (
                <div className="rounded border border-red-900/70 bg-red-950/40 p-2 text-[11px] text-red-200">
                  {winnerCheckError}
                </div>
              ) : null}
              {winnerCheckResult ? (
                <div className={`rounded border p-2 text-[11px] ${winnerCheckResult.is_winner ? "border-emerald-800/70 bg-emerald-950/30 text-emerald-100" : "border-amber-800/70 bg-amber-950/30 text-amber-100"}`}>
                  <p className="font-bold uppercase tracking-[0.08em]">
                    {winnerCheckResult.card_identifier} · {winnerCheckResult.is_winner ? "Winner" : "Not Yet Winning"}
                  </p>
                  <p className="mt-1 text-stone-300">
                    Free squares {winnerCheckResult.actual_free_square_count}/{winnerCheckResult.expected_free_square_count} · Marked {winnerCheckResult.marked_square_count}/{winnerCheckResult.playable_square_count + winnerCheckResult.actual_free_square_count}
                  </p>
                  {winnerCheckResult.winning_patterns.length > 0 ? (
                    <p className="mt-1 text-emerald-200">
                      {winnerCheckResult.winning_patterns.map((pattern) => `${pattern.mode.replace("_", " ")}: ${pattern.label}`).join(" | ")}
                    </p>
                  ) : null}
                  {winnerCheckResult.mistakes.length > 0 ? (
                    <div className="mt-1 space-y-1 text-amber-100">
                      {winnerCheckResult.mistakes.slice(0, 2).map((mistake) => (
                        <p key={`${mistake.mode}-${mistake.message}`}>
                          {mistake.message}
                          {mistake.missing_cells.length > 0 ? ` Missing: ${mistake.missing_cells.slice(0, 4).map((cell) => cell.label).join(", ")}` : ""}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Right column: Timing controls */}
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-stone-400 whitespace-nowrap">Next Call (sec)</label>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={secondsToNextCallInput}
                    onChange={(e) => setSecondsToNextCallInput(Math.max(0, Math.min(300, Number(e.target.value) || 0)))}
                    onBlur={() => { void saveSecondsToNextCall(); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveSecondsToNextCall();
                    }}
                    className="w-full rounded border border-stone-700 bg-stone-950 px-2 py-1 text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-stone-400 whitespace-nowrap">Reveal Delay (sec)</label>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={revealDelayInput}
                    onFocus={() => { revealDelayEditingRef.current = true; }}
                    onBlur={() => { void saveRevealDelay(); }}
                    onChange={(e) => {
                      revealDelayEditingRef.current = true;
                      setRevealDelayInput(Math.max(0, Math.min(300, Number(e.target.value) || 0)));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveRevealDelay();
                    }}
                    className="w-full rounded border border-stone-700 bg-stone-950 px-2 py-1 text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-stone-400 whitespace-nowrap">Intermission (min)</label>
                  <input
                    type="number"
                    min={0}
                    value={intermissionLengthMinutes}
                    onFocus={() => { intermissionEditingRef.current = true; }}
                    onBlur={() => { void saveIntermissionMinutes(); }}
                    onChange={(e) => setIntermissionLengthMinutes(Math.max(0, Number(e.target.value) || 0))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveIntermissionMinutes();
                    }}
                    className="w-full rounded border border-stone-700 bg-stone-950 px-2 py-1 text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-stone-400 whitespace-nowrap">Playback</label>
                  <button
                    onClick={() => void (session?.status === "paused" ? resume() : pause())}
                    className={`w-full rounded border px-2 py-1 font-bold transition ${
                      session?.status === "paused"
                        ? "border-emerald-600 bg-emerald-900/40 text-emerald-200 hover:bg-emerald-900/60"
                        : "border-amber-600 bg-amber-900/30 text-amber-200 hover:bg-amber-900/50"
                    }`}
                  >
                    {session?.status === "paused" ? "▶ Resume" : "⏸ Pause"}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-[1.55fr,1fr]">
          <section className="flex h-[68vh] flex-col rounded-2xl border border-stone-700 bg-black/50 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">
              Crate (Call Order){activeCrateLetter ? ` · Loaded: Crate ${activeCrateLetter}` : ""}
            </h2>
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
            secondsToNextCall={remaining}
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
