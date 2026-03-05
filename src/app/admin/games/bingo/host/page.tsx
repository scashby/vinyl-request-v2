"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
    const byCurrentIndex = calls.find((call) => call.call_index === (session?.current_call_index ?? 0) && call.status === "called");
    if (byCurrentIndex) return byCurrentIndex;
    return [...calls].reverse().find((call) => call.status === "called") ?? null;
  }, [calls, session?.current_call_index]);

  const previous = useMemo(() => called.slice(Math.max(0, called.length - 5), called.length - 1), [called]);

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
                {session?.playlist_name} · {session?.session_code} · Round {session?.current_round} of {session?.round_count}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/bingo/assistant?sessionId=${sessionId}`}>
                Assistant
              </Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/bingo/jumbotron?sessionId=${sessionId}`}>
                Jumbotron
              </Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/bingo/history">
                History
              </Link>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
          <section className="rounded-2xl border border-stone-700 bg-black/50 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">Crate (Call Order)</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">Draw</th>
                    <th className="pb-2">Ball</th>
                    <th className="pb-2">Track</th>
                    <th className="pb-2">Artist</th>
                    <th className="pb-2">Album</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => {
                    const ballLabel = formatBallLabel(call.ball_number, call.column_letter);
                    const ballToneClass = getBingoColumnTextClass(call.column_letter, call.ball_number);

                    return (
                      <tr key={call.id} className="border-t border-stone-800 align-top">
                        <td className="py-2 text-stone-400">{call.call_index}</td>
                        <td className={`py-2 font-bold ${ballToneClass}`}>{ballLabel}</td>
                        <td className="py-1">
                          <InlineEditableCell
                            onSave={(nextValue) => patchCallMetadata(call.id, { track_title: nextValue })}
                            value={call.track_title}
                          />
                        </td>
                        <td className="py-1">
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

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/50 p-4">
              <p className="text-xs uppercase text-amber-300">Session Controls</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button onClick={pause} className="rounded border border-stone-600 px-2 py-1">
                  Pause
                </button>
                <button onClick={resume} className="rounded border border-stone-600 px-2 py-1">
                  Resume
                </button>
                <button onClick={skip} className="rounded border border-stone-600 px-2 py-1">
                  Skip
                </button>
                <button onClick={replace} className="rounded border border-stone-600 px-2 py-1">
                  Replace with Next
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/50 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">Call Card</h2>
              <div className="mt-3 rounded border border-red-700/50 bg-red-950/30 p-3">
                <p className="text-xs uppercase text-red-300">Current</p>
                <p className="text-lg font-black">
                  {currentCall ? (
                    <>
                      <span className={getBingoColumnTextClass(currentCall.column_letter, currentCall.ball_number)}>
                        {formatBallLabel(currentCall.ball_number, currentCall.column_letter)}
                      </span>{" "}
                      - {currentCall.track_title}
                    </>
                  ) : (
                    "No call yet"
                  )}
                </p>
                <p className="text-sm text-stone-300">{currentCall ? `${currentCall.artist_name} · ${currentCall.album_name ?? ""}` : ""}</p>
              </div>
              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Previous Calls</p>
                <ul className="mt-1 space-y-1 text-stone-400">
                  {previous.map((call) => {
                    const ballLabel = formatBallLabel(call.ball_number, call.column_letter);
                    const ballToneClass = getBingoColumnTextClass(call.column_letter, call.ball_number);
                    return (
                      <li key={call.id}>
                        <span className={ballToneClass}>{ballLabel}</span> - {call.track_title}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Full Called Order</p>
                <div className="mt-1 max-h-24 overflow-auto text-stone-400">
                  {called.map((call) => {
                    const ballLabel = formatBallLabel(call.ball_number, call.column_letter);
                    const ballToneClass = getBingoColumnTextClass(call.column_letter, call.ball_number);
                    return (
                      <div key={call.id}>
                        {call.call_index}. <span className={ballToneClass}>{ballLabel}</span> - {call.track_title}
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-stone-500">
                Click Track/Artist/Album in Crate to edit inline. Press Enter to save.
              </p>
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
