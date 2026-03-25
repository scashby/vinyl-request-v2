"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { GameMode } from "src/lib/bingoEngine";
import { GAME_MODE_OPTIONS, type RoundModesEntry, normalizeRoundModes } from "src/lib/bingoModes";
import { normalizeRoundPlaylistIds, type RoundPlaylistEntry } from "src/lib/bingoRoundPlaylists";

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
  round_playlist_ids: RoundPlaylistEntry[] | null;
  session_code: string;
  game_mode: string;
  round_modes: RoundModesEntry[] | null;
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

export default function BingoEditSessionPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sessionCode, setSessionCode] = useState("");

  const [eventId, setEventId] = useState<number | null>(null);
  const [playlistIds, setPlaylistIds] = useState<number[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>("single_line");
  const [roundModes, setRoundModes] = useState<RoundModesEntry[]>([]);
  const [roundPlaylistIds, setRoundPlaylistIds] = useState<RoundPlaylistEntry[]>([]);
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
      try {
        setRoundPlaylistIds(normalizeRoundPlaylistIds(sessionPayload.round_playlist_ids, sessionPayload.round_count ?? 3));
      } catch {
        setRoundPlaylistIds([]);
      }
      setGameMode((sessionPayload.game_mode as GameMode) ?? "single_line");
      try {
        setRoundModes(normalizeRoundModes(sessionPayload.round_modes, sessionPayload.round_count ?? 3));
      } catch {
        setRoundModes([]);
      }
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
    setRoundModes((current) => current.filter((entry) => entry.round <= roundCount));
  }, [roundCount]);

  useEffect(() => {
    setRoundPlaylistIds((current) => current.filter((entry) => entry.round <= roundCount));
  }, [roundCount]);

  const getModesForRound = useCallback(
    (round: number) => roundModes.find((entry) => entry.round === round)?.modes ?? [gameMode],
    [roundModes, gameMode]
  );

  const getPlaylistIdsForRound = useCallback(
    (round: number) => roundPlaylistIds.find((entry) => entry.round === round)?.playlist_ids ?? [],
    [roundPlaylistIds]
  );

  const setPlaylistIdsForRound = useCallback((round: number, nextPlaylistIds: number[]) => {
    setRoundPlaylistIds((current) => {
      const normalizedIds = Array.from(new Set(nextPlaylistIds.filter((value) => Number.isFinite(value) && value > 0)));
      const remaining = current.filter((entry) => entry.round !== round);
      if (normalizedIds.length === 0) {
        return remaining.sort((left, right) => left.round - right.round);
      }

      return [...remaining, { round, playlist_ids: normalizedIds }].sort((left, right) => left.round - right.round);
    });
  }, []);

  const missingPlaylistRounds = useMemo(
    () => playlistIds.length > 0
      ? []
      : Array.from({ length: Math.max(1, roundCount) }, (_, index) => index + 1).filter(
          (round) => getPlaylistIdsForRound(round).length === 0
        ),
    [getPlaylistIdsForRound, playlistIds.length, roundCount]
  );
  const hasUsablePlaylistConfiguration = playlistIds.length > 0 || missingPlaylistRounds.length === 0;

  const toggleRoundMode = useCallback(
    (round: number, mode: GameMode) => {
      setRoundModes((current) => {
        const existing = current.find((entry) => entry.round === round)?.modes ?? [];
        const hasMode = existing.includes(mode);
        const nextModes = hasMode ? existing.filter((value) => value !== mode) : [...existing, mode];

        if (nextModes.length === 0) {
          return current.filter((entry) => entry.round !== round);
        }

        const nextEntry: RoundModesEntry = { round, modes: nextModes };
        const rest = current.filter((entry) => entry.round !== round);
        return [...rest, nextEntry].sort((a, b) => a.round - b.round);
      });
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!Number.isFinite(sessionId) || !hasUsablePlaylistConfiguration) {
      setError(
        missingPlaylistRounds.length > 0
          ? `Add a master playlist or round overrides for rounds ${missingPlaylistRounds.join(", ")}.`
          : "At least one playlist is required."
      );
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
          round_playlist_ids: roundPlaylistIds,
          game_mode: gameMode,
          round_modes: roundModes,
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

                <label className="text-sm">Master Playlists
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
                  <p className="mt-2 text-xs text-stone-500">Leave this empty only if every round below has its own playlist override.</p>
                </label>

                <label className="text-sm">Default Game Mode
                  <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={gameMode} onChange={(e) => setGameMode(e.target.value as GameMode)}>
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

                <label className="text-sm">Call Reveal Step (sec)
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={300} value={callRevealDelay} onChange={(e) => setCallRevealDelay(Math.max(0, Math.min(300, Number(e.target.value) || 0)))} />
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

              <div className="rounded border border-stone-700 bg-stone-950/40 p-3">
                <p className="text-sm font-semibold text-amber-200">Round Win Modes</p>
                <p className="mt-1 text-xs text-stone-400">Set one or more modes per round. If a round has none selected, it uses the default mode. Playlist overrides are optional and fall back to the master crate.</p>
                <div className="mt-3 space-y-3">
                  {Array.from({ length: roundCount }, (_, index) => {
                    const round = index + 1;
                    const activeModes = getModesForRound(round);
                    const explicit = roundModes.some((entry) => entry.round === round);
                    const roundPlaylistSelection = getPlaylistIdsForRound(round);
                    const hasPlaylistOverride = roundPlaylistSelection.length > 0;
                    return (
                      <div key={round} className="rounded border border-stone-700/70 bg-black/40 p-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-300">
                          Round {round} {explicit ? "(custom)" : "(default)"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {GAME_MODE_OPTIONS.map((mode) => {
                            const checked = activeModes.includes(mode.value);
                            return (
                              <label key={mode.value} className={`cursor-pointer rounded border px-2 py-1 text-xs ${checked ? "border-amber-500 bg-amber-900/30 text-amber-100" : "border-stone-700 bg-stone-900 text-stone-300"}`}>
                                <input
                                  type="checkbox"
                                  className="mr-1"
                                  checked={checked}
                                  onChange={() => toggleRoundMode(round, mode.value)}
                                />
                                {mode.label}
                              </label>
                            );
                          })}
                        </div>
                        <div className="mt-3 border-t border-stone-800 pt-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-300">
                            Round {round} Playlist Override {hasPlaylistOverride ? "(custom)" : "(uses master crate)"}
                          </p>
                          <select
                            multiple
                            size={5}
                            className="mt-2 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-xs"
                            value={roundPlaylistSelection.map(String)}
                            onChange={(e) => {
                              const values = Array.from(e.target.selectedOptions)
                                .map((option) => Number(option.value))
                                .filter((value) => Number.isFinite(value));
                              setPlaylistIdsForRound(round, values);
                            }}
                          >
                            {playlists.map((playlist) => (
                              <option key={`${round}-${playlist.id}`} value={playlist.id}>{playlist.name} ({playlist.track_count})</option>
                            ))}
                          </select>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-stone-400">
                            <button
                              type="button"
                              onClick={() => setPlaylistIdsForRound(round, [])}
                              className="rounded border border-stone-700 px-2 py-1 text-stone-300 hover:border-amber-500 hover:text-amber-200"
                            >
                              Clear Override
                            </button>
                            <span>{hasPlaylistOverride ? "This round uses only the selected playlists." : "Leave empty to use the master playlist selection."}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!hasUsablePlaylistConfiguration ? (
                <p className="text-sm text-red-400">Add a master playlist or round overrides for rounds {missingPlaylistRounds.join(", ")}.</p>
              ) : null}

              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={showCountdown} onChange={(e) => setShowCountdown(e.target.checked)} />
                Show Countdown
              </label>

              <label className="block text-sm">Welcome Screen Host Note (optional)
                <textarea rows={3} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm" value={nextGameRulesText} onChange={(e) => setNextGameRulesText(e.target.value)} placeholder="Optional extra note shown below the generated mode rules..." />
              </label>

              {error ? <p className="text-sm text-red-400">{error}</p> : null}

              <div className="flex justify-end gap-3">
                <button onClick={resetGame} disabled={saving} className="rounded border border-amber-700/70 bg-amber-950/30 px-4 py-2 text-sm text-amber-200 disabled:opacity-50">Reset Game</button>
                <Link href="/admin/games/bingo" className="rounded border border-stone-600 px-4 py-2 text-sm">Cancel</Link>
                <button onClick={save} disabled={saving || !hasUsablePlaylistConfiguration} className="rounded bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
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
