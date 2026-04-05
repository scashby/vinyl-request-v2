"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatBallLabel, getBingoColumnTextClass } from "src/lib/bingoBall";
import BingoTransportLane, { type BingoTransportCall } from "../_components/BingoTransportLane";

type Session = {
  session_code: string;
  playlist_name: string;
  current_call_index: number;
  current_round: number;
  round_count: number;
  transport_queue_call_ids?: number[];
  status: string;
  seconds_to_next_call: number;
};
type Call = BingoTransportCall;

export default function BingoAssistantPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);

  const [remaining, setRemaining] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    if (typeof document !== "undefined" && document.hidden) return;
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
    const isIdle = session?.status === "paused" || session?.status === "completed";
    const timer = setInterval(load, isIdle ? 30_000 : 3_500);
    return () => clearInterval(timer);
  }, [load, session?.status]);

  const called = useMemo(
    () =>
      calls
        .filter((call) => ["called", "completed", "skipped"].includes(call.status))
        .sort((a, b) => a.call_index - b.call_index),
    [calls]
  );

  const current = useMemo(() => {
    const byCurrentIndex = calls.find((call) => call.call_index === (session?.current_call_index ?? 0) && call.status === "called");
    if (byCurrentIndex) return byCurrentIndex;
    return [...calls].reverse().find((call) => call.status === "called") ?? null;
  }, [calls, session?.current_call_index]);

  const openWindow = (url: string, name: string, features: string) => {
    const opened = window.open(url, name, features);
    if (opened) opened.focus();
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#141414,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl border border-cyan-900/50 bg-black/50 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Sidekick</p>
              <h1 className="text-3xl font-black uppercase">Assistant Board</h1>
              <p className="text-sm text-stone-400">
                {session?.playlist_name} · {session?.session_code} · Round {session?.current_round} of {session?.round_count}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-500 uppercase">Next Call In</p>
              <p
                className={`text-3xl font-black tabular-nums ${
                  remaining <= 10 ? "text-red-400" : remaining <= 20 ? "text-amber-400" : "text-cyan-300"
                }`}
              >
                {remaining}s
              </p>
              {session?.status === "paused" && (
                <p className="text-xs text-red-400 font-semibold uppercase">Paused</p>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button
              className="rounded border border-stone-600 px-2 py-1"
              onClick={() => openWindow(`/admin/games/bingo/host?sessionId=${sessionId}`, "bingo_host", "width=1280,height=960,left=0,top=0,noopener,noreferrer")}
            >
              Host
            </button>
            <button
              className="rounded border border-stone-600 px-2 py-1"
              onClick={() => openWindow(`/admin/games/bingo/jumbotron?sessionId=${sessionId}`, "bingo_jumbotron", "width=1920,height=1080,noopener,noreferrer")}
            >
              Jumbotron
            </button>
            <button className="rounded border border-stone-600 px-2 py-1" onClick={() => window.open("/admin/games/bingo", "_blank", "noopener,noreferrer")}>
              Setup
            </button>
            <button className="rounded border border-stone-600 px-2 py-1" onClick={() => (window.location.href = "/admin/games")}>Main</button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-stone-700 bg-black/50 p-4">
            <h2 className="text-sm font-bold uppercase text-cyan-200">Current Call</h2>
            <div className="mt-2 rounded border border-cyan-700/40 bg-cyan-950/20 p-3">
              <p className="text-lg font-black">
                {current ? (
                  <>
                    <span className={getBingoColumnTextClass(current.column_letter, current.ball_number)}>
                      {formatBallLabel(current.ball_number, current.column_letter)}
                    </span>{" "}
                    - {current.track_title}
                  </>
                ) : (
                  "Waiting for first call"
                )}
              </p>
              <p className="text-sm text-stone-300">{current ? `${current.artist_name} · ${current.album_name ?? ""}` : ""}</p>
            </div>

            <div className="mt-3 text-xs">
              <p className="font-semibold text-stone-300">Full Called Order</p>
              <div className="mt-2 max-h-52 space-y-1 overflow-auto text-stone-400">
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
          </section>

          <BingoTransportLane
            sessionId={sessionId}
            calls={calls}
            currentCallIndex={session?.current_call_index ?? 0}
            transportQueueCallIds={session?.transport_queue_call_ids ?? []}
            onChanged={load}
            accent="assistant"
            maxRows={6}
          />
        </div>
      </div>
    </div>
  );
}
