"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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
  playlist_ids: number[] | null;
  session_code: string;
  game_mode: string;
  card_count: number;
  round_count: number;
  remove_resleeve_seconds: number;
  place_vinyl_seconds: number;
  cue_seconds: number;
  start_slide_seconds: number;
  host_buffer_seconds: number;
  sonos_output_delay_ms: number;
  seconds_to_next_call: number;
  call_reveal_delay_seconds: number;
  show_countdown: boolean;
  recent_calls_limit: number;
  next_game_rules_text: string | null;
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

export default function BingoEditSessionPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sessionCode, setSessionCode] = useState("");

  const [eventId, setEventId] = useState<number | null>(null);
  const [playlistIds, setPlaylistIds] = useState<number[]>([]);
  const [gameMode, setGameMode] = useState("single_line");
  const [cardCount, setCardCount] = useState(40);
  const [roundCount, setRoundCount] = useState(3);
  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [placeVinylSeconds, setPlaceVinylSeconds] = useState(8);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [startSlideSeconds, setStartSlideSeconds] = useState(5);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(2);
  const [sonosDelayMs, setSonosDelayMs] = useState(75);
  const [callRevealDelay, setCallRevealDelay] = useState(0);
  const [showCountdown, setShowCountdown] = useState(true);
  const [recentCallsLimit, setRecentCallsLimit] = useState(5);
  const [nextGameRulesText, setNextGameRulesText] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!Number.isFinite(sessionId)) {
      setError("Missing or invalid sessionId in URL.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [eventsRes, playlistsRes, sessionRes] = await Promise.all([
        fetch("/api/games/bingo/events"),
        fetch("/api/games/playlists"),
        fetch(`/api/games/bingo/sessions/${sessionId}`),
      ]);

      if (!eventsRes.ok || !playlistsRes.ok || !sessionRes.ok) {
        throw new Error("Failed to load session edit data.");
      }

      const eventsPayload = await eventsRes.json();
      const playlistsPayload = await playlistsRes.json();
      const sessionPayload = (await sessionRes.json()) as Session;

      setEvents(eventsPayload.data ?? []);
      setPlaylists(playlistsPayload.data ?? []);
      setSessionCode(sessionPayload.session_code ?? "");

      setEventId(sessionPayload.event_id ?? null);
      setPlaylistIds(
        Array.isArray(sessionPayload.playlist_ids) && sessionPayload.playlist_ids.length > 0
          ? sessionPayload.playlist_ids
          : sessionPayload.playlist_id
            ? [sessionPayload.playlist_id]
            : []
      );
      setGameMode(sessionPayload.game_mode ?? "single_line");
      setCardCount(sessionPayload.card_count ?? 40);
      setRoundCount(sessionPayload.round_count ?? 3);
      setRemoveResleeveSeconds(sessionPayload.remove_resleeve_seconds ?? 20);
      setPlaceVinylSeconds(sessionPayload.place_vinyl_seconds ?? 8);
      setCueSeconds(sessionPayload.cue_seconds ?? 12);
      setStartSlideSeconds(sessionPayload.start_slide_seconds ?? 5);
      setHostBufferSeconds(sessionPayload.host_buffer_seconds ?? 2);
      setSonosDelayMs(sessionPayload.sonos_output_delay_ms ?? 75);
      setCallRevealDelay(sessionPayload.call_reveal_delay_seconds ?? 0);
      setShowCountdown(Boolean(sessionPayload.show_countdown));
      setRecentCallsLimit(sessionPayload.recent_calls_limit ?? 5);
      setNextGameRulesText(sessionPayload.next_game_rules_text ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load session edit data.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!Number.isFinite(sessionId) || playlistIds.length === 0) {
      setError("At least one playlist is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/bingo/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          playlist_id: playlistIds[0],
          playlist_ids: playlistIds,
          game_mode: gameMode,
          card_count: cardCount,
          round_count: roundCount,
          remove_resleeve_seconds: removeResleeveSeconds,
          place_vinyl_seconds: placeVinylSeconds,
          cue_seconds: cueSeconds,
          start_slide_seconds: startSlideSeconds,
          host_buffer_seconds: hostBufferSeconds,
          sonos_output_delay_ms: sonosDelayMs,
          seconds_to_next_call: derivedSecondsToNextCall,
          call_reveal_delay_seconds: callRevealDelay,
          show_countdown: showCountdown,
          recent_calls_limit: recentCallsLimit,
          next_game_rules_text: nextGameRulesText.trim() || null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as { error?: string }).error ?? "Failed to save session");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save session");
    } finally {
      setSaving(false);
    }
  };

  const resetGame = async () => {
    if (!Number.isFinite(sessionId)) return;
    if (!confirm(`Reset session ${sessionCode}? This will clear call progress and return to welcome screen.`)) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/bingo/sessions/${sessionId}/reset`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as { error?: string }).error ?? "Failed to reset session");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Failed to reset session");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#3f130f,transparent_40%),linear-gradient(180deg,#171717,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-amber-900/50 bg-black/45 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Session Management</p>
              <h1 className="mt-1 text-4xl font-black uppercase text-amber-100">Edit Bingo Session</h1>
              <p className="mt-2 text-sm text-stone-300">{sessionCode || "Loading session..."}</p>
            </div>
            <div className="flex gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-3 py-1" href="/admin/games/bingo">Back to Setup</Link>
              {Number.isFinite(sessionId) ? (
                <Link className="rounded border border-stone-700 px-3 py-1" href={`/admin/games/bingo/host?sessionId=${sessionId}`}>Host Console</Link>
              ) : null}
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          {loading ? <p className="text-sm text-stone-300">Loading session…</p> : null}

          {!loading ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm">Event (optional)
                  <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={eventId ?? ""} onChange={(e) => setEventId(Number(e.target.value) || null)}>
                    <option value="">No linked event</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>{event.date} - {event.title}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">Playlists (select one or more)
                  <select
                    multiple
                    size={6}
                    className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                    value={playlistIds.map(String)}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions)
                        .map((option) => Number(option.value))
                        .filter((value) => Number.isFinite(value));
                      setPlaylistIds(values);
                    }}
                  >
                    {playlists.map((playlist) => (
                      <option key={playlist.id} value={playlist.id}>{playlist.name} ({playlist.track_count})</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">Game Mode
                  <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={gameMode} onChange={(e) => setGameMode(e.target.value)}>
                    {GAME_MODE_OPTIONS.map((mode) => (
                      <option key={mode.value} value={mode.value}>{mode.label}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">Card Count
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={1} value={cardCount} onChange={(e) => setCardCount(Math.max(1, Number(e.target.value) || 1))} />
                </label>

                <label className="text-sm">Rounds
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={1} value={roundCount} onChange={(e) => setRoundCount(Math.max(1, Number(e.target.value) || 1))} />
                </label>

                <label className="text-sm">Call Reveal Delay (sec)
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={callRevealDelay} onChange={(e) => setCallRevealDelay(Math.max(0, Number(e.target.value) || 0))} />
                </label>

                <label className="text-sm">Remove + Resleeve (sec)
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={removeResleeveSeconds} onChange={(e) => setRemoveResleeveSeconds(Math.max(0, Number(e.target.value) || 0))} />
                </label>

                <label className="text-sm">Place New Vinyl (sec)
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={placeVinylSeconds} onChange={(e) => setPlaceVinylSeconds(Math.max(0, Number(e.target.value) || 0))} />
                </label>

                <label className="text-sm">Cue Track (sec)
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={cueSeconds} onChange={(e) => setCueSeconds(Math.max(0, Number(e.target.value) || 0))} />
                </label>

                <label className="text-sm">Press Start + Slide (sec)
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={startSlideSeconds} onChange={(e) => setStartSlideSeconds(Math.max(0, Number(e.target.value) || 0))} />
                </label>

                <label className="text-sm">Host Buffer (sec)
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={hostBufferSeconds} onChange={(e) => setHostBufferSeconds(Math.max(0, Number(e.target.value) || 0))} />
                </label>

                <label className="text-sm">Sonos Output Delay (ms)
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={sonosDelayMs} onChange={(e) => setSonosDelayMs(Math.max(0, Number(e.target.value) || 0))} />
                </label>

                <label className="text-sm">Recent Calls Limit
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={1} max={20} value={recentCallsLimit} onChange={(e) => setRecentCallsLimit(Math.max(1, Number(e.target.value) || 1))} />
                </label>
              </div>

              <p className="text-xs text-stone-400">
                Derived time to next call: <span className="font-semibold text-amber-300">{derivedSecondsToNextCall}s</span> (includes Sonos delay).
              </p>

              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={showCountdown} onChange={(e) => setShowCountdown(e.target.checked)} />
                Show Countdown
              </label>

              <label className="block text-sm">Welcome Screen Rules Text
                <textarea rows={3} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm" value={nextGameRulesText} onChange={(e) => setNextGameRulesText(e.target.value)} placeholder="Optional rules or notes shown on the welcome screen..." />
              </label>

              {error ? <p className="text-sm text-red-400">{error}</p> : null}

              <div className="flex justify-end gap-3">
                <button onClick={resetGame} disabled={saving} className="rounded border border-amber-700/70 bg-amber-950/30 px-4 py-2 text-sm text-amber-200 disabled:opacity-50">Reset Game</button>
                <Link href="/admin/games/bingo" className="rounded border border-stone-600 px-4 py-2 text-sm">Cancel</Link>
                <button onClick={save} disabled={saving || playlistIds.length === 0} className="rounded bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
