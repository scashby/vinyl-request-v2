"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { generateBingoCardsPdf } from "src/lib/bingoCardsPdf";
import { generateBingoCallSheetPdf } from "src/lib/bingoCallSheetPdf";
import type { GameMode } from "src/lib/bingoEngine";
import { buildWelcomeRulesContent, GAME_MODE_OPTIONS, type RoundModesEntry } from "src/lib/bingoModes";
import type { RoundPlaylistEntry } from "src/lib/bingoRoundPlaylists";
import EditEventForm from "src/components/EditEventForm";
import GameSetupInfoButton from "src/components/GameSetupInfoButton";
import InlineFieldHelp from "src/components/InlineFieldHelp";
import { uploadVenueLogo } from "src/lib/uploadVenueLogo";
import { supabase } from "src/lib/supabaseClient";

type Playlist = { id: number; name: string; track_count: number };
type EventRow = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  venue_logo_url: string | null;
};
type Session = {
  id: number;
  event_id: number | null;
  playlist_id: number;
  playlist_ids: number[] | null;
  round_playlist_ids?: RoundPlaylistEntry[] | null;
  playlist_names?: string[];
  session_code: string;
  game_mode: string;
  round_modes: { round: number; modes: GameMode[] }[] | null;
  card_count: number;
  playlist_name: string;
  event_title: string | null;
  status: string;
  current_round: number;
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

const GAME_BALL_COUNT = 75;

function computeMinimumPlaylistTracks(roundCount: number, cardCount: number): number {
  void roundCount;
  void cardCount;
  return GAME_BALL_COUNT;
}

function formatEnglishMagnitude(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";

  const units: Array<{ threshold: number; label: string }> = [
    { threshold: 1_000_000_000_000_000_000_000_000_000, label: "octillion" },
    { threshold: 1_000_000_000_000_000_000_000_000, label: "septillion" },
    { threshold: 1_000_000_000_000_000_000_000, label: "sextillion" },
    { threshold: 1_000_000_000_000_000_000, label: "quintillion" },
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

const CREATE_EVENT_OPTION = "__create_new_event__";
const INITIAL_WELCOME_CONTENT = buildWelcomeRulesContent({
  round: 1,
  gameMode: "single_line",
  roundModes: [],
  hostNote: null,
});

export default function BingoSetupPage() {
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);

  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<number[]>([]);
  const [roundModes, setRoundModes] = useState<RoundModesEntry[]>([]);
  const [roundPlaylistIds, setRoundPlaylistIds] = useState<RoundPlaylistEntry[]>([]);
  const [roundPlaylistOverrideRounds, setRoundPlaylistOverrideRounds] = useState<number[]>([]);
  const [cardCount, setCardCount] = useState(40);
  const [roundCount, setRoundCount] = useState(3);
  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [placeVinylSeconds, setPlaceVinylSeconds] = useState(8);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [startSlideSeconds, setStartSlideSeconds] = useState(5);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(2);
  const [sonosDelayMs, setSonosDelayMs] = useState(75);
  const [callRevealDelaySeconds, setCallRevealDelaySeconds] = useState(3);
  const [defaultIntermissionSeconds, setDefaultIntermissionSeconds] = useState(180);
  const [welcomeHeadingText, setWelcomeHeadingText] = useState("Welcome To Vinyl Music Bingo");
  const [welcomeMessageText, setWelcomeMessageText] = useState(INITIAL_WELCOME_CONTENT.intro);
  const [welcomeRulesText, setWelcomeRulesText] = useState(INITIAL_WELCOME_CONTENT.modeRules.join("\n"));
  const [welcomeTieBreakText, setWelcomeTieBreakText] = useState(INITIAL_WELCOME_CONTENT.tieBreak);
  const [intermissionHeadingText, setIntermissionHeadingText] = useState("Intermission");
  const [intermissionMessageText, setIntermissionMessageText] = useState("Round {round} of {roundCount} begins in");
  const [intermissionFooterText, setIntermissionFooterText] = useState("Crate reset in progress. Next round starts shortly.");
  const [thankYouHeadingText, setThankYouHeadingText] = useState("Thank You For Playing!");
  const [thankYouSubheadingText, setThankYouSubheadingText] = useState("Vinyl Music Bingo");
  const [thankYouEventsHeadingText, setThankYouEventsHeadingText] = useState("Find Us Next At");
  const [venueLogoUrl, setVenueLogoUrl] = useState<string | null>(null);
  const [uploadingVenueLogo, setUploadingVenueLogo] = useState(false);

  const [creating, setCreating] = useState(false);
  const [downloadingRoundsSessionId, setDownloadingRoundsSessionId] = useState<number | null>(null);
  const minimumTracksForSetup = useMemo(() => computeMinimumPlaylistTracks(roundCount, cardCount), [roundCount, cardCount]);
  const trackCountByPlaylistId = useMemo(
    () => new Map(playlists.map((playlist) => [playlist.id, playlist.track_count])),
    [playlists]
  );
  const selectedPlaylistTrackCount = useMemo(
    () => selectedPlaylistIds.reduce((sum, id) => sum + (trackCountByPlaylistId.get(id) ?? 0), 0),
    [selectedPlaylistIds, trackCountByPlaylistId]
  );
  const hasSelectedPlaylists = selectedPlaylistIds.length > 0;
  const getTrackCountForPlaylistIds = useCallback(
    (playlistIds: number[]) => playlistIds.reduce((sum, id) => sum + (trackCountByPlaylistId.get(id) ?? 0), 0),
    [trackCountByPlaylistId]
  );
  const perRoundCardCapacityEstimate = useMemo(() => {
    const permute = (n: number, k: number) => {
      if (k < 0 || k > n) return 0;
      let result = 1;
      for (let i = 1; i <= k; i += 1) {
        result *= n - (i - 1);
      }
      return result;
    };
    return permute(15, 5) ** 4 * permute(15, 4);
  }, []);
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

  useEffect(() => {
    setRoundModes((current) => current.filter((entry) => entry.round <= roundCount));
  }, [roundCount]);

  useEffect(() => {
    setRoundPlaylistIds((current) => current.filter((entry) => entry.round <= roundCount));
  }, [roundCount]);

  useEffect(() => {
    setRoundPlaylistOverrideRounds((current) => current.filter((round) => round <= roundCount));
  }, [roundCount]);

  const getModesForRound = useCallback(
     (round: number): GameMode[] => roundModes.find((entry) => entry.round === round)?.modes ?? [],
     [roundModes]
  );

  const getPlaylistIdsForRound = useCallback(
    (round: number) => roundPlaylistIds.find((entry) => entry.round === round)?.playlist_ids ?? [],
    [roundPlaylistIds]
  );

  const setPlaylistsForRound = useCallback((round: number, playlistIds: number[]) => {
    setRoundPlaylistIds((current) => {
      const normalizedIds = Array.from(new Set(playlistIds.filter((value) => Number.isFinite(value) && value > 0)));
      const remaining = current.filter((entry) => entry.round !== round);
      if (normalizedIds.length === 0) {
        return remaining.sort((left, right) => left.round - right.round);
      }

      return [...remaining, { round, playlist_ids: normalizedIds }].sort((left, right) => left.round - right.round);
    });
  }, []);

  const setRoundPlaylistOverrideEnabled = useCallback((round: number, enabled: boolean) => {
    setRoundPlaylistOverrideRounds((current) => {
      if (enabled) {
        if (current.includes(round)) return current;
        return [...current, round].sort((left, right) => left - right);
      }
      return current.filter((value) => value !== round);
    });

    if (!enabled) {
      setPlaylistsForRound(round, []);
    }
  }, [setPlaylistsForRound]);

  const missingPlaylistRounds = useMemo(
    () => hasSelectedPlaylists
      ? []
      : Array.from({ length: Math.max(1, roundCount) }, (_, index) => index + 1).filter(
          (round) => getPlaylistIdsForRound(round).length === 0
        ),
    [getPlaylistIdsForRound, hasSelectedPlaylists, roundCount]
  );
  const hasUsablePlaylistConfiguration = hasSelectedPlaylists || missingPlaylistRounds.length === 0;

  const toggleRoundMode = useCallback(
    (round: number, mode: GameMode) => {
      setRoundModes((current) => {
        const existingModes = current.find((entry) => entry.round === round)?.modes ?? [];
        const hasMode = existingModes.includes(mode);
        const nextModes = hasMode ? existingModes.filter((value) => value !== mode) : [...existingModes, mode];

        if (nextModes.length === 0) {
          return current.filter((entry) => entry.round !== round);
        }

        const updatedEntry: RoundModesEntry = { round, modes: nextModes };
        const rest = current.filter((entry) => entry.round !== round);
        return [...rest, updatedEntry].sort((a, b) => a.round - b.round);
      });
    },
    []
  );

  const derivedGameMode = useMemo<GameMode>(
    () => roundModes[0]?.modes[0] ?? "single_line",
    [roundModes]
  );
  const welcomePreviewContent = useMemo(() => {
    const content = buildWelcomeRulesContent({
      round: 1,
      gameMode: derivedGameMode,
      roundModes,
      hostNote: null,
    });

    const customRules = welcomeRulesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return {
      heading: welcomeHeadingText.trim() || "Welcome To Vinyl Music Bingo",
      intro: welcomeMessageText || content.intro,
      modeRules: customRules.length > 0 ? customRules : content.modeRules,
      tieBreak: welcomeTieBreakText || content.tieBreak,
    };
  }, [derivedGameMode, roundModes, welcomeHeadingText, welcomeMessageText, welcomeRulesText, welcomeTieBreakText]);

  useEffect(() => {
    if (!eventId) { setVenueLogoUrl(null); return; }
    const found = events.find((e) => e.id === eventId);
    setVenueLogoUrl(found?.venue_logo_url ?? null);
  }, [eventId, events]);

  const handleVenueLogoUpload = useCallback(async () => {
    if (!eventId) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploadingVenueLogo(true);
      try {
        const { publicUrl } = await uploadVenueLogo(file);
        await supabase.from("events").update({ venue_logo_url: publicUrl }).eq("id", eventId);
        setVenueLogoUrl(publicUrl);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to upload venue logo");
      } finally {
        setUploadingVenueLogo(false);
      }
    };
    input.click();
  }, [eventId]);

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

  const resetSession = async (sessionId: number, code: string) => {
    if (!confirm(`Reset session ${code}? This will clear call progress and return to welcome screen.`)) return;
    const res = await fetch(`/api/games/bingo/sessions/${sessionId}/reset`, { method: "POST" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert((payload as { error?: string }).error ?? "Failed to reset session");
      return;
    }
    void load();
  };

  const createSession = async () => {
    if (!hasUsablePlaylistConfiguration) return;
    setCreating(true);
    try {
      const res = await fetch("/api/games/bingo/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId ? Number(eventId) : null,
          playlist_id: selectedPlaylistIds[0],
          playlist_ids: selectedPlaylistIds,
          round_playlist_ids: roundPlaylistIds,
          game_mode: derivedGameMode,
          round_modes: roundModes,
          card_count: cardCount,
          round_count: roundCount,
          remove_resleeve_seconds: removeResleeveSeconds,
          place_vinyl_seconds: placeVinylSeconds,
          cue_seconds: cueSeconds,
          start_slide_seconds: startSlideSeconds,
          host_buffer_seconds: hostBufferSeconds,
          sonos_output_delay_ms: sonosDelayMs,
          call_reveal_delay_seconds: callRevealDelaySeconds,
          default_intermission_seconds: defaultIntermissionSeconds,
          next_game_rules_text: welcomePreviewContent.intro || null,
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

  const openJumbotronPreview = useCallback((screen: "welcome" | "intermission" | "thanks") => {
    const previewSessionId = (eventId
      ? sessions.find((session) => session.event_id === eventId)?.id
      : null) ?? sessions[0]?.id;
    if (!previewSessionId) {
      alert("Create a session first, then use preview.");
      return;
    }

    const selectedEvent = eventId ? events.find((entry) => entry.id === eventId) : null;
    const params = new URLSearchParams({
      sessionId: String(previewSessionId),
      preview: screen,
      previewIntermissionSeconds: String(defaultIntermissionSeconds),
      previewWelcomeHeading: welcomePreviewContent.heading,
      previewWelcomeText: welcomePreviewContent.intro,
      previewWelcomeRules: welcomePreviewContent.modeRules.join("\n"),
      previewIntermissionHeading: intermissionHeadingText.trim(),
      previewIntermissionText: intermissionMessageText.trim(),
      previewIntermissionFooter: intermissionFooterText.trim(),
      previewThanksHeading: thankYouHeadingText.trim(),
      previewThanksSubheading: thankYouSubheadingText.trim(),
      previewThanksEventsHeading: thankYouEventsHeadingText.trim(),
    });

    if (welcomePreviewContent.tieBreak.trim()) {
      params.set("previewWelcomeTieBreak", welcomePreviewContent.tieBreak.trim());
    }
    if (selectedEvent?.venue_logo_url) {
      params.set("previewVenueLogo", selectedEvent.venue_logo_url);
    }
    if (selectedEvent?.title) {
      params.set("previewVenueName", selectedEvent.title);
    }

    const url = `/admin/games/bingo/jumbotron?${params.toString()}`;
    openGameWindow(
      url,
      `bingo_jumbotron_preview_${screen}`,
      "width=1920,height=1080,noopener,noreferrer"
    );
  }, [
    defaultIntermissionSeconds,
    eventId,
    events,
    intermissionFooterText,
    intermissionHeadingText,
    intermissionMessageText,
    sessions,
    thankYouEventsHeadingText,
    thankYouHeadingText,
    thankYouSubheadingText,
    welcomePreviewContent,
  ]);

  const downloadCards = async (sessionId: number, layout: "2-up" | "4-up") => {
    const res = await fetch(`/api/games/bingo/cards?sessionId=${sessionId}`);
    if (!res.ok) return;
    const payload = await res.json();
    const doc = generateBingoCardsPdf(payload.data ?? [], layout, `Music Bingo ${sessionId}`);
    doc.save(`bingo-${sessionId}-cards-${layout}.pdf`);
  };

  const downloadCallSheet = async (
    sessionId: number,
    round?: number,
    options?: { suppressErrorAlert?: boolean }
  ): Promise<boolean> => {
    const roundSuffix = round ? `?round=${round}` : "";
    const res = await fetch(`/api/games/bingo/sessions/${sessionId}/calls${roundSuffix}`);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      if (!options?.suppressErrorAlert) {
        alert((payload as { error?: string }).error ?? "Failed to download call sheet");
      }
      return false;
    }
    const payload = await res.json();
    const title = round ? `Music Bingo Session ${sessionId} Round ${round}` : `Music Bingo Session ${sessionId}`;
    const doc = generateBingoCallSheetPdf(payload.data ?? [], title);
    const filename = round ? `bingo-${sessionId}-round-${round}-call-sheet.pdf` : `bingo-${sessionId}-call-sheet.pdf`;
    doc.save(filename);
    return true;
  };

  const downloadAllRoundSheets = async (session: Session) => {
    if (downloadingRoundsSessionId !== null) return;
    setDownloadingRoundsSessionId(session.id);

    try {
      for (let round = 1; round <= Math.max(1, session.round_count); round += 1) {
        const ok = await downloadCallSheet(session.id, round, { suppressErrorAlert: true });
        if (!ok) {
          alert(`Failed to download round ${round} sheet. Stopped bulk download.`);
          return;
        }
        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), 120);
        });
      }
    } finally {
      setDownloadingRoundsSessionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#3f130f,transparent_40%),linear-gradient(180deg,#171717,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-amber-900/50 bg-black/45 p-6">
          <h1 className="text-4xl font-black uppercase text-amber-100">Vinyl Bingo Setup</h1>
          <p className="mt-2 text-sm text-stone-300">Music Bingo uses songs instead of numbers: as tracks play, teams mark matching squares, and the first team to complete the winning pattern wins.</p>
          <div className="mt-3 flex justify-end"><GameSetupInfoButton gameSlug="bingo" /></div>
        </header>

        {/* ── SECTION 1: Session Setup ─────────────────────────────── */}
        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">1. Session Setup</h2>
          <p className="mt-1 text-xs text-stone-400">
            Minimum playlist size: <span className="font-semibold text-amber-300">{minimumTracksForSetup}</span> tracks to build one bingo crate for this game.
          </p>
          <p className="mt-1 text-xs text-stone-400">
            Estimated exact card layouts from one 75-track crate: <span className="font-semibold text-emerald-300">{formatEnglishMagnitude(perRoundCardCapacityEstimate)}</span> before an exact duplicate.
          </p>
          {hasSelectedPlaylists ? (
            <p className={`mt-1 text-xs ${selectedPlaylistTrackCount >= minimumTracksForSetup ? "text-emerald-300" : "text-rose-300"}`}>
              Selected playlists: {selectedPlaylistTrackCount} tracks {selectedPlaylistTrackCount >= minimumTracksForSetup ? "· enough to build the game crate and reshuffle it each round." : `· need at least ${minimumTracksForSetup} tracks to build the game crate.`}
            </p>
          ) : (
            <p className={`mt-1 text-xs ${hasUsablePlaylistConfiguration ? "text-amber-300" : "text-rose-300"}`}>
              No master playlist selected {hasUsablePlaylistConfiguration ? "· each round will use its own override playlists." : `· add round-specific playlists for rounds ${missingPlaylistRounds.join(", ")}.`}
            </p>
          )}

          {/* Event + Players */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
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
            <label className="text-sm">Estimated # of Players <InlineFieldHelp label="Card Count" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={1} value={cardCount} onChange={(e) => setCardCount(Number(e.target.value) || 1)} />
            </label>
          </div>

          {/* Playlists */}
          <div className="mt-4">
            <label className="block text-sm">Master Playlists (optional if every round has its own override) <InlineFieldHelp label="Playlist" />
              <select
                multiple
                size={5}
                className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                value={selectedPlaylistIds.map(String)}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions)
                    .map((option) => Number(option.value))
                    .filter((value) => Number.isFinite(value));
                  setSelectedPlaylistIds(values);
                }}
              >
                {playlists.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.track_count})</option>)}
              </select>
              <p className="mt-2 text-xs text-stone-500">Leave this empty if each round below should use its own themed playlist set.</p>
              <a
                href="/edit-collection?playlistStudio=1&playlistView=manual&viewMode=playlist&trackSource=playlists&folderMode=playlists"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block rounded border border-stone-600 px-2 py-1 text-xs font-semibold text-stone-200 hover:border-amber-400 hover:text-amber-200"
              >
                Open Playlist Editor
              </a>
            </label>
          </div>

          {/* Rounds with inline per-round game modes */}
          <div className="mt-5">
            <div className="flex items-center gap-4">
              <label className="text-sm">Rounds <InlineFieldHelp label="Rounds" />
                <input className="mt-1 w-24 rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={1} value={roundCount} onChange={(e) => setRoundCount(Number(e.target.value) || 1)} />
              </label>
            </div>
            <div className="mt-3 space-y-2">
              {Array.from({ length: Math.max(1, roundCount) }, (_, index) => {
                const round = index + 1;
                const activeModes = getModesForRound(round);
                const roundPlaylistSelection = getPlaylistIdsForRound(round);
                const overrideEnabled = roundPlaylistOverrideRounds.includes(round);
                const usesOverride = overrideEnabled && roundPlaylistSelection.length > 0;
                const roundTrackCount = getTrackCountForPlaylistIds(roundPlaylistSelection);
                return (
                  <div key={round} className="rounded border border-stone-700/70 bg-black/40 p-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-300">
                      Round {round} — Game Mode{activeModes.length !== 1 ? "s" : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {GAME_MODE_OPTIONS.map((mode) => {
                        const checked = activeModes.includes(mode.value);
                        return (
                          <label key={mode.value} className={`cursor-pointer rounded border px-2 py-1 text-xs ${checked ? "border-amber-500 bg-amber-900/30 text-amber-100" : "border-stone-700 bg-stone-900 text-stone-300"}`}>
                            <input type="checkbox" className="mr-1" checked={checked} onChange={() => toggleRoundMode(round, mode.value)} />
                            {mode.label}
                          </label>
                        );
                      })}
                    </div>
                    {activeModes.length === 0 ? (
                      <p className="mt-1 text-[11px] text-stone-500">No mode selected — defaults to Single Line</p>
                    ) : null}
                    <div className="mt-3 border-t border-stone-800 pt-3">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-stone-300">
                        <input
                          type="checkbox"
                          checked={overrideEnabled}
                          onChange={(event) => setRoundPlaylistOverrideEnabled(round, event.target.checked)}
                        />
                        Use Playlist Override For Round {round}
                      </label>
                      {overrideEnabled ? (
                        <>
                          <select
                            multiple
                            size={4}
                            className="mt-2 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-xs"
                            value={roundPlaylistSelection.map(String)}
                            onChange={(e) => {
                              const values = Array.from(e.target.selectedOptions)
                                .map((option) => Number(option.value))
                                .filter((value) => Number.isFinite(value));
                              setPlaylistsForRound(round, values);
                            }}
                          >
                            {playlists.map((playlist) => (
                              <option key={`${round}-${playlist.id}`} value={playlist.id}>
                                {playlist.name} ({playlist.track_count})
                              </option>
                            ))}
                          </select>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setPlaylistsForRound(round, [])}
                              className="rounded border border-stone-700 px-2 py-1 text-stone-300 hover:border-amber-500 hover:text-amber-200"
                            >
                              Clear Override
                            </button>
                            <span className={usesOverride ? (roundTrackCount >= minimumTracksForSetup ? "text-emerald-300" : "text-rose-300") : "text-stone-500"}>
                              {usesOverride
                                ? `${roundTrackCount} tracks selected${roundTrackCount >= minimumTracksForSetup ? " · enough for this round crate." : ` · need at least ${minimumTracksForSetup} tracks.`}`
                                : "Select one or more playlists for this round override."}
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="mt-2 text-[11px] text-stone-500">Using master playlist selection for this round.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            disabled={!hasUsablePlaylistConfiguration || creating}
            onClick={createSession}
            className="mt-6 rounded bg-red-700 px-5 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Session"}
          </button>
        </section>

        {/* ── SECTION 2: Gameplay Timing ────────────────────────── */}
        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">2. Gameplay Timing</h2>
          <p className="mt-1 text-xs text-stone-400">These values set the session defaults. The host can adjust timing live during the game.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">Sonos Output Delay (ms) <InlineFieldHelp label="Sonos Output Delay (ms)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={sonosDelayMs} onChange={(e) => setSonosDelayMs(Number(e.target.value) || 0)} />
            </label>
            <label className="text-sm">Place New Vinyl (sec) <InlineFieldHelp label="Place New Vinyl (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={placeVinylSeconds} onChange={(e) => setPlaceVinylSeconds(Number(e.target.value) || 0)} />
            </label>
            <label className="text-sm">Cue Track (sec) <InlineFieldHelp label="Cue Track (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={cueSeconds} onChange={(e) => setCueSeconds(Number(e.target.value) || 0)} />
            </label>
            <label className="text-sm">Remove &amp; Resleeve (sec) <InlineFieldHelp label="Remove + Resleeve (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={removeResleeveSeconds} onChange={(e) => setRemoveResleeveSeconds(Number(e.target.value) || 0)} />
            </label>
            <label className="text-sm">Start Delay (sec) <InlineFieldHelp label="Press Start + Slide (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={startSlideSeconds} onChange={(e) => setStartSlideSeconds(Number(e.target.value) || 0)} />
            </label>
            <label className="text-sm">Host Buffer (sec) <InlineFieldHelp label="Host Buffer (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={hostBufferSeconds} onChange={(e) => setHostBufferSeconds(Number(e.target.value) || 0)} />
            </label>
            <label className="text-sm">Reveal Delay (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={callRevealDelaySeconds} onChange={(e) => setCallRevealDelaySeconds(Number(e.target.value) || 0)} />
            </label>
            <label className="text-sm">Intermission (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={defaultIntermissionSeconds} onChange={(e) => setDefaultIntermissionSeconds(Number(e.target.value) || 0)} />
            </label>
          </div>
          <p className="mt-3 text-xs text-stone-400">
            Time until next call: <span className="font-semibold text-amber-300">{derivedSecondsToNextCall}s</span> (Sonos delay + vinyl handling timing).
          </p>
        </section>

        {/* ── SECTION 3: Jumbotron Content ───────────────────────── */}
        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">3. Jumbotron Content</h2>
          <p className="mt-1 text-xs text-stone-400">Customize what appears on each jumbotron screen state.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {/* Welcome Screen */}
            <div className="rounded-xl border border-amber-900/40 bg-stone-950/50 p-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-amber-200">Welcome Screen</h3>
              <p className="mt-1 text-xs text-stone-400">Shown before each round. Rule text is generated automatically from the round modes above.</p>
              <button
                type="button"
                onClick={() => openJumbotronPreview("welcome")}
                className="mt-3 rounded border border-amber-700/70 bg-amber-950/30 px-3 py-1 text-xs font-semibold text-amber-200 hover:border-amber-500"
              >
                Preview Welcome
              </button>
              <label className="mt-3 block text-sm text-stone-300">Welcome Heading
                <input
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-200"
                  value={welcomeHeadingText}
                  onChange={(e) => setWelcomeHeadingText(e.target.value)}
                />
              </label>
              <label className="mt-3 block text-sm text-stone-300">Welcome Message
                <textarea
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-200 placeholder:text-stone-600"
                  rows={4}
                  placeholder="Edit the welcome message shown to players (line breaks supported)..."
                  value={welcomeMessageText}
                  onChange={(e) => setWelcomeMessageText(e.target.value)}
                />
              </label>
              <label className="mt-3 block text-sm text-stone-300">Round Rules (one per line)
                <textarea
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-200 placeholder:text-stone-600"
                  rows={5}
                  placeholder="Type each rule on a new line..."
                  value={welcomeRulesText}
                  onChange={(e) => setWelcomeRulesText(e.target.value)}
                />
              </label>
              <label className="mt-3 block text-sm text-stone-300">Tie-break Line
                <textarea
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-200 placeholder:text-stone-600"
                  rows={2}
                  placeholder="Edit tie-break text..."
                  value={welcomeTieBreakText}
                  onChange={(e) => setWelcomeTieBreakText(e.target.value)}
                />
              </label>
              <div className="mt-3">
                <p className="text-sm text-stone-300">Venue Logo</p>
                {eventId ? (
                  <div className="mt-2">
                    {venueLogoUrl ? (
                      <img src={venueLogoUrl} alt="Venue logo" className="mb-2 h-12 rounded object-contain" />
                    ) : (
                      <p className="mb-2 text-xs text-stone-500">No logo set for this event.</p>
                    )}
                    <button
                      type="button"
                      disabled={uploadingVenueLogo}
                      onClick={handleVenueLogoUpload}
                      className="rounded border border-stone-600 px-3 py-1 text-xs text-stone-300 hover:border-amber-500 hover:text-amber-200 disabled:opacity-50"
                    >
                      {uploadingVenueLogo ? "Uploading…" : venueLogoUrl ? "Replace Logo" : "Upload Logo"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-stone-500">Link an event above to upload a venue logo.</p>
                )}
              </div>
            </div>

            {/* Intermission Screen */}
            <div className="rounded-xl border border-amber-900/40 bg-stone-950/50 p-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-amber-200">Intermission Screen</h3>
              <button
                type="button"
                onClick={() => openJumbotronPreview("intermission")}
                className="mt-2 rounded border border-amber-700/70 bg-amber-950/30 px-3 py-1 text-xs font-semibold text-amber-200 hover:border-amber-500"
              >
                Preview Intermission
              </button>
              <p className="mt-2 text-xs text-stone-400">
                Shown between rounds. Displays a countdown from the intermission duration set above (<span className="text-amber-300">{defaultIntermissionSeconds}s</span>).
              </p>
              <label className="mt-3 block text-sm text-stone-300">Intermission Heading
                <input
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-200"
                  value={intermissionHeadingText}
                  onChange={(e) => setIntermissionHeadingText(e.target.value)}
                />
              </label>
              <label className="mt-3 block text-sm text-stone-300">Intermission Message
                <textarea
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-200 placeholder:text-stone-600"
                  rows={3}
                  placeholder="Shown above countdown. Use {round} and {roundCount} tokens if needed."
                  value={intermissionMessageText}
                  onChange={(e) => setIntermissionMessageText(e.target.value)}
                />
              </label>
              <label className="mt-3 block text-sm text-stone-300">Intermission Footer
                <textarea
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-200 placeholder:text-stone-600"
                  rows={2}
                  placeholder="Shown below countdown..."
                  value={intermissionFooterText}
                  onChange={(e) => setIntermissionFooterText(e.target.value)}
                />
              </label>
            </div>

            {/* Thank You Screen */}
            <div className="rounded-xl border border-amber-900/40 bg-stone-950/50 p-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-amber-200">Thank You Screen</h3>
              <button
                type="button"
                onClick={() => openJumbotronPreview("thanks")}
                className="mt-2 rounded border border-amber-700/70 bg-amber-950/30 px-3 py-1 text-xs font-semibold text-amber-200 hover:border-amber-500"
              >
                Preview Thank You
              </button>
              <p className="mt-2 text-xs text-stone-400">Shown when the game ends with upcoming events from your schedule and venue branding.</p>
              <label className="mt-3 block text-sm text-stone-300">Thank You Heading
                <input
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-200"
                  value={thankYouHeadingText}
                  onChange={(e) => setThankYouHeadingText(e.target.value)}
                />
              </label>
              <label className="mt-3 block text-sm text-stone-300">Thank You Subheading
                <input
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-200"
                  value={thankYouSubheadingText}
                  onChange={(e) => setThankYouSubheadingText(e.target.value)}
                />
              </label>
              <label className="mt-3 block text-sm text-stone-300">Upcoming Events Heading
                <input
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-200"
                  value={thankYouEventsHeadingText}
                  onChange={(e) => setThankYouEventsHeadingText(e.target.value)}
                />
              </label>
            </div>
          </div>
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
                  <div className="text-sm">{session.session_code} · {(session.playlist_names?.length ? session.playlist_names.join(" + ") : session.playlist_name)} · {session.game_mode} · Round {session.current_round} of {session.round_count}</div>
                  {session.event_title ? (
                    <div className="mt-1 text-xs text-stone-400">Event: {session.event_title}</div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="rounded border border-amber-700/70 bg-amber-950/30 px-2 py-1 text-amber-200" onClick={() => openGameWindow(`/admin/games/bingo/edit?sessionId=${session.id}`, `bingo_edit_${session.id}`, "width=1320,height=960,left=80,top=40,noopener,noreferrer")}>Edit</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => openGameWindow(`/admin/games/bingo/host?sessionId=${session.id}`, "bingo_host", "width=1280,height=960,left=0,top=0,noopener,noreferrer")}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => openGameWindow(`/admin/games/bingo/assistant?sessionId=${session.id}`, "bingo_assistant", "width=1024,height=800,left=1300,top=0,noopener,noreferrer")}>Assistant</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => openGameWindow(`/admin/games/bingo/jumbotron?sessionId=${session.id}`, "bingo_jumbotron", "width=1920,height=1080,noopener,noreferrer")}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadCards(session.id, "2-up")}>Cards 2-up</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadCards(session.id, "4-up")}>Cards 4-up</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadCallSheet(session.id)}>Call Sheet (Live)</button>
                    <button
                      className="rounded border border-sky-700/70 px-2 py-1 text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void downloadAllRoundSheets(session)}
                      disabled={downloadingRoundsSessionId !== null}
                    >
                      {downloadingRoundsSessionId === session.id ? "Downloading Round Sheets..." : "All Round Sheets"}
                    </button>
                    <button className="rounded border border-amber-700/70 bg-amber-950/30 px-2 py-1 text-amber-200" onClick={() => resetSession(session.id, session.session_code)}>Reset Game</button>
                    {Array.from({ length: session.round_count }, (_, index) => index + 1).map((round) => (
                      <button
                        key={`${session.id}-round-sheet-${round}`}
                        className="rounded border border-sky-700/70 px-2 py-1 text-sky-200"
                        onClick={() => downloadCallSheet(session.id, round)}
                      >
                        Round {round} Sheet
                      </button>
                    ))}
                    <button className="rounded border border-red-800/60 bg-red-950/30 px-2 py-1 text-red-200" onClick={() => deleteSession(session.id, session.session_code)}>Delete</button>
                  </div>
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
