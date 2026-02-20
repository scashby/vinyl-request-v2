"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = { session_code: string; playlist_name: string; current_round: number; round_count: number };
type Call = { id: number; call_index: number; column_letter: string; track_title: string; artist_name: string; album_name: string | null; side: string | null; position: string | null; status: string };

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

  const called = useMemo(() => calls.filter((call) => ["called", "completed", "skipped"].includes(call.status)), [calls]);
  const current = called.at(-1) ?? null;
  const nextTwo = useMemo(() => calls.filter((call) => call.status === "pending").slice(0, 2), [calls]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#141414,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl border border-cyan-900/50 bg-black/50 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Sidekick</p>
              <h1 className="text-3xl font-black uppercase">Assistant Board</h1>
              <p className="text-sm text-stone-400">{session?.playlist_name} · {session?.session_code} · Round {session?.current_round} of {session?.round_count}</p>
            </div>
            <Link href={`/admin/games/bingo/host?sessionId=${sessionId}`} className="rounded border border-stone-700 px-3 py-1 text-xs">Back to Host</Link>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-stone-700 bg-black/50 p-4">
            <h2 className="text-sm font-bold uppercase text-cyan-200">Current Call</h2>
            <div className="mt-2 rounded border border-cyan-700/40 bg-cyan-950/20 p-3">
              <p className="text-lg font-black">{current ? `${current.column_letter} - ${current.track_title}` : "Waiting for first call"}</p>
              <p className="text-sm text-stone-300">{current ? `${current.artist_name} · ${current.album_name ?? ""}` : ""}</p>
            </div>

            <div className="mt-3 text-xs">
              <p className="font-semibold text-stone-300">Full Called Order</p>
              <div className="mt-2 max-h-52 overflow-auto space-y-1 text-stone-400">
                {called.map((call) => <div key={call.id}>{call.call_index}. {call.column_letter} - {call.track_title}</div>)}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-700 bg-black/50 p-4">
            <h2 className="text-sm font-bold uppercase text-cyan-200">Next 2 Prep</h2>
            <div className="mt-2 space-y-3">
              {nextTwo.map((call, index) => (
                <div key={call.id} className="rounded border border-stone-700 bg-stone-950/80 p-3 text-xs">
                  <p className="font-semibold text-cyan-300">#{index + 1} · {call.column_letter} - {call.track_title}</p>
                  <p className="text-stone-300">{call.artist_name} · {call.album_name ?? ""}</p>
                  <p className="text-stone-500">Side {call.side ?? "-"} · Position {call.position ?? "-"}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="rounded border border-stone-700 p-1 text-center">Pull now</div>
                    <div className="rounded border border-stone-700 p-1 text-center">Cue now</div>
                    <div className="rounded border border-stone-700 p-1 text-center">Called</div>
                  </div>
                </div>
              ))}
              {nextTwo.length === 0 ? <p className="text-xs text-stone-500">No pending calls.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
