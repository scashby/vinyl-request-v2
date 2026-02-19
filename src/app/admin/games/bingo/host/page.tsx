"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Play, Pause, SkipForward, SkipBack, Monitor, Music2, History } from "lucide-react";

type Session = {
  id: number;
  session_code: string;
  status: "pending" | "active" | "paused" | "completed";
  current_call_index: number;
  round_count: number;
  current_round: number;
  seconds_to_next_call: number;
  clip_seconds: number;
  prep_buffer_seconds: number;
};

type Call = {
  id: number;
  call_index: number;
  status: "pending" | "prep_started" | "called" | "played" | "skipped" | "completed";
  column_letter: "B" | "I" | "N" | "G" | "O";
  track_title: string;
  artist_name: string;
  album_name: string | null;
  side?: string | null;
  position?: string | null;
};

export default function BingoHostPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [countdown, setCountdown] = useState(45);

  const load = useCallback(async () => {
    if (!sessionId) return;
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/vb/sessions/${sessionId}`),
      fetch(`/api/vb/sessions/${sessionId}/calls`),
    ]);

    if (sRes.ok) {
      const s = await sRes.json();
      const next = s.data as Session;
      setSession(next);
      setCountdown(next.seconds_to_next_call ?? 45);
    }

    if (cRes.ok) {
      const c = await cRes.json();
      setCalls((c.data ?? []) as Call[]);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const i = setInterval(load, 2500);
    return () => clearInterval(i);
  }, [load]);

  useEffect(() => {
    if (!session || session.status !== "active") return;
    const t = setInterval(() => setCountdown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [session?.status, session?.current_call_index]);

  const currentCall = calls.find((c) => c.call_index === (session?.current_call_index ?? 0)) ?? null;
  const playedCalls = useMemo(() => calls.filter((c) => ["played", "completed", "called"].includes(c.status)), [calls]);
  const nextTwo = useMemo(
    () =>
      calls
        .filter((c) => c.call_index > (session?.current_call_index ?? 0))
        .slice(0, 2),
    [calls, session?.current_call_index]
  );

  const patchSession = async (patch: Record<string, unknown>) => {
    if (!session) return;
    await fetch(`/api/vb/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  };

  const callAndAdvance = async () => {
    if (!session || !currentCall) return;
    await fetch(`/api/vb/calls/${currentCall.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "called" }),
    });
    await patchSession({
      status: "active",
      current_call_index: Math.min(session.current_call_index + 1, Math.max(0, calls.length - 1)),
    });
  };

  const markPrep = async () => {
    if (!currentCall) return;
    await fetch(`/api/vb/calls/${currentCall.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "prep_started" }),
    });
    await load();
  };

  const markCompleted = async () => {
    if (!currentCall) return;
    await fetch(`/api/vb/calls/${currentCall.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    await load();
  };

  const skipCurrent = async () => {
    if (!session || !currentCall) return;
    await fetch(`/api/vb/calls/${currentCall.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "skipped" }),
    });
    await patchSession({
      status: "active",
      current_call_index: Math.min(session.current_call_index + 1, Math.max(0, calls.length - 1)),
    });
  };

  const rewind = async () => {
    if (!session || session.current_call_index <= 0) return;
    const prev = calls.find((c) => c.call_index === session.current_call_index - 1);
    if (prev) {
      await fetch(`/api/vb/calls/${prev.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
    }
    await patchSession({ current_call_index: session.current_call_index - 1 });
  };

  const togglePause = async () => {
    if (!session) return;
    await patchSession({ status: session.status === "active" ? "paused" : "active" });
  };

  if (!sessionId) return <div className="p-6">Missing sessionId</div>;

  return (
    <div className="min-h-screen bg-[#121212] p-6 text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black">Host Console</h1>
              <p className="text-sm text-white/60">Code {session?.session_code ?? "----"} · Round {session?.current_round ?? 1} of {session?.round_count ?? 3}</p>
              <p className="text-xs text-white/50">Clip {session?.clip_seconds ?? 80}s · Prep buffer {session?.prep_buffer_seconds ?? 45}s</p>
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/games/bingo/assistant?sessionId=${sessionId}`} className="rounded border border-white/20 px-2 py-1 text-xs"><Music2 className="mr-1 inline h-4 w-4" />Assistant</Link>
              <Link href={`/admin/games/bingo/jumbotron?sessionId=${sessionId}`} className="rounded border border-white/20 px-2 py-1 text-xs"><Monitor className="mr-1 inline h-4 w-4" />Jumbotron</Link>
              <Link href="/admin/games/bingo/history" className="rounded border border-white/20 px-2 py-1 text-xs"><History className="mr-1 inline h-4 w-4" />History</Link>
            </div>
          </div>

          <div className="overflow-auto rounded-xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-white/60">
                <tr>
                  <th className="px-3 py-2">Column</th>
                  <th className="px-3 py-2">Track Name</th>
                  <th className="px-3 py-2">Artist Name</th>
                  <th className="px-3 py-2">Album Name</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.id} className={`border-t border-white/5 ${c.call_index === session?.current_call_index ? "bg-rose-500/10" : ""}`}>
                    <td className="px-3 py-2 font-bold text-rose-300">{c.column_letter}</td>
                    <td className="px-3 py-2">{c.track_title}</td>
                    <td className="px-3 py-2 text-white/80">{c.artist_name}</td>
                    <td className="px-3 py-2 text-white/60">{c.album_name ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-5">
            <p className="text-xs uppercase tracking-wider text-white/50">Current Call</p>
            {currentCall ? (
              <>
                <p className="mt-2 text-2xl font-black text-rose-300">{currentCall.column_letter}: {currentCall.track_title}</p>
                <p className="mt-1 text-lg text-white/80">{currentCall.artist_name}</p>
              </>
            ) : <p className="mt-2 text-white/70">No call selected.</p>}
            <p className="mt-4 text-sm text-white/60">{session?.status === "paused" ? "Paused" : `Time Until Next Call: ${countdown}s`}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={rewind} className="rounded-full border border-white/20 p-3"><SkipBack className="h-5 w-5" /></button>
              <button onClick={togglePause} className="rounded-full bg-rose-700 p-3">
                {session?.status === "active" ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button onClick={callAndAdvance} className="rounded-full border border-white/20 p-3"><SkipForward className="h-5 w-5" /></button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button onClick={markPrep} className="rounded border border-white/20 px-2 py-1">Prep Started</button>
              <button onClick={callAndAdvance} className="rounded border border-white/20 px-2 py-1">Called + Next</button>
              <button onClick={markCompleted} className="rounded border border-white/20 px-2 py-1">Completed</button>
              <button onClick={skipCurrent} className="rounded border border-white/20 px-2 py-1 text-amber-300">Skip</button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-5">
            <h2 className="text-lg font-bold">Up Next</h2>
            <div className="mt-3 space-y-2 text-sm">
              {nextTwo.length === 0 ? <p className="text-white/60">No upcoming tracks.</p> : nextTwo.map((c) => (
                <div key={c.id} className="rounded border border-white/10 px-3 py-2">
                  <span className="mr-2 font-bold text-rose-300">{c.column_letter}</span>
                  {c.track_title} <span className="text-white/60">- {c.artist_name}</span>
                  <div className="text-xs text-white/50">{c.album_name ?? "-"} {c.side ? `· Side ${c.side}` : ""} {c.position ? `· ${c.position}` : ""}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-5">
            <h2 className="text-lg font-bold">Call Card</h2>
            <p className="text-sm text-white/60">Full called list for paper card verification.</p>
            <ol className="mt-3 max-h-[420px] space-y-2 overflow-auto">
              {playedCalls.length === 0 ? <li className="text-sm text-white/60">No calls yet.</li> : playedCalls.map((c) => (
                <li key={c.id} className="rounded border border-white/10 px-3 py-2 text-sm">
                  <span className="mr-2 font-bold text-rose-300">{c.column_letter}</span>
                  {c.track_title} <span className="text-white/60">- {c.artist_name}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
