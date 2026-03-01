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
  connection_points: number;
  detail_bonus_points: number;
  calls_total: number;
  calls_scored: number;
  event_title: string | null;
};

type PairDraft = {
  track_a_artist: string;
  track_a_title: string;
  track_b_artist: string;
  track_b_title: string;
  accepted_connection: string;
  accepted_detail?: string;
};

function parsePairs(lines: string): PairDraft[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map<PairDraft | null>((line) => {
      const [trackA, trackB, connection, detail] = line.split("|").map((part) => part.trim());
      const [trackAArtist, trackATitle] = (trackA ?? "").split(" - ").map((part) => part.trim());
      const [trackBArtist, trackBTitle] = (trackB ?? "").split(" - ").map((part) => part.trim());
      if (!trackAArtist || !trackATitle || !trackBArtist || !trackBTitle || !connection) return null;

      return {
        track_a_artist: trackAArtist,
        track_a_title: trackATitle,
        track_b_artist: trackBArtist,
        track_b_title: trackBTitle,
        accepted_connection: connection,
        ...(detail ? { accepted_detail: detail } : {}),
      };
    })
    .filter((pair): pair is PairDraft => pair !== null);
}

export default function BackToBackConnectionSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [playlistId, setPlaylistId] = useState<number | null>(null);
  const [title, setTitle] = useState("Back-to-Back Connection Session");
  const [roundCount, setRoundCount] = useState(10);
  const [connectionPoints, setConnectionPoints] = useState(2);
  const [detailBonusPoints, setDetailBonusPoints] = useState(1);

  const [showTitle, setShowTitle] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);
  const [showConnectionPrompt, setShowConnectionPrompt] = useState(true);

  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(10);

  const [teamNamesText, setTeamNamesText] = useState("Table 1\nTable 2");
  const [pairListText, setPairListText] = useState(
    "Chic - Good Times | Queen - Another One Bites the Dust | Shared bassline influence | Bernard Edwards groove\nDaft Punk - One More Time | Modjo - Lady (Hear Me Tonight) | French house crossover | Built from disco-era sampling"
  );

  const [preflight, setPreflight] = useState({
    pairOrderPrinted: false,
    sleevesStagedInPlayOrder: false,
    tiebreakPairReady: false,
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

  const calls = useMemo(() => parsePairs(pairListText), [pairListText]);
  const preflightComplete = useMemo(() => Object.values(preflight).every(Boolean), [preflight]);
  const targetGapSeconds = useMemo(
    () => removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds,
    [cueSeconds, findRecordSeconds, hostBufferSeconds, removeResleeveSeconds]
  );

  const minimumPlaylistTracks = useMemo(
    () => Math.max((roundCount + 1) * 2, calls.length * 2),
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
      fetch("/api/games/back-to-back-connection/events"),
      fetch("/api/games/playlists"),
      fetch(`/api/games/back-to-back-connection/sessions${eventId ? `?eventId=${eventId}` : ""}`),
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
      const res = await fetch("/api/games/back-to-back-connection/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          playlist_id: playlistId,
          title,
          round_count: roundCount,
          connection_points: connectionPoints,
          detail_bonus_points: detailBonusPoints,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_title: showTitle,
          show_round: showRound,
          show_scoreboard: showScoreboard,
          show_connection_prompt: showConnectionPrompt,
          team_names: teamNames,
          calls,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      router.push(`/admin/games/back-to-back-connection/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const roundCountWarning = calls.length < roundCount;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_18%,#563b13,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Brewery Floor Mode</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-4xl font-black uppercase text-amber-100">Back-to-Back Connection Setup</h1>
            <div className="flex gap-2">
              <Link href="/admin/games/back-to-back-connection/history" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">History</Link>
              <Link href="/admin/games/back-to-back-connection/host" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Host</Link>
              <Link href="/admin/games/back-to-back-connection/assistant" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Assistant</Link>
              <Link href="/admin/games/back-to-back-connection/jumbotron" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Jumbotron</Link>
            </div>
          </div>
          <p className="mt-2 text-sm text-stone-300">Play two tracks, teams identify one accepted connection, then optionally name a specific detail.</p>
          <div className="mt-3 flex justify-end"><GameSetupInfoButton gameSlug="back-to-back-connection" /></div>
        </header>

        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">Session Config</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GameEventSelect events={events} eventId={eventId} setEventId={setEventId} />
            <GamePlaylistSelect playlists={playlists} playlistId={playlistId} setPlaylistId={setPlaylistId} />

            <label className="text-sm">Session Title <InlineFieldHelp label="Session Title" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm">Rounds (8-14) <InlineFieldHelp label="Rounds (8-14)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={8} max={14} value={roundCount} onChange={(e) => setRoundCount(Math.max(8, Math.min(14, Number(e.target.value) || 8)))} />
            </label>

            <label className="text-sm">Connection Points <InlineFieldHelp label="Connection Points" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={3} value={connectionPoints} onChange={(e) => setConnectionPoints(Math.max(0, Math.min(3, Number(e.target.value) || 0)))} />
            </label>

            <label className="text-sm">Detail Bonus Points <InlineFieldHelp label="Detail Bonus Points" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={2} value={detailBonusPoints} onChange={(e) => setDetailBonusPoints(Math.max(0, Math.min(2, Number(e.target.value) || 0)))} />
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
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showConnectionPrompt} onChange={(e) => setShowConnectionPrompt(e.target.checked)} /> <span>Show connection prompt <InlineFieldHelp label="Show connection prompt" /></span></label>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">Pacing Budget</h2>
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
          <p className="mt-3 text-sm text-stone-300">Derived target gap: <span className="font-semibold text-amber-300">{targetGapSeconds}s</span></p>
        </section>

        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">Teams + Pair Deck</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">Teams (one per line) <InlineFieldHelp label="Teams (one per line)" />
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
              <p className="mt-1 text-xs text-stone-400">Detected teams: {teamNames.length}</p>
            </label>

            <label className="text-sm">Playlist Pull Pairs (Track A | Track B | Connection | Optional detail) <InlineFieldHelp label="Playlist Pull Pairs" />
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={pairListText} onChange={(e) => setPairListText(e.target.value)} />
              <p className={`mt-1 text-xs ${roundCountWarning ? "text-amber-300" : "text-stone-400"}`}>
                Valid pairs: {calls.length}. Minimum required for current rounds: {roundCount}.
              </p>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-stone-700 bg-stone-950/80 p-3 text-sm">
            <p className="font-semibold uppercase tracking-wide text-amber-200">Preflight Checklist</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.pairOrderPrinted} onChange={(e) => setPreflight((p) => ({ ...p, pairOrderPrinted: e.target.checked }))} /> <span>Pair order and answer key printed <InlineFieldHelp label="Pair order and answer key printed" /></span></label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.sleevesStagedInPlayOrder} onChange={(e) => setPreflight((p) => ({ ...p, sleevesStagedInPlayOrder: e.target.checked }))} /> <span>Sleeves staged in play order <InlineFieldHelp label="Sleeves staged in play order" /></span></label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.tiebreakPairReady} onChange={(e) => setPreflight((p) => ({ ...p, tiebreakPairReady: e.target.checked }))} /> <span>Tie-break pair staged and labeled <InlineFieldHelp label="Tie-break pair staged and labeled" /></span></label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button disabled={!playlistId || playlistTooSmall || creating || !preflightComplete || roundCountWarning || teamNames.length < 2} onClick={createSession} className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-300">
              {creating ? "Creating..." : "Create Session"}
            </button>
            {!preflightComplete ? <p className="text-xs text-amber-300">Complete preflight before creating session.</p> : null}
          </div>
        </section>

        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">Host / Assistant / Jumbotron Scope</h2>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded border border-stone-700 bg-stone-950/70 p-3">
              <p className="font-semibold text-amber-200">Host</p>
              <p className="mt-1 text-stone-300">Own round control, reveal answer, score by table, and manage vinyl pacing timer.</p>
            </div>
            <div className="rounded border border-stone-700 bg-stone-950/70 p-3">
              <p className="font-semibold text-amber-200">Assistant</p>
              <p className="mt-1 text-stone-300">Optional score entry and dispute notes only. No transport controls for solo-host safety.</p>
            </div>
            <div className="rounded border border-stone-700 bg-stone-950/70 p-3">
              <p className="font-semibold text-amber-200">Jumbotron</p>
              <p className="mt-1 text-stone-300">Show prompt, round, countdown, and scoreboard. Keep answer hidden until reveal action.</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-stone-400">Detailed phase plan, route plan, and risk controls: `docs/back-to-back-connection-plan.md`.</p>
        </section>

        <section className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-amber-100">Recent Sessions</h2>
          {sessions.length === 0 ? (
            <p className="mt-2 text-sm text-stone-400">No sessions yet.</p>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              {sessions.map((session) => (
                <div key={session.id} className="rounded border border-stone-700 bg-stone-950/70 p-3">
                  <p>{session.session_code} · {session.title}</p>
                  <p className="text-stone-400">Event: {session.event_title ?? "(none)"} · Round: {session.current_round}/{session.round_count} · Calls: {session.calls_scored}/{session.calls_total} scored · Status: {session.status}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="rounded border border-stone-600 px-2 py-1 text-xs" onClick={() => router.push(`/admin/games/back-to-back-connection/host?sessionId=${session.id}`)}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1 text-xs" onClick={() => router.push(`/admin/games/back-to-back-connection/assistant?sessionId=${session.id}`)}>Assistant</button>
                    <button className="rounded border border-stone-600 px-2 py-1 text-xs" onClick={() => router.push(`/admin/games/back-to-back-connection/jumbotron?sessionId=${session.id}`)}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1 text-xs" onClick={() => downloadGamePullListPdf({ gameSlug: "back-to-back-connection", gameTitle: "Back-to-Back Connection", sessionId: session.id, sessionCode: session.session_code, accentRgb: [217, 119, 6] })}>Pull List PDF</button>
                    <button className="rounded border border-stone-600 px-2 py-1 text-xs" onClick={() => router.push("/admin/games/back-to-back-connection/history")}>History</button>
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
