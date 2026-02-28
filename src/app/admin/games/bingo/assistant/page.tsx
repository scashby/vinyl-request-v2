"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatBallLabel } from "src/lib/bingoBall";
import BingoTransportLane, { type BingoTransportCall } from "../_components/BingoTransportLane";

type Session = {
  session_code: string;
  playlist_name: string;
  current_call_index: number;
  current_round: number;
  round_count: number;
  pull_call_id: number | null;
};
type Call = BingoTransportCall;

export default function BingoAssistantPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
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

  const current = useMemo(() => {
    const byCurrentIndex = calls.find((call) => call.call_index === (session?.current_call_index ?? 0) && call.status === "called");
    if (byCurrentIndex) return byCurrentIndex;
    return [...calls].reverse().find((call) => call.status === "called") ?? null;
  }, [calls, session?.current_call_index]);

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
            <Link href={`/admin/games/bingo/host?sessionId=${sessionId}`} className="rounded border border-stone-700 px-3 py-1 text-xs">
              Back to Host
            </Link>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-stone-700 bg-black/50 p-4">
            <h2 className="text-sm font-bold uppercase text-cyan-200">Current Call</h2>
            <div className="mt-2 rounded border border-cyan-700/40 bg-cyan-950/20 p-3">
              <p className="text-lg font-black">
                {current ? `${formatBallLabel(current.ball_number, current.column_letter)} - ${current.track_title}` : "Waiting for first call"}
              </p>
              <p className="text-sm text-stone-300">{current ? `${current.artist_name} · ${current.album_name ?? ""}` : ""}</p>
            </div>

            <div className="mt-3 text-xs">
              <p className="font-semibold text-stone-300">Full Called Order</p>
              <div className="mt-2 max-h-52 space-y-1 overflow-auto text-stone-400">
                {called.map((call) => (
                  <div key={call.id}>
                    {call.call_index}. {formatBallLabel(call.ball_number, call.column_letter)} - {call.track_title}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <BingoTransportLane
            sessionId={sessionId}
            calls={calls}
            currentCallIndex={session?.current_call_index ?? 0}
            pullCallId={session?.pull_call_id ?? null}
            onChanged={load}
            accent="assistant"
            maxRows={6}
          />
        </div>
      </div>
    </div>
  );
}
