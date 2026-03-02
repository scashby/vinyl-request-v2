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
  playlist_name: string | null;
  stage_one_points: number;
  stage_two_points: number;
  final_reveal_points: number;
  calls_total: number;
  calls_scored: number;
  event_title: string | null;
};

type CallDraft = {
  artist: string;
  title: string;
  release_year?: number;
  reveal_level_1_image_url: string;
  reveal_level_2_image_url: string;
  reveal_level_3_image_url: string;
  audio_clue_source?: string;
  source_label?: string;
};

function parseCalls(lines: string): CallDraft[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map<CallDraft | null>((line) => {
      const parts = line.split("|").map((part) => part.trim());
      const [metaPart, yearPart, level1, level2, level3, audioClue, sourceLabel] = parts;
      const [artist, title] = (metaPart ?? "").split(" - ").map((part) => part.trim());
      if (!artist || !title || !level1 || !level2 || !level3) return null;

      const year = Number(yearPart);
      return {
        artist,
        title,
        reveal_level_1_image_url: level1,
        reveal_level_2_image_url: level2,
        reveal_level_3_image_url: level3,
        ...(Number.isFinite(year) ? { release_year: year } : {}),
        ...(audioClue ? { audio_clue_source: audioClue } : {}),
        ...(sourceLabel ? { source_label: sourceLabel } : {}),
      };
    })
    .filter((call): call is CallDraft => call !== null);
}

export default function CoverArtClueChaseSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [playlistId, setPlaylistId] = useState<number | null>(null);
  const [title, setTitle] = useState("Cover Art Clue Chase Session");
  const [roundCount, setRoundCount] = useState(10);
  const [stageOnePoints, setStageOnePoints] = useState(3);
  const [stageTwoPoints, setStageTwoPoints] = useState(2);
  const [finalRevealPoints, setFinalRevealPoints] = useState(1);
  const [audioClueEnabled, setAudioClueEnabled] = useState(true);

  const [showTitle, setShowTitle] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);
  const [showStageHint, setShowStageHint] = useState(true);

  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(10);

  const [teamNamesText, setTeamNamesText] = useState("Table 1\nTable 2");
  const [callListText, setCallListText] = useState(
    "Fleetwood Mac - Rumours | 1977 | https://img.example.com/r1-1.jpg | https://img.example.com/r1-2.jpg | https://img.example.com/r1-3.jpg | clean intro on side B | LP A\nDaft Punk - Discovery | 2001 | https://img.example.com/r2-1.jpg | https://img.example.com/r2-2.jpg | https://img.example.com/r2-3.jpg | vocoder clue | LP B"
  );

  const [preflight, setPreflight] = useState({
    imageDeckPrepared: false,
    revealOrderVerified: false,
    audioCluesOptionalReady: false,
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
      fetch("/api/games/cover-art-clue-chase/events"),
      fetch("/api/games/playlists"),
      fetch(`/api/games/cover-art-clue-chase/sessions${eventId ? `?eventId=${eventId}` : ""}`),
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
      const res = await fetch("/api/games/cover-art-clue-chase/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          playlist_id: playlistId,
          title,
          round_count: roundCount,
          stage_one_points: stageOnePoints,
          stage_two_points: stageTwoPoints,
          final_reveal_points: finalRevealPoints,
          audio_clue_enabled: audioClueEnabled,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_title: showTitle,
          show_round: showRound,
          show_scoreboard: showScoreboard,
          show_stage_hint: showStageHint,
          team_names: teamNames,
          calls,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      router.push(`/admin/games/cover-art-clue-chase/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const roundCountWarning = calls.length < roundCount;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#173a3d,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-teal-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-teal-300">Brewery Floor Mode</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-4xl font-black uppercase text-teal-100">Cover Art Clue Chase Setup</h1>
            <div className="flex gap-2">
              <Link href="/admin/games/cover-art-clue-chase/help" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Help</Link>
              <Link href="/admin/games/cover-art-clue-chase/history" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">History</Link>
              <Link href="/admin/games/cover-art-clue-chase/jumbotron" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Jumbotron Scope</Link>
            </div>
          </div>
          <p className="mt-2 text-sm text-stone-300">Cover Art Clue Chase reveals album art in stages, teams guess as early as possible for more points, and the highest score wins.</p>
          <div className="mt-3 flex justify-end"><GameSetupInfoButton gameSlug="cover-art-clue-chase" /></div>
        </header>

        <section className="rounded-3xl border border-teal-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-teal-100">Session Config</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GameEventSelect events={events} eventId={eventId} setEventId={setEventId} />
            <GamePlaylistSelect playlists={playlists} playlistId={playlistId} setPlaylistId={setPlaylistId} />

            <label className="text-sm">Session Title <InlineFieldHelp label="Session Title" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm">Rounds (8-14) <InlineFieldHelp label="Rounds (8-14)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={8} max={14} value={roundCount} onChange={(e) => setRoundCount(Math.max(8, Math.min(14, Number(e.target.value) || 8)))} />
            </label>

            <label className="text-sm">Stage 1 Points <InlineFieldHelp label="Stage 1 Points" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={5} value={stageOnePoints} onChange={(e) => setStageOnePoints(Math.max(0, Math.min(5, Number(e.target.value) || 0)))} />
            </label>

            <label className="text-sm">Stage 2 Points <InlineFieldHelp label="Stage 2 Points" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={5} value={stageTwoPoints} onChange={(e) => setStageTwoPoints(Math.max(0, Math.min(5, Number(e.target.value) || 0)))} />
            </label>

            <label className="text-sm">Final/Audio Points <InlineFieldHelp label="Final/Audio Points" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={5} value={finalRevealPoints} onChange={(e) => setFinalRevealPoints(Math.max(0, Math.min(5, Number(e.target.value) || 0)))} />
            </label>

            <label className="inline-flex items-center gap-2 text-sm pt-7">
              <input type="checkbox" checked={audioClueEnabled} onChange={(e) => setAudioClueEnabled(e.target.checked)} />
              <span>Audio clue fallback enabled <InlineFieldHelp label="Audio clue fallback enabled" /></span>
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
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showStageHint} onChange={(e) => setShowStageHint(e.target.checked)} /> <span>Show stage hint <InlineFieldHelp label="Show stage hint" /></span></label>
          </div>
        </section>

        <section className="rounded-3xl border border-teal-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-teal-100">Pacing Budget</h2>
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
          <p className="mt-3 text-sm text-stone-300">Derived target gap: <span className="font-semibold text-teal-300">{targetGapSeconds}s</span></p>
        </section>

        <section className="rounded-3xl border border-teal-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-teal-100">Teams + Cover Art Calls</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">Teams (one per line) <InlineFieldHelp label="Teams (one per line)" />
              <textarea className="mt-1 h-32 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
            </label>

            <label className="text-sm">Playlist Pull Calls (Artist - Title | Year | Reveal1 URL | Reveal2 URL | Reveal3 URL | Audio clue optional | Source optional) <InlineFieldHelp label="Playlist Pull Calls" />
              <textarea className="mt-1 h-32 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={callListText} onChange={(e) => setCallListText(e.target.value)} />
            </label>
          </div>

          <div className="mt-4 rounded border border-stone-700 bg-stone-950/60 p-3 text-sm">
            <p>Teams: {teamNames.length} | Calls parsed: {calls.length}</p>
            {roundCountWarning ? <p className="mt-1 text-amber-300">Add at least {roundCount} valid calls before creating the session.</p> : null}
          </div>

          <div className="mt-4 rounded border border-stone-700 bg-stone-950/60 p-3 text-sm">
            <p className="font-semibold text-teal-200">Preflight checklist</p>
            <label className="mt-2 block"><input type="checkbox" checked={preflight.imageDeckPrepared} onChange={(e) => setPreflight((prev) => ({ ...prev, imageDeckPrepared: e.target.checked }))} /> <span className="ml-2">Three reveal assets are prepared for every round. <InlineFieldHelp label="Three reveal assets are prepared for every round." /></span></label>
            <label className="mt-1 block"><input type="checkbox" checked={preflight.revealOrderVerified} onChange={(e) => setPreflight((prev) => ({ ...prev, revealOrderVerified: e.target.checked }))} /> <span className="ml-2">Reveal order is verified (stage 1 hardest to stage 3 easiest). <InlineFieldHelp label="Reveal order is verified (stage 1 hardest to stage 3 easiest)." /></span></label>
            <label className="mt-1 block"><input type="checkbox" checked={preflight.audioCluesOptionalReady} onChange={(e) => setPreflight((prev) => ({ ...prev, audioCluesOptionalReady: e.target.checked }))} /> <span className="ml-2">Optional audio clues are cued for stall recovery. <InlineFieldHelp label="Optional audio clues are cued for stall recovery." /></span></label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button className="rounded bg-teal-600 px-4 py-2 font-semibold text-black disabled:opacity-40" disabled={!playlistId || playlistTooSmall || creating || !preflightComplete || roundCountWarning} onClick={createSession}>
              {creating ? "Creating..." : "Create Session"}
            </button>
            <button className="rounded border border-stone-600 px-4 py-2" onClick={load}>Refresh</button>
          </div>
        </section>

        <section className="rounded-3xl border border-teal-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-teal-100">Recent Sessions</h2>
          {sessions.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">No sessions yet for this filter.</p>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              {sessions.map((session) => (
                <div key={session.id} className="rounded border border-stone-700 bg-stone-950/70 p-3">
                  <p>{session.session_code} · {session.title} · Round {session.current_round}/{session.round_count}</p>
                  <p className="text-stone-400">Event: {session.event_title ?? "(none)"} · Playlist: {session.playlist_name ?? "(none)"} · Score model: {session.stage_one_points}/{session.stage_two_points}/{session.final_reveal_points} · Calls: {session.calls_scored}/{session.calls_total} · Status: {session.status}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/cover-art-clue-chase/host?sessionId=${session.id}`)}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/cover-art-clue-chase/assistant?sessionId=${session.id}`)}>Assistant</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/cover-art-clue-chase/jumbotron?sessionId=${session.id}`)}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadGamePullListPdf({ gameSlug: "cover-art-clue-chase", gameTitle: "Cover Art Clue Chase", sessionId: session.id, sessionCode: session.session_code, accentRgb: [13, 148, 136] })}>Pull List PDF</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push("/admin/games/cover-art-clue-chase/history")}>History</button>
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
