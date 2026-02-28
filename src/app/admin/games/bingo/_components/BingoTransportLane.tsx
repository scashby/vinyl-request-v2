"use client";

import { useMemo, useState } from "react";
import { formatBallLabel } from "src/lib/bingoBall";

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

const DONE_STATUSES = new Set(["completed", "skipped"]);

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
  pullCallId: number | null | undefined;
  onChanged: () => Promise<void> | void;
  accent: "host" | "assistant";
  maxRows?: number;
};

export default function BingoTransportLane({
  sessionId,
  calls,
  currentCallIndex,
  pullCallId,
  onChanged,
  accent,
  maxRows = 5,
}: BingoTransportLaneProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortedCalls = useMemo(() => [...calls].sort((a, b) => a.call_index - b.call_index), [calls]);

  const currentCall = useMemo(() => {
    const bySession = sortedCalls.find((call) => call.call_index === currentCallIndex && call.status === "called");
    if (bySession) return bySession;
    return [...sortedCalls].reverse().find((call) => call.status === "called") ?? null;
  }, [sortedCalls, currentCallIndex]);

  const cueCall = useMemo(() => {
    const boundary = currentCall?.call_index ?? currentCallIndex ?? 0;
    const prepped = sortedCalls.find((call) => call.status === "prep_started" && call.call_index > boundary);
    if (prepped) return prepped;
    return sortedCalls.find((call) => call.status === "pending" && call.call_index > boundary) ?? null;
  }, [sortedCalls, currentCall, currentCallIndex]);

  const pullCall = useMemo(() => {
    const boundary = cueCall?.call_index ?? currentCall?.call_index ?? currentCallIndex ?? 0;
    const pullFromEvent =
      typeof pullCallId === "number"
        ? sortedCalls.find((call) => call.id === pullCallId && call.status === "pending" && call.call_index > boundary)
        : null;
    if (pullFromEvent) return pullFromEvent;
    return sortedCalls.find((call) => call.status === "pending" && call.call_index > boundary) ?? null;
  }, [sortedCalls, cueCall, currentCall, currentCallIndex, pullCallId]);

  const firstCallable = useMemo(
    () => (!currentCall ? sortedCalls.find((call) => call.status === "pending" || call.status === "prep_started") ?? null : null),
    [sortedCalls, currentCall]
  );

  const laneCalls = useMemo(() => {
    const seen = new Set<number>();
    const rows: BingoTransportCall[] = [];

    const pushCall = (call: BingoTransportCall | null) => {
      if (!call || seen.has(call.id)) return;
      rows.push(call);
      seen.add(call.id);
    };

    pushCall(currentCall);
    pushCall(cueCall);
    pushCall(pullCall);

    const queueStart = currentCall?.call_index ?? firstCallable?.call_index ?? 1;
    for (const call of sortedCalls) {
      if (rows.length >= maxRows) break;
      if (DONE_STATUSES.has(call.status)) continue;
      if (call.call_index < queueStart) continue;
      pushCall(call);
    }

    if (rows.length === 0) {
      for (const call of sortedCalls) {
        if (rows.length >= maxRows) break;
        if (DONE_STATUSES.has(call.status)) continue;
        pushCall(call);
      }
    }

    return rows;
  }, [sortedCalls, currentCall, cueCall, pullCall, maxRows, firstCallable]);

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
    <section className={`rounded-2xl border p-4 ${sectionToneClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`text-sm font-bold uppercase tracking-wide ${headingToneClass}`}>Transport Lane</h2>
        <p className="text-[11px] uppercase tracking-[0.2em] text-stone-400">Pull · Cue · Call</p>
      </div>

      {errorMessage ? <p className="mt-2 rounded border border-red-700/60 bg-red-950/30 px-2 py-1 text-xs text-red-200">{errorMessage}</p> : null}

      <div className="mt-3 space-y-2">
        {laneCalls.map((call) => {
          const isCurrent = currentCall?.id === call.id;
          const isCue = cueCall?.id === call.id;
          const isPull = pullCall?.id === call.id;

          const callTone: ActionTone = isCurrent || firstCallable?.id === call.id ? "green" : isCue ? "yellow" : "red";
          const cueTone: ActionTone = isCue ? "green" : isPull ? "yellow" : "red";
          const pullTone: ActionTone = isPull ? "green" : call.status === "pending" && pullCall && call.call_index > pullCall.call_index ? "yellow" : "red";

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
            call.status === "called" ||
            (currentCall && call.call_index <= currentCall.call_index);

          const cueBoundary = cueCall?.call_index ?? currentCall?.call_index ?? currentCallIndex ?? 0;
          const pullDisabled = inFlight || call.status !== "pending" || call.call_index <= cueBoundary;

          return (
            <div key={call.id} className="rounded border border-stone-700 bg-stone-950/70 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-stone-100">
                  #{call.call_index} · {formatBallLabel(call.ball_number, call.column_letter)} - {call.track_title}
                </p>
                <span className="rounded border border-stone-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-stone-300">{toStatusLabel(call.status)}</span>
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
