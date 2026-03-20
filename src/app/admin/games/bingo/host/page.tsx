"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatBallLabel, getBingoColumnTextClass } from "src/lib/bingoBall";
import InlineEditableCell from "../../_components/InlineEditableCell";
import BingoTransportLane, { type BingoTransportCall } from "../_components/BingoTransportLane";

type Session = {
  id: number;
  session_code: string;
  playlist_name: string;
  current_call_index: number;
  current_round: number;
  round_count: number;
  status: string;
  transport_queue_call_ids?: number[];
  seconds_to_next_call: number;
  call_reveal_delay_seconds: number;
  next_game_scheduled_at: string | null;
  next_game_rules_text: string | null;
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
  const [revealDelayInput, setRevealDelayInput] = useState<number>(3);
  const [scheduleInput, setScheduleInput] = useState("");
  const [rulesInput, setRulesInput] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingOverlay, setSavingOverlay] = useState(false);
  const [syncedSessionId, setSyncedSessionId] = useState<number | null>(null);
  const currentCallRowRef = useRef<HTMLTableRowElement>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/games/bingo/sessions/${sessionId}`),
      fetch(`/api/games/bingo/sessions/${sessionId}/calls`),
    ]);

    if (sRes.ok) setSession(await sRes.json());
    if (cRes.ok) {
      const payload = await cRes.json();
      setCalls(payload.data ?? []);
    }
  }, [sessionId]);

  // Sync form inputs from session data once per session id
  useEffect(() => {
    if (!session || session.id === syncedSessionId) return;
    setSyncedSessionId(session.id);
    setRevealDelayInput(session.call_reveal_delay_seconds ?? 3);
    setRulesInput(session.next_game_rules_text ?? "");
    if (session.next_game_scheduled_at) {
      const d = new Date(session.next_game_scheduled_at);
      const pad = (n: number) => String(n).padStart(2, "0");
      setScheduleInput(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
    }
  }, [session, syncedSessionId]);

  // Sync remaining from poll
  useEffect(() => {
    if (session?.seconds_to_next_call != null) {
      setRemaining(session.seconds_to_next_call);
    }
  }, [session?.seconds_to_next_call]);

  // Countdown tick
  useEffect(() => {
    const tick = setInterval(() => {
      if (!session || session.status === "paused") return;
      setRemaining((v) => Math.max(0, v - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [session]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 3500);
    return () => clearInterval(timer);
  }, [load]);

  const called = useMemo(
    () =>
      calls
        .filter((call) => ["called", "completed", "skipped"].includes(call.status))
        .sort((a, b) => a.call_index - b.call_index),
    [calls]
  );

  const currentCall = useMemo(() => {
    const byCurrentIndex = calls.find(
      (call) => call.call_index === (session?.current_call_index ?? 0) && call.status === "called"
    );
    if (byCurrentIndex) return byCurrentIndex;
    return [...calls].reverse().find((call) => call.status === "called") ?? null;
  }, [calls, session?.current_call_index]);

  // Auto-scroll current call row into view
  useEffect(() => {
    currentCallRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentCall?.id]);

  const pause = async () => {
    await fetch(`/api/games/bingo/sessions/${sessionId}/pause`, { method: "POST" });
    load();
  };

  const resume = async () => {
    await fetch(`/api/games/bingo/sessions/${sessionId}/resume`, { method: "POST" });
    load();
  };

  const skip = async () => {
    await fetch(`/api/games/bingo/sessions/${sessionId}/skip`, { method: "POST" });
    load();
  };

  const replace = async () => {
    await fetch(`/api/games/bingo/sessions/${sessionId}/replace`, { method: "POST" });
    load();
  };

  const saveRevealDelay = async () => {
    await fetch(`/api/games/bingo/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call_reveal_delay_seconds: revealDelayInput }),
    });
    load();
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    await fetch(`/api/games/bingo/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        next_game_scheduled_at: scheduleInput ? new Date(scheduleInput).toISOString() : null,
        next_game_rules_text: rulesInput || null,
      }),
    });
    setSavingSchedule(false);
    load();
  };

  const clearSchedule = async () => {
    setSavingSchedule(true);
    setScheduleInput("");
    setRulesInput("");
    await fetch(`/api/games/bingo/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next_game_scheduled_at: null, next_game_rules_text: null }),
    });
    setSavingSchedule(false);
    load();
  };

  const setOverlay = async (overlay: "none" | "pending" | "winner") => {
    setSavingOverlay(true);
    await fetch(`/api/games/bingo/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bingo_overlay: overlay }),
    });
    setSavingOverlay(false);
    load();
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#0c0c0c,#1b1b1b)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-red-900/40 bg-black/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Host Console</p>
              <h1 className="text-3xl font-black uppercase">Music Bingo Host</h1>
              <p className="text-sm text-stone-400">
                {session?.playlist_name} · {session?.session_code} · Round {session?.current_round} of{" "}
                {session?.round_count}
              </p>
            </div>
            <span className="rounded border border-stone-700 px-2 py-1 text-xs text-stone-400 capitalize">
              {session?.status ?? "—"}
            </span>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
          {/* LEFT: Scrollable call crate */}
          <section className="rounded-2xl border border-stone-700 bg-black/50 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">Crate (Call Order)</h2>
            <div className="mt-3 overflow-x-auto overflow-y-auto max-h-[65vh]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#111] z-10">
                  <tr className="text-stone-300">
                    <th className="pb-2 pr-2">Draw</th>
                    <th className="pb-2 pr-2">Ball</th>
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
                        <td className={`py-2 pr-2 font-bold ${ballToneClass} ${isDone ? "line-through" : ""}`}>
                          {ballLabel}
                        </td>
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
            <p className="mt-2 text-[11px] text-stone-500">
              Click Track / Artist / Album to edit inline. Press Enter to save. Current call highlighted in amber.
            </p>
          </section>

          {/* RIGHT: Timer + Controls */}
          <section className="space-y-4">
            {/* Timer */}
            <div className="rounded-2xl border border-stone-700 bg-black/50 p-4">
              <p className="text-xs uppercase text-amber-300">Time Until Next Call</p>
              <p
                className={`mt-1 text-5xl font-black leading-none tabular-nums ${
                  remaining <= 10 ? "text-red-400" : remaining <= 20 ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {remaining}s
              </p>
              {session?.status === "paused" && (
                <p className="mt-1 text-xs font-semibold text-red-400 uppercase tracking-wide">Paused</p>
              )}
            </div>

            {/* Session Controls */}
            <div className="rounded-2xl border border-stone-700 bg-black/50 p-4">
              <p className="text-xs uppercase text-amber-300">Session Controls</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button onClick={pause} className="rounded border border-stone-600 px-2 py-1 hover:border-stone-400">Pause</button>
                <button onClick={resume} className="rounded border border-stone-600 px-2 py-1 hover:border-stone-400">Resume</button>
                <button onClick={skip} className="rounded border border-stone-600 px-2 py-1 hover:border-stone-400">Skip</button>
                <button onClick={replace} className="rounded border border-stone-600 px-2 py-1 hover:border-stone-400">Replace with Next</button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <label className="text-stone-400 whitespace-nowrap">Reveal Delay</label>
                <input
                  type="number"
                  min={0}
                  max={15}
                  value={revealDelayInput}
                  onChange={(e) => setRevealDelayInput(Math.max(0, Math.min(15, Number(e.target.value) || 0)))}
                  className="w-16 rounded border border-stone-700 bg-stone-950 px-2 py-1 text-center"
                />
                <span className="text-stone-500">s</span>
                <button
                  onClick={saveRevealDelay}
                  className="rounded border border-amber-700 px-2 py-1 text-amber-300 hover:bg-amber-900/30"
                >
                  Save
                </button>
                <span className="text-stone-600">delay before jumbotron reveals call</span>
              </div>
            </div>

            {/* Bingo Overlay */}
            <div className="rounded-2xl border border-stone-700 bg-black/50 p-4">
              <p className="text-xs uppercase text-amber-300">Bingo Overlay</p>
              <p className="mt-1 text-xs text-stone-500">
                Active: <span className="font-semibold text-stone-300 capitalize">{session?.bingo_overlay ?? "none"}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => setOverlay("pending")}
                  disabled={savingOverlay}
                  className="rounded border border-yellow-700 bg-yellow-900/30 px-3 py-1.5 font-bold text-yellow-200 hover:bg-yellow-900/60 disabled:opacity-50"
                >
                  Bingo Pending
                </button>
                <button
                  onClick={() => setOverlay("winner")}
                  disabled={savingOverlay}
                  className="rounded border border-emerald-700 bg-emerald-900/30 px-3 py-1.5 font-bold text-emerald-200 hover:bg-emerald-900/60 disabled:opacity-50"
                >
                  Bingo Winner!
                </button>
                <button
                  onClick={() => setOverlay("none")}
                  disabled={savingOverlay}
                  className="rounded border border-stone-600 px-3 py-1.5 text-stone-300 hover:border-stone-400 disabled:opacity-50"
                >
                  Clear Overlay
                </button>
              </div>
            </div>

            {/* Schedule Next Game */}
            <div className="rounded-2xl border border-stone-700 bg-black/50 p-4">
              <p className="text-xs uppercase text-amber-300">Schedule Next Game</p>
              <p className="mt-1 text-xs text-stone-500">
                Displays a countdown + rules on the jumbotron when the session is pending.
              </p>
              <div className="mt-3 space-y-2 text-xs">
                <label className="block text-stone-400">
                  Start Time
                  <input
                    type="datetime-local"
                    value={scheduleInput}
                    onChange={(e) => setScheduleInput(e.target.value)}
                    className="mt-1 block w-full rounded border border-stone-700 bg-stone-950 px-2 py-1 text-stone-200"
                  />
                </label>
                <label className="block text-stone-400">
                  Rules / How to Play
                  <textarea
                    rows={3}
                    value={rulesInput}
                    onChange={(e) => setRulesInput(e.target.value)}
                    placeholder="See a staff member for a bingo card. Any five in a row wins!"
                    className="mt-1 block w-full rounded border border-stone-700 bg-stone-950 px-2 py-1 text-stone-200 placeholder:text-stone-600 resize-none"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={saveSchedule}
                    disabled={savingSchedule || !scheduleInput}
                    className="rounded border border-amber-700 px-3 py-1 text-amber-300 hover:bg-amber-900/30 disabled:opacity-50"
                  >
                    {savingSchedule ? "Saving..." : "Save Schedule"}
                  </button>
                  <button
                    onClick={clearSchedule}
                    disabled={savingSchedule}
                    className="rounded border border-stone-600 px-3 py-1 text-stone-400 hover:border-stone-400 disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <BingoTransportLane
              sessionId={sessionId}
              calls={calls}
              currentCallIndex={session?.current_call_index ?? 0}
              transportQueueCallIds={session?.transport_queue_call_ids ?? []}
              onChanged={load}
              accent="host"
              maxRows={6}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
