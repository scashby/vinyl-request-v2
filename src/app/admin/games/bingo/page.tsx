"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { generateBingoCardsPdf } from "src/lib/bingoCardsPdf";
import { generateBingoCallSheetPdf } from "src/lib/bingoCallSheetPdf";

type Playlist = { id: number; name: string; track_count: number };
type Session = {
  id: number;
  session_code: string;
  game_mode: string;
  playlist_name: string;
  status: string;
  current_round: number;
  round_count: number;
};

const GAME_MODE_OPTIONS = [
  { value: "single_line", label: "Single Line" },
  { value: "double_line", label: "Double Line" },
  { value: "triple_line", label: "Triple Line" },
  { value: "criss_cross", label: "Criss-Cross" },
  { value: "four_corners", label: "Four Corners" },
  { value: "blackout", label: "Blackout" },
  { value: "death", label: "Death" },
] as const;

export default function BingoSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  const [playlistId, setPlaylistId] = useState<number | null>(null);
  const [gameMode, setGameMode] = useState("single_line");
  const [cardCount, setCardCount] = useState(40);
  const [roundCount, setRoundCount] = useState(3);
  const [songsPerRound, setSongsPerRound] = useState(15);
  const [secondsToNextCall, setSecondsToNextCall] = useState(45);
  const [clipSeconds, setClipSeconds] = useState(80);
  const [prepBufferSeconds, setPrepBufferSeconds] = useState(45);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [setlistMode, setSetlistMode] = useState(false);

  const [preflight, setPreflight] = useState({
    cratePull: false,
    needleReady: false,
    backupsReady: false,
    boardReset: false,
  });

  const [creating, setCreating] = useState(false);
  const preflightComplete = useMemo(() => Object.values(preflight).every(Boolean), [preflight]);

  const load = async () => {
    const [pRes, sRes] = await Promise.all([
      fetch("/api/games/playlists"),
      fetch(`/api/games/bingo/sessions${eventId ? `?eventId=${eventId}` : ""}`),
    ]);

    if (pRes.ok) {
      const payload = await pRes.json();
      setPlaylists(payload.data ?? []);
    }

    if (sRes.ok) {
      const payload = await sRes.json();
      setSessions(payload.data ?? []);
    }
  };

  useEffect(() => {
    load();
  }, [eventId]);

  const createSession = async () => {
    if (!playlistId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/games/bingo/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId ? Number(eventId) : null,
          playlist_id: playlistId,
          game_mode: gameMode,
          card_count: cardCount,
          round_count: roundCount,
          songs_per_round: songsPerRound,
          seconds_to_next_call: secondsToNextCall,
          clip_seconds: clipSeconds,
          prep_buffer_seconds: prepBufferSeconds,
          auto_advance: autoAdvance,
          setlist_mode: setlistMode,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      router.push(`/admin/games/bingo/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const downloadCards = async (sessionId: number, layout: "2-up" | "4-up") => {
    const res = await fetch(`/api/games/bingo/cards?sessionId=${sessionId}`);
    if (!res.ok) return;
    const payload = await res.json();
    const doc = generateBingoCardsPdf(payload.data ?? [], layout, `Music Bingo ${sessionId}`);
    doc.save(`bingo-${sessionId}-cards-${layout}.pdf`);
  };

  const downloadCallSheet = async (sessionId: number) => {
    const res = await fetch(`/api/games/bingo/sessions/${sessionId}/calls`);
    if (!res.ok) return;
    const payload = await res.json();
    const doc = generateBingoCallSheetPdf(payload.data ?? [], `Music Bingo Session ${sessionId}`);
    doc.save(`bingo-${sessionId}-call-sheet.pdf`);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#3f130f,transparent_40%),linear-gradient(180deg,#171717,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-amber-900/50 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Dive Bar Console</p>
          <h1 className="mt-1 text-4xl font-black uppercase text-amber-100">Vinyl Bingo Setup</h1>
          <p className="mt-2 text-sm text-stone-300">Playlist-first, analog-first, host controlled.</p>
        </header>

        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">Create Session</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">Playlist
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={playlistId ?? ""} onChange={(e) => setPlaylistId(Number(e.target.value) || null)}>
                <option value="">Select playlist</option>
                {playlists.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.track_count})</option>)}
              </select>
            </label>

            <label className="text-sm">Game Mode
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={gameMode} onChange={(e) => setGameMode(e.target.value)}>
                {GAME_MODE_OPTIONS.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
              </select>
            </label>

            <label className="text-sm">Card Count
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={1} value={cardCount} onChange={(e) => setCardCount(Number(e.target.value) || 1)} />
            </label>

            <label className="text-sm">Rounds
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={1} value={roundCount} onChange={(e) => setRoundCount(Number(e.target.value) || 1)} />
            </label>

            <label className="text-sm">Songs per Round
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={1} value={songsPerRound} onChange={(e) => setSongsPerRound(Number(e.target.value) || 1)} />
            </label>

            <label className="text-sm">Seconds to Next Call
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={10} value={secondsToNextCall} onChange={(e) => setSecondsToNextCall(Number(e.target.value) || 45)} />
            </label>

            <label className="text-sm">Clip Seconds
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={10} value={clipSeconds} onChange={(e) => setClipSeconds(Number(e.target.value) || 80)} />
            </label>

            <label className="text-sm">Prep Buffer Seconds
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={10} value={prepBufferSeconds} onChange={(e) => setPrepBufferSeconds(Number(e.target.value) || 45)} />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={setlistMode} onChange={(e) => setSetlistMode(e.target.checked)} /> Setlist mode</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} /> Auto advance</label>
          </div>

          <div className="mt-4 rounded-xl border border-stone-700 bg-stone-950/80 p-3 text-sm">
            <p className="font-semibold uppercase tracking-wide text-amber-200">Preflight Checklist</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.cratePull} onChange={(e) => setPreflight((p) => ({ ...p, cratePull: e.target.checked }))} /> Crate pull complete</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.needleReady} onChange={(e) => setPreflight((p) => ({ ...p, needleReady: e.target.checked }))} /> Needle/cleaning ready</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.backupsReady} onChange={(e) => setPreflight((p) => ({ ...p, backupsReady: e.target.checked }))} /> Backup tracks staged</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.boardReset} onChange={(e) => setPreflight((p) => ({ ...p, boardReset: e.target.checked }))} /> Dry-erase board reset</label>
            </div>
          </div>

          <button disabled={!playlistId || creating || !preflightComplete} onClick={createSession} className="mt-5 rounded bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {creating ? "Creating..." : "Create Session"}
          </button>
        </section>

        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black uppercase text-amber-100">Existing Sessions</h2>
            <button onClick={load} className="rounded border border-stone-700 px-3 py-1 text-sm">Refresh</button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-stone-400">No sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-stone-700 bg-stone-950/70 p-3">
                  <div className="text-sm">{session.session_code} · {session.playlist_name} · {session.game_mode} · Round {session.current_round} of {session.round_count}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/bingo/host?sessionId=${session.id}`)}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/bingo/assistant?sessionId=${session.id}`)}>Assistant</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/bingo/jumbotron?sessionId=${session.id}`)}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadCards(session.id, "2-up")}>Cards 2-up</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadCards(session.id, "4-up")}>Cards 4-up</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadCallSheet(session.id)}>Call Sheet</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
