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
  lyric_points: number;
  song_bonus_enabled: boolean;
  song_bonus_points: number;
  calls_total: number;
  event_title: string | null;
};

type CallDraft = {
  artist: string;
  title: string;
  correct_lyric: string;
  decoy_lyric_1: string;
  decoy_lyric_2: string;
  decoy_lyric_3?: string;
  answer_slot: number;
  source_label?: string;
  dj_cue_hint?: string;
};

function parseCalls(lines: string): CallDraft[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [metaPart, correctLyric, decoysRaw, sourceLabel, djCueHint] = line.split("|").map((part) => part.trim());
      const [artist, title] = (metaPart ?? "").split(" - ").map((part) => part.trim());

      const entries = (decoysRaw ?? "")
        .split(";;")
        .map((entry) => entry.trim())
        .filter(Boolean);

      const answerSlotValue = entries.find((entry) => entry.toLowerCase().startsWith("slot="));
      const answerSlot = Math.max(1, Math.min(4, Number((answerSlotValue ?? "").replace("slot=", "")) || 1));

      const decoys = entries.filter((entry) => !entry.toLowerCase().startsWith("slot="));

      return {
        artist: artist ?? "",
        title: title ?? "",
        correct_lyric: correctLyric ?? "",
        decoy_lyric_1: decoys[0] ?? "",
        decoy_lyric_2: decoys[1] ?? "",
        decoy_lyric_3: decoys[2] || undefined,
        answer_slot: answerSlot,
        source_label: sourceLabel || undefined,
        dj_cue_hint: djCueHint || undefined,
      };
    })
    .filter((call) => call.artist && call.title && call.correct_lyric && call.decoy_lyric_1 && call.decoy_lyric_2);
}

export default function WrongLyricChallengeSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = Number(searchParams.get("eventId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [eventId, setEventId] = useState<number | null>(Number.isFinite(eventIdFromUrl) ? eventIdFromUrl : null);
  const [title, setTitle] = useState("Wrong Lyric Challenge Session");
  const [roundCount, setRoundCount] = useState(10);
  const [lyricPoints, setLyricPoints] = useState(2);
  const [songBonusEnabled, setSongBonusEnabled] = useState(true);
  const [songBonusPoints, setSongBonusPoints] = useState(1);
  const [optionCount, setOptionCount] = useState<3 | 4>(3);
  const [revealMode, setRevealMode] = useState<"host_reads" | "jumbotron_choices">("host_reads");

  const [showTitle, setShowTitle] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);
  const [showOptions, setShowOptions] = useState(true);

  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(10);

  const [teamNamesText, setTeamNamesText] = useState("Team A\nTeam B");
  const [callListText, setCallListText] = useState(
    "Prince - Purple Rain | I never meant to cause you any sorrow | I never meant to cause you any pain;;I only wanted one time to see you laughing;;slot=2 | LP side B | cue by chorus\nFleetwood Mac - Dreams | Players only love you when they're playing | Women they will come and they will go;;Players only call you when they're lonely;;slot=1 | LP side A | keep under 15 sec"
  );

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
  const targetGapSeconds = useMemo(
    () => removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds,
    [cueSeconds, findRecordSeconds, hostBufferSeconds, removeResleeveSeconds]
  );

  const usableCalls = useMemo(
    () => calls.filter((call) => (optionCount === 3 ? true : Boolean(call.decoy_lyric_3))),
    [calls, optionCount]
  );

  const load = useCallback(async () => {
    const [eventRes, sessionRes] = await Promise.all([
      fetch("/api/games/wrong-lyric-challenge/events"),
      fetch(`/api/games/wrong-lyric-challenge/sessions${eventId ? `?eventId=${eventId}` : ""}`),
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
      const res = await fetch("/api/games/wrong-lyric-challenge/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          title,
          round_count: roundCount,
          lyric_points: lyricPoints,
          song_bonus_enabled: songBonusEnabled,
          song_bonus_points: songBonusPoints,
          option_count: optionCount,
          reveal_mode: revealMode,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_title: showTitle,
          show_round: showRound,
          show_scoreboard: showScoreboard,
          show_options: showOptions,
          team_names: teamNames,
          calls: usableCalls,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create session");

      router.push(`/admin/games/wrong-lyric-challenge/host?sessionId=${payload.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setCreating(false);
      load();
    }
  };

  const roundCountWarning = usableCalls.length < roundCount;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#3f1515,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-red-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-red-300">Co-Host Vinyl Mode</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-4xl font-black uppercase text-red-100">Wrong Lyric Challenge Setup</h1>
            <div className="flex gap-2">
              <Link href="/admin/games/wrong-lyric-challenge/history" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">History</Link>
              <Link href="/admin/games/wrong-lyric-challenge/jumbotron" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Jumbotron Scope</Link>
            </div>
          </div>
          <p className="mt-2 text-sm text-stone-300">Host reads lyric options while DJ cues track. Teams choose the real lyric. Score 2 for correct lyric, optional +1 for naming song.</p>
          <div className="mt-3 flex justify-end"><GameSetupInfoButton gameSlug="wrong-lyric-challenge" /></div>
        </header>

        <section className="rounded-3xl border border-red-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-red-100">Session Config</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GameEventSelect events={events} eventId={eventId} setEventId={setEventId} />

            <label className="text-sm">Session Title
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm">Rounds (8-14)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={8} max={14} value={roundCount} onChange={(e) => setRoundCount(Math.max(8, Math.min(14, Number(e.target.value) || 8)))} />
            </label>

            <label className="text-sm">Lyric Points
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={5} value={lyricPoints} onChange={(e) => setLyricPoints(Math.max(0, Math.min(5, Number(e.target.value) || 0)))} />
            </label>

            <label className="text-sm">Song Bonus
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={songBonusEnabled ? "on" : "off"} onChange={(e) => setSongBonusEnabled(e.target.value === "on")}>
                <option value="on">Enabled</option>
                <option value="off">Disabled</option>
              </select>
            </label>

            <label className="text-sm">Song Bonus Points
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={3} value={songBonusPoints} onChange={(e) => setSongBonusPoints(Math.max(0, Math.min(3, Number(e.target.value) || 0)))} disabled={!songBonusEnabled} />
            </label>

            <label className="text-sm">Option Count
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={optionCount} onChange={(e) => setOptionCount(Number(e.target.value) === 4 ? 4 : 3)}>
                <option value={3}>3 options (1 real + 2 wrong)</option>
                <option value={4}>4 options (1 real + 3 wrong)</option>
              </select>
            </label>

            <label className="text-sm">Reveal Mode
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={revealMode} onChange={(e) => setRevealMode((e.target.value as "host_reads" | "jumbotron_choices") ?? "host_reads")}>
                <option value="host_reads">Host Reads (recommended)</option>
                <option value="jumbotron_choices">Jumbotron Choices</option>
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> Jumbotron title</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showRound} onChange={(e) => setShowRound(e.target.checked)} /> Jumbotron round</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showScoreboard} onChange={(e) => setShowScoreboard(e.target.checked)} /> Jumbotron scoreboard</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showOptions} onChange={(e) => setShowOptions(e.target.checked)} /> Show options on board</label>
          </div>
        </section>

        <section className="rounded-3xl border border-red-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-red-100">Pacing Budget</h2>
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
          <p className="mt-3 text-sm text-stone-300">Derived target gap: <span className="font-semibold text-red-300">{targetGapSeconds}s</span></p>
        </section>

        <section className="rounded-3xl border border-red-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-red-100">Teams + Lyric Option Deck</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">Teams (one per line)
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={teamNamesText} onChange={(e) => setTeamNamesText(e.target.value)} />
              <p className="mt-1 text-xs text-stone-400">Detected teams: {teamNames.length}</p>
            </label>

            <label className="text-sm">Calls (Artist - Title | correct lyric | decoy1;;decoy2[;;decoy3][;;slot=1..4] | source | dj cue hint)
              <textarea className="mt-1 h-36 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={callListText} onChange={(e) => setCallListText(e.target.value)} />
              <p className={`mt-1 text-xs ${roundCountWarning ? "text-red-300" : "text-stone-400"}`}>
                Valid calls for current option count: {usableCalls.length}. Minimum required for rounds: {roundCount}.
              </p>
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              className="rounded bg-red-500 px-4 py-2 text-sm font-semibold text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={createSession}
              disabled={creating || roundCountWarning || teamNames.length < 2}
            >
              {creating ? "Creating..." : "Create Session"}
            </button>
            <span className="text-xs text-stone-400">Requires 2+ teams and enough valid calls.</span>
          </div>
        </section>

        <section className="rounded-3xl border border-stone-700 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-stone-100">Recent Sessions</h2>
          <div className="mt-4 space-y-2 text-sm">
            {sessions.length === 0 ? (
              <p className="text-stone-400">No sessions yet for this filter.</p>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="rounded border border-stone-700 bg-stone-950/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">{session.session_code} · {session.title} · Round {session.current_round} of {session.round_count} · Calls {session.calls_total}</div>
                    <div className="flex gap-2 text-xs">
                      <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/wrong-lyric-challenge/host?sessionId=${session.id}`)}>Host</button>
                      <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/wrong-lyric-challenge/assistant?sessionId=${session.id}`)}>Assistant</button>
                      <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push(`/admin/games/wrong-lyric-challenge/jumbotron?sessionId=${session.id}`)}>Jumbotron</button>
                      <button className="rounded border border-stone-600 px-2 py-1" onClick={() => router.push("/admin/games/wrong-lyric-challenge/history")}>History</button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-stone-400">Event: {session.event_title ?? "(none)"} · Status: {session.status} · Scoring: {session.lyric_points} + {session.song_bonus_enabled ? `${session.song_bonus_points} bonus` : "no bonus"}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
