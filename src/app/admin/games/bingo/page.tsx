"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { generateBingoCardsPdf } from "src/lib/bingoCardsPdf";
import { generateBingoCallSheetPdf } from "src/lib/bingoCallSheetPdf";

type Playlist = { id: number; name: string; track_count: number };
type EventRow = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
};
type Session = {
  id: number;
  session_code: string;
  game_mode: string;
  playlist_name: string;
  event_title: string | null;
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
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);

  const [playlistId, setPlaylistId] = useState<number | null>(null);
  const [gameMode, setGameMode] = useState("single_line");
  const [cardCount, setCardCount] = useState(40);
  const [roundCount, setRoundCount] = useState(3);
  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [placeVinylSeconds, setPlaceVinylSeconds] = useState(8);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [startSlideSeconds, setStartSlideSeconds] = useState(5);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(2);
  const [sonosDelayMs, setSonosDelayMs] = useState(75);

  const [preflight, setPreflight] = useState({
    cratePull: false,
    needleReady: false,
    backupsReady: false,
  });

  const [creating, setCreating] = useState(false);
  const preflightComplete = useMemo(() => Object.values(preflight).every(Boolean), [preflight]);
  const minTracksForMode = 75;
  const derivedSecondsToNextCall = useMemo(
    () =>
      removeResleeveSeconds +
      placeVinylSeconds +
      cueSeconds +
      startSlideSeconds +
      hostBufferSeconds +
      Math.ceil(sonosDelayMs / 1000),
    [cueSeconds, hostBufferSeconds, placeVinylSeconds, removeResleeveSeconds, sonosDelayMs, startSlideSeconds]
  );

  const load = useCallback(async () => {
    const [eRes, pRes, sRes] = await Promise.all([
      fetch("/api/games/bingo/events"),
      fetch("/api/games/playlists"),
      fetch(`/api/games/bingo/sessions${eventId ? `?eventId=${eventId}` : ""}`),
    ]);

    if (eRes.ok) {
      const payload = await eRes.json();
      setEvents(payload.data ?? []);
    }

    if (pRes.ok) {
      const payload = await pRes.json();
      setPlaylists(payload.data ?? []);
    }

    if (sRes.ok) {
      const payload = await sRes.json();
      setSessions(payload.data ?? []);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

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
          remove_resleeve_seconds: removeResleeveSeconds,
          place_vinyl_seconds: placeVinylSeconds,
          cue_seconds: cueSeconds,
          start_slide_seconds: startSlideSeconds,
          host_buffer_seconds: hostBufferSeconds,
          sonos_output_delay_ms: sonosDelayMs,
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
          <p className="mt-1 text-xs text-stone-400">
            Minimum playlist size: <span className="font-semibold text-amber-300">{minTracksForMode}</span> tracks for this game.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">Event (optional)
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={eventId ?? ""} onChange={(e) => setEventId(Number(e.target.value) || null)}>
                <option value="">No linked event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{event.date} - {event.title}</option>
                ))}
              </select>
            </label>

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

            <label className="text-sm">Remove + Resleeve (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={removeResleeveSeconds} onChange={(e) => setRemoveResleeveSeconds(Number(e.target.value) || 0)} />
            </label>

            <label className="text-sm">Place New Vinyl (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={placeVinylSeconds} onChange={(e) => setPlaceVinylSeconds(Number(e.target.value) || 0)} />
            </label>

            <label className="text-sm">Cue Track (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={cueSeconds} onChange={(e) => setCueSeconds(Number(e.target.value) || 0)} />
            </label>

            <label className="text-sm">Press Start + Slide (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={startSlideSeconds} onChange={(e) => setStartSlideSeconds(Number(e.target.value) || 0)} />
            </label>

            <label className="text-sm">Host Buffer (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={hostBufferSeconds} onChange={(e) => setHostBufferSeconds(Number(e.target.value) || 0)} />
            </label>

            <label className="text-sm">Sonos Output Delay (ms)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={sonosDelayMs} onChange={(e) => setSonosDelayMs(Number(e.target.value) || 0)} />
            </label>
          </div>
          <p className="mt-2 text-xs text-stone-400">
            Derived time to next call: <span className="font-semibold text-amber-300">{derivedSecondsToNextCall}s</span> (includes Sonos delay).
          </p>

          <div className="mt-4 rounded-xl border border-stone-700 bg-stone-950/80 p-3 text-sm">
            <p className="font-semibold uppercase tracking-wide text-amber-200">Preflight Checklist</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.cratePull} onChange={(e) => setPreflight((p) => ({ ...p, cratePull: e.target.checked }))} /> Crate pull complete</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.needleReady} onChange={(e) => setPreflight((p) => ({ ...p, needleReady: e.target.checked }))} /> Needle/cleaning ready</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.backupsReady} onChange={(e) => setPreflight((p) => ({ ...p, backupsReady: e.target.checked }))} /> Backup tracks staged</label>
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
                  {session.event_title ? (
                    <div className="mt-1 text-xs text-stone-400">Event: {session.event_title}</div>
                  ) : null}
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
