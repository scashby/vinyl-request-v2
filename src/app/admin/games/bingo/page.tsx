"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { generateBingoCardsPdf } from "src/lib/bingoCardsPdf";
import { generateBingoCallSheetPdf } from "src/lib/bingoCallSheetPdf";
import EditEventForm from "src/components/EditEventForm";
import GameSetupInfoButton from "src/components/GameSetupInfoButton";
import InlineFieldHelp from "src/components/InlineFieldHelp";

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
  event_id: number | null;
  playlist_id: number;
  session_code: string;
  game_mode: string;
  playlist_name: string;
  event_title: string | null;
  status: string;
  current_round: number;
  round_count: number;
};

type SessionDetail = {
  id: number;
  event_id: number | null;
  playlist_id: number;
  game_mode: string;
  round_count: number;
  remove_resleeve_seconds: number;
  place_vinyl_seconds: number;
  cue_seconds: number;
  start_slide_seconds: number;
  host_buffer_seconds: number;
  sonos_output_delay_ms: number;
  call_reveal_delay_seconds: number;
  recent_calls_limit: number;
  show_title: boolean;
  show_logo: boolean;
  show_rounds: boolean;
  show_countdown: boolean;
};

type EditForm = {
  event_id: number | null;
  game_mode: string;
  round_count: number;
  remove_resleeve_seconds: number;
  place_vinyl_seconds: number;
  cue_seconds: number;
  start_slide_seconds: number;
  host_buffer_seconds: number;
  sonos_output_delay_ms: number;
  call_reveal_delay_seconds: number;
  recent_calls_limit: number;
  show_title: boolean;
  show_logo: boolean;
  show_rounds: boolean;
  show_countdown: boolean;
};

const GAME_BALL_COUNT = 75;

function computeMinimumPlaylistTracks(roundCount: number, cardCount: number): number {
  const normalizedRounds = Math.max(1, Math.floor(roundCount || 1));
  const normalizedCards = Math.max(1, Math.floor(cardCount || 1));
  const base = GAME_BALL_COUNT * normalizedRounds;
  const densityBuffer = Math.max(0, Math.ceil((normalizedCards - 40) / 20)) * 5;
  return base + densityBuffer;
}

function formatEnglishMagnitude(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";

  const units: Array<{ threshold: number; label: string }> = [
    { threshold: 1_000_000_000_000_000, label: "quadrillion" },
    { threshold: 1_000_000_000_000, label: "trillion" },
    { threshold: 1_000_000_000, label: "billion" },
    { threshold: 1_000_000, label: "million" },
    { threshold: 1_000, label: "thousand" },
  ];

  const whole = Math.floor(value);
  for (const unit of units) {
    if (whole >= unit.threshold) {
      const compact = whole / unit.threshold;
      const rounded = compact >= 100 ? Math.round(compact) : Math.round(compact * 10) / 10;
      return `${rounded.toLocaleString()} ${unit.label}`;
    }
  }

  return whole.toLocaleString();
}

const GAME_MODE_OPTIONS = [
  { value: "single_line", label: "Single Line" },
  { value: "double_line", label: "Double Line" },
  { value: "triple_line", label: "Triple Line" },
  { value: "criss_cross", label: "Criss-Cross" },
  { value: "four_corners", label: "Four Corners" },
  { value: "blackout", label: "Blackout" },
  { value: "death", label: "Death" },
] as const;

const CREATE_EVENT_OPTION = "__create_new_event__";

export default function BingoSetupPage() {
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);

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

  const [creating, setCreating] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const minimumTracksForSetup = useMemo(() => computeMinimumPlaylistTracks(roundCount, cardCount), [roundCount, cardCount]);
  const selectedPlaylist = useMemo(() => playlists.find((entry) => entry.id === playlistId) ?? null, [playlists, playlistId]);
  const roundsSupportedByPlaylist = selectedPlaylist ? Math.floor(selectedPlaylist.track_count / GAME_BALL_COUNT) : 0;
  const effectiveRoundCapacity = Math.min(Math.max(1, roundCount), Math.max(1, roundsSupportedByPlaylist));
  const isPlaylistEligible = selectedPlaylist ? selectedPlaylist.track_count >= minimumTracksForSetup : false;
  const perRoundCardCapacityEstimate = useMemo(() => {
    const choose = (n: number, k: number) => {
      if (k < 0 || k > n) return 0;
      let result = 1;
      for (let i = 1; i <= k; i += 1) {
        result = (result * (n - (k - i))) / i;
      }
      return result;
    };
    return choose(15, 5) ** 4 * choose(15, 4);
  }, []);
  const estimatedUniqueCardsAcrossRounds = perRoundCardCapacityEstimate * effectiveRoundCapacity;
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

  const refreshEvents = useCallback(async () => {
    const res = await fetch("/api/games/bingo/events");
    if (!res.ok) return;
    const payload = await res.json();
    setEvents(payload.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEditSession = async (sessionId: number) => {
    if (editingSessionId === sessionId) {
      setEditingSessionId(null);
      setEditForm(null);
      return;
    }
    const res = await fetch(`/api/games/bingo/sessions/${sessionId}`);
    if (!res.ok) {
      alert("Failed to load session details");
      return;
    }
    const data = (await res.json()) as SessionDetail;
    setEditForm({
      event_id: data.event_id,
      game_mode: data.game_mode,
      round_count: data.round_count,
      remove_resleeve_seconds: data.remove_resleeve_seconds,
      place_vinyl_seconds: data.place_vinyl_seconds,
      cue_seconds: data.cue_seconds,
      start_slide_seconds: data.start_slide_seconds,
      host_buffer_seconds: data.host_buffer_seconds,
      sonos_output_delay_ms: data.sonos_output_delay_ms,
      call_reveal_delay_seconds: data.call_reveal_delay_seconds,
      recent_calls_limit: data.recent_calls_limit,
      show_title: data.show_title,
      show_logo: data.show_logo,
      show_rounds: data.show_rounds,
      show_countdown: data.show_countdown,
    });
    setEditingSessionId(sessionId);
  };

  const saveEditSession = async () => {
    if (!editingSessionId || !editForm) return;
    setEditSaving(true);
    try {
      const derivedSeconds =
        editForm.remove_resleeve_seconds +
        editForm.place_vinyl_seconds +
        editForm.cue_seconds +
        editForm.start_slide_seconds +
        editForm.host_buffer_seconds +
        Math.ceil(editForm.sonos_output_delay_ms / 1000);
      const res = await fetch(`/api/games/bingo/sessions/${editingSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          seconds_to_next_call: derivedSeconds,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        alert((payload as { error?: string }).error ?? "Failed to save session");
        return;
      }
      setEditingSessionId(null);
      setEditForm(null);
      await load();
    } finally {
      setEditSaving(false);
    }
  };

  const deleteSession = async (sessionId: number, code: string) => {
    if (!confirm(`Delete session ${code}? This cannot be undone.`)) return;
    const res = await fetch(`/api/games/bingo/sessions?id=${sessionId}`, { method: "DELETE" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert((payload as { error?: string }).error ?? "Failed to delete session");
      return;
    }
    load();
  };

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

      window.open(`/admin/games/bingo/prep?sessionId=${payload.id}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const openGameWindow = (url: string, name: string, features: string) => {
    const opened = window.open(url, name, features);
    if (opened) {
      opened.focus();
      return;
    }
    // Popup fallback for stricter browser policies
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const downloadCards = async (sessionId: number, layout: "2-up" | "4-up") => {
    const res = await fetch(`/api/games/bingo/cards?sessionId=${sessionId}`);
    if (!res.ok) return;
    const payload = await res.json();
    const doc = generateBingoCardsPdf(payload.data ?? [], layout, `Music Bingo ${sessionId}`);
    doc.save(`bingo-${sessionId}-cards-${layout}.pdf`);
  };

  const downloadCallSheet = async (sessionId: number, round?: number) => {
    const roundSuffix = round ? `?round=${round}` : "";
    const res = await fetch(`/api/games/bingo/sessions/${sessionId}/calls${roundSuffix}`);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      alert((payload as { error?: string }).error ?? "Failed to download call sheet");
      return;
    }
    const payload = await res.json();
    const title = round ? `Music Bingo Session ${sessionId} Round ${round}` : `Music Bingo Session ${sessionId}`;
    const doc = generateBingoCallSheetPdf(payload.data ?? [], title);
    const filename = round ? `bingo-${sessionId}-round-${round}-call-sheet.pdf` : `bingo-${sessionId}-call-sheet.pdf`;
    doc.save(filename);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#3f130f,transparent_40%),linear-gradient(180deg,#171717,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-amber-900/50 bg-black/45 p-6">
          <h1 className="text-4xl font-black uppercase text-amber-100">Vinyl Bingo Setup</h1>
          <p className="mt-2 text-sm text-stone-300">Music Bingo uses songs instead of numbers: as tracks play, teams mark matching squares, and the first team to complete the winning pattern wins.</p>
          <div className="mt-3 flex justify-end"><GameSetupInfoButton gameSlug="bingo" /></div>
        </header>

        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">Create Session</h2>
          <p className="mt-1 text-xs text-stone-400">
            Minimum playlist size: <span className="font-semibold text-amber-300">{minimumTracksForSetup}</span> tracks for {Math.max(1, roundCount)} round(s) with {Math.max(1, cardCount)} cards.
          </p>
          <p className="mt-1 text-xs text-stone-400">
            Estimated unique card layouts available: <span className="font-semibold text-emerald-300">{formatEnglishMagnitude(estimatedUniqueCardsAcrossRounds)}</span> across configured rounds.
          </p>
          {selectedPlaylist ? (
            <p className={`mt-1 text-xs ${selectedPlaylist.track_count >= minimumTracksForSetup ? "text-emerald-300" : "text-rose-300"}`}>
              Selected playlist has {selectedPlaylist.track_count} tracks and supports up to {roundsSupportedByPlaylist} full round(s) of 75 unique calls.
            </p>
          ) : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">Event (optional) <InlineFieldHelp label="Event (optional)" />
              <select
                className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                value={eventId ?? ""}
                onChange={(e) => {
                  const selected = e.target.value;
                  if (selected === CREATE_EVENT_OPTION) {
                    setShowCreateEventModal(true);
                    return;
                  }
                  setEventId(Number(selected) || null);
                }}
              >
                <option value="">No linked event</option>
                <option value={CREATE_EVENT_OPTION}>+ Create New Event...</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{event.date} - {event.title}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">Playlist <InlineFieldHelp label="Playlist" />
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={playlistId ?? ""} onChange={(e) => setPlaylistId(Number(e.target.value) || null)}>
                <option value="">Select playlist</option>
                {playlists.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.track_count})</option>)}
              </select>
              <a
                href="/edit-collection?playlistStudio=1&playlistView=manual&viewMode=playlist&trackSource=playlists&folderMode=playlists"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block rounded border border-stone-600 px-2 py-1 text-xs font-semibold text-stone-200 hover:border-amber-400 hover:text-amber-200"
              >
                Open Playlist Editor
              </a>
            </label>

            <label className="text-sm">Game Mode <InlineFieldHelp label="Game Mode" />
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={gameMode} onChange={(e) => setGameMode(e.target.value)}>
                {GAME_MODE_OPTIONS.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
              </select>
            </label>

            <label className="text-sm">Card Count <InlineFieldHelp label="Card Count" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={1} value={cardCount} onChange={(e) => setCardCount(Number(e.target.value) || 1)} />
            </label>

            <label className="text-sm">Rounds <InlineFieldHelp label="Rounds" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={1} value={roundCount} onChange={(e) => setRoundCount(Number(e.target.value) || 1)} />
            </label>

            <label className="text-sm">Remove + Resleeve (sec) <InlineFieldHelp label="Remove + Resleeve (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={removeResleeveSeconds} onChange={(e) => setRemoveResleeveSeconds(Number(e.target.value) || 0)} />
            </label>

            <label className="text-sm">Place New Vinyl (sec) <InlineFieldHelp label="Place New Vinyl (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={placeVinylSeconds} onChange={(e) => setPlaceVinylSeconds(Number(e.target.value) || 0)} />
            </label>

            <label className="text-sm">Cue Track (sec) <InlineFieldHelp label="Cue Track (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={cueSeconds} onChange={(e) => setCueSeconds(Number(e.target.value) || 0)} />
            </label>

            <label className="text-sm">Press Start + Slide (sec) <InlineFieldHelp label="Press Start + Slide (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={startSlideSeconds} onChange={(e) => setStartSlideSeconds(Number(e.target.value) || 0)} />
            </label>

            <label className="text-sm">Host Buffer (sec) <InlineFieldHelp label="Host Buffer (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={hostBufferSeconds} onChange={(e) => setHostBufferSeconds(Number(e.target.value) || 0)} />
            </label>

            <label className="text-sm">Sonos Output Delay (ms) <InlineFieldHelp label="Sonos Output Delay (ms)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={sonosDelayMs} onChange={(e) => setSonosDelayMs(Number(e.target.value) || 0)} />
            </label>
          </div>
          <p className="mt-2 text-xs text-stone-400">
            Derived time to next call: <span className="font-semibold text-amber-300">{derivedSecondsToNextCall}s</span> (includes Sonos delay).
          </p>

          <button disabled={!playlistId || creating || !isPlaylistEligible} onClick={createSession} className="mt-5 rounded bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
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
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => openGameWindow(`/admin/games/bingo/host?sessionId=${session.id}`, "bingo_host", "width=1280,height=960,left=0,top=0,noopener,noreferrer")}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => openGameWindow(`/admin/games/bingo/assistant?sessionId=${session.id}`, "bingo_assistant", "width=1024,height=800,left=1300,top=0,noopener,noreferrer")}>Assistant</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => openGameWindow(`/admin/games/bingo/jumbotron?sessionId=${session.id}`, "bingo_jumbotron", "width=1920,height=1080,noopener,noreferrer")}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadCards(session.id, "2-up")}>Cards 2-up</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadCards(session.id, "4-up")}>Cards 4-up</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadCallSheet(session.id)}>Call Sheet (Live)</button>
                    {Array.from({ length: session.round_count }, (_, index) => index + 1).map((round) => (
                      <button
                        key={`${session.id}-round-sheet-${round}`}
                        className="rounded border border-sky-700/70 px-2 py-1 text-sky-200"
                        onClick={() => downloadCallSheet(session.id, round)}
                      >
                        Round {round} Sheet
                      </button>
                    ))}
                    <button
                      className={`rounded border px-2 py-1 ${editingSessionId === session.id ? "border-amber-600 bg-amber-950/40 text-amber-200" : "border-stone-600 text-stone-200"}`}
                      onClick={() => openEditSession(session.id)}
                    >
                      {editingSessionId === session.id ? "Cancel Edit" : "Edit"}
                    </button>
                    <button className="rounded border border-red-800/60 bg-red-950/30 px-2 py-1 text-red-200" onClick={() => deleteSession(session.id, session.session_code)}>Delete</button>
                  </div>

                  {editingSessionId === session.id && editForm ? (
                    <div className="mt-4 border-t border-stone-700 pt-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-300">Edit Session Settings</p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                        <label className="flex flex-col gap-1">
                          <span className="text-stone-400">Event</span>
                          <select
                            className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                            value={editForm.event_id ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, event_id: Number(e.target.value) || null })}
                          >
                            <option value="">No linked event</option>
                            {events.map((ev) => (
                              <option key={ev.id} value={ev.id}>{ev.date} — {ev.title}</option>
                            ))}
                          </select>
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-stone-400">Game Mode</span>
                          <select
                            className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                            value={editForm.game_mode}
                            onChange={(e) => setEditForm({ ...editForm, game_mode: e.target.value })}
                          >
                            {GAME_MODE_OPTIONS.map((m) => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-stone-400">Round Count</span>
                          <input
                            type="number" min={1}
                            className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                            value={editForm.round_count}
                            onChange={(e) => setEditForm({ ...editForm, round_count: Math.max(1, Number(e.target.value) || 1) })}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-stone-400">Remove + Resleeve (sec)</span>
                          <input
                            type="number" min={0}
                            className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                            value={editForm.remove_resleeve_seconds}
                            onChange={(e) => setEditForm({ ...editForm, remove_resleeve_seconds: Math.max(0, Number(e.target.value) || 0) })}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-stone-400">Place New Vinyl (sec)</span>
                          <input
                            type="number" min={0}
                            className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                            value={editForm.place_vinyl_seconds}
                            onChange={(e) => setEditForm({ ...editForm, place_vinyl_seconds: Math.max(0, Number(e.target.value) || 0) })}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-stone-400">Cue Track (sec)</span>
                          <input
                            type="number" min={0}
                            className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                            value={editForm.cue_seconds}
                            onChange={(e) => setEditForm({ ...editForm, cue_seconds: Math.max(0, Number(e.target.value) || 0) })}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-stone-400">Press Start + Slide (sec)</span>
                          <input
                            type="number" min={0}
                            className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                            value={editForm.start_slide_seconds}
                            onChange={(e) => setEditForm({ ...editForm, start_slide_seconds: Math.max(0, Number(e.target.value) || 0) })}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-stone-400">Host Buffer (sec)</span>
                          <input
                            type="number" min={0}
                            className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                            value={editForm.host_buffer_seconds}
                            onChange={(e) => setEditForm({ ...editForm, host_buffer_seconds: Math.max(0, Number(e.target.value) || 0) })}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-stone-400">Sonos Output Delay (ms)</span>
                          <input
                            type="number" min={0}
                            className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                            value={editForm.sonos_output_delay_ms}
                            onChange={(e) => setEditForm({ ...editForm, sonos_output_delay_ms: Math.max(0, Number(e.target.value) || 0) })}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-stone-400">Call Reveal Delay (sec)</span>
                          <input
                            type="number" min={0} max={15}
                            className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                            value={editForm.call_reveal_delay_seconds}
                            onChange={(e) => setEditForm({ ...editForm, call_reveal_delay_seconds: Math.max(0, Math.min(15, Number(e.target.value) || 0)) })}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-stone-400">Recent Calls Limit</span>
                          <input
                            type="number" min={1} max={20}
                            className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                            value={editForm.recent_calls_limit}
                            onChange={(e) => setEditForm({ ...editForm, recent_calls_limit: Math.max(1, Math.min(20, Number(e.target.value) || 5)) })}
                          />
                        </label>

                        <div className="flex flex-col gap-1">
                          <span className="text-stone-400">Jumbotron Display</span>
                          <div className="flex flex-wrap gap-3">
                            {(["show_title", "show_logo", "show_rounds", "show_countdown"] as const).map((key) => (
                              <label key={key} className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editForm[key]}
                                  onChange={(e) => setEditForm({ ...editForm, [key]: e.target.checked })}
                                />
                                <span className="capitalize">{key.replace("show_", "")}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-stone-500">
                        Derived time to next call:{" "}
                        <span className="text-amber-300 font-semibold">
                          {editForm.remove_resleeve_seconds + editForm.place_vinyl_seconds + editForm.cue_seconds + editForm.start_slide_seconds + editForm.host_buffer_seconds + Math.ceil(editForm.sonos_output_delay_ms / 1000)}s
                        </span>
                      </p>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={saveEditSession}
                          disabled={editSaving}
                          className="rounded bg-amber-700 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                          {editSaving ? "Saving…" : "Save Changes"}
                        </button>
                        <button
                          onClick={() => { setEditingSessionId(null); setEditForm(null); }}
                          className="rounded border border-stone-600 px-3 py-1 text-xs text-stone-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showCreateEventModal ? (
        <>
          <div
            className="fixed inset-0 z-[60000] bg-black/70"
            onClick={() => setShowCreateEventModal(false)}
          />
          <div className="fixed inset-0 z-[60001] flex items-center justify-center p-4">
            <div className="w-full max-w-6xl">
              <EditEventForm
                mode="modal"
                onCancel={() => setShowCreateEventModal(false)}
                onSaved={(createdEvent) => {
                  setEventId(createdEvent.id);
                  setShowCreateEventModal(false);
                  void refreshEvents();
                }}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
