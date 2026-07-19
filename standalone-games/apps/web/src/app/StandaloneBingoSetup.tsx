"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  generateStandaloneCallSheetPdf,
  generateStandaloneCardsPdf,
} from "@/lib/standaloneBingoPrint";

type PlaylistRecord = {
  id: string;
  name: string;
  provider: string;
  createdAt: string;
};

type SnapshotRecord = {
  id: string;
  tenantPlaylistId: string;
  snapshotName?: string | null;
  createdAt: string;
  snapshotPayload?: {
    itemCount?: number;
    playlistName?: string;
    items?: Array<unknown>;
  } | null;
};

type SessionRecord = {
  id: string;
  eventId?: string | null;
  sessionCode: string;
  status: "pending" | "running" | "paused" | "completed";
  playlistSnapshotId: string;
  currentRound?: number;
  roundCount: number;
  roundModes?: Array<{ round: number; modes: string[] }>;
  cardCount: number;
  gameMode: string;
  callIntervalSeconds: number;
  removeResleeveSeconds?: number;
  placeVinylSeconds?: number;
  cueSeconds?: number;
  startSlideSeconds?: number;
  hostBufferSeconds?: number;
  sonosOutputDelayMs?: number;
  callRevealDelaySeconds?: number;
  defaultIntermissionSeconds?: number;
  welcomeHeadingText?: string | null;
  welcomeMessageText?: string | null;
  welcomeRulesText?: string | null;
  welcomeTiebreakText?: string | null;
  intermissionHeadingText?: string | null;
  intermissionMessageText?: string | null;
  intermissionFooterText?: string | null;
  thanksHeadingText?: string | null;
  thanksSubheadingText?: string | null;
  thanksEventsHeadingText?: string | null;
  showCountdown?: boolean;
  recentCallsLimit?: number;
  themeEnabled?: boolean;
  themeName?: string | null;
  isSandbox?: boolean;
  sandboxSourceSessionId?: string | null;
  sandboxExpiresAt?: string | null;
  isFavorite?: boolean;
  createdAt: string;
  startedAt?: string | null;
};

type RoundPlaylistSelection = {
  round: number;
  playlistIds: string[];
};

type RoundModesSelection = {
  round: number;
  modes: SessionRecord["gameMode"][];
};

type PlaylistChoice = {
  id: string;
  name: string;
  provider: string;
  trackCount: number;
  snapshotId: string | null;
  snapshotName: string | null;
};

type BingoPresetRecord = {
  id: string;
  name: string;
  sourcePlaylistIds: string[];
  sourcePlaylistNames: string[];
  poolSize: number;
  note?: string | null;
  createdFromSessionId?: string | null;
};

const GAME_MODE_OPTIONS: Array<{ value: SessionRecord["gameMode"]; label: string }> = [
  { value: "single_line", label: "Single Line" },
  { value: "double_line", label: "Double Line" },
  { value: "triple_line", label: "Triple Line" },
  { value: "criss_cross", label: "Criss Cross" },
  { value: "four_corners", label: "Four Corners" },
  { value: "blackout", label: "Blackout" },
  { value: "death", label: "Death" },
];

type CallRecord = {
  id: string;
  callIndex: number;
  trackTitle: string;
  artistName: string;
  status: "pending" | "called" | "skipped" | "completed";
};

type CardRecord = {
  id: string;
  cardIndex: number;
  cardIdentifier: string;
  grid: Array<{
    row: number;
    col: number;
    track_title: string;
    artist_name: string;
    free: boolean;
  }>;
};

type StandaloneBingoSetupProps = {
  tenantId: string;
  userId: string;
  entitlements: string;
  initialSessionId: string;
};

type EventRecord = {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  location?: string | null;
};

const CREATE_EVENT_OPTION = "__create_new_event__";

function getSnapshotItemCount(snapshot: SnapshotRecord) {
  const directCount = Number(snapshot.snapshotPayload?.itemCount ?? 0);
  if (Number.isFinite(directCount) && directCount > 0) return directCount;
  if (Array.isArray(snapshot.snapshotPayload?.items)) return snapshot.snapshotPayload.items.length;
  return 0;
}

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function StandaloneBingoSetup({
  tenantId,
  userId,
  entitlements,
  initialSessionId,
}: StandaloneBingoSetupProps) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);
  const [presets, setPresets] = useState<BingoPresetRecord[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventTime, setNewEventTime] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [selectedTemplateSessionId, setSelectedTemplateSessionId] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [creatingPresetSessionId, setCreatingPresetSessionId] = useState<string | null>(null);
  const [creatingSandboxSessionId, setCreatingSandboxSessionId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId);
  const [roundCount, setRoundCount] = useState(3);
  const [roundModes, setRoundModes] = useState<RoundModesSelection[]>([]);
  const [cardCount, setCardCount] = useState(40);
  const [gameMode, setGameMode] = useState<SessionRecord["gameMode"]>("single_line");
  const [callIntervalSeconds, setCallIntervalSeconds] = useState(45);
  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [placeVinylSeconds, setPlaceVinylSeconds] = useState(8);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [startSlideSeconds, setStartSlideSeconds] = useState(5);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(2);
  const [sonosOutputDelayMs, setSonosOutputDelayMs] = useState(75);
  const [callRevealDelaySeconds, setCallRevealDelaySeconds] = useState(10);
  const [defaultIntermissionSeconds, setDefaultIntermissionSeconds] = useState(600);
  const [welcomeHeadingText, setWelcomeHeadingText] = useState("Welcome To Vinyl Music Bingo");
  const [welcomeMessageText, setWelcomeMessageText] = useState("Get your cards ready and listen for the next call.");
  const [welcomeRulesText, setWelcomeRulesText] = useState("Complete the winning pattern before anyone else.");
  const [welcomeTiebreakText, setWelcomeTiebreakText] = useState("Ties are resolved by the host.");
  const [intermissionHeadingText, setIntermissionHeadingText] = useState("Intermission");
  const [intermissionMessageText, setIntermissionMessageText] = useState("Round {round} of {roundCount} begins in");
  const [intermissionFooterText, setIntermissionFooterText] = useState("Crate reset in progress. Next round starts shortly.");
  const [thanksHeadingText, setThanksHeadingText] = useState("Thank You For Playing!");
  const [thanksSubheadingText, setThanksSubheadingText] = useState("Vinyl Music Bingo");
  const [thanksEventsHeadingText, setThanksEventsHeadingText] = useState("Find Us Next At");
  const [showCountdown, setShowCountdown] = useState(true);
  const [recentCallsLimit, setRecentCallsLimit] = useState(5);
  const [themeEnabled, setThemeEnabled] = useState(false);
  const [themeName, setThemeName] = useState("");
  const [useDifferentMastersPerRound, setUseDifferentMastersPerRound] = useState(false);
  const [roundPlaylistSelections, setRoundPlaylistSelections] = useState<RoundPlaylistSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestHeaders = useMemo(
    () => ({
      "x-tenant-id": tenantId,
      "x-user-id": userId,
      "x-entitlements": entitlements,
    }),
    [entitlements, tenantId, userId]
  );

  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null;
  const templateSession = sessions.find((session) => session.id === selectedTemplateSessionId) ?? null;
  const favoriteTemplateSessions = sessions.filter((session) => Boolean(session.isFavorite));
  const sandboxSessions = sessions.filter((session) => Boolean(session.isSandbox));
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? null;
  const currentCall = [...calls].reverse().find((call) => call.status === "called") ?? null;
  const nextCalls = calls.filter((call) => call.status === "pending").slice(0, 5);
  const snapshotByPlaylistId = useMemo(() => {
    const next = new Map<string, SnapshotRecord>();
    for (const snapshot of snapshots) {
      if (!next.has(snapshot.tenantPlaylistId)) {
        next.set(snapshot.tenantPlaylistId, snapshot);
      }
    }
    return next;
  }, [snapshots]);
  const playlistChoices = useMemo<PlaylistChoice[]>(() => {
    return playlists.map((playlist) => {
      const snapshot = snapshotByPlaylistId.get(playlist.id) ?? null;
      return {
        id: playlist.id,
        name: playlist.name,
        provider: playlist.provider,
        trackCount: snapshot ? getSnapshotItemCount(snapshot) : 0,
        snapshotId: snapshot?.id ?? null,
        snapshotName: snapshot?.snapshotName ?? null,
      };
    });
  }, [playlists, snapshotByPlaylistId]);
  const playlistChoiceById = useMemo(
    () => new Map(playlistChoices.map((choice) => [choice.id, choice])),
    [playlistChoices]
  );
  const effectiveSelectedPlaylistIds = useDifferentMastersPerRound
    ? roundPlaylistSelections.flatMap((entry) => entry.playlistIds)
    : selectedPlaylistIds;
  const selectedTrackCount = effectiveSelectedPlaylistIds.reduce(
    (sum, playlistId) => sum + (playlistChoiceById.get(playlistId)?.trackCount ?? 0),
    0
  );
  const derivedSecondsToNextCall =
    removeResleeveSeconds +
    placeVinylSeconds +
    cueSeconds +
    startSlideSeconds +
    hostBufferSeconds +
    Math.ceil(sonosOutputDelayMs / 1000);
  const minimumTrackCount = 75;
  const trackConfigValid = selectedTrackCount >= minimumTrackCount && effectiveSelectedPlaylistIds.length > 0;

  async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...requestHeaders,
      },
      cache: "no-store",
    });

    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      data?: T;
    };

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }

    return (payload.data as T) ?? (payload as T);
  }

  async function loadBaseData() {
    setLoading(true);
    setError(null);
    try {
      const [nextEvents, nextPlaylists, nextPresets, nextSnapshots, nextSessions] = await Promise.all([
        fetchJson<EventRecord[]>("/api/v1/games/bingo/events"),
        fetchJson<PlaylistRecord[]>("/api/v1/playlists"),
        fetchJson<BingoPresetRecord[]>("/api/v1/games/bingo/presets"),
        fetchJson<SnapshotRecord[]>("/api/v1/playlists/snapshots"),
        fetchJson<SessionRecord[]>("/api/v1/games/bingo/sessions"),
      ]);

      setEvents(nextEvents);
      setPlaylists(nextPlaylists);
      setPresets(nextPresets);
      setSnapshots(nextSnapshots);
      setSessions(nextSessions);

      if (!selectedSessionId && nextSessions.length > 0) {
        setSelectedSessionId(nextSessions[0]!.id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load standalone data.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCalls(sessionId: string) {
    try {
      const nextCalls = await fetchJson<CallRecord[]>(
        `/api/v1/games/bingo/sessions/${sessionId}/calls`
      );
      setCalls(nextCalls);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load calls.");
    }
  }

  async function loadCards(sessionId: string) {
    return fetchJson<CardRecord[]>(`/api/v1/games/bingo/sessions/${sessionId}/cards`);
  }

  useEffect(() => {
    void loadBaseData();
  }, [tenantId, userId, entitlements]);

  useEffect(() => {
    if (!selectedSessionId) {
      setCalls([]);
      return;
    }
    void loadCalls(selectedSessionId);
  }, [selectedSessionId]);

  useEffect(() => {
    if (!templateSession) return;
    setRoundCount(templateSession.roundCount);
    setRoundModes((templateSession.roundModes ?? []).map((entry) => ({ round: entry.round, modes: entry.modes as SessionRecord["gameMode"][] })));
    setCardCount(templateSession.cardCount);
    setGameMode(templateSession.gameMode);
    setCallIntervalSeconds(templateSession.callIntervalSeconds);
    setRemoveResleeveSeconds(templateSession.removeResleeveSeconds ?? 20);
    setPlaceVinylSeconds(templateSession.placeVinylSeconds ?? 8);
    setCueSeconds(templateSession.cueSeconds ?? 12);
    setStartSlideSeconds(templateSession.startSlideSeconds ?? 5);
    setHostBufferSeconds(templateSession.hostBufferSeconds ?? 2);
    setSonosOutputDelayMs(templateSession.sonosOutputDelayMs ?? 75);
    setCallRevealDelaySeconds(templateSession.callRevealDelaySeconds ?? 10);
    setDefaultIntermissionSeconds(templateSession.defaultIntermissionSeconds ?? 600);
    setWelcomeHeadingText(templateSession.welcomeHeadingText ?? "Welcome To Vinyl Music Bingo");
    setWelcomeMessageText(templateSession.welcomeMessageText ?? "Get your cards ready and listen for the next call.");
    setWelcomeRulesText(templateSession.welcomeRulesText ?? "Complete the winning pattern before anyone else.");
    setWelcomeTiebreakText(templateSession.welcomeTiebreakText ?? "Ties are resolved by the host.");
    setIntermissionHeadingText(templateSession.intermissionHeadingText ?? "Intermission");
    setIntermissionMessageText(templateSession.intermissionMessageText ?? "Round {round} of {roundCount} begins in");
    setIntermissionFooterText(templateSession.intermissionFooterText ?? "Crate reset in progress. Next round starts shortly.");
    setThanksHeadingText(templateSession.thanksHeadingText ?? "Thank You For Playing!");
    setThanksSubheadingText(templateSession.thanksSubheadingText ?? "Vinyl Music Bingo");
    setThanksEventsHeadingText(templateSession.thanksEventsHeadingText ?? "Find Us Next At");
    setShowCountdown(templateSession.showCountdown ?? true);
    setRecentCallsLimit(templateSession.recentCallsLimit ?? 5);
    setThemeEnabled(templateSession.themeEnabled ?? false);
    setThemeName(templateSession.themeName ?? "");
  }, [templateSession]);

  useEffect(() => {
    if (!selectedPreset) return;
    setSelectedPlaylistIds(selectedPreset.sourcePlaylistIds);
    setUseDifferentMastersPerRound(false);
  }, [selectedPreset]);

  function openJumbotronPreview(screen: "welcome" | "intermission" | "thanks") {
    const previewQuery = new URLSearchParams({
      tenantId,
      userId,
      entitlements,
      sessionId: selectedSessionId || selectedSession?.id || "",
      preview: screen,
      previewWelcomeHeading: welcomeHeadingText,
      previewWelcomeText: welcomeMessageText,
      previewWelcomeRules: welcomeRulesText,
      previewWelcomeTieBreak: welcomeTiebreakText,
      previewIntermissionHeading: intermissionHeadingText,
      previewIntermissionText: intermissionMessageText,
      previewIntermissionFooter: intermissionFooterText,
      previewThanksHeading: thanksHeadingText,
      previewThanksSubheading: thanksSubheadingText,
      previewThanksEventsHeading: thanksEventsHeadingText,
      previewIntermissionSeconds: String(defaultIntermissionSeconds),
    }).toString();

    window.open(`/bingo/jumbotron?${previewQuery}`, `_blank`, "noopener,noreferrer");
  }

  useEffect(() => {
    setRoundPlaylistSelections((current) =>
      Array.from({ length: Math.max(1, roundCount) }, (_, index) => {
        const round = index + 1;
        return current.find((entry) => entry.round === round) ?? { round, playlistIds: [] };
      })
    );
  }, [roundCount]);

  useEffect(() => {
    setRoundModes((current) =>
      Array.from({ length: Math.max(1, roundCount) }, (_, index) => {
        const round = index + 1;
        return current.find((entry) => entry.round === round) ?? { round, modes: round === 1 ? [gameMode] : [] };
      })
    );
  }, [gameMode, roundCount]);

  function toggleMasterPlaylist(playlistId: string) {
    setSelectedPlaylistIds((current) =>
      current.includes(playlistId)
        ? current.filter((value) => value !== playlistId)
        : [...current, playlistId]
    );
  }

  function updateRoundPlaylist(round: number, playlistId: string) {
    setRoundPlaylistSelections((current) =>
      current.map((entry) =>
        entry.round === round ? { ...entry, playlistIds: playlistId ? [playlistId] : [] } : entry
      )
    );
  }

  function toggleRoundMode(round: number, mode: SessionRecord["gameMode"]) {
    setRoundModes((current) =>
      current.map((entry) => {
        if (entry.round !== round) return entry;
        const hasMode = entry.modes.includes(mode);
        return {
          ...entry,
          modes: hasMode ? entry.modes.filter((value) => value !== mode) : [...entry.modes, mode],
        };
      })
    );
  }

  async function handleCreateEvent() {
    if (!newEventTitle.trim() || !newEventDate.trim()) return;
    setCreatingEvent(true);
    try {
      const created = await fetchJson<EventRecord>("/api/v1/games/bingo/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: newEventTitle,
          date: newEventDate,
          time: newEventTime,
          location: newEventLocation,
        }),
      });
      setSelectedEventId(created.id);
      setNewEventTitle("");
      setNewEventDate("");
      setNewEventTime("");
      setNewEventLocation("");
      await loadBaseData();
    } catch (eventError) {
      setError(eventError instanceof Error ? eventError.message : "Failed to create event.");
    } finally {
      setCreatingEvent(false);
    }
  }

  async function handleCreateSession() {
    if (!trackConfigValid) return;
    setCreating(true);
    setError(null);
    try {
      const created = await fetchJson<SessionRecord>("/api/v1/games/bingo/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_id: selectedEventId && selectedEventId !== CREATE_EVENT_OPTION ? selectedEventId : undefined,
          master_playlist_ids: selectedPlaylistIds,
          round_playlist_ids: useDifferentMastersPerRound
            ? roundPlaylistSelections.map((entry) => ({
                round: entry.round,
                playlist_ids: entry.playlistIds,
              }))
            : [],
          cards_per_round_enabled: useDifferentMastersPerRound,
          round_count: roundCount,
          round_modes: roundModes.filter((entry) => entry.modes.length > 0),
          card_count: cardCount,
          game_mode: gameMode,
          call_interval_seconds: callIntervalSeconds,
          remove_resleeve_seconds: removeResleeveSeconds,
          place_vinyl_seconds: placeVinylSeconds,
          cue_seconds: cueSeconds,
          start_slide_seconds: startSlideSeconds,
          host_buffer_seconds: hostBufferSeconds,
          sonos_output_delay_ms: sonosOutputDelayMs,
          call_reveal_delay_seconds: callRevealDelaySeconds,
          default_intermission_seconds: defaultIntermissionSeconds,
          welcome_heading_text: welcomeHeadingText,
          welcome_message_text: welcomeMessageText,
          welcome_rules_text: welcomeRulesText,
          welcome_tiebreak_text: welcomeTiebreakText,
          intermission_heading_text: intermissionHeadingText,
          intermission_message_text: intermissionMessageText,
          intermission_footer_text: intermissionFooterText,
          thanks_heading_text: thanksHeadingText,
          thanks_subheading_text: thanksSubheadingText,
          thanks_events_heading_text: thanksEventsHeadingText,
          show_countdown: showCountdown,
          recent_calls_limit: recentCallsLimit,
          theme_enabled: themeEnabled,
          theme_name: themeEnabled ? themeName : null,
        }),
      });
      await loadBaseData();
      setSelectedSessionId(created.id);
      await loadCalls(created.id);
      const prepQuery = new URLSearchParams({
        tenantId,
        userId,
        entitlements,
        sessionId: created.id,
      }).toString();
      window.open(`/bingo/prep?${prepQuery}`, "_blank", "noopener,noreferrer");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create session.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDownloadCards(layout: "2-up" | "4-up") {
    if (!selectedSession) return;
    try {
      const cards = await loadCards(selectedSession.id);
      const doc = generateStandaloneCardsPdf(selectedSession.sessionCode, cards, layout);
      doc.save(`bingo-${selectedSession.sessionCode}-cards-${layout}.pdf`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download cards PDF.");
    }
  }

  async function handleDownloadCallSheet() {
    if (!selectedSession) return;
    try {
      const sessionCalls = await fetchJson<CallRecord[]>(`/api/v1/games/bingo/sessions/${selectedSession.id}/calls`);
      const doc = generateStandaloneCallSheetPdf(selectedSession.sessionCode, sessionCalls);
      doc.save(`bingo-${selectedSession.sessionCode}-call-sheet.pdf`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download call sheet PDF.");
    }
  }

  async function handleSetFavorite(sessionId: string, isFavorite: boolean) {
    try {
      await fetchJson<SessionRecord>(`/api/v1/games/bingo/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_favorite: isFavorite }),
      });
      await loadBaseData();
    } catch (favoriteError) {
      setError(favoriteError instanceof Error ? favoriteError.message : "Failed to update session template favorite.");
    }
  }

  async function handleResetSession(sessionId: string) {
    try {
      await fetchJson<SessionRecord>(`/api/v1/games/bingo/sessions/${sessionId}/reset`, {
        method: "POST",
      });
      await Promise.all([loadBaseData(), loadCalls(sessionId)]);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Failed to reset session.");
    }
  }

  async function handleDeleteSession(sessionId: string) {
    try {
      await fetchJson<void>(`/api/v1/games/bingo/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (selectedSessionId === sessionId) {
        setSelectedSessionId("");
        setCalls([]);
      }
      await loadBaseData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete session.");
    }
  }

  async function handleCreatePresetFromSession(session: SessionRecord) {
    const sourcePlaylistIds = useDifferentMastersPerRound
      ? roundPlaylistSelections.flatMap((entry) => entry.playlistIds)
      : selectedPlaylistIds;
    const sourcePlaylistNames = sourcePlaylistIds.map((playlistId) => playlistChoiceById.get(playlistId)?.name ?? playlistId);
    const poolSize = sourcePlaylistIds.reduce(
      (sum, playlistId) => sum + (playlistChoiceById.get(playlistId)?.trackCount ?? 0),
      0
    );

    if (sourcePlaylistIds.length === 0 || poolSize < 1) {
      setError("Cannot create a tracklist preset without source playlists.");
      return;
    }

    setCreatingPresetSessionId(session.id);
    try {
      await fetchJson<BingoPresetRecord>("/api/v1/games/bingo/presets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `${session.sessionCode} Tracklist`,
          source_playlist_ids: sourcePlaylistIds,
          source_playlist_names: sourcePlaylistNames,
          pool_size: poolSize,
          created_from_session_id: session.id,
        }),
      });
      await loadBaseData();
    } catch (presetError) {
      setError(presetError instanceof Error ? presetError.message : "Failed to create tracklist preset.");
    } finally {
      setCreatingPresetSessionId(null);
    }
  }

  async function handleCreateSandbox(session: SessionRecord) {
    setCreatingSandboxSessionId(session.id);
    try {
      const sandbox = await fetchJson<SessionRecord>(`/api/v1/games/bingo/sessions/${session.id}/sandbox`, {
        method: "POST",
      });
      await loadBaseData();
      const query = new URLSearchParams({ tenantId, userId, entitlements, sessionId: sandbox.id }).toString();
      window.open(`/bingo/prep?${query}`, `_blank`, "noopener,noreferrer");
      window.open(`/bingo/host?${query}`, `_blank`, "noopener,noreferrer");
      window.open(`/bingo/assistant?${query}`, `_blank`, "noopener,noreferrer");
      window.open(`/bingo/jumbotron?${query}`, `_blank`, "noopener,noreferrer");
    } catch (sandboxError) {
      setError(sandboxError instanceof Error ? sandboxError.message : "Failed to start sandbox session.");
    } finally {
      setCreatingSandboxSessionId(null);
    }
  }

  const baseQuery = new URLSearchParams({
    tenantId,
    userId,
    entitlements,
    sessionId: selectedSessionId,
  }).toString();

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <section style={heroStyle}>
          <p style={eyebrowStyle}>Standalone Vinyl Music Bingo</p>
          <h1 style={{ margin: "10px 0 12px", fontSize: 42 }}>Game Setup</h1>
          <p style={{ margin: 0, maxWidth: 860, color: "#d9d1c3", lineHeight: 1.5 }}>
            This setup follows the original playlist-first session creation flow: choose source playlists,
            configure the game, create the session, then launch prep, host, assistant, and jumbotron views.
          </p>
          <div style={{ marginTop: 16 }}>
            <a href={`/bingo/history?tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}&entitlements=${encodeURIComponent(entitlements)}`} style={linkButtonStyle(false)}>
              Open History
            </a>
          </div>
          {error ? <div style={errorStyle}>{error}</div> : null}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)", gap: 20 }}>
          <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <h2 style={panelTitleStyle}>1. Session Setup</h2>
              <button onClick={() => void loadBaseData()} disabled={loading} style={buttonStyle(false)}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={fieldLabelStyle}>Event (optional)</label>
                <select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} style={fieldStyle}>
                  <option value="">No linked event</option>
                  {events.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.title} · {entry.date}</option>
                  ))}
                  <option value={CREATE_EVENT_OPTION}>Create new event</option>
                </select>
              </div>

              {selectedEventId === CREATE_EVENT_OPTION ? (
                <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
                  <div>
                    <label style={fieldLabelStyle}>Event Title</label>
                    <input value={newEventTitle} onChange={(event) => setNewEventTitle(event.target.value)} style={fieldStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                    <div>
                      <label style={fieldLabelStyle}>Date</label>
                      <input type="date" value={newEventDate} onChange={(event) => setNewEventDate(event.target.value)} style={fieldStyle} />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Time</label>
                      <input type="time" value={newEventTime} onChange={(event) => setNewEventTime(event.target.value)} style={fieldStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Location</label>
                    <input value={newEventLocation} onChange={(event) => setNewEventLocation(event.target.value)} style={fieldStyle} />
                  </div>
                  <button onClick={() => void handleCreateEvent()} disabled={creatingEvent} style={buttonStyle(false)}>
                    {creatingEvent ? "Creating Event..." : "Create Event"}
                  </button>
                </div>
              ) : null}

              <div>
                <label style={fieldLabelStyle}>Estimated # of Players</label>
                <select value={cardCount} onChange={(event) => setCardCount(Number(event.target.value))} style={fieldStyle}>
                  {[20, 30, 40, 50, 60, 75, 100].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={fieldLabelStyle}>Reuse Session Template (optional)</label>
                <select value={selectedTemplateSessionId} onChange={(event) => setSelectedTemplateSessionId(event.target.value)} style={fieldStyle}>
                  <option value="">Do not copy a session template</option>
                  {favoriteTemplateSessions.map((session) => (
                    <option key={session.id} value={session.id}>{session.sessionCode} · {session.status}</option>
                  ))}
                </select>
                {favoriteTemplateSessions.length === 0 ? (
                  <p style={helpTextStyle}>Mark any session in Existing Sessions as a favorite template to make it available here.</p>
                ) : null}
              </div>

              <div>
                <label style={fieldLabelStyle}>Reuse Game Tracklist Favorite (optional)</label>
                <select value={selectedPresetId} onChange={(event) => setSelectedPresetId(event.target.value)} style={fieldStyle}>
                  <option value="">Create from playlists below</option>
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.name} ({preset.poolSize} tracks)</option>
                  ))}
                </select>
                {selectedPreset ? (
                  <div style={{ marginTop: 8, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}>
                    <strong>Using tracklist favorite {selectedPreset.name}</strong>
                    <div style={selectionMetaStyle}>Source playlists: {selectedPreset.sourcePlaylistNames.join(", ") || "None"}</div>
                    {selectedPreset.note ? <div style={selectionMetaStyle}>{selectedPreset.note}</div> : null}
                  </div>
                ) : null}
              </div>

              <div>
                <label style={fieldLabelStyle}>Round Count</label>
                <select value={roundCount} onChange={(event) => setRoundCount(Number(event.target.value))} style={fieldStyle}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={fieldLabelStyle}>Game Mode</label>
                <select value={gameMode} onChange={(event) => setGameMode(event.target.value as SessionRecord["gameMode"])} style={fieldStyle}>
                  {GAME_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={fieldLabelStyle}>Seconds To Next Call</label>
                <input type="number" min={1} value={callIntervalSeconds} onChange={(event) => setCallIntervalSeconds(Number(event.target.value) || 45)} style={fieldStyle} />
                <p style={helpTextStyle}>Derived from timing inputs below: {derivedSecondsToNextCall}s.</p>
              </div>

              <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
                <input type="checkbox" checked={useDifferentMastersPerRound} onChange={(event) => setUseDifferentMastersPerRound(event.target.checked)} />
                Use Different Master Playlist Per Round
              </label>

              <div>
                <p style={fieldLabelStyle}>Master Playlists</p>
                <p style={helpTextStyle}>Minimum playlist size: 75 tracks. Imported snapshots drive the available track counts.</p>
                <div style={{ display: "grid", gap: 8, maxHeight: 280, overflow: "auto" }}>
                  {playlistChoices.map((playlist) => (
                    <label key={playlist.id} style={selectionCardStyle(selectedPlaylistIds.includes(playlist.id))}>
                      <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedPlaylistIds.includes(playlist.id)}
                          onChange={() => toggleMasterPlaylist(playlist.id)}
                          disabled={useDifferentMastersPerRound}
                        />
                        <span>
                          <strong>{playlist.name}</strong>
                          <span style={selectionMetaStyle}>{playlist.trackCount} tracks · {playlist.provider} · {playlist.snapshotName ?? "No snapshot"}</span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {useDifferentMastersPerRound ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {Array.from({ length: Math.max(1, roundCount) }, (_, index) => {
                    const round = index + 1;
                    const selectedValue = roundPlaylistSelections.find((entry) => entry.round === round)?.playlistIds[0] ?? "";
                    return (
                      <div key={round}>
                        <label style={fieldLabelStyle}>Round {round} Playlist</label>
                        <select value={selectedValue} onChange={(event) => updateRoundPlaylist(round, event.target.value)} style={fieldStyle}>
                          <option value="">Select playlist</option>
                          {playlistChoices.map((playlist) => (
                            <option key={playlist.id} value={playlist.id}>
                              {playlist.name} · {playlist.trackCount} tracks
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div style={{ display: "grid", gap: 10 }}>
                <p style={fieldLabelStyle}>Round Modes</p>
                {Array.from({ length: Math.max(1, roundCount) }, (_, index) => {
                  const round = index + 1;
                  const activeModes = roundModes.find((entry) => entry.round === round)?.modes ?? [];
                  return (
                    <div key={round} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}>
                      <strong style={{ fontSize: 13 }}>Round {round}</strong>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        {GAME_MODE_OPTIONS.map((option) => {
                          const checked = activeModes.includes(option.value);
                          return (
                            <label key={`${round}-${option.value}`} style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                              <input type="checkbox" checked={checked} onChange={() => toggleRoundMode(round, option.value)} />
                              {option.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ ...selectionCardStyle(trackConfigValid), cursor: "default" }}>
                <strong>Total available tracks: {selectedTrackCount}</strong>
                <span style={selectionMetaStyle}>
                  {trackConfigValid ? "Track pool meets minimum session size." : "Select imported playlists with at least 75 total tracks."}
                </span>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, display: "grid", gap: 12 }}>
                <strong style={{ fontSize: 16 }}>2. Gameplay Timing</strong>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <div>
                    <label style={fieldLabelStyle}>Sonos Output Delay (ms)</label>
                    <input type="number" min={0} value={sonosOutputDelayMs} onChange={(event) => setSonosOutputDelayMs(Number(event.target.value) || 0)} style={fieldStyle} />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Place New Vinyl (sec)</label>
                    <input type="number" min={0} value={placeVinylSeconds} onChange={(event) => setPlaceVinylSeconds(Number(event.target.value) || 0)} style={fieldStyle} />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Cue Track (sec)</label>
                    <input type="number" min={0} value={cueSeconds} onChange={(event) => setCueSeconds(Number(event.target.value) || 0)} style={fieldStyle} />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Remove & Resleeve (sec)</label>
                    <input type="number" min={0} value={removeResleeveSeconds} onChange={(event) => setRemoveResleeveSeconds(Number(event.target.value) || 0)} style={fieldStyle} />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Start Delay (sec)</label>
                    <input type="number" min={0} value={startSlideSeconds} onChange={(event) => setStartSlideSeconds(Number(event.target.value) || 0)} style={fieldStyle} />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Host Buffer (sec)</label>
                    <input type="number" min={0} value={hostBufferSeconds} onChange={(event) => setHostBufferSeconds(Number(event.target.value) || 0)} style={fieldStyle} />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Reveal Delay (sec)</label>
                    <input type="number" min={0} value={callRevealDelaySeconds} onChange={(event) => setCallRevealDelaySeconds(Number(event.target.value) || 0)} style={fieldStyle} />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Intermission (sec)</label>
                    <input type="number" min={0} value={defaultIntermissionSeconds} onChange={(event) => setDefaultIntermissionSeconds(Number(event.target.value) || 0)} style={fieldStyle} />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, display: "grid", gap: 12 }}>
                <strong style={{ fontSize: 16 }}>3. Jumbotron Content</strong>
                <div>
                  <label style={fieldLabelStyle}>Welcome Heading</label>
                  <input value={welcomeHeadingText} onChange={(event) => setWelcomeHeadingText(event.target.value)} style={fieldStyle} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Welcome Message</label>
                  <textarea value={welcomeMessageText} onChange={(event) => setWelcomeMessageText(event.target.value)} style={textAreaStyle} rows={3} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Round Rules</label>
                  <textarea value={welcomeRulesText} onChange={(event) => setWelcomeRulesText(event.target.value)} style={textAreaStyle} rows={4} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Tie-break Line</label>
                  <textarea value={welcomeTiebreakText} onChange={(event) => setWelcomeTiebreakText(event.target.value)} style={textAreaStyle} rows={2} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Intermission Heading</label>
                  <input value={intermissionHeadingText} onChange={(event) => setIntermissionHeadingText(event.target.value)} style={fieldStyle} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Intermission Message</label>
                  <textarea value={intermissionMessageText} onChange={(event) => setIntermissionMessageText(event.target.value)} style={textAreaStyle} rows={2} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Intermission Footer</label>
                  <textarea value={intermissionFooterText} onChange={(event) => setIntermissionFooterText(event.target.value)} style={textAreaStyle} rows={2} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Thank You Heading</label>
                  <input value={thanksHeadingText} onChange={(event) => setThanksHeadingText(event.target.value)} style={fieldStyle} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Thank You Subheading</label>
                  <input value={thanksSubheadingText} onChange={(event) => setThanksSubheadingText(event.target.value)} style={fieldStyle} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Upcoming Events Heading</label>
                  <input value={thanksEventsHeadingText} onChange={(event) => setThanksEventsHeadingText(event.target.value)} style={fieldStyle} />
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => openJumbotronPreview("welcome")} style={buttonStyle(false)}>Preview Welcome</button>
                  <button onClick={() => openJumbotronPreview("intermission")} style={buttonStyle(false)}>Preview Intermission</button>
                  <button onClick={() => openJumbotronPreview("thanks")} style={buttonStyle(false)}>Preview Thank You</button>
                </div>
                <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                  <input type="checkbox" checked={showCountdown} onChange={(event) => setShowCountdown(event.target.checked)} />
                  Show Countdown On Jumbotron
                </label>
                <div>
                  <label style={fieldLabelStyle}>Recent Calls Limit</label>
                  <input type="number" min={1} value={recentCallsLimit} onChange={(event) => setRecentCallsLimit(Math.max(1, Number(event.target.value) || 1))} style={fieldStyle} />
                </div>
                <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                  <input type="checkbox" checked={themeEnabled} onChange={(event) => setThemeEnabled(event.target.checked)} />
                  Enable Theme Reveal
                </label>
                {themeEnabled ? (
                  <div>
                    <label style={fieldLabelStyle}>Theme Name</label>
                    <input value={themeName} onChange={(event) => setThemeName(event.target.value)} style={fieldStyle} />
                  </div>
                ) : null}
              </div>
            </div>
            <button onClick={() => void handleCreateSession()} disabled={!trackConfigValid || creating} style={{ ...buttonStyle(true), marginTop: 14, width: "100%" }}>
              {creating ? "Creating Session..." : "Create Session"}
            </button>
          </section>

          <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <h2 style={panelTitleStyle}>Existing Sessions</h2>
            </div>
            <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
              {sessions.filter((session) => !session.isSandbox).map((session) => (
                <div key={session.id} style={selectionCardStyle(session.id === selectedSessionId)}>
                  <button
                    onClick={() => setSelectedSessionId(session.id)}
                    style={{ background: "transparent", border: 0, color: "inherit", textAlign: "left", padding: 0, cursor: "pointer" }}
                  >
                    <strong>{session.sessionCode} · {session.status}</strong>
                    <span style={selectionMetaStyle}>{session.gameMode} · {session.cardCount} cards · {formatTimestamp(session.createdAt)}</span>
                  </button>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(session.isFavorite)}
                        onChange={(event) => {
                          event.stopPropagation();
                          void handleSetFavorite(session.id, event.target.checked);
                        }}
                      />
                      Favorite Session Template
                    </label>
                    <button onClick={() => void handleCreatePresetFromSession(session)} style={buttonStyle(false)}>
                      {creatingPresetSessionId === session.id ? "Saving Preset..." : "Save Tracklist Favorite"}
                    </button>
                    <button onClick={() => void handleCreateSandbox(session)} style={buttonStyle(false)}>
                      {creatingSandboxSessionId === session.id ? "Starting Sandbox..." : "Start Sandbox Dry Run"}
                    </button>
                    <button onClick={() => void handleResetSession(session.id)} style={buttonStyle(false)}>Reset Game</button>
                    <button onClick={() => void handleDeleteSession(session.id)} style={{ ...buttonStyle(false), border: "1px solid rgba(160,60,60,0.45)", color: "#ffd8d8" }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Sandbox Sessions</h3>
              {sandboxSessions.length === 0 ? (
                <div style={{ color: "#d9d1c3" }}>No active sandbox sessions.</div>
              ) : (
                sandboxSessions.map((session) => (
                  <div key={session.id} style={selectionCardStyle(false)}>
                    <strong>{session.sessionCode} · Sandbox</strong>
                    <span style={selectionMetaStyle}>Source: {session.sandboxSourceSessionId ?? "Unknown"} · Expires: {formatTimestamp(session.sandboxExpiresAt)}</span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      <a href={`/bingo/prep?tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}&entitlements=${encodeURIComponent(entitlements)}&sessionId=${encodeURIComponent(session.id)}`} target="_blank" rel="noreferrer" style={linkButtonStyle(false)}>Prep</a>
                      <a href={`/bingo/host?tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}&entitlements=${encodeURIComponent(entitlements)}&sessionId=${encodeURIComponent(session.id)}`} target="_blank" rel="noreferrer" style={linkButtonStyle(false)}>Host</a>
                      <a href={`/bingo/assistant?tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}&entitlements=${encodeURIComponent(entitlements)}&sessionId=${encodeURIComponent(session.id)}`} target="_blank" rel="noreferrer" style={linkButtonStyle(false)}>Assistant</a>
                      <a href={`/bingo/jumbotron?tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}&entitlements=${encodeURIComponent(entitlements)}&sessionId=${encodeURIComponent(session.id)}`} target="_blank" rel="noreferrer" style={linkButtonStyle(false)}>Jumbotron</a>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedSession ? (
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 18, background: "rgba(0,0,0,0.18)" }}>
                  <p style={eyebrowStyle}>Selected Session</p>
                  <h3 style={{ margin: "8px 0 6px", fontSize: 28 }}>{selectedSession.sessionCode}</h3>
                  <p style={{ margin: 0, color: "#d9d1c3" }}>Status: {selectedSession.status} · Started: {formatTimestamp(selectedSession.startedAt)}</p>
                  <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                    <a href={`/bingo/prep?${baseQuery}`} target="_blank" rel="noreferrer" style={linkButtonStyle(false)}>
                      Open Prep
                    </a>
                    <a href={`/bingo/host?${baseQuery}`} target="_blank" rel="noreferrer" style={linkButtonStyle(true)}>
                      Open Host
                    </a>
                    <a href={`/bingo/assistant?${baseQuery}`} target="_blank" rel="noreferrer" style={linkButtonStyle(false)}>
                      Open Assistant
                    </a>
                    <a href={`/bingo/jumbotron?${baseQuery}`} target="_blank" rel="noreferrer" style={linkButtonStyle(false)}>
                      Open Jumbotron
                    </a>
                    <button onClick={() => void handleDownloadCards("2-up")} style={buttonStyle(false)}>
                      Cards 2-up
                    </button>
                    <button onClick={() => void handleDownloadCards("4-up")} style={buttonStyle(false)}>
                      Cards 4-up
                    </button>
                    <button onClick={() => void handleDownloadCallSheet()} style={buttonStyle(false)}>
                      Call Sheet
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 320px)", gap: 16 }}>
                  <div style={{ borderRadius: 20, padding: 20, background: "linear-gradient(135deg, rgba(214,163,82,0.3), rgba(74,53,25,0.45))" }}>
                    <p style={eyebrowStyle}>Current Call Preview</p>
                    <h4 style={{ margin: "8px 0", fontSize: 30 }}>{currentCall ? currentCall.trackTitle : "No call revealed yet"}</h4>
                    <p style={{ margin: 0, fontSize: 20 }}>{currentCall ? currentCall.artistName : "Open Host to start the round."}</p>
                  </div>
                  <div style={{ borderRadius: 20, padding: 20, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <h4 style={{ marginTop: 0 }}>Next Up</h4>
                    <div style={{ display: "grid", gap: 8 }}>
                      {nextCalls.map((call) => (
                        <div key={call.id} style={miniCallStyle}>
                          <strong>{call.callIndex}. {call.trackTitle}</strong>
                          <span style={{ fontSize: 13, color: "#d9d1c3" }}>{call.artistName}</span>
                        </div>
                      ))}
                      {nextCalls.length === 0 ? <span style={{ color: "#d9d1c3" }}>No pending calls loaded.</span> : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 18, padding: 24, color: "#d9d1c3" }}>
                Select or create a session to launch the standalone game screens.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  color: "#f5efe6",
  background: "radial-gradient(circle at top left, #40301b 0%, #1b1712 42%, #100f0d 100%)",
  fontFamily: 'Georgia, "Times New Roman", serif',
};

const heroStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 24,
  padding: 24,
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(10px)",
  marginBottom: 20,
};

const panelStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 24,
  padding: 20,
  background: "rgba(255,255,255,0.04)",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

const panelTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 24,
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#d0b07a",
  fontSize: 12,
};

const fieldLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 700,
  color: "#f0e0bf",
};

const helpTextStyle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 12,
  color: "#d9d1c3",
};

const fieldStyle: CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.22)",
  color: "#f5efe6",
  padding: "10px 12px",
  fontSize: 14,
};

const textAreaStyle: CSSProperties = {
  ...fieldStyle,
  resize: "vertical",
  minHeight: 72,
};

const errorStyle: CSSProperties = {
  marginTop: 16,
  border: "1px solid rgba(255,120,120,0.45)",
  background: "rgba(120,20,20,0.25)",
  color: "#ffd8d8",
  borderRadius: 14,
  padding: 14,
};

function buttonStyle(primary: boolean): CSSProperties {
  return {
    appearance: "none",
    border: primary ? "1px solid rgba(208,176,122,0.65)" : "1px solid rgba(255,255,255,0.16)",
    borderRadius: 999,
    background: primary ? "#d6a352" : "rgba(255,255,255,0.04)",
    color: primary ? "#20160c" : "#f5efe6",
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function linkButtonStyle(primary: boolean): CSSProperties {
  return {
    ...buttonStyle(primary),
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function selectionCardStyle(active: boolean): CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    border: active ? "1px solid rgba(214,163,82,0.75)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(214,163,82,0.16)" : "rgba(0,0,0,0.18)",
    color: "#f5efe6",
    borderRadius: 18,
    padding: 14,
    cursor: "pointer",
    display: "grid",
    gap: 6,
  };
}

const selectionMetaStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  opacity: 0.85,
};

const miniCallStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 10,
  borderRadius: 12,
  background: "rgba(255,255,255,0.04)",
};