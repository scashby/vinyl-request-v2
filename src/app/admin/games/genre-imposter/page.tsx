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
  reveal_mode: "after_third_spin" | "immediate";
  reason_mode: "host_judged" | "strict_key";
  playlist_name: string | null;
  rounds_total: number;
  picks_logged: number;
  event_title: string | null;
};

type RoundDraft = {
  category_label: string;
  imposter_call_index: number;
  reason_key?: string;
  calls: Array<{
    call_index: number;
    artist?: string;
    title?: string;
    source_label?: string;
  }>;
};

const REVEAL_OPTIONS = [
  { value: "after_third_spin", label: "After 3rd Spin" },
  { value: "immediate", label: "Immediate" },
] as const;

const REASON_MODE_OPTIONS = [
  { value: "host_judged", label: "Host Judged" },
  { value: "strict_key", label: "Strict Key" },
] as const;

function parseRoundDeck(lines: string): RoundDraft[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [categoryLabel, call1, call2, call3, imposterIndexPart, reasonKey] = line.split("|").map((part) => part.trim());
      const imposterCallIndex = Math.min(3, Math.max(1, Number(imposterIndexPart || 3)));
      const calls = [call1, call2, call3].map((raw, index) => {
        const [artist, title, sourceLabel] = (raw ?? "").split("~").map((part) => part.trim());
        return {
          call_index: index + 1,
          artist: artist || undefined,
          title: title || undefined,
          source_label: sourceLabel || undefined,
        };
      });

      return {
        category_label: categoryLabel ?? "",
        imposter_call_index: imposterCallIndex,
        reason_key: reasonKey || undefined,
        calls,
      };
    })
    .filter((round) => round.category_label && round.calls.length === 3);
}

export default function GenreImposterSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [playlistId, setPlaylistId] = useState<number | null>(null);
  const [title, setTitle] = useState("Genre Imposter Session");
  const [roundCount, setRoundCount] = useState(8);
  const [revealMode, setRevealMode] = useState<"after_third_spin" | "immediate">("after_third_spin");
  const [reasonMode, setReasonMode] = useState<"host_judged" | "strict_key">("host_judged");

  const [showTitle, setShowTitle] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showCategory, setShowCategory] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);

  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(10);

  const [teamNamesText, setTeamNamesText] = useState("Table 1\nTable 2");
  const [roundDeckText, setRoundDeckText] = useState(
    "90s Hip-Hop | A Tribe Called Quest~Can I Kick It?~LP A1 | Nirvana~Smells Like Teen Spirit~LP A2 | Daft Punk~Around the World~LP B1 | 3 | Daft Punk is French house, not 90s hip-hop\nMotown/Soul | Marvin Gaye~What's Going On~LP A1 | Stevie Wonder~Sir Duke~LP A2 | Metallica~One~LP B1 | 3 | Metallica is outside Motown/Soul"
  );

  const [imposterPoints, setImposterPoints] = useState(2);
  const [reasonBonusPoints, setReasonBonusPoints] = useState(1);

  const [preflight, setPreflight] = useState({
    categoryCardsReady: false,
    allRoundTriosPrePulled: false,
    tieBreakerRoundReady: false,
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

  const rounds = useMemo(() => parseRoundDeck(roundDeckText), [roundDeckText]);
  const preflightComplete = useMemo(() => Object.values(preflight).every(Boolean), [preflight]);
  const targetGapSeconds = useMemo(
    () => removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds,
    [cueSeconds, findRecordSeconds, hostBufferSeconds, removeResleeveSeconds]
  );

  const minimumPlaylistTracks = useMemo(
    () => Math.max((roundCount + 1) * 3, rounds.length * 3),
    [roundCount, rounds.length]
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
      fetch("/api/games/genre-imposter/events"),
      fetch("/api/games/playlists"),
      fetch(`/api/games/genre-imposter/sessions${eventId ? `?eventId=${eventId}` : ""}`),
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
      const res = await fetch("/api/games/genre-imposter/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          playlist_id: playlistId,
          title,
          round_count: roundCount,
          reveal_mode: revealMode,
          reason_mode: reasonMode,
          imposter_points: imposterPoints,
          reason_bonus_points: reasonBonusPoints,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_title: showTitle,
          show_round: showRound,
          show_category: showCategory,
          show_scoreboard: showScoreboard,
          team_names: teamNames,
          rounds,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      router.push(`/admin/games/genre-imposter/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const usingAutoGeneratedRounds = rounds.length === 0;
  const roundCountWarning = rounds.length > 0 && rounds.length < roundCount;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#26403d,transparent_45%),linear-gradient(180deg,#101010,#060606)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-emerald-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-300">Brewery Floor Mode</p>
          <h1 className="mt-1 text-4xl font-black uppercase text-emerald-100">Genre Imposter Setup</h1>
          <p className="mt-2 text-sm text-stone-300">Genre Imposter plays three songs in a category, teams pick the one that does not belong, and the team with the most correct imposter picks wins.</p>
          <div className="mt-3 flex justify-end"><GameSetupInfoButton gameSlug="genre-imposter" /></div>
        </header>

        <section className="rounded-3xl border border-emerald-900/40 bg-black/45 p-4 text-sm text-stone-200">
          <p className="font-semibold uppercase tracking-[0.16em] text-emerald-200">Testing Instructions</p>
          <p className="mt-2">Operator guide: <code>docs/genre-imposter-operator-guide.md</code></p>
          <p className="mt-1">Smoke test checklist: <code>docs/genre-imposter-smoke-test.md</code></p>
        </section>

        <section className="rounded-3xl border border-emerald-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-emerald-100">Session Config</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GameEventSelect events={events} eventId={eventId} setEventId={setEventId} />
            <GamePlaylistSelect playlists={playlists} playlistId={playlistId} setPlaylistId={setPlaylistId} />

            <label className="text-sm">Session Title <InlineFieldHelp label="Session Title" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm">Rounds (6-15) <InlineFieldHelp label="Rounds (6-15)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={6} max={15} value={roundCount} onChange={(e) => setRoundCount(Math.max(6, Math.min(15, Number(e.target.value) || 6)))} />
            </label>

            <label className="text-sm">Reveal Mode <InlineFieldHelp label="Reveal Mode" />
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={revealMode} onChange={(e) => setRevealMode((e.target.value as "after_third_spin" | "immediate") ?? "after_third_spin")}>
                {REVEAL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="text-sm">Reason Mode <InlineFieldHelp label="Reason Mode" />
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={reasonMode} onChange={(e) => setReasonMode((e.target.value as "host_judged" | "strict_key") ?? "host_judged")}>
                {REASON_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="text-sm">Imposter Points <InlineFieldHelp label="Imposter Points" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={5} value={imposterPoints} onChange={(e) => setImposterPoints(Math.max(0, Math.min(5, Number(e.target.value) || 0)))} />
            </label>

            <label className="text-sm">Reason Bonus Points <InlineFieldHelp label="Reason Bonus Points" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={3} value={reasonBonusPoints} onChange={(e) => setReasonBonusPoints(Math.max(0, Math.min(3, Number(e.target.value) || 0)))} />
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
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showRound} onChange={(e) => setShowRound(e.target.checked)} /> <span>Jumbotron round label <InlineFieldHelp label="Jumbotron round label" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showCategory} onChange={(e) => setShowCategory(e.target.checked)} /> <span>Jumbotron category card <InlineFieldHelp label="Jumbotron category card" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showScoreboard} onChange={(e) => setShowScoreboard(e.target.checked)} /> <span>Jumbotron scoreboard <InlineFieldHelp label="Jumbotron scoreboard" /></span></label>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-emerald-100">Pacing Budget</h2>
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
          <p className="mt-3 text-sm text-stone-300">Derived target gap: <span className="font-semibold text-emerald-300">{targetGapSeconds}s</span></p>
        </section>

        <section className="rounded-3xl border border-emerald-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-emerald-100">Teams + Round Deck</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">Teams (one per line) <InlineFieldHelp label="Teams (one per line)" />
              <textarea className="mt-1 h-40 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
              <p className="mt-1 text-xs text-stone-400">Detected teams: {teamNames.length}</p>
            </label>

            <label className="text-sm">Playlist Pull Rounds (one per line, optional) <InlineFieldHelp label="Playlist Pull Rounds" />
              <textarea className="mt-1 h-40 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={roundDeckText} onChange={(e) => setRoundDeckText(e.target.value)} />
              <p className={`mt-1 text-xs ${roundCountWarning ? "text-amber-300" : usingAutoGeneratedRounds ? "text-emerald-300" : "text-stone-400"}`}>
                {usingAutoGeneratedRounds
                  ? `No manual rounds provided. ${roundCount} rounds will be auto-generated from the selected playlist bank.`
                  : `Valid rounds: ${rounds.length}. Minimum required for current rounds: ${roundCount}. Format: Category | A~Song~Source | B~Song~Source | C~Song~Source | ImposterIndex(1-3) | Reason key.`}
              </p>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-stone-700 bg-stone-950/80 p-3 text-sm">
            <p className="font-semibold uppercase tracking-wide text-emerald-200">Preflight Checklist</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.categoryCardsReady} onChange={(e) => setPreflight((p) => ({ ...p, categoryCardsReady: e.target.checked }))} /> <span>Category cards printed and sorted <InlineFieldHelp label="Category cards printed and sorted" /></span></label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.allRoundTriosPrePulled} onChange={(e) => setPreflight((p) => ({ ...p, allRoundTriosPrePulled: e.target.checked }))} /> <span>Three-record trios pre-pulled by round <InlineFieldHelp label="Three-record trios pre-pulled by round" /></span></label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.tieBreakerRoundReady} onChange={(e) => setPreflight((p) => ({ ...p, tieBreakerRoundReady: e.target.checked }))} /> <span>Tie-breaker round staged <InlineFieldHelp label="Tie-breaker round staged" /></span></label>
            </div>
          </div>

          <button disabled={!playlistId || playlistTooSmall || !preflightComplete || teamNames.length < 2 || roundCountWarning || creating} onClick={createSession} className="mt-5 rounded bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {creating ? "Creating..." : "Create Session"}
          </button>
        </section>

        <section className="rounded-3xl border border-emerald-900/40 bg-black/45 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black uppercase text-emerald-100">Existing Sessions</h2>
            <button onClick={load} className="rounded border border-stone-700 px-3 py-1 text-sm">Refresh</button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-stone-400">No sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-stone-700 bg-stone-950/70 p-3">
                  <div className="text-sm">{session.session_code} · {session.title} · Round {session.current_round} of {session.round_count} · Rounds Loaded {session.rounds_total}</div>
                  <div className="text-xs text-stone-400">Event: {session.event_title ?? "(none)"} · Playlist: {session.playlist_name ?? "(unlabeled)"} · Reveal: {session.reveal_mode} · Reason mode: {session.reason_mode} · Picks: {session.picks_logged} · Status: {session.status}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/genre-imposter/host?sessionId=${session.id}`)}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/genre-imposter/assistant?sessionId=${session.id}`)}>Assistant</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/genre-imposter/jumbotron?sessionId=${session.id}`)}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => downloadGamePullListPdf({ gameSlug: "genre-imposter", gameTitle: "Genre Imposter", sessionId: session.id, sessionCode: session.session_code, accentRgb: [5, 150, 105] })}>Pull List PDF</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push("/admin/games/genre-imposter/history")}>History</button>
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
