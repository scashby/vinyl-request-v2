"use client";

import { type ReactNode, useMemo, useState } from "react";
import { formatBallLabel, getBingoColumnTextClass } from "src/lib/bingoBall";

export type BingoTransportCall = {
  id: number;
  call_index: number;
  ball_number: number | null;
  column_letter: string;
  track_title: string;
  artist_name: string;
  album_name: string | null;
  side: string | null;
  position: string | null;
  status: string;
};

type ActionName = "pull" | "cue" | "call";
type ActionTone = "green" | "yellow" | "red";

const DONE_STATUSES = new Set(["called", "completed", "skipped"]);

function actionClass(tone: ActionTone, disabled: boolean) {
  const base = "rounded border px-2 py-1 text-center text-[11px] font-black uppercase tracking-wide transition";
  const interactive = disabled ? "cursor-not-allowed opacity-65" : "hover:brightness-110";

  if (tone === "green") return `${base} ${interactive} border-emerald-400 bg-emerald-500 text-black`;
  if (tone === "yellow") return `${base} ${interactive} border-amber-300 bg-amber-400 text-black`;
  return `${base} ${interactive} border-red-700 bg-red-900/70 text-red-100`;
}

function toStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

type BingoTransportLaneProps = {
  sessionId: number;
  calls: BingoTransportCall[];
  currentCallIndex: number;
  transportQueueCallIds?: number[];
  onChanged: () => Promise<void> | void;
  accent: "host" | "assistant";
  maxRows?: number;
  className?: string;
  callsContainerClassName?: string;
  headerRight?: ReactNode;
  secondsToNextCall?: number;
};

export default function BingoTransportLane({
  sessionId,
  calls,
  currentCallIndex,
  transportQueueCallIds = [],
  onChanged,
  accent,
  maxRows = 5,
  className = "",
  callsContainerClassName = "",
  headerRight,
  secondsToNextCall,
}: BingoTransportLaneProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortedCalls = useMemo(() => [...calls].sort((a, b) => a.call_index - b.call_index), [calls]);
  const callById = useMemo(() => new Map(sortedCalls.map((call) => [call.id, call])), [sortedCalls]);

  const currentCall = useMemo(() => {
    const bySession = sortedCalls.find((call) => call.call_index === currentCallIndex && call.status === "called");
    if (bySession) return bySession;
    return [...sortedCalls].reverse().find((call) => call.status === "called") ?? null;
  }, [sortedCalls, currentCallIndex]);

  const queueCalls = useMemo(() => {
    const fromSessionQueue = transportQueueCallIds
      .map((id) => callById.get(id) ?? null)
      .filter((call): call is BingoTransportCall => {
        if (!call) return false;
        if (DONE_STATUSES.has(call.status)) return false;
        return call.call_index > currentCallIndex;
      });

    if (fromSessionQueue.length > 0) return fromSessionQueue;

    return sortedCalls.filter((call) => !DONE_STATUSES.has(call.status) && call.call_index > currentCallIndex);
  }, [transportQueueCallIds, callById, currentCallIndex, sortedCalls]);

  const queueRankById = useMemo(() => new Map(queueCalls.map((call, index) => [call.id, index])), [queueCalls]);

  const firstCallable = useMemo(() => (!currentCall ? queueCalls[0] ?? null : null), [queueCalls, currentCall]);

  const laneCalls = useMemo(() => {
    if (queueCalls.length > 0) return queueCalls.slice(0, maxRows);
    return sortedCalls
      .filter((call) => !DONE_STATUSES.has(call.status))
      .slice(0, maxRows);
  }, [queueCalls, sortedCalls, maxRows]);

  const inFlight = pendingAction !== null;

  const runAction = async (action: ActionName, callId: number) => {
    if (!Number.isFinite(sessionId)) return;
    const key = `${action}:${callId}`;
    setPendingAction(key);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/games/bingo/sessions/${sessionId}/transport`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, call_id: callId }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to update transport action.");
      }
      await onChanged();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update transport action.";
      setErrorMessage(message);
    } finally {
      setPendingAction(null);
    }
  };

  const sectionToneClass =
    accent === "assistant"
      ? "border-cyan-700/40 bg-cyan-950/15"
      : "border-amber-700/40 bg-amber-950/10";
  const headingToneClass = accent === "assistant" ? "text-cyan-200" : "text-amber-200";

  return (
    <section className={`rounded-2xl border p-4 ${sectionToneClass} ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`text-sm font-bold uppercase tracking-wide ${headingToneClass}`}>Transport Lane</h2>
        <div className="flex items-center gap-3">
          {secondsToNextCall !== undefined ? (
            <span
              className={`rounded border px-2 py-0.5 text-xs font-bold tabular-nums ${
                secondsToNextCall <= 10
                  ? "border-red-700 text-red-300"
                  : secondsToNextCall <= 20
                    ? "border-amber-600 text-amber-300"
                    : "border-stone-600 text-stone-300"
              }`}
            >
              Next: {secondsToNextCall}s
            </span>
          ) : null}
          {headerRight}
        </div>
      </div>

      {errorMessage ? <p className="mt-2 rounded border border-red-700/60 bg-red-950/30 px-2 py-1 text-xs text-red-200">{errorMessage}</p> : null}

      <div className={`mt-3 space-y-2 ${callsContainerClassName}`}>
        {laneCalls.map((call) => {
          const isCurrent = currentCall?.id === call.id;
          const queueRank = queueRankById.get(call.id);
          const isCue = queueRank === 0;
          const isPull = queueRank === 1;
          const isPulling = queueRank === 2;

          const queueStatusLabel = isCue
            ? "Cued"
            : isPull
              ? "Pulled"
              : isPulling
                ? "Pulling"
                : call.status === "pending"
                  ? "Pending"
                  : toStatusLabel(call.status);

          const callTone: ActionTone =
            isCurrent || isCue || firstCallable?.id === call.id
              ? "green"
              : isPull
                ? "yellow"
                : "red";
          const cueTone: ActionTone = isPull ? "green" : isPulling ? "yellow" : "red";
          const pullTone: ActionTone =
            isPulling
              ? "green"
              : call.status === "pending" && typeof queueRank === "number" && queueRank >= 3
                ? "yellow"
                : "red";

          const callDisabled =
            inFlight ||
            DONE_STATUSES.has(call.status) ||
            isCurrent ||
            (currentCall && call.call_index < currentCall.call_index) ||
            (!currentCall && call.status === "called");

          const cueDisabled =
            inFlight ||
            DONE_STATUSES.has(call.status) ||
            isCurrent ||
            isCue ||
            call.status === "called" ||
            (currentCall && call.call_index <= currentCall.call_index);

          const pullDisabled =
            inFlight ||
            call.status !== "pending" ||
            isCue ||
            isPull ||
            typeof queueRank !== "number" ||
            queueRank < 3;

          return (
            <div key={call.id} className={`rounded border bg-stone-950/70 p-3 ${isCurrent ? "border-amber-500/70 ring-1 ring-inset ring-amber-500/40" : "border-stone-700"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={isCurrent ? "font-black text-stone-100" : "text-xs font-semibold text-stone-100"}>
                  {isCurrent ? (
                    <>
                      <span className={`text-2xl font-black ${getBingoColumnTextClass(call.column_letter, call.ball_number)}`}>{formatBallLabel(call.ball_number, call.column_letter)}</span>
                      <span className="ml-2 text-base font-bold">{call.track_title}</span>
                    </>
                  ) : isCue ? (
                    <>
                      <span className={`text-base font-bold ${getBingoColumnTextClass(call.column_letter, call.ball_number)}`}>{formatBallLabel(call.ball_number, call.column_letter)}</span>
                      <span className="ml-2 text-sm font-semibold"> - {call.track_title}</span>
                    </>
                  ) : (
                    <>#{call.call_index} · <span className={getBingoColumnTextClass(call.column_letter, call.ball_number)}>{formatBallLabel(call.ball_number, call.column_letter)}</span> - {call.track_title}</>
                  )}
                </p>
                <span className="rounded border border-stone-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-stone-300">{queueStatusLabel}</span>
              </div>
              <p className="mt-1 text-stone-300">{call.artist_name} · {call.album_name ?? ""}</p>
              <p className="mt-1 text-stone-500">Side {call.side ?? "-"} · Position {call.position ?? "-"}</p>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  className={actionClass(pullTone, pullDisabled)}
                  disabled={pullDisabled}
                  onClick={() => runAction("pull", call.id)}
                >
                  {pendingAction === `pull:${call.id}` ? "Saving" : "Pull"}
                </button>
                <button
                  className={actionClass(cueTone, cueDisabled)}
                  disabled={cueDisabled}
                  onClick={() => runAction("cue", call.id)}
                >
                  {pendingAction === `cue:${call.id}` ? "Saving" : "Cue"}
                </button>
                <button
                  className={actionClass(callTone, callDisabled)}
                  disabled={callDisabled}
                  onClick={() => runAction("call", call.id)}
                >
                  {pendingAction === `call:${call.id}` ? "Saving" : "Call"}
                </button>
              </div>
            </div>
          );
        })}
        {laneCalls.length === 0 ? <p className="text-xs text-stone-500">No upcoming calls available.</p> : null}
      </div>
    </section>
  );
}
