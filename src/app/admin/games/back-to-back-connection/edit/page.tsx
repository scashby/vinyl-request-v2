"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Session = {
  id: number;
  title: string;
  event_id: number | null;
  playlist_id: number | null;
  round_count: number;
  connection_points: number;
  detail_bonus_points: number;
  remove_resleeve_seconds: number;
  find_record_seconds: number;
  cue_seconds: number;
  host_buffer_seconds: number;
  show_logo: boolean;
  show_title: boolean;
  show_round: boolean;
  show_scoreboard: boolean;
  show_connection_prompt: boolean;
  welcome_heading_text: string | null;
  welcome_message_text: string | null;
  intermission_heading_text: string | null;
  intermission_message_text: string | null;
  thanks_heading_text: string | null;
  thanks_subheading_text: string | null;
  default_intermission_seconds: number;
  status: string;
};

export default function BackToBackConnectionEditPage() {
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("sessionId"));
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [title, setTitle] = useState("");
  const [roundCount, setRoundCount] = useState(10);
  const [connectionPoints, setConnectionPoints] = useState(2);
  const [detailBonusPoints, setDetailBonusPoints] = useState(1);
  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(10);
  const [showLogo, setShowLogo] = useState(true);
  const [showTitle, setShowTitle] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);
  const [showConnectionPrompt, setShowConnectionPrompt] = useState(true);
  const [welcomeHeading, setWelcomeHeading] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [intermissionHeading, setIntermissionHeading] = useState("");
  const [intermissionMessage, setIntermissionMessage] = useState("");
  const [thanksHeading, setThanksHeading] = useState("");
  const [thanksSubheading, setThanksSubheading] = useState("");
  const [defaultIntermissionSeconds, setDefaultIntermissionSeconds] = useState(600);

  useEffect(() => {
    if (!Number.isFinite(sessionId)) return;
    fetch(`/api/games/back-to-back-connection/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((data: Session) => {
        setSession(data);
        setTitle(data.title);
        setRoundCount(data.round_count);
        setConnectionPoints(data.connection_points);
        setDetailBonusPoints(data.detail_bonus_points);
        setRemoveResleeveSeconds(data.remove_resleeve_seconds);
        setFindRecordSeconds(data.find_record_seconds);
        setCueSeconds(data.cue_seconds);
        setHostBufferSeconds(data.host_buffer_seconds);
        setShowLogo(data.show_logo ?? true);
        setShowTitle(data.show_title);
        setShowRound(data.show_round);
        setShowScoreboard(data.show_scoreboard);
        setShowConnectionPrompt(data.show_connection_prompt);
        setWelcomeHeading(data.welcome_heading_text ?? "Welcome to Back-to-Back Connection");
        setWelcomeMessage(data.welcome_message_text ?? "Identify the hidden musical connection between two back-to-back tracks.");
        setIntermissionHeading(data.intermission_heading_text ?? "Intermission");
        setIntermissionMessage(data.intermission_message_text ?? "Short break before the next round.");
        setThanksHeading(data.thanks_heading_text ?? "Thanks for Playing");
        setThanksSubheading(data.thanks_subheading_text ?? "See you at the next round.");
        setDefaultIntermissionSeconds(data.default_intermission_seconds ?? 600);
      })
      .catch(() => setError("Failed to load session"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/back-to-back-connection/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          round_count: roundCount,
          connection_points: connectionPoints,
          detail_bonus_points: detailBonusPoints,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_logo: showLogo,
          show_title: showTitle,
          show_round: showRound,
          show_scoreboard: showScoreboard,
          show_connection_prompt: showConnectionPrompt,
          welcome_heading_text: welcomeHeading,
          welcome_message_text: welcomeMessage,
          intermission_heading_text: intermissionHeading,
          intermission_message_text: intermissionMessage,
          thanks_heading_text: thanksHeading,
          thanks_subheading_text: thanksSubheading,
          default_intermission_seconds: defaultIntermissionSeconds,
        }),
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Save failed");
      }
      router.push("/admin/games/back-to-back-connection");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!Number.isFinite(sessionId)) return <p className="p-6 text-red-400">No session ID provided.</p>;
  if (loading) return <p className="p-6 text-stone-400">Loading…</p>;
  if (error && !session) return <p className="p-6 text-red-400">{error}</p>;
  if (!session) return <p className="p-6 text-stone-400">Session not found.</p>;

  return (
    <div className="min-h-screen bg-stone-900 p-6 text-white">
      <h1 className="mb-6 text-2xl font-black uppercase text-amber-300">Edit Session — Back-to-Back Connection</h1>

      <div className="space-y-6 max-w-xl">
        {/* Basic */}
        <section className="rounded-2xl border border-stone-700 bg-black/40 p-4 space-y-4">
          <h2 className="text-sm font-bold uppercase text-amber-400">Session Info</h2>
          <label className="block text-sm">
            Title
            <input
              className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Rounds ({roundCount})
            <input
              className="mt-1 w-full"
              type="range"
              min={8}
              max={14}
              value={roundCount}
              onChange={(e) => setRoundCount(Number(e.target.value))}
            />
          </label>
        </section>

        {/* Scoring */}
        <section className="rounded-2xl border border-stone-700 bg-black/40 p-4 space-y-4">
          <h2 className="text-sm font-bold uppercase text-amber-400">Scoring</h2>
          <label className="block text-sm">
            Connection Points (0–3)
            <input
              className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              type="number"
              min={0}
              max={3}
              value={connectionPoints}
              onChange={(e) => setConnectionPoints(Math.min(3, Math.max(0, Number(e.target.value) || 0)))}
            />
          </label>
          <label className="block text-sm">
            Detail Bonus Points (0–2)
            <input
              className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              type="number"
              min={0}
              max={2}
              value={detailBonusPoints}
              onChange={(e) => setDetailBonusPoints(Math.min(2, Math.max(0, Number(e.target.value) || 0)))}
            />
          </label>
        </section>

        {/* Timers */}
        <section className="rounded-2xl border border-stone-700 bg-black/40 p-4 space-y-4">
          <h2 className="text-sm font-bold uppercase text-amber-400">Timers</h2>
          {(
            [
              ["Remove & Resleeve (sec)", removeResleeveSeconds, setRemoveResleeveSeconds],
              ["Find Record (sec)", findRecordSeconds, setFindRecordSeconds],
              ["Cue (sec)", cueSeconds, setCueSeconds],
              ["Host Buffer (sec)", hostBufferSeconds, setHostBufferSeconds],
            ] as [string, number, (v: number) => void][]
          ).map(([label, val, setter]) => (
            <label key={label} className="block text-sm">
              {label}
              <input
                className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
                type="number"
                min={0}
                value={val}
                onChange={(e) => setter(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
          ))}
          <p className="text-xs text-stone-400">
            Target Gap: {removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds}s (auto-computed on save)
          </p>
        </section>

        {/* Display flags */}
        <section className="rounded-2xl border border-stone-700 bg-black/40 p-4 space-y-3">
          <h2 className="text-sm font-bold uppercase text-amber-400">Display Flags</h2>
          {(
            [
              ["Show Logo", showLogo, setShowLogo],
              ["Show Title", showTitle, setShowTitle],
              ["Show Round", showRound, setShowRound],
              ["Show Scoreboard", showScoreboard, setShowScoreboard],
              ["Show Connection Prompt", showConnectionPrompt, setShowConnectionPrompt],
            ] as [string, boolean, (v: boolean) => void][]
          ).map(([label, val, setter]) => (
            <label key={label} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} />
              {label}
            </label>
          ))}
        </section>

        {/* Overlay text */}
        <section className="rounded-2xl border border-stone-700 bg-black/40 p-4 space-y-4">
          <h2 className="text-sm font-bold uppercase text-amber-400">Overlay Text</h2>
          <label className="block text-sm">
            Welcome Heading
            <input
              className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              value={welcomeHeading}
              onChange={(e) => setWelcomeHeading(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Welcome Message
            <input
              className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Intermission Heading
            <input
              className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              value={intermissionHeading}
              onChange={(e) => setIntermissionHeading(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Intermission Message
            <input
              className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              value={intermissionMessage}
              onChange={(e) => setIntermissionMessage(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Thanks Heading
            <input
              className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              value={thanksHeading}
              onChange={(e) => setThanksHeading(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Thanks Subheading
            <input
              className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              value={thanksSubheading}
              onChange={(e) => setThanksSubheading(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Default Intermission Duration (sec)
            <input
              className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              type="number"
              min={0}
              value={defaultIntermissionSeconds}
              onChange={(e) => setDefaultIntermissionSeconds(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
        </section>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            disabled={saving}
            onClick={handleSave}
            className="rounded bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 hover:bg-amber-500"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button
            onClick={() => router.push("/admin/games/back-to-back-connection")}
            className="rounded border border-stone-600 px-4 py-2 text-sm text-stone-300 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
