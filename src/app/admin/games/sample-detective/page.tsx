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
  points_correct_pair: number;
  bonus_both_artists_points: number;
  calls_total: number;
  calls_scored: number;
  event_title: string | null;
  playlist_name: string | null;
};

type CallDraft = {
  sampled_artist: string;
  sampled_title: string;
  source_artist: string;
  source_title: string;
  release_year?: number;
  sample_timestamp?: string;
  source_label?: string;
};

function parseCalls(lines: string): CallDraft[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map<CallDraft | null>((line) => {
      const [sampledMeta, sourceMeta, yearPart, timestampPart, sourceLabel] = line
        .split("|")
        .map((part) => part.trim());
      const [sampledArtist, sampledTitle] = (sampledMeta ?? "").split(" - ").map((part) => part.trim());
      const [sourceArtist, sourceTitle] = (sourceMeta ?? "").split(" - ").map((part) => part.trim());

      if (!sampledArtist || !sampledTitle || !sourceArtist || !sourceTitle) return null;

      const year = Number(yearPart);
      return {
        sampled_artist: sampledArtist,
        sampled_title: sampledTitle,
        source_artist: sourceArtist,
        source_title: sourceTitle,
        ...(Number.isFinite(year) ? { release_year: year } : {}),
        ...(timestampPart ? { sample_timestamp: timestampPart } : {}),
        ...(sourceLabel ? { source_label: sourceLabel } : {}),
      };
    })
    .filter((call): call is CallDraft => call !== null);
}

export default function SampleDetectiveSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [playlistId, setPlaylistId] = useState<number | null>(null);
  const [title, setTitle] = useState("Sample Detective Session");
  const [roundCount, setRoundCount] = useState(8);
  const [pointsCorrectPair, setPointsCorrectPair] = useState(2);
  const [bonusBothArtistsPoints, setBonusBothArtistsPoints] = useState(1);

  const [showTitle, setShowTitle] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);
  const [showScoringHint, setShowScoringHint] = useState(true);

  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(10);

  const [teamNamesText, setTeamNamesText] = useState("Table 1\nTable 2");
  const [callListText, setCallListText] = useState("");

  const [preflight, setPreflight] = useState({
    sourcePairsVerified: false,
    cuePointsMarked: false,
    crateOrderPrepared: false,
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
    () => Math.max((roundCount + 2) * 2, calls.length * 2),
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
      fetch("/api/games/sample-detective/events"),
      fetch("/api/games/playlists"),
      fetch(`/api/games/sample-detective/sessions${eventId ? `?eventId=${eventId}` : ""}`),
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
      const res = await fetch("/api/games/sample-detective/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          playlist_id: playlistId,
          title,
          round_count: roundCount,
          points_correct_pair: pointsCorrectPair,
          bonus_both_artists_points: bonusBothArtistsPoints,
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

      router.push(`/admin/games/sample-detective/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const roundCountWarning = calls.length < roundCount;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#193e2c,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-green-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-green-300">Brewery Floor Mode</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-4xl font-black uppercase text-green-100">Sample Detective Setup</h1>
            <div className="flex gap-2">
              <Link href="/admin/games/sample-detective/history" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">History</Link>
              <Link href="/admin/games/sample-detective/jumbotron" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Jumbotron Scope</Link>
              <Link href="/admin/games/sample-detective/help" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Help</Link>
            </div>
          </div>
          <p className="mt-2 text-sm text-stone-300">Sample Detective plays sampled tracks, teams match each one to its original source song, and the team with the most correct matches wins.</p>
          <div className="mt-3 flex justify-end"><GameSetupInfoButton gameSlug="sample-detective" /></div>
        </header>

        <section className="rounded-3xl border border-green-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-green-100">Session Config</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GameEventSelect events={events} eventId={eventId} setEventId={setEventId} />
            <GamePlaylistSelect playlists={playlists} playlistId={playlistId} setPlaylistId={setPlaylistId} />

            <label className="text-sm">Session Title <InlineFieldHelp label="Session Title" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm">Rounds (6-10) <InlineFieldHelp label="Rounds (6-10)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={6} max={10} value={roundCount} onChange={(e) => setRoundCount(Math.max(6, Math.min(10, Number(e.target.value) || 6)))} />
            </label>

            <label className="text-sm">Correct Pair Points <InlineFieldHelp label="Correct Pair Points" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={5} value={pointsCorrectPair} onChange={(e) => setPointsCorrectPair(Math.max(0, Math.min(5, Number(e.target.value) || 0)))} />
            </label>

            <label className="text-sm">Bonus Both Artists <InlineFieldHelp label="Bonus Both Artists" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={3} value={bonusBothArtistsPoints} onChange={(e) => setBonusBothArtistsPoints(Math.max(0, Math.min(3, Number(e.target.value) || 0)))} />
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
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showScoringHint} onChange={(e) => setShowScoringHint(e.target.checked)} /> <span>Show scoring hint <InlineFieldHelp label="Show scoring hint" /></span></label>
          </div>
        </section>

        <section className="rounded-3xl border border-green-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-green-100">Pacing Budget</h2>
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
          <p className="mt-3 text-sm text-stone-300">Derived target gap: <span className="font-semibold text-green-300">{targetGapSeconds}s</span></p>
        </section>

        <section className="rounded-3xl border border-green-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-green-100">Teams + Call Deck</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="text-sm">Team Names (one per line) <InlineFieldHelp label="Team Names (one per line)" />
              <textarea className="mt-1 h-48 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
            </label>
            <label className="text-sm">Playlist Pull Call List (sampled artist - sampled title | source artist - source title | year | sample timestamp | source label) <InlineFieldHelp label="Playlist Pull Call List" />
              <textarea className="mt-1 h-48 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 font-mono text-xs" value={callListText} onChange={(e) => setCallListText(e.target.value)} />
            </label>
          </div>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.sourcePairsVerified} onChange={(e) => setPreflight((p) => ({ ...p, sourcePairsVerified: e.target.checked }))} /> <span>Source pairs verified <InlineFieldHelp label="Source pairs verified" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.cuePointsMarked} onChange={(e) => setPreflight((p) => ({ ...p, cuePointsMarked: e.target.checked }))} /> <span>Cue points marked <InlineFieldHelp label="Cue points marked" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.crateOrderPrepared} onChange={(e) => setPreflight((p) => ({ ...p, crateOrderPrepared: e.target.checked }))} /> <span>Crate order prepared <InlineFieldHelp label="Crate order prepared" /></span></label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              className="rounded bg-green-500 px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
              onClick={createSession}
              disabled={!playlistId || playlistTooSmall || creating || !preflightComplete || teamNames.length < 2 || roundCountWarning}
            >
              {creating ? "Creating..." : "Create Session"}
            </button>
            <span className="text-xs text-stone-400">Teams: {teamNames.length} · Calls parsed: {calls.length}</span>
            {roundCountWarning ? <span className="text-xs text-amber-300">Need at least {roundCount} parsed calls.</span> : null}
            {!preflightComplete ? <span className="text-xs text-amber-300">Complete all preflight checks before creating.</span> : null}
          </div>
        </section>

        <section className="rounded-3xl border border-stone-700 bg-black/45 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black uppercase text-stone-100">Recent Sessions</h2>
            <button onClick={() => load()} className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Refresh</button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-stone-400">No sessions found for this event filter.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {sessions.map((session) => (
                <div key={session.id} className="rounded border border-stone-700 bg-stone-950/60 p-3">
                  <p className="text-stone-100">{session.session_code} · {session.title} · {session.status}</p>
                  <p className="text-stone-400">Event: {session.event_title ?? "(none)"} · Playlist: {session.playlist_name ?? "(unknown)"} · Round {session.current_round}/{session.round_count} · Calls {session.calls_scored}/{session.calls_total} scored · Scoring {session.points_correct_pair}+{session.bonus_both_artists_points}</p>
                  <div className="mt-2 flex gap-2 text-xs">
                    <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/sample-detective/host?sessionId=${session.id}`}>Host</Link>
                    <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/sample-detective/assistant?sessionId=${session.id}`}>Assistant</Link>
                    <Link className="rounded border border-stone-700 px-2 py-1" href={`/admin/games/sample-detective/jumbotron?sessionId=${session.id}`}>Jumbotron</Link>
                    <button className="rounded border border-stone-700 px-2 py-1" onClick={() => downloadGamePullListPdf({ gameSlug: "sample-detective", gameTitle: "Sample Detective", sessionId: session.id, sessionCode: session.session_code, accentRgb: [71, 85, 105] })}>Pull List PDF</button>
                    <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/sample-detective/history">History</Link>
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
