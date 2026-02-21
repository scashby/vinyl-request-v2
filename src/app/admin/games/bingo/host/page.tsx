"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatBallLabel } from "src/lib/bingoBall";

type Session = {
  id: number;
  session_code: string;
  playlist_name: string;
  game_mode: string;
  current_call_index: number;
  current_round: number;
  round_count: number;
  status: string;
  seconds_to_next_call: number;
};

type Call = {
  id: number;
  call_index: number;
  ball_number: number | null;
  column_letter: string;
  track_title: string;
  artist_name: string;
  album_name: string | null;
  status: string;
};

export default function BingoHostPage() {
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("sessionId"));

  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [backupTrack, setBackupTrack] = useState({ track_title: "", artist_name: "", album_name: "" });

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

  const activeCall = useMemo(
    () => calls.find((call) => call.call_index === (session?.current_call_index ?? 0)),
    [calls, session?.current_call_index]
  );
  const nextPendingCall = useMemo(
    () => calls.find((call) => call.call_index === (session?.current_call_index ?? 0) + 1),
    [calls, session?.current_call_index]
  );
  const called = useMemo(() => calls.filter((call) => ["called", "completed", "skipped"].includes(call.status)), [calls]);
  const previous = useMemo(() => called.slice(Math.max(0, called.length - 5), called.length - 1), [called]);
  const callForControls = activeCall ?? nextPendingCall;

  const advance = async () => {
    await fetch(`/api/games/bingo/sessions/${sessionId}/advance`, { method: "POST" });
    load();
  };

  const setCallStatus = async (status: "prep_started" | "called" | "completed" | "skipped") => {
    const target = callForControls ?? calls.find((c) => c.call_index === (session?.current_round ?? 1));
    if (!target) return;
    await fetch(`/api/games/bingo/calls/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

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

  const insertBackup = async () => {
    if (!backupTrack.track_title || !backupTrack.artist_name) return;
    await fetch(`/api/games/bingo/sessions/${sessionId}/insert-backup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backupTrack),
    });
    setBackupTrack({ track_title: "", artist_name: "", album_name: "" });
    load();
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0c0c0c,#1b1b1b)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-red-900/40 bg-black/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Host Console</p>
              <h1 className="text-3xl font-black uppercase">Music Bingo Host</h1>
              <p className="text-sm text-stone-400">{session?.playlist_name} · {session?.session_code} · Round {session?.current_round} of {session?.round_count}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/bingo/assistant?sessionId=${sessionId}`}>Assistant</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/bingo/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
              <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/bingo/history">History</Link>
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
                    <th className="pb-2">Draw</th><th className="pb-2">Ball</th><th className="pb-2">Track</th><th className="pb-2">Artist</th><th className="pb-2">Album</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 text-stone-400">{call.call_index}</td>
                      <td className="py-2 font-bold text-amber-300">{formatBallLabel(call.ball_number, call.column_letter)}</td>
                      <td className="py-2">{call.track_title}</td>
                      <td className="py-2">{call.artist_name}</td>
                      <td className="py-2 text-stone-400">{call.album_name ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/50 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">Call Card</h2>
              <div className="mt-3 rounded border border-red-700/50 bg-red-950/30 p-3">
                <p className="text-xs uppercase text-red-300">Current</p>
                <p className="text-lg font-black">
                  {callForControls ? `${formatBallLabel(callForControls.ball_number, callForControls.column_letter)} - ${callForControls.track_title}` : "No call yet"}
                </p>
                <p className="text-sm text-stone-300">{callForControls ? `${callForControls.artist_name} · ${callForControls.album_name ?? ""}` : ""}</p>
              </div>
              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Previous Calls</p>
                <ul className="mt-1 space-y-1 text-stone-400">
                  {previous.map((call) => <li key={call.id}>{formatBallLabel(call.ball_number, call.column_letter)} - {call.track_title}</li>)}
                </ul>
              </div>
              <div className="mt-3 text-xs">
                <p className="font-semibold text-stone-300">Full Called Order</p>
                <div className="mt-1 max-h-24 overflow-auto text-stone-400">
                  {called.map((call) => (
                    <div key={call.id}>{call.call_index}. {formatBallLabel(call.ball_number, call.column_letter)} - {call.track_title}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/50 p-4">
              <p className="text-xs uppercase text-amber-300">Controls</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button onClick={() => setCallStatus("prep_started")} className="rounded bg-amber-700 px-2 py-1">Prep Started</button>
                <button onClick={() => setCallStatus("called")} className="rounded bg-blue-700 px-2 py-1">Called</button>
                <button onClick={() => setCallStatus("completed")} className="rounded bg-emerald-700 px-2 py-1">Completed</button>
                <button onClick={advance} className="rounded bg-red-700 px-2 py-1">Advance</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button onClick={pause} className="rounded border border-stone-600 px-2 py-1">Pause</button>
                <button onClick={resume} className="rounded border border-stone-600 px-2 py-1">Resume</button>
                <button onClick={skip} className="rounded border border-stone-600 px-2 py-1">Skip</button>
                <button onClick={replace} className="rounded border border-stone-600 px-2 py-1">Replace with Next</button>
              </div>
              <div className="mt-3 grid gap-2 text-xs">
                <input placeholder="Backup Track" value={backupTrack.track_title} onChange={(e) => setBackupTrack((s) => ({ ...s, track_title: e.target.value }))} className="rounded border border-stone-700 bg-stone-950 px-2 py-1" />
                <input placeholder="Backup Artist" value={backupTrack.artist_name} onChange={(e) => setBackupTrack((s) => ({ ...s, artist_name: e.target.value }))} className="rounded border border-stone-700 bg-stone-950 px-2 py-1" />
                <input placeholder="Backup Album" value={backupTrack.album_name} onChange={(e) => setBackupTrack((s) => ({ ...s, album_name: e.target.value }))} className="rounded border border-stone-700 bg-stone-950 px-2 py-1" />
                <button onClick={insertBackup} className="rounded bg-purple-700 px-2 py-1">Insert Backup Song</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
