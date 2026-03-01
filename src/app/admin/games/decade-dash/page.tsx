"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GameEventSelect from "src/components/GameEventSelect";
import GamePlaylistSelect from "src/components/GamePlaylistSelect";
import GameSetupInfoButton from "src/components/GameSetupInfoButton";
import InlineFieldHelp from "src/components/InlineFieldHelp";
import { downloadGamePullListPdf } from "src/lib/downloadGamePullListPdf";

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
  adjacent_scoring_enabled: boolean;
  calls_total: number;
  calls_scored: number;
  event_title: string | null;
};

type CallDraft = {
  artist?: string;
  title?: string;
  release_year: number;
  decade_start: number;
  source_label?: string;
};

function toDecadeStart(year: number): number {
  return Math.floor(year / 10) * 10;
}

function parseCalls(lines: string): CallDraft[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [metaPart, yearPart, sourceLabel] = line.split("|").map((part) => part.trim());
      const [artistRaw, titleRaw] = (metaPart ?? "").split(" - ").map((part) => part.trim());
      const releaseYear = Number(yearPart);
      if (!Number.isFinite(releaseYear)) return null;

      return {
        artist: artistRaw || undefined,
        title: titleRaw || undefined,
        release_year: releaseYear,
        decade_start: toDecadeStart(releaseYear),
        source_label: sourceLabel || undefined,
      };
    })
    .filter((call): call is NonNullable<typeof call> => Boolean(call));
}

export default function DecadeDashSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [playlistId, setPlaylistId] = useState<number | null>(null);
  const [title, setTitle] = useState("Decade Dash Session");
  const [roundCount, setRoundCount] = useState(14);
  const [adjacentScoringEnabled, setAdjacentScoringEnabled] = useState(true);
  const [exactPoints, setExactPoints] = useState(2);
  const [adjacentPoints, setAdjacentPoints] = useState(1);

  const [showTitle, setShowTitle] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);
  const [showScoringHint, setShowScoringHint] = useState(true);

  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(10);

  const [teamNamesText, setTeamNamesText] = useState("Table 1\nTable 2");
  const [callListText, setCallListText] = useState(
    "Madonna - Like a Prayer | 1989 | LP A1\nOutkast - Hey Ya! | 2003 | LP B2"
  );

  const [preflight, setPreflight] = useState({
    decadeCardsOnTables: false,
    backupTieBreakRecordReady: false,
    hostCheatSheetPrinted: false,
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

  const calls = useMemo(() => parseCalls(callListText), [callListText]);
  const preflightComplete = useMemo(() => Object.values(preflight).every(Boolean), [preflight]);
  const targetGapSeconds = useMemo(
    () => removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds,
    [cueSeconds, findRecordSeconds, hostBufferSeconds, removeResleeveSeconds]
  );

  const minimumPlaylistTracks = useMemo(
    () => Math.max(roundCount + 2, calls.length),
    [roundCount, calls.length]
  );
  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === playlistId) ?? null,
    [playlists, playlistId]
  );
  const playlistTooSmall = useMemo(
    () => (selectedPlaylist ? selectedPlaylist.track_count < minimumPlaylistTracks : false),
    [minimumPlaylistTracks, selectedPlaylist]
  );

  const load = useCallback(async () => {
    const [eventRes, playlistRes, sessionRes] = await Promise.all([
      fetch("/api/games/decade-dash/events"),
      fetch("/api/games/playlists"),
      fetch(`/api/games/decade-dash/sessions${eventId ? `?eventId=${eventId}` : ""}`),
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

  const createSession = async () => {
    if (!playlistId) {
      alert("Select a playlist bank first");
      return;
    }
    if (playlistTooSmall && selectedPlaylist) {
      alert(`Selected playlist has ${selectedPlaylist.track_count} tracks. This setup needs at least ${minimumPlaylistTracks}.`);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/games/decade-dash/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          playlist_id: playlistId,
          title,
          round_count: roundCount,
          adjacent_scoring_enabled: adjacentScoringEnabled,
          exact_points: exactPoints,
          adjacent_points: adjacentPoints,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_title: showTitle,
          show_round: showRound,
          show_scoreboard: showScoreboard,
          show_scoring_hint: showScoringHint,
          team_names: teamNames,
          calls,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      router.push(`/admin/games/decade-dash/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const roundCountWarning = calls.length < roundCount;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_20%,#20305c,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-sky-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-sky-300">Brewery Floor Mode</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-4xl font-black uppercase text-sky-100">Decade Dash Setup</h1>
            <div className="flex gap-2">
              <Link href="/admin/games/decade-dash/history" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">History</Link>
              <Link href="/admin/games/decade-dash/jumbotron" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Jumbotron Scope</Link>
            </div>
          </div>
          <p className="mt-2 text-sm text-stone-300">Play a song and have teams choose the decade they think it came from.</p>
          <div className="mt-3 flex justify-end"><GameSetupInfoButton gameSlug="decade-dash" /></div>
        </header>

        <section className="rounded-3xl border border-sky-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-sky-100">Session Config</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GameEventSelect events={events} eventId={eventId} setEventId={setEventId} />
            <GamePlaylistSelect playlists={playlists} playlistId={playlistId} setPlaylistId={setPlaylistId} />

            <label className="text-sm">Session Title <InlineFieldHelp label="Session Title" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm">Rounds (12-20) <InlineFieldHelp label="Rounds (12-20)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={12} max={20} value={roundCount} onChange={(e) => setRoundCount(Math.max(12, Math.min(20, Number(e.target.value) || 12)))} />
            </label>

            <label className="inline-flex items-center gap-2 text-sm pt-7">
              <input type="checkbox" checked={adjacentScoringEnabled} onChange={(e) => setAdjacentScoringEnabled(e.target.checked)} />
              <span>Adjacent decade scoring enabled <InlineFieldHelp label="Adjacent decade scoring enabled" /></span>
            </label>

            <label className="text-sm">Exact Points <InlineFieldHelp label="Exact Points" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={2} value={exactPoints} onChange={(e) => setExactPoints(Math.max(0, Math.min(2, Number(e.target.value) || 0)))} />
            </label>

            <label className="text-sm">Adjacent Points <InlineFieldHelp label="Adjacent Points" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={1} disabled={!adjacentScoringEnabled} value={adjacentPoints} onChange={(e) => setAdjacentPoints(Math.max(0, Math.min(1, Number(e.target.value) || 0)))} />
            </label>
          </div>

          <p className="mt-2 text-xs text-stone-300">
            Minimum playlist size for current setup:{" "}
            <span className="font-semibold text-emerald-300">{minimumPlaylistTracks}</span> tracks.
          </p>
          {selectedPlaylist ? (
            <p className={`mt-1 text-xs ${playlistTooSmall ? "text-red-300" : "text-emerald-300"}`}>
              Selected bank: {selectedPlaylist.name} ({selectedPlaylist.track_count} tracks)
              {playlistTooSmall ? ` · add ${minimumPlaylistTracks - selectedPlaylist.track_count} tracks or lower setup requirements.` : " · meets minimum."}
            </p>
          ) : (
            <p className="mt-1 text-xs text-amber-300">Select a playlist bank to validate minimum track requirement.</p>
          )}

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> <span>Jumbotron title <InlineFieldHelp label="Jumbotron title" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showRound} onChange={(e) => setShowRound(e.target.checked)} /> <span>Jumbotron round <InlineFieldHelp label="Jumbotron round" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showScoreboard} onChange={(e) => setShowScoreboard(e.target.checked)} /> <span>Jumbotron scoreboard <InlineFieldHelp label="Jumbotron scoreboard" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showScoringHint} onChange={(e) => setShowScoringHint(e.target.checked)} /> <span>Show scoring legend <InlineFieldHelp label="Show scoring legend" /></span></label>
          </div>
        </section>

        <section className="rounded-3xl border border-sky-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-sky-100">Pacing Budget</h2>
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
          <p className="mt-3 text-sm text-stone-300">Derived target gap: <span className="font-semibold text-sky-300">{targetGapSeconds}s</span></p>
        </section>

        <section className="rounded-3xl border border-sky-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-sky-100">Teams + Decade Calls</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">Teams (one per line) <InlineFieldHelp label="Teams (one per line)" />
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
              <p className="mt-1 text-xs text-stone-400">Detected teams: {teamNames.length}</p>
            </label>

            <label className="text-sm">Playlist Pull Calls (Artist - Title | year | optional source) <InlineFieldHelp label="Playlist Pull Calls" />
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={callListText} onChange={(e) => setCallListText(e.target.value)} />
              <p className={`mt-1 text-xs ${roundCountWarning ? "text-amber-300" : "text-stone-400"}`}>
                Valid calls: {calls.length}. Minimum required for current rounds: {roundCount}.
              </p>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-stone-700 bg-stone-950/80 p-3 text-sm">
            <p className="font-semibold uppercase tracking-wide text-sky-200">Preflight Checklist</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.decadeCardsOnTables} onChange={(e) => setPreflight((p) => ({ ...p, decadeCardsOnTables: e.target.checked }))} /> <span>Decade cards staged on all tables <InlineFieldHelp label="Decade cards staged on all tables" /></span></label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.backupTieBreakRecordReady} onChange={(e) => setPreflight((p) => ({ ...p, backupTieBreakRecordReady: e.target.checked }))} /> <span>Tie-break record staged <InlineFieldHelp label="Tie-break record staged" /></span></label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.hostCheatSheetPrinted} onChange={(e) => setPreflight((p) => ({ ...p, hostCheatSheetPrinted: e.target.checked }))} /> <span>Decade cheat sheet printed <InlineFieldHelp label="Decade cheat sheet printed" /></span></label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className="rounded border border-sky-700 px-4 py-2 text-sm font-semibold text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={createSession}
              disabled={!playlistId || playlistTooSmall || creating || !preflightComplete || roundCountWarning || teamNames.length < 2}
            >
              {creating ? "Creating..." : "Create Session"}
            </button>
            <p className="text-xs text-stone-400">Create is enabled when checklist, teams, and minimum call count are valid.</p>
          </div>
        </section>

        <section className="rounded-3xl border border-sky-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-sky-100">Recent Sessions</h2>
          {sessions.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">No sessions yet.</p>
          ) : (
            <div className="mt-4 space-y-2 text-sm">
              {sessions.map((session) => (
                <div key={session.id} className="rounded border border-stone-700 bg-stone-950/70 p-3">
                  <p>{session.session_code} · {session.title} · {session.status}</p>
                  <p className="text-stone-400">Event: {session.event_title ?? "(none)"} · Round: {session.current_round}/{session.round_count} · Calls: {session.calls_scored}/{session.calls_total} scored · Adjacent: {session.adjacent_scoring_enabled ? "On" : "Off"}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/decade-dash/host?sessionId=${session.id}`)}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/decade-dash/assistant?sessionId=${session.id}`)}>Assistant</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/decade-dash/jumbotron?sessionId=${session.id}`)}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadGamePullListPdf({ gameSlug: "decade-dash", gameTitle: "Decade Dash", sessionId: session.id, sessionCode: session.session_code, accentRgb: [14, 116, 144] })}>Pull List PDF</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push("/admin/games/decade-dash/history")}>History</button>
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
