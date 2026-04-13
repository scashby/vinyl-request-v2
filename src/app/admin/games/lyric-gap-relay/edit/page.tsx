"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Session = {
  id: number;
  title: string;
  round_count: number;
  points_per_round: number;
  show_logo: boolean;
  welcome_heading_text: string | null;
  welcome_message_text: string | null;
  intermission_heading_text: string | null;
  intermission_message_text: string | null;
  thanks_heading_text: string | null;
  thanks_subheading_text: string | null;
  default_intermission_seconds: number;
  status: string;
};

export default function LyricGapRelayEditPage() {
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("sessionId"));
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [roundCount, setRoundCount] = useState(6);
  const [pointsPerRound, setPointsPerRound] = useState(3);
  const [showLogo, setShowLogo] = useState(true);
  const [welcomeHeading, setWelcomeHeading] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [intermissionHeading, setIntermissionHeading] = useState("");
  const [intermissionMessage, setIntermissionMessage] = useState("");
  const [thanksHeading, setThanksHeading] = useState("");
  const [thanksSubheading, setThanksSubheading] = useState("");
  const [defaultIntermissionSeconds, setDefaultIntermissionSeconds] = useState(600);

  useEffect(() => {
    if (!Number.isFinite(sessionId)) return;
    fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((data: Session) => {
        setSession(data);
        setTitle(data.title);
        setRoundCount(data.round_count);
        setPointsPerRound(data.points_per_round || 3);
        setShowLogo(data.show_logo ?? true);
        setWelcomeHeading(data.welcome_heading_text ?? "Welcome to Lyric Gap Relay");
        setWelcomeMessage(data.welcome_message_text ?? "Fill in the missing lyrics.");
        setIntermissionHeading(data.intermission_heading_text ?? "Intermission");
        setIntermissionMessage(data.intermission_message_text ?? "Prepare for the next round.");
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
      const res = await fetch(`/api/games/lyric-gap-relay/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          round_count: roundCount,
          points_per_round: pointsPerRound,
          show_logo: showLogo,
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
      router.push("/admin/games/lyric-gap-relay");
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
      <h1 className="mb-6 text-2xl font-black uppercase text-indigo-300">Edit Session — Lyric Gap Relay</h1>

      <div className="space-y-6 max-w-xl">
        <section className="rounded-2xl border border-stone-700 bg-black/40 p-4 space-y-4">
          <h2 className="text-sm font-bold uppercase text-indigo-400">Session Info</h2>
          <label className="block text-sm">
            Title
            <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block text-sm">
            Rounds ({roundCount})
            <input className="mt-1 w-full" type="range" min={4} max={10}
              value={roundCount} onChange={(e) => setRoundCount(Number(e.target.value))} />
          </label>
        </section>

        <section className="rounded-2xl border border-stone-700 bg-black/40 p-4 space-y-4">
          <h2 className="text-sm font-bold uppercase text-indigo-400">Scoring</h2>
          <label className="block text-sm">
            Points Per Round (1-5)
            <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              type="number" min={1} max={5}
              value={pointsPerRound} onChange={(e) => setPointsPerRound(Math.min(5, Math.max(1, Number(e.target.value) || 1)))} />
          </label>
        </section>

        <section className="rounded-2xl border border-stone-700 bg-black/40 p-4 space-y-3">
          <h2 className="text-sm font-bold uppercase text-indigo-400">Display</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} />
            Show Logo
          </label>
        </section>

        <section className="rounded-2xl border border-stone-700 bg-black/40 p-4 space-y-4">
          <h2 className="text-sm font-bold uppercase text-indigo-400">Overlay Text</h2>
          {([
            ["Welcome Heading", welcomeHeading, setWelcomeHeading],
            ["Welcome Message", welcomeMessage, setWelcomeMessage],
            ["Intermission Heading", intermissionHeading, setIntermissionHeading],
            ["Intermission Message", intermissionMessage, setIntermissionMessage],
            ["Thanks Heading", thanksHeading, setThanksHeading],
            ["Thanks Subheading", thanksSubheading, setThanksSubheading],
          ] as Array<[string, string, (value: string) => void]>).map(([label, val, setter]) => (
            <label key={label} className="block text-sm">
              {label}
              <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
                value={val} onChange={(e) => setter(e.target.value)} />
            </label>
          ))}
          <label className="block text-sm">
            Default Intermission Duration (sec)
            <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              type="number" min={0} value={defaultIntermissionSeconds}
              onChange={(e) => setDefaultIntermissionSeconds(Math.max(0, Number(e.target.value) || 0))} />
          </label>
        </section>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded bg-indigo-700 px-4 py-2 font-bold text-white hover:bg-indigo-600 disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={() => router.back()}
            className="flex-1 rounded border border-stone-600 px-4 py-2 hover:bg-stone-800">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
