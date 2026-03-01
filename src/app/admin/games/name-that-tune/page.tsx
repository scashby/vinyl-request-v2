"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { generateNameThatTunePullListPdf } from "src/lib/nameThatTunePullListPdf";
import GameEventSelect from "src/components/GameEventSelect";
import GamePlaylistSelect from "src/components/GamePlaylistSelect";
import GameSetupInfoButton from "src/components/GameSetupInfoButton";
import InlineFieldHelp from "src/components/InlineFieldHelp";

type EventRow = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
};

type PlaylistRow = {
  id: number;
  name: string;
  track_count: number;
};

type SessionRow = {
  id: number;
  session_code: string;
  title: string;
  status: string;
  current_round: number;
  round_count: number;
  lock_in_rule: string;
  calls_total: number;
  event_title: string | null;
};

type SnippetDraft = {
  artist: string;
  title: string;
  source_label?: string;
  snippet_start_seconds?: number;
  snippet_duration_seconds?: number;
  host_notes?: string;
};

type PlaylistTrackApiItem = {
  track_key: string;
  sort_order: number;
  track_title: string | null;
  artist_name: string | null;
  album_name: string | null;
  side: string | null;
  position: string | null;
};

type PlaylistTracksPayload = {
  items?: PlaylistTrackApiItem[];
  error?: string;
};

type PullListApiRow = {
  call_index: number;
  round_number: number;
  artist_answer: string;
  title_answer: string;
  source_label?: string | null;
  snippet_start_seconds?: number | null;
  snippet_duration_seconds?: number | null;
  host_notes?: string | null;
};

const LOCK_IN_OPTIONS = [
  { value: "time_window", label: "Time Window (default)" },
  { value: "first_sheet_wins", label: "First Slip Wins" },
  { value: "hand_raise", label: "Hand Raise" },
] as const;

function toSnippet(item: PlaylistTrackApiItem, index: number): SnippetDraft {
  const sideAndPosition = [item.side?.trim(), item.position?.trim()].filter(Boolean).join(" ");
  const sourceLabel = [item.album_name?.trim() || null, sideAndPosition || null].filter(Boolean).join(" | ");
  return {
    artist: item.artist_name?.trim() || "Unknown Artist",
    title: item.track_title?.trim() || `Track ${index + 1}`,
    source_label: sourceLabel || undefined,
  };
}

export default function NameThatTuneSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [playlistId, setPlaylistId] = useState<number | null>(null);
  const [title, setTitle] = useState("Name That Tune Session");
  const [roundCount, setRoundCount] = useState(10);
  const [lockInRule, setLockInRule] = useState<"time_window" | "first_sheet_wins" | "hand_raise">("time_window");
  const [lockInWindowSeconds, setLockInWindowSeconds] = useState(20);

  const [showTitle, setShowTitle] = useState(true);
  const [showRounds, setShowRounds] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);

  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(8);

  const [teamNamesText, setTeamNamesText] = useState("Team A\nTeam B");
  const [playlistSnippets, setPlaylistSnippets] = useState<SnippetDraft[]>([]);
  const [playlistSnippetsLoading, setPlaylistSnippetsLoading] = useState(false);
  const [playlistSnippetsError, setPlaylistSnippetsError] = useState<string | null>(null);

  const [preflight, setPreflight] = useState({
    snippetsPreCue: false,
    cratePullStaged: false,
    spareNeedleReady: false,
    tieBreakSnippetReady: false,
  });
  const [creating, setCreating] = useState(false);

  const teamNames = useMemo(
    () =>
      Array.from(
        new Set(
          teamNamesText
            .split("\n")
            .map((name) => name.trim())
            .filter(Boolean)
        )
      ),
    [teamNamesText]
  );
  const snippets = useMemo(() => playlistSnippets, [playlistSnippets]);
  const preflightComplete = useMemo(() => Object.values(preflight).every(Boolean), [preflight]);
  const targetGapSeconds = useMemo(
    () => removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds,
    [cueSeconds, findRecordSeconds, hostBufferSeconds, removeResleeveSeconds]
  );
  const backupSnippetCount = useMemo(() => Math.max(2, Math.ceil(roundCount * 0.2)), [roundCount]);
  const recommendedPullSize = useMemo(() => roundCount + backupSnippetCount, [backupSnippetCount, roundCount]);
  const minimumPlaylistTracks = useMemo(() => recommendedPullSize, [recommendedPullSize]);
  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === playlistId) ?? null,
    [playlists, playlistId]
  );
  const playlistTooSmall = useMemo(
    () => (selectedPlaylist ? selectedPlaylist.track_count < minimumPlaylistTracks : false),
    [minimumPlaylistTracks, selectedPlaylist]
  );
  const snippetPreviewLimit = useMemo(
    () => Math.max(recommendedPullSize, roundCount),
    [recommendedPullSize, roundCount]
  );
  const snippetPreviewText = useMemo(
    () =>
      snippets
        .slice(0, snippetPreviewLimit)
        .map((snippet) => {
          const source = snippet.source_label?.trim();
          return source
            ? `${snippet.artist} - ${snippet.title} | ${source}`
            : `${snippet.artist} - ${snippet.title}`;
        })
        .join("\n"),
    [snippetPreviewLimit, snippets]
  );

  const load = useCallback(async () => {
    const [eventRes, playlistRes, sessionRes] = await Promise.all([
      fetch("/api/games/name-that-tune/events"),
      fetch("/api/games/playlists"),
      fetch(`/api/games/name-that-tune/sessions${eventId ? `?eventId=${eventId}` : ""}`),
    ]);

    if (eventRes.ok) {
      const payload = await eventRes.json();
      setEvents(payload.data ?? []);
    }

    if (playlistRes.ok) {
      const payload = await playlistRes.json();
      setPlaylists(payload.data ?? []);
    }

    if (sessionRes.ok) {
      const payload = await sessionRes.json();
      setSessions(payload.data ?? []);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadPlaylistSnippets = useCallback(async (selectedPlaylistId: number | null) => {
    if (!selectedPlaylistId) {
      setPlaylistSnippets([]);
      setPlaylistSnippetsError(null);
      setPlaylistSnippetsLoading(false);
      return;
    }

    setPlaylistSnippetsLoading(true);
    setPlaylistSnippetsError(null);
    try {
      const res = await fetch(`/api/playlists/${selectedPlaylistId}/tracks`);
      const payload = (await res.json()) as PlaylistTracksPayload;
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to load playlist tracks");
      }

      const items = payload.items ?? [];
      setPlaylistSnippets(items.map((item, index) => toSnippet(item, index)));
    } catch (error) {
      setPlaylistSnippets([]);
      setPlaylistSnippetsError(error instanceof Error ? error.message : "Failed to load playlist tracks");
    } finally {
      setPlaylistSnippetsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlaylistSnippets(playlistId);
  }, [loadPlaylistSnippets, playlistId]);

  const createSession = async () => {
    if (!playlistId) {
      alert("Select a playlist bank first");
      return;
    }
    if (playlistTooSmall && selectedPlaylist) {
      alert(
        `Selected playlist has ${selectedPlaylist.track_count} tracks. This setup needs at least ${minimumPlaylistTracks}.`
      );
      return;
    }
    if (playlistSnippetsLoading) {
      alert("Playlist tracks are still loading. Try again in a moment.");
      return;
    }
    if (playlistSnippetsError) {
      alert(`Unable to build snippet deck from playlist: ${playlistSnippetsError}`);
      return;
    }
    if (snippets.length < roundCount) {
      alert(`Selected playlist currently resolves to ${snippets.length} snippets. At least ${roundCount} are required.`);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/games/name-that-tune/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          playlist_id: playlistId,
          title,
          round_count: roundCount,
          lock_in_rule: lockInRule,
          lock_in_window_seconds: lockInWindowSeconds,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_title: showTitle,
          show_rounds: showRounds,
          show_scoreboard: showScoreboard,
          team_names: teamNames,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      router.push(`/admin/games/name-that-tune/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const downloadPullList = async (sessionId: number, sessionCode: string) => {
    const res = await fetch(`/api/games/name-that-tune/sessions/${sessionId}/calls`);
    if (!res.ok) {
      alert("Failed to load pull list for PDF");
      return;
    }

    const payload = (await res.json()) as { data?: PullListApiRow[] };
    const rows = payload.data ?? [];
    if (!rows.length) {
      alert("No pull list rows found for this session");
      return;
    }

    const doc = generateNameThatTunePullListPdf(rows, `Name That Tune Pull List · ${sessionCode}`);
    doc.save(`ntt-${sessionCode.toLowerCase()}-pull-list.pdf`);
  };

  const roundCountWarning = snippets.length < roundCount;
  const recommendedPullWarning = snippets.length < recommendedPullSize;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#3f1722,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-rose-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-rose-300">Brewery Floor Mode</p>
          <h1 className="mt-1 text-4xl font-black uppercase text-rose-100">Name That Tune Setup</h1>
          <p className="mt-2 text-sm text-stone-300">Single-DJ flow with lock-in answers and turntable pacing budget.</p>
          <div className="mt-3 flex justify-end"><GameSetupInfoButton gameSlug="name-that-tune" /></div>
        </header>

        <section className="rounded-3xl border border-rose-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-rose-100">Session Config</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GameEventSelect events={events} eventId={eventId} setEventId={setEventId} />
            <GamePlaylistSelect playlists={playlists} playlistId={playlistId} setPlaylistId={setPlaylistId} />

            <label className="text-sm">Session Title <InlineFieldHelp label="Session Title" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm">Rounds (8-15) <InlineFieldHelp label="Rounds (8-15)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={8} max={15} value={roundCount} onChange={(e) => setRoundCount(Math.max(8, Math.min(15, Number(e.target.value) || 8)))} />
            </label>

            <label className="text-sm">Lock-In Rule <InlineFieldHelp label="Lock-In Rule" />
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={lockInRule} onChange={(e) => setLockInRule((e.target.value as "time_window" | "first_sheet_wins" | "hand_raise") ?? "time_window")}>
                {LOCK_IN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="text-sm">Lock-In Window (sec) <InlineFieldHelp label="Lock-In Window (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={5} value={lockInWindowSeconds} onChange={(e) => setLockInWindowSeconds(Math.max(5, Number(e.target.value) || 5))} />
            </label>
          </div>

          <p className="mt-2 text-xs text-stone-300">
            Minimum playlist size for current setup:{" "}
            <span className="font-semibold text-rose-300">{minimumPlaylistTracks}</span>{" "}
            tracks ({roundCount} primary + {backupSnippetCount} backup pull).
          </p>
          {selectedPlaylist ? (
            <p className={`mt-1 text-xs ${playlistTooSmall ? "text-red-300" : "text-emerald-300"}`}>
              Selected bank: {selectedPlaylist.name} ({selectedPlaylist.track_count} tracks)
              {playlistTooSmall ? ` · add ${minimumPlaylistTracks - selectedPlaylist.track_count} tracks or reduce rounds.` : " · meets minimum."}
            </p>
          ) : (
            <p className="mt-1 text-xs text-amber-300">Select a playlist bank to validate minimum track requirement.</p>
          )}

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> <span>Jumbotron title <InlineFieldHelp label="Jumbotron title" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showRounds} onChange={(e) => setShowRounds(e.target.checked)} /> <span>Jumbotron round status <InlineFieldHelp label="Jumbotron round status" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showScoreboard} onChange={(e) => setShowScoreboard(e.target.checked)} /> <span>Jumbotron scoreboard <InlineFieldHelp label="Jumbotron scoreboard" /></span></label>
          </div>
        </section>

        <section className="rounded-3xl border border-rose-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-rose-100">Pacing Budget</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">Remove + Resleeve (sec) <InlineFieldHelp label="Remove + Resleeve (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={removeResleeveSeconds} onChange={(e) => setRemoveResleeveSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-sm">Find Record (sec) <InlineFieldHelp label="Find Record (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={findRecordSeconds} onChange={(e) => setFindRecordSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-sm">Cue (sec) <InlineFieldHelp label="Cue (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={cueSeconds} onChange={(e) => setCueSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-sm">Host Buffer (sec) <InlineFieldHelp label="Host Buffer (sec)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={hostBufferSeconds} onChange={(e) => setHostBufferSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
          </div>
          <p className="mt-3 text-sm text-stone-300">Derived target gap: <span className="font-semibold text-rose-300">{targetGapSeconds}s</span></p>
        </section>

        <section className="rounded-3xl border border-rose-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-rose-100">Teams + Snippet Deck</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">Teams (one per line) <InlineFieldHelp label="Teams (one per line)" />
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
              <p className="mt-1 text-xs text-stone-400">Detected teams: {teamNames.length}</p>
            </label>

            <div className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>Playlist Pull Snippets (auto-generated from selected playlist) <InlineFieldHelp label="Playlist Pull Snippets" /></span>
                <button
                  type="button"
                  className="rounded border border-stone-600 px-2 py-1 text-xs disabled:opacity-50"
                  disabled={!playlistId || playlistSnippetsLoading}
                  onClick={() => {
                    void loadPlaylistSnippets(playlistId);
                  }}
                >
                  {playlistSnippetsLoading ? "Loading..." : "Refresh Deck"}
                </button>
              </div>
              <textarea
                className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2"
                readOnly
                value={snippetPreviewText}
                placeholder={
                  playlistId
                    ? "Playlist selected. Loading snippets..."
                    : "Select a playlist bank to load snippets."
                }
              />
              {playlistSnippetsError ? <p className="mt-1 text-xs text-red-300">{playlistSnippetsError}</p> : null}
              <p className={`mt-1 text-xs ${roundCountWarning ? "text-amber-300" : "text-stone-400"}`}>
                Valid snippets: {snippets.length}. Minimum required for current rounds: {roundCount}.
              </p>
              <p className={`mt-1 text-xs ${recommendedPullWarning ? "text-amber-300" : "text-emerald-300"}`}>
                Recommended playlist/crate pull: {recommendedPullSize} ({roundCount} primary + {backupSnippetCount} backup).
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-stone-700 bg-stone-950/80 p-3 text-sm">
            <p className="font-semibold uppercase tracking-wide text-rose-200">Preflight Checklist</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.snippetsPreCue} onChange={(e) => setPreflight((p) => ({ ...p, snippetsPreCue: e.target.checked }))} /> <span>Snippets pre-cued by round <InlineFieldHelp label="Snippets pre-cued by round" /></span></label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.cratePullStaged} onChange={(e) => setPreflight((p) => ({ ...p, cratePullStaged: e.target.checked }))} /> <span>Crate/playlist pull staged ({recommendedPullSize} snippets) <InlineFieldHelp label="Crate/playlist pull staged" /></span></label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.spareNeedleReady} onChange={(e) => setPreflight((p) => ({ ...p, spareNeedleReady: e.target.checked }))} /> <span>Needle/backup cart ready <InlineFieldHelp label="Needle/backup cart ready" /></span></label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.tieBreakSnippetReady} onChange={(e) => setPreflight((p) => ({ ...p, tieBreakSnippetReady: e.target.checked }))} /> <span>Tie-break snippet staged <InlineFieldHelp label="Tie-break snippet staged" /></span></label>
            </div>
          </div>

          <button disabled={!playlistId || playlistTooSmall || playlistSnippetsLoading || !!playlistSnippetsError || !preflightComplete || teamNames.length < 2 || roundCountWarning || creating} onClick={createSession} className="mt-5 rounded bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {creating ? "Creating..." : "Create Session"}
          </button>
        </section>

        <section className="rounded-3xl border border-rose-900/40 bg-black/45 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black uppercase text-rose-100">Existing Sessions</h2>
            <button onClick={load} className="rounded border border-stone-700 px-3 py-1 text-sm">Refresh</button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-stone-400">No sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-stone-700 bg-stone-950/70 p-3">
                  <div className="text-sm">{session.session_code} · {session.title} · Round {session.current_round} of {session.round_count} · Calls {session.calls_total}</div>
                  <div className="text-xs text-stone-400">Event: {session.event_title ?? "(none)"} · Lock-In: {session.lock_in_rule} · Status: {session.status}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/name-that-tune/host?sessionId=${session.id}`)}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/name-that-tune/assistant?sessionId=${session.id}`)}>Assistant</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/name-that-tune/jumbotron?sessionId=${session.id}`)}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadPullList(session.id, session.session_code)}>Pull List PDF</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push("/admin/games/name-that-tune/history")}>History</button>
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
