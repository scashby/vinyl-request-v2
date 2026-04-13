"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  id: number;
  session_code: string;
  event_id: number | null;
  title: string;
  round_count: number;
  points_correct_call: number;
  bonus_original_artist_points: number;
  remove_resleeve_seconds: number;
  find_record_seconds: number;
  cue_seconds: number;
  host_buffer_seconds: number;
  show_title: boolean;
  show_logo: boolean;
  show_round: boolean;
  show_scoreboard: boolean;
  show_prompt: boolean;
  welcome_heading_text: string | null;
  welcome_message_text: string | null;
  intermission_heading_text: string | null;
  intermission_message_text: string | null;
  thanks_heading_text: string | null;
  thanks_subheading_text: string | null;
  default_intermission_seconds: number;
  status: "pending" | "running" | "paused" | "completed";
};

type EventRow = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
};

function asInt(value: string, fallback: number, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

export default function OriginalOrCoverEditPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventId, setEventId] = useState<number | null>(null);
  const [title, setTitle] = useState("Original or Cover Session");
  const [roundCount, setRoundCount] = useState(10);
  const [pointsCorrectCall, setPointsCorrectCall] = useState(2);
  const [bonusOriginalArtistPoints, setBonusOriginalArtistPoints] = useState(1);
  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(10);

  const [showTitle, setShowTitle] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);
  const [showPrompt, setShowPrompt] = useState(true);

  const [welcomeHeading, setWelcomeHeading] = useState("Welcome to Original or Cover");
  const [welcomeMessage, setWelcomeMessage] = useState("Call it: original or cover.");
  const [intermissionHeading, setIntermissionHeading] = useState("Intermission");
  const [intermissionMessage, setIntermissionMessage] = useState("Short break before the next round.");
  const [thanksHeading, setThanksHeading] = useState("Thanks for Playing");
  const [thanksSubheading, setThanksSubheading] = useState("See you at the next round.");
  const [defaultIntermissionSeconds, setDefaultIntermissionSeconds] = useState(600);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) {
      setError("Missing or invalid sessionId");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [eventsRes, sessionRes] = await Promise.all([
        fetch("/api/games/original-or-cover/events"),
        fetch(`/api/games/original-or-cover/sessions/${sessionId}`),
      ]);

      if (!eventsRes.ok || !sessionRes.ok) {
        throw new Error("Failed to load Original or Cover session");
      }

      const eventsPayload = await eventsRes.json();
      const sessionPayload = (await sessionRes.json()) as Session;

      setEvents(eventsPayload.data ?? []);
      setSession(sessionPayload);

      setEventId(sessionPayload.event_id ?? null);
      setTitle(sessionPayload.title ?? "Original or Cover Session");
      setRoundCount(sessionPayload.round_count ?? 10);
      setPointsCorrectCall(sessionPayload.points_correct_call ?? 2);
      setBonusOriginalArtistPoints(sessionPayload.bonus_original_artist_points ?? 1);
      setRemoveResleeveSeconds(sessionPayload.remove_resleeve_seconds ?? 20);
      setFindRecordSeconds(sessionPayload.find_record_seconds ?? 12);
      setCueSeconds(sessionPayload.cue_seconds ?? 12);
      setHostBufferSeconds(sessionPayload.host_buffer_seconds ?? 10);

      setShowTitle(Boolean(sessionPayload.show_title));
      setShowLogo(Boolean(sessionPayload.show_logo));
      setShowRound(Boolean(sessionPayload.show_round));
      setShowScoreboard(Boolean(sessionPayload.show_scoreboard));
      setShowPrompt(Boolean(sessionPayload.show_prompt));

      setWelcomeHeading(sessionPayload.welcome_heading_text ?? "Welcome to Original or Cover");
      setWelcomeMessage(sessionPayload.welcome_message_text ?? "Call it: original or cover.");
      setIntermissionHeading(sessionPayload.intermission_heading_text ?? "Intermission");
      setIntermissionMessage(sessionPayload.intermission_message_text ?? "Short break before the next round.");
      setThanksHeading(sessionPayload.thanks_heading_text ?? "Thanks for Playing");
      setThanksSubheading(sessionPayload.thanks_subheading_text ?? "See you at the next round.");
      setDefaultIntermissionSeconds(sessionPayload.default_intermission_seconds ?? 600);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Original or Cover session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!Number.isFinite(sessionId)) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/games/original-or-cover/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          title: title.trim() || "Original or Cover Session",
          round_count: Math.max(8, Math.min(12, roundCount)),
          points_correct_call: Math.max(0, Math.min(5, pointsCorrectCall)),
          bonus_original_artist_points: Math.max(0, Math.min(3, bonusOriginalArtistPoints)),
          remove_resleeve_seconds: Math.max(0, removeResleeveSeconds),
          find_record_seconds: Math.max(0, findRecordSeconds),
          cue_seconds: Math.max(0, cueSeconds),
          host_buffer_seconds: Math.max(0, hostBufferSeconds),
          show_title: showTitle,
          show_logo: showLogo,
          show_round: showRound,
          show_scoreboard: showScoreboard,
          show_prompt: showPrompt,
          welcome_heading_text: welcomeHeading.trim() || null,
          welcome_message_text: welcomeMessage.trim() || null,
          intermission_heading_text: intermissionHeading.trim() || null,
          intermission_message_text: intermissionMessage.trim() || null,
          thanks_heading_text: thanksHeading.trim() || null,
          thanks_subheading_text: thanksSubheading.trim() || null,
          default_intermission_seconds: Math.max(0, defaultIntermissionSeconds),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to save session");
      }

      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save session");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#171717)] p-6 text-stone-100">Loading session...</div>;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#090909,#171717)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="rounded-3xl border border-yellow-900/40 bg-black/55 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-yellow-300">Original or Cover</p>
          <h1 className="text-3xl font-black uppercase">Edit Session</h1>
          <p className="text-sm text-stone-400">{session?.session_code ?? "-"} · {session?.status ?? "pending"}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link href="/admin/games/original-or-cover" className="rounded border border-stone-700 px-3 py-1">Back to Setup</Link>
            <Link href={`/admin/games/original-or-cover/host?sessionId=${sessionId}`} className="rounded border border-stone-700 px-3 py-1">Host</Link>
            <Link href={`/admin/games/original-or-cover/jumbotron?sessionId=${sessionId}`} className="rounded border border-stone-700 px-3 py-1">Jumbotron</Link>
          </div>
        </header>

        {error ? <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</div> : null}

        <section className="rounded-3xl border border-yellow-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-yellow-100">Rules & Timing</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">Event
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={eventId ?? ""} onChange={(e) => setEventId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">No event selected</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{event.date} - {event.title}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">Title
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm">Rounds (8-12)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={8} max={12} value={roundCount} onChange={(e) => setRoundCount(asInt(e.target.value, roundCount, 8))} />
            </label>

            <label className="text-sm">Correct Call Points
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={5} value={pointsCorrectCall} onChange={(e) => setPointsCorrectCall(asInt(e.target.value, pointsCorrectCall, 0))} />
            </label>

            <label className="text-sm">Original Artist Bonus
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} max={3} value={bonusOriginalArtistPoints} onChange={(e) => setBonusOriginalArtistPoints(asInt(e.target.value, bonusOriginalArtistPoints, 0))} />
            </label>

            <label className="text-sm">Default Intermission (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={defaultIntermissionSeconds} onChange={(e) => setDefaultIntermissionSeconds(asInt(e.target.value, defaultIntermissionSeconds, 0))} />
            </label>

            <label className="text-sm">Remove + Resleeve (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={removeResleeveSeconds} onChange={(e) => setRemoveResleeveSeconds(asInt(e.target.value, removeResleeveSeconds, 0))} />
            </label>

            <label className="text-sm">Find Record (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={findRecordSeconds} onChange={(e) => setFindRecordSeconds(asInt(e.target.value, findRecordSeconds, 0))} />
            </label>

            <label className="text-sm">Cue (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={cueSeconds} onChange={(e) => setCueSeconds(asInt(e.target.value, cueSeconds, 0))} />
            </label>

            <label className="text-sm">Host Buffer (sec)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={0} value={hostBufferSeconds} onChange={(e) => setHostBufferSeconds(asInt(e.target.value, hostBufferSeconds, 0))} />
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-yellow-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-yellow-100">Display & Overlay Text</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> Show Title</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} /> Show Logo</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={showRound} onChange={(e) => setShowRound(e.target.checked)} /> Show Round</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={showScoreboard} onChange={(e) => setShowScoreboard(e.target.checked)} /> Show Scoreboard</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={showPrompt} onChange={(e) => setShowPrompt(e.target.checked)} /> Show Prompt</label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">Welcome Heading
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={welcomeHeading} onChange={(e) => setWelcomeHeading(e.target.value)} />
            </label>
            <label className="text-sm">Welcome Message
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} />
            </label>
            <label className="text-sm">Intermission Heading
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={intermissionHeading} onChange={(e) => setIntermissionHeading(e.target.value)} />
            </label>
            <label className="text-sm">Intermission Message
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={intermissionMessage} onChange={(e) => setIntermissionMessage(e.target.value)} />
            </label>
            <label className="text-sm">Thanks Heading
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={thanksHeading} onChange={(e) => setThanksHeading(e.target.value)} />
            </label>
            <label className="text-sm">Thanks Subheading
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={thanksSubheading} onChange={(e) => setThanksSubheading(e.target.value)} />
            </label>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button className="rounded bg-yellow-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Session"}
          </button>
          <button className="rounded border border-stone-700 px-4 py-2 text-sm" onClick={() => void load()} disabled={saving}>
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
