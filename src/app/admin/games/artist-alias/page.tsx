"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GameEventSelect from "src/components/GameEventSelect";
import GameSetupInfoButton from "src/components/GameSetupInfoButton";
import InlineFieldHelp from "src/components/InlineFieldHelp";

type EventRow = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
};

type SessionRow = {
  id: number;
  session_code: string;
  title: string;
  status: string;
  current_round: number;
  round_count: number;
  stage_one_points: number;
  stage_two_points: number;
  final_reveal_points: number;
  calls_total: number;
  calls_scored: number;
  event_title: string | null;
};

type CallDraft = {
  artist_name: string;
  accepted_aliases?: string[];
  clue_era: string;
  clue_collaborator: string;
  clue_label_region: string;
  audio_clue_source?: string;
  source_label?: string;
};

function parseAliases(raw: string | undefined): string[] {
  if (!raw) return [];
  return Array.from(new Set(raw.split(",").map((part) => part.trim()).filter(Boolean)));
}

function parseCalls(lines: string): CallDraft[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map<CallDraft | null>((line) => {
      const parts = line.split("|").map((part) => part.trim());
      const [artistName, eraClue, collaboratorClue, labelRegionClue, aliasesRaw, audioClue, sourceLabel] = parts;
      if (!artistName || !eraClue || !collaboratorClue || !labelRegionClue) return null;

      const aliases = parseAliases(aliasesRaw);

      return {
        artist_name: artistName,
        clue_era: eraClue,
        clue_collaborator: collaboratorClue,
        clue_label_region: labelRegionClue,
        ...(aliases.length ? { accepted_aliases: aliases } : {}),
        ...(audioClue ? { audio_clue_source: audioClue } : {}),
        ...(sourceLabel ? { source_label: sourceLabel } : {}),
      };
    })
    .filter((call): call is CallDraft => call !== null);
}

export default function ArtistAliasSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [title, setTitle] = useState("Artist Alias Session");
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
    "Prince | 80s Minneapolis funk | Teamed with The Revolution | Warner Bros / Minneapolis | The Artist Formerly Known as Prince, Love Symbol | Optional audio teaser | LP A\nDavid Bowie | 70s glam to art-pop pivot | Worked heavily with Brian Eno | UK/EMI to RCA run | Ziggy Stardust, Thin White Duke | | LP B"
  );

  const [preflight, setPreflight] = useState({
    clueCardsPrepared: false,
    revealOrderChecked: false,
    backupAudioCluesReady: false,
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

  const load = useCallback(async () => {
    const [eventRes, sessionRes] = await Promise.all([
      fetch("/api/games/artist-alias/events"),
      fetch(`/api/games/artist-alias/sessions${eventId ? `?eventId=${eventId}` : ""}`),
    ]);

    if (eventRes.ok) {
      const payload = await eventRes.json();
      setEvents(payload.data ?? []);
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
    setCreating(true);
    try {
      const res = await fetch("/api/games/artist-alias/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
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

      router.push(`/admin/games/artist-alias/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const roundCountWarning = calls.length < roundCount;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#25203a,transparent_45%),linear-gradient(180deg,#111,#060606)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-violet-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-violet-300">Brewery Floor Mode</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-4xl font-black uppercase text-violet-100">Artist Alias Setup</h1>
            <div className="flex gap-2">
              <Link href="/admin/games/artist-alias/history" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">History</Link>
              <Link href="/admin/games/artist-alias/jumbotron" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Jumbotron Scope</Link>
            </div>
          </div>
          <p className="mt-2 text-sm text-stone-300">Staged clue cards: era, collaborator, then label/region. Scoring rewards early locks.</p>
          <div className="mt-3 flex justify-end"><GameSetupInfoButton gameSlug="artist-alias" /></div>
        </header>

        <section className="rounded-3xl border border-violet-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-violet-100">Session Config</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GameEventSelect events={events} eventId={eventId} setEventId={setEventId} />

            <label className="text-sm">Session Title <InlineFieldHelp label="Session Title" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm">Rounds (8-14) <InlineFieldHelp label="Rounds (8-14)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={8} max={14} value={roundCount} onChange={(e) => setRoundCount(Math.max(8, Math.min(14, Number(e.target.value) || 8)))} />
            </label>

            <label className="text-sm">Stage 1 Points (Era clue) <InlineFieldHelp label="Stage 1 Points (Era clue)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={5} value={stageOnePoints} onChange={(e) => setStageOnePoints(Math.max(0, Math.min(5, Number(e.target.value) || 0)))} />
            </label>

            <label className="text-sm">Stage 2 Points (Collaborator clue) <InlineFieldHelp label="Stage 2 Points (Collaborator clue)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={5} value={stageTwoPoints} onChange={(e) => setStageTwoPoints(Math.max(0, Math.min(5, Number(e.target.value) || 0)))} />
            </label>

            <label className="text-sm">Stage 3 Points (Label/Region clue) <InlineFieldHelp label="Stage 3 Points (Label/Region clue)" />
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={5} value={finalRevealPoints} onChange={(e) => setFinalRevealPoints(Math.max(0, Math.min(5, Number(e.target.value) || 0)))} />
            </label>

            <label className="inline-flex items-center gap-2 text-sm pt-7">
              <input type="checkbox" checked={audioClueEnabled} onChange={(e) => setAudioClueEnabled(e.target.checked)} />
              <span>Audio clue fallback enabled <InlineFieldHelp label="Audio clue fallback enabled" /></span>
            </label>
          </div>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> <span>Jumbotron title <InlineFieldHelp label="Jumbotron title" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showRound} onChange={(e) => setShowRound(e.target.checked)} /> <span>Jumbotron round <InlineFieldHelp label="Jumbotron round" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showScoreboard} onChange={(e) => setShowScoreboard(e.target.checked)} /> <span>Jumbotron scoreboard <InlineFieldHelp label="Jumbotron scoreboard" /></span></label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showStageHint} onChange={(e) => setShowStageHint(e.target.checked)} /> <span>Show stage hint <InlineFieldHelp label="Show stage hint" /></span></label>
          </div>
        </section>

        <section className="rounded-3xl border border-violet-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-violet-100">Pacing Budget</h2>
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
          <p className="mt-3 text-sm text-stone-300">Derived target gap: <span className="font-semibold text-violet-300">{targetGapSeconds}s</span></p>
        </section>

        <section className="rounded-3xl border border-violet-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-violet-100">Teams + Clue Cards</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">Teams (one per line) <InlineFieldHelp label="Teams (one per line)" />
              <textarea className="mt-1 h-32 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
            </label>

            <label className="text-sm">Playlist Pull + Clue Cards (`Artist | Era clue | Collaborator clue | Label/Region clue | aliases comma list optional | audio clue optional | source optional`) <InlineFieldHelp label="Playlist Pull + Clue Cards" />
              <textarea className="mt-1 h-32 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={callListText} onChange={(e) => setCallListText(e.target.value)} />
            </label>
          </div>

          <div className="mt-4 rounded border border-stone-700 bg-stone-950/60 p-3 text-sm">
            <p>Teams: {teamNames.length} | Clue cards parsed: {calls.length}</p>
            {roundCountWarning ? <p className="mt-1 text-amber-300">Add at least {roundCount} valid clue cards before creating the session.</p> : null}
          </div>

          <div className="mt-4 rounded border border-stone-700 bg-stone-950/60 p-3 text-sm">
            <p className="font-semibold text-violet-200">Preflight checklist</p>
            <label className="mt-2 block"><input type="checkbox" checked={preflight.clueCardsPrepared} onChange={(e) => setPreflight((prev) => ({ ...prev, clueCardsPrepared: e.target.checked }))} /> <span className="ml-2">Each round has all three clue stages prepared and legible. <InlineFieldHelp label="Each round has all three clue stages prepared and legible." /></span></label>
            <label className="mt-1 block"><input type="checkbox" checked={preflight.revealOrderChecked} onChange={(e) => setPreflight((prev) => ({ ...prev, revealOrderChecked: e.target.checked }))} /> <span className="ml-2">Clue order is validated: era first, collaborator second, label/region third. <InlineFieldHelp label="Clue order is validated: era first, collaborator second, label/region third." /></span></label>
            <label className="mt-1 block"><input type="checkbox" checked={preflight.backupAudioCluesReady} onChange={(e) => setPreflight((prev) => ({ ...prev, backupAudioCluesReady: e.target.checked }))} /> <span className="ml-2">Optional audio fallback hints are queued for stall recovery. <InlineFieldHelp label="Optional audio fallback hints are queued for stall recovery." /></span></label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button className="rounded bg-violet-500 px-4 py-2 font-semibold text-black disabled:opacity-40" disabled={creating || !preflightComplete || roundCountWarning} onClick={createSession}>
              {creating ? "Creating..." : "Create Session"}
            </button>
            <button className="rounded border border-stone-600 px-4 py-2" onClick={load}>Refresh</button>
          </div>
        </section>

        <section className="rounded-3xl border border-violet-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-violet-100">Recent Sessions</h2>
          {sessions.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">No sessions yet for this filter.</p>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              {sessions.map((session) => (
                <div key={session.id} className="rounded border border-stone-700 bg-stone-950/70 p-3">
                  <p>{session.session_code} · {session.title} · Round {session.current_round}/{session.round_count}</p>
                  <p className="text-stone-400">Event: {session.event_title ?? "(none)"} · Score model: {session.stage_one_points}/{session.stage_two_points}/{session.final_reveal_points} · Calls: {session.calls_scored}/{session.calls_total} · Status: {session.status}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/artist-alias/host?sessionId=${session.id}`)}>Host</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/artist-alias/assistant?sessionId=${session.id}`)}>Assistant</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/artist-alias/jumbotron?sessionId=${session.id}`)}>Jumbotron</button>
                    <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push("/admin/games/artist-alias/history")}>History</button>
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
