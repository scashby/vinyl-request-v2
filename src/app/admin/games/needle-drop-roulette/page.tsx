"use client";

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
  answer_mode: "slips" | "whiteboard" | "mixed";
  snippet_seconds: number;
  calls_total: number;
  event_title: string | null;
};

type CallDraft = {
  artist: string;
  title: string;
  source_label?: string;
};

const ANSWER_MODE_OPTIONS = [
  { value: "slips", label: "Answer Slips" },
  { value: "whiteboard", label: "Whiteboards" },
  { value: "mixed", label: "Mixed" },
] as const;

function parseCalls(lines: string): CallDraft[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [artistTitle, sourceLabel] = line.split("|").map((part) => part.trim());
      const [artist, title] = artistTitle.split(" - ").map((part) => part.trim());
      return {
        artist: artist ?? "",
        title: title ?? "",
        source_label: sourceLabel || undefined,
      };
    })
    .filter((call) => call.artist && call.title);
}

export default function NeedleDropRouletteSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [playlistId, setPlaylistId] = useState<number | null>(null);
  const [title, setTitle] = useState("Needle Drop Roulette Session");
  const [roundCount, setRoundCount] = useState(10);
  const [answerMode, setAnswerMode] = useState<"slips" | "whiteboard" | "mixed">("slips");
  const [snippetSeconds, setSnippetSeconds] = useState(7);

  const [showTitle, setShowTitle] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);

  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(10);

  const [teamNamesText, setTeamNamesText] = useState("Table 1\nTable 2");
  const [callListText, setCallListText] = useState(
    "Stevie Wonder - Superstition | LP crate A\nPrince - Kiss | 12in\nFleetwood Mac - Dreams | crate B"
  );

  const [preflight, setPreflight] = useState({
    slipsOrBoardsReady: false,
    backupNeedleReady: false,
    tieBreakDropReady: false,
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
      fetch("/api/games/needle-drop-roulette/events"),
      fetch("/api/games/playlists"),
      fetch(`/api/games/needle-drop-roulette/sessions${eventId ? `?eventId=${eventId}` : ""}`),
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
      const res = await fetch("/api/games/needle-drop-roulette/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          playlist_id: playlistId,
          title,
          round_count: roundCount,
          answer_mode: answerMode,
          snippet_seconds: snippetSeconds,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_title: showTitle,
          show_round: showRound,
          show_scoreboard: showScoreboard,
          team_names: teamNames,
          calls,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      router.push(`/admin/games/needle-drop-roulette/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const roundCountWarning = calls.length < roundCount;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#4a1707,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-orange-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-orange-300">Brewery Floor Mode</p>
          <h1 className="mt-1 text-4xl font-black uppercase text-orange-100">Needle Drop Roulette Setup</h1>
          <p className="mt-2 text-sm text-stone-300">Drop the needle at random, play a short clip, and have teams guess the artist and song before the reveal.</p>
          <div className="mt-3 flex justify-end"><GameSetupInfoButton gameSlug="needle-drop-roulette" /></div>
        </header>

        <section className="rounded-3xl border border-orange-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-orange-100">Session Config</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GameEventSelect events={events} eventId={eventId} setEventId={setEventId} />
            <GamePlaylistSelect playlists={playlists} playlistId={playlistId} setPlaylistId={setPlaylistId} />

            <label className="text-sm">Session Title <InlineFieldHelp label="Session Title" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm">Rounds (8-12) <InlineFieldHelp label="Rounds (8-12)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={8} max={12} value={roundCount} onChange={(e) => setRoundCount(Math.max(8, Math.min(12, Number(e.target.value) || 8)))} />
            </label>

            <label className="text-sm">Answer Mode <InlineFieldHelp label="Answer Mode" />
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={answerMode} onChange={(e) => setAnswerMode((e.target.value as "slips" | "whiteboard" | "mixed") ?? "slips")}>
                {ANSWER_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="text-sm">Snippet Seconds (5-10) <InlineFieldHelp label="Snippet Seconds (5-10)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={5} max={10} value={snippetSeconds} onChange={(e) => setSnippetSeconds(Math.max(5, Math.min(10, Number(e.target.value) || 5)))} />
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

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> <span>Jumbotron title <InlineFieldHelp label="Jumbotron title" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showRound} onChange={(e) => setShowRound(e.target.checked)} /> <span>Jumbotron round <InlineFieldHelp label="Jumbotron round" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showScoreboard} onChange={(e) => setShowScoreboard(e.target.checked)} /> <span>Jumbotron scoreboard <InlineFieldHelp label="Jumbotron scoreboard" /></span></label>
          </div>
        </section>

        <section className="rounded-3xl border border-orange-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-orange-100">Pacing Budget</h2>
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
          <p className="mt-3 text-sm text-stone-300">Derived target gap: <span className="font-semibold text-orange-300">{targetGapSeconds}s</span></p>
        </section>

        <section className="rounded-3xl border border-orange-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-orange-100">Teams + Needle Drop Deck</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">Teams (one per line) <InlineFieldHelp label="Teams (one per line)" />
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
              <p className="mt-1 text-xs text-stone-400">Detected teams: {teamNames.length}</p>
            </label>

            <label className="text-sm">Playlist Pull Needle Drops (one per line: Artist - Title | optional source) <InlineFieldHelp label="Playlist Pull Needle Drops" />
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={callListText} onChange={(e) => setCallListText(e.target.value)} />
              <p className={`mt-1 text-xs ${roundCountWarning ? "text-amber-300" : "text-stone-400"}`}>
                Valid calls: {calls.length}. Minimum required for current rounds: {roundCount}.
              </p>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-stone-700 bg-stone-950/80 p-3 text-sm">
            <p className="font-semibold uppercase tracking-wide text-orange-200">Preflight Checklist</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.slipsOrBoardsReady} onChange={(e) => setPreflight((p) => ({ ...p, slipsOrBoardsReady: e.target.checked }))} /> <span>Slips/whiteboards staged by table <InlineFieldHelp label="Slips/whiteboards staged by table" /></span></label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.backupNeedleReady} onChange={(e) => setPreflight((p) => ({ ...p, backupNeedleReady: e.target.checked }))} /> <span>Backup stylus and cleaning kit ready <InlineFieldHelp label="Backup stylus and cleaning kit ready" /></span></label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.tieBreakDropReady} onChange={(e) => setPreflight((p) => ({ ...p, tieBreakDropReady: e.target.checked }))} /> <span>Tie-break drop staged <InlineFieldHelp label="Tie-break drop staged" /></span></label>
            </div>
          </div>

          <button disabled={!playlistId || playlistTooSmall || !preflightComplete || teamNames.length < 2 || roundCountWarning || creating} onClick={createSession} className="mt-5 rounded bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {creating ? "Creating..." : "Create Session"}
          </button>
        </section>

        <section className="rounded-3xl border border-orange-900/40 bg-black/45 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black uppercase text-orange-100">Existing Sessions</h2>
            <button onClick={load} className="rounded border border-stone-700 px-3 py-1 text-sm">Refresh</button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-stone-400">No sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-stone-700 bg-stone-950/70 p-3">
                  <div className="text-sm">{session.session_code} · {session.title} · Round {session.current_round} of {session.round_count} · Calls {session.calls_total}</div>
                  <div className="text-xs text-stone-400">Event: {session.event_title ?? "(none)"} · Mode: {session.answer_mode} · Snippet: {session.snippet_seconds}s · Status: {session.status}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/needle-drop-roulette/host?sessionId=${session.id}`)}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/needle-drop-roulette/assistant?sessionId=${session.id}`)}>Assistant</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/needle-drop-roulette/jumbotron?sessionId=${session.id}`)}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadGamePullListPdf({ gameSlug: "needle-drop-roulette", gameTitle: "Needle Drop Roulette", sessionId: session.id, sessionCode: session.session_code, accentRgb: [194, 65, 12] })}>Pull List PDF</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push("/admin/games/needle-drop-roulette/history")}>History</button>
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
