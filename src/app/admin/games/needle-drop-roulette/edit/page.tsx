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
  answer_mode: "slips" | "whiteboard" | "mixed";
  snippet_seconds: number;
  remove_resleeve_seconds: number;
  find_record_seconds: number;
  cue_seconds: number;
  host_buffer_seconds: number;
  show_title: boolean;
  show_logo: boolean;
  show_round: boolean;
  show_scoreboard: boolean;
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

const ANSWER_MODE_OPTIONS = [
  { value: "slips", label: "Answer Slips" },
  { value: "whiteboard", label: "Whiteboards" },
  { value: "mixed", label: "Mixed" },
] as const;

function asInt(value: string, fallback: number, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

export default function NeedleDropRouletteEditPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));

  const [events, setEvents] = useState<EventRow[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventId, setEventId] = useState<number | null>(null);
  const [title, setTitle] = useState("Needle Drop Roulette Session");
  const [roundCount, setRoundCount] = useState(10);
  const [answerMode, setAnswerMode] = useState<"slips" | "whiteboard" | "mixed">("slips");
  const [snippetSeconds, setSnippetSeconds] = useState(7);
  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(10);

  const [showTitle, setShowTitle] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);

  const [welcomeHeading, setWelcomeHeading] = useState("Welcome to Needle Drop Roulette");
  const [welcomeMessage, setWelcomeMessage] = useState("Get your team ready for the next drop.");
  const [intermissionHeading, setIntermissionHeading] = useState("Intermission");
  const [intermissionMessage, setIntermissionMessage] = useState("Quick reset. Next drop starts soon.");
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
        fetch("/api/games/needle-drop-roulette/events"),
        fetch(`/api/games/needle-drop-roulette/sessions/${sessionId}`),
      ]);

      if (!eventsRes.ok || !sessionRes.ok) {
        throw new Error("Failed to load Needle Drop Roulette session");
      }

      const eventsPayload = await eventsRes.json();
      const sessionPayload = (await sessionRes.json()) as Session;

      setEvents(eventsPayload.data ?? []);
      setSession(sessionPayload);

      setEventId(sessionPayload.event_id ?? null);
      setTitle(sessionPayload.title ?? "Needle Drop Roulette Session");
      setRoundCount(sessionPayload.round_count ?? 10);
      setAnswerMode(sessionPayload.answer_mode ?? "slips");
      setSnippetSeconds(sessionPayload.snippet_seconds ?? 7);
      setRemoveResleeveSeconds(sessionPayload.remove_resleeve_seconds ?? 20);
      setFindRecordSeconds(sessionPayload.find_record_seconds ?? 12);
      setCueSeconds(sessionPayload.cue_seconds ?? 12);
      setHostBufferSeconds(sessionPayload.host_buffer_seconds ?? 10);

      setShowTitle(Boolean(sessionPayload.show_title));
      setShowLogo(Boolean(sessionPayload.show_logo));
      setShowRound(Boolean(sessionPayload.show_round));
      setShowScoreboard(Boolean(sessionPayload.show_scoreboard));

      setWelcomeHeading(sessionPayload.welcome_heading_text ?? "Welcome to Needle Drop Roulette");
      setWelcomeMessage(sessionPayload.welcome_message_text ?? "Get your team ready for the next drop.");
      setIntermissionHeading(sessionPayload.intermission_heading_text ?? "Intermission");
      setIntermissionMessage(sessionPayload.intermission_message_text ?? "Quick reset. Next drop starts soon.");
      setThanksHeading(sessionPayload.thanks_heading_text ?? "Thanks for Playing");
      setThanksSubheading(sessionPayload.thanks_subheading_text ?? "See you at the next round.");
      setDefaultIntermissionSeconds(sessionPayload.default_intermission_seconds ?? 600);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Needle Drop Roulette session");
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
      const response = await fetch(`/api/games/needle-drop-roulette/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          title: title.trim() || "Needle Drop Roulette Session",
          round_count: Math.max(8, Math.min(12, roundCount)),
          answer_mode: answerMode,
          snippet_seconds: Math.max(5, Math.min(10, snippetSeconds)),
          remove_resleeve_seconds: Math.max(0, removeResleeveSeconds),
          find_record_seconds: Math.max(0, findRecordSeconds),
          cue_seconds: Math.max(0, cueSeconds),
          host_buffer_seconds: Math.max(0, hostBufferSeconds),
          show_title: showTitle,
          show_logo: showLogo,
          show_round: showRound,
          show_scoreboard: showScoreboard,
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
        <header className="rounded-3xl border border-orange-900/40 bg-black/55 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-orange-300">Needle Drop Roulette</p>
          <h1 className="text-3xl font-black uppercase">Edit Session</h1>
          <p className="text-sm text-stone-400">{session?.session_code ?? "-"} · {session?.status ?? "pending"}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link href="/admin/games/needle-drop-roulette" className="rounded border border-stone-700 px-3 py-1">Back to Setup</Link>
            <Link href={`/admin/games/needle-drop-roulette/host?sessionId=${sessionId}`} className="rounded border border-stone-700 px-3 py-1">Host</Link>
            <Link href={`/admin/games/needle-drop-roulette/jumbotron?sessionId=${sessionId}`} className="rounded border border-stone-700 px-3 py-1">Jumbotron</Link>
          </div>
        </header>

        {error ? <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</div> : null}

        <section className="rounded-3xl border border-orange-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-orange-100">Rules & Timing</h2>
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

            <label className="text-sm">Answer Mode
              <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" value={answerMode} onChange={(e) => setAnswerMode((e.target.value as "slips" | "whiteboard" | "mixed") ?? "slips")}>
                {ANSWER_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">Snippet Seconds (5-10)
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2" type="number" min={5} max={10} value={snippetSeconds} onChange={(e) => setSnippetSeconds(asInt(e.target.value, snippetSeconds, 5))} />
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

        <section className="rounded-3xl border border-orange-900/40 bg-black/45 p-6">
          <h2 className="text-xl font-black uppercase text-orange-100">Display & Overlay Text</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> Show Title</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} /> Show Logo</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={showRound} onChange={(e) => setShowRound(e.target.checked)} /> Show Round</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={showScoreboard} onChange={(e) => setShowScoreboard(e.target.checked)} /> Show Scoreboard</label>
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
          <button className="rounded bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={save} disabled={saving}>
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
