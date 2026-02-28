"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GameEventSelect from "src/components/GameEventSelect";
import GameSetupInfoButton from "src/components/GameSetupInfoButton";

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
  points_correct_call: number;
  bonus_original_artist_points: number;
  calls_total: number;
  calls_scored: number;
  event_title: string | null;
};

type CallDraft = {
  spin_artist: string;
  track_title: string;
  original_artist: string;
  is_cover: boolean;
  release_year?: number;
  source_label?: string;
  host_notes?: string;
};

function parseCalls(lines: string): CallDraft[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map<CallDraft | null>((line) => {
      const parts = line.split("|").map((part) => part.trim());
      const [metaPart, answerPart, originalArtistPart, yearPart, sourceLabelPart, hostNotesPart] = parts;
      const [spinArtist, trackTitle] = (metaPart ?? "").split(" - ").map((part) => part.trim());
      if (!spinArtist || !trackTitle || !answerPart || !originalArtistPart) return null;

      const normalizedAnswer = answerPart.toLowerCase();
      if (normalizedAnswer !== "original" && normalizedAnswer !== "cover") return null;

      const year = Number(yearPart);
      return {
        spin_artist: spinArtist,
        track_title: trackTitle,
        original_artist: originalArtistPart,
        is_cover: normalizedAnswer === "cover",
        ...(Number.isFinite(year) ? { release_year: year } : {}),
        ...(sourceLabelPart ? { source_label: sourceLabelPart } : {}),
        ...(hostNotesPart ? { host_notes: hostNotesPart } : {}),
      };
    })
    .filter((call): call is CallDraft => call !== null);
}

export default function OriginalOrCoverSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [title, setTitle] = useState("Original or Cover Session");
  const [roundCount, setRoundCount] = useState(10);
  const [pointsCorrectCall, setPointsCorrectCall] = useState(2);
  const [bonusOriginalArtistPoints, setBonusOriginalArtistPoints] = useState(1);

  const [showTitle, setShowTitle] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);
  const [showPrompt, setShowPrompt] = useState(true);

  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(10);

  const [teamNamesText, setTeamNamesText] = useState("Table 1\nTable 2");
  const [callListText, setCallListText] = useState(
    "The Fugees - Killing Me Softly | cover | Roberta Flack | 1996 | LP crate A | Big crowd recognition\nRoberta Flack - Killing Me Softly | original | Roberta Flack | 1973 | LP crate B | Use when reset time is tight"
  );

  const [preflight, setPreflight] = useState({
    pairKeyVerified: false,
    originalArtistSpellingsChecked: false,
    backupQuickSwapPairsReady: false,
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
      fetch("/api/games/original-or-cover/events"),
      fetch(`/api/games/original-or-cover/sessions${eventId ? `?eventId=${eventId}` : ""}`),
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
      const res = await fetch("/api/games/original-or-cover/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          title,
          round_count: roundCount,
          points_correct_call: pointsCorrectCall,
          bonus_original_artist_points: bonusOriginalArtistPoints,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_title: showTitle,
          show_round: showRound,
          show_scoreboard: showScoreboard,
          show_prompt: showPrompt,
          team_names: teamNames,
          calls,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      router.push(`/admin/games/original-or-cover/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const roundCountWarning = calls.length < roundCount;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#4a3b0b,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-yellow-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-yellow-300">Brewery Floor Mode</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-4xl font-black uppercase text-yellow-100">Original or Cover Setup</h1>
            <div className="flex gap-2">
              <Link href="/admin/games/original-or-cover/history" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">History</Link>
              <Link href="/admin/games/original-or-cover/jumbotron" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Jumbotron Scope</Link>
            </div>
          </div>
          <p className="mt-2 text-sm text-stone-300">Spin a track, teams call original vs cover, then bonus for naming the original artist.</p>
          <div className="mt-3 flex justify-end"><GameSetupInfoButton gameSlug="original-or-cover" /></div>
        </header>

        <section className="rounded-3xl border border-yellow-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-yellow-100">Session Config</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GameEventSelect events={events} eventId={eventId} setEventId={setEventId} />

            <label className="text-sm">Session Title
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm">Rounds (8-12)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={8} max={12} value={roundCount} onChange={(e) => setRoundCount(Math.max(8, Math.min(12, Number(e.target.value) || 8)))} />
            </label>

            <label className="text-sm">Points: Correct Call
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={5} value={pointsCorrectCall} onChange={(e) => setPointsCorrectCall(Math.max(0, Math.min(5, Number(e.target.value) || 0)))} />
            </label>

            <label className="text-sm">Bonus: Name Original Artist
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={3} value={bonusOriginalArtistPoints} onChange={(e) => setBonusOriginalArtistPoints(Math.max(0, Math.min(3, Number(e.target.value) || 0)))} />
            </label>
          </div>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> Jumbotron title</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showRound} onChange={(e) => setShowRound(e.target.checked)} /> Jumbotron round</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showScoreboard} onChange={(e) => setShowScoreboard(e.target.checked)} /> Jumbotron scoreboard</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showPrompt} onChange={(e) => setShowPrompt(e.target.checked)} /> Show guess prompt</label>
          </div>
        </section>

        <section className="rounded-3xl border border-yellow-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-yellow-100">Pacing Budget</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">Remove + Resleeve (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={removeResleeveSeconds} onChange={(e) => setRemoveResleeveSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-sm">Find Record (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={findRecordSeconds} onChange={(e) => setFindRecordSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-sm">Cue (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={cueSeconds} onChange={(e) => setCueSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-sm">Host Buffer (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={hostBufferSeconds} onChange={(e) => setHostBufferSeconds(Math.max(0, Number(e.target.value) || 0))} />
            </label>
          </div>
          <p className="mt-3 text-sm text-stone-300">Target gap between rounds: <span className="font-semibold text-yellow-200">{targetGapSeconds}s</span></p>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-yellow-900/40 bg-black/45 p-6">
            <h2 className="text-xl font-black uppercase text-yellow-100">Teams</h2>
            <p className="mt-2 text-sm text-stone-300">One team per line. Minimum 2 teams.</p>
            <textarea className="mt-3 min-h-[140px] w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
            <p className="mt-2 text-xs text-stone-400">Parsed teams: {teamNames.length}</p>
          </div>

          <div className="rounded-3xl border border-yellow-900/40 bg-black/45 p-6">
            <h2 className="text-xl font-black uppercase text-yellow-100">Pair Deck</h2>
            <p className="mt-2 text-xs text-stone-300">Format: <code>Spin Artist - Track | cover|original | Original Artist | Year | Source Label | Host Notes</code></p>
            <textarea className="mt-3 min-h-[220px] w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-xs" value={callListText} onChange={(e) => setCallListText(e.target.value)} />
            <p className="mt-2 text-xs text-stone-400">Parsed calls: {calls.length}</p>
            {roundCountWarning ? <p className="mt-2 text-xs text-yellow-300">Need at least {roundCount} parsed calls for selected round count.</p> : null}
          </div>
        </section>

        <section className="rounded-3xl border border-yellow-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-yellow-100">Preflight</h2>
          <div className="mt-4 grid gap-2 text-sm">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.pairKeyVerified} onChange={(e) => setPreflight((prev) => ({ ...prev, pairKeyVerified: e.target.checked }))} /> Pair list order and answer key verified</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.originalArtistSpellingsChecked} onChange={(e) => setPreflight((prev) => ({ ...prev, originalArtistSpellingsChecked: e.target.checked }))} /> Original artist spellings checked for scoring bonus</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preflight.backupQuickSwapPairsReady} onChange={(e) => setPreflight((prev) => ({ ...prev, backupQuickSwapPairsReady: e.target.checked }))} /> Backup quick-swap pair crate prepared</label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              disabled={creating || !preflightComplete || teamNames.length < 2 || roundCountWarning}
              onClick={createSession}
              className="rounded border border-yellow-700 px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Session"}
            </button>
            <Link href="/admin/games/original-or-cover/host" className="rounded border border-stone-700 px-3 py-2 text-xs uppercase">Host Scope</Link>
            <Link href="/admin/games/original-or-cover/assistant" className="rounded border border-stone-700 px-3 py-2 text-xs uppercase">Assistant Scope</Link>
          </div>
        </section>

        <section className="rounded-3xl border border-yellow-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-yellow-100">Recent Sessions {eventId ? "(filtered by event)" : ""}</h2>
          <div className="mt-4 space-y-2 text-sm">
            {sessions.length === 0 ? (
              <p className="text-stone-400">No sessions yet.</p>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="rounded border border-stone-700 bg-stone-950/70 p-3">
                  <p>{session.session_code} · {session.title} · Event: {session.event_title ?? "(none)"}</p>
                  <p className="text-stone-400">Round {session.current_round} / {session.round_count} · Calls {session.calls_scored}/{session.calls_total} scored · Scoring {session.points_correct_call}+{session.bonus_original_artist_points} · Status: {session.status}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link className="rounded border border-stone-700 px-2 py-1 text-xs" href={`/admin/games/original-or-cover/host?sessionId=${session.id}`}>Host</Link>
                    <Link className="rounded border border-stone-700 px-2 py-1 text-xs" href={`/admin/games/original-or-cover/assistant?sessionId=${session.id}`}>Assistant</Link>
                    <Link className="rounded border border-stone-700 px-2 py-1 text-xs" href={`/admin/games/original-or-cover/jumbotron?sessionId=${session.id}`}>Jumbotron</Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
