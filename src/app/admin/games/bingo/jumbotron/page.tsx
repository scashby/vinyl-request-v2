"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  session_code: string;
  current_round: number;
  round_count: number;
  seconds_to_next_call: number;
  status: string;
  recent_calls_limit: number;
  show_title: boolean;
  show_logo: boolean;
  show_rounds: boolean;
  show_countdown: boolean;
  paused_at: string | null;
};

type Call = { id: number; call_index: number; column_letter: string; track_title: string; status: string };

export default function BingoJumbotronPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [remaining, setRemaining] = useState(0);

  const load = async () => {
    if (!Number.isFinite(sessionId)) return;
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/games/bingo/sessions/${sessionId}`),
      fetch(`/api/games/bingo/sessions/${sessionId}/calls`),
    ]);

    if (sRes.ok) {
      const payload = await sRes.json();
      setSession(payload);
      setRemaining(payload.seconds_to_next_call ?? 0);
    }

    if (cRes.ok) {
      const payload = await cRes.json();
      setCalls(payload.data ?? []);
    }
  };

  useEffect(() => {
    load();
    const poll = setInterval(load, 3000);
    return () => clearInterval(poll);
  }, [sessionId]);

  useEffect(() => {
    const tick = setInterval(() => {
      setRemaining((value) => {
        if (!session || session.status === "paused") return value;
        return Math.max(0, value - 1);
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [session]);

  const called = useMemo(() => calls.filter((call) => ["called", "completed", "skipped"].includes(call.status)), [calls]);
  const current = called.at(-1) ?? null;
  const recentLimit = session?.recent_calls_limit ?? 5;
  const recent = called.slice(Math.max(0, called.length - recentLimit));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#5a180e,transparent_35%),linear-gradient(180deg,#0a0a0a,#101010)] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-amber-700/40 bg-black/35 p-6">
          {session?.show_title ? <h1 className="text-5xl font-black uppercase tracking-tight text-amber-200">Music Bingo Night</h1> : null}
          {session?.show_logo ? <p className="mt-2 text-sm uppercase tracking-[0.3em] text-red-300">Dead Wax Dialogues</p> : null}

          <div className="mt-4 flex flex-wrap gap-6 text-xl font-semibold">
            {session?.show_rounds ? <p>Round {session?.current_round} of {session?.round_count}</p> : null}
            {session?.show_countdown ? <p>Time Until Next Call: <span className="font-black text-amber-300">{remaining}s</span></p> : null}
            {session?.status === "paused" ? <p className="text-red-400">Paused</p> : null}
          </div>
        </header>

        <section className="rounded-3xl border border-stone-700 bg-black/45 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Current Call</p>
          <p className="mt-2 text-7xl font-black text-amber-200">{current ? `${current.column_letter} - ${current.track_title}` : "Waiting"}</p>
        </section>

        <section className="rounded-3xl border border-stone-700 bg-black/45 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Recently Called</p>
          <div className="mt-3 grid gap-2 text-2xl font-semibold">
            {recent.map((call) => <div key={call.id}>{call.column_letter} - {call.track_title}</div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
