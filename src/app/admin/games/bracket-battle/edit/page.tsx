"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Session = {
  id: number;
  title: string;
  event_id: number | null;
  playlist_id: number | null;
  bracket_size: number;
  vote_method: "hands" | "slips";
  scoring_model: "round_weighted" | "flat_per_hit";
  remove_resleeve_seconds: number;
  find_record_seconds: number;
  cue_seconds: number;
  host_buffer_seconds: number;
  show_title: boolean;
  show_logo: boolean;
  show_round: boolean;
  show_bracket: boolean;
  show_scoreboard: boolean;
  welcome_heading_text: string | null;
  welcome_message_text: string | null;
  intermission_heading_text: string | null;
  intermission_message_text: string | null;
  thanks_heading_text: string | null;
  thanks_subheading_text: string | null;
  default_intermission_seconds: number;
  status: string;
};

export default function BracketBattleEditPage() {
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("sessionId"));
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [title, setTitle] = useState("");
  const [voteMethod, setVoteMethod] = useState<"hands" | "slips">("hands");
  const [scoringModel, setScoringModel] = useState<"round_weighted" | "flat_per_hit">("round_weighted");
  const [removeResleeveSeconds, setRemoveResleeveSeconds] = useState(20);
  const [findRecordSeconds, setFindRecordSeconds] = useState(12);
  const [cueSeconds, setCueSeconds] = useState(12);
  const [hostBufferSeconds, setHostBufferSeconds] = useState(10);
  const [showLogo, setShowLogo] = useState(true);
  const [showTitle, setShowTitle] = useState(true);
  const [showRound, setShowRound] = useState(true);
  const [showBracket, setShowBracket] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);
  const [welcomeHeading, setWelcomeHeading] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [intermissionHeading, setIntermissionHeading] = useState("");
  const [intermissionMessage, setIntermissionMessage] = useState("");
  const [thanksHeading, setThanksHeading] = useState("");
  const [thanksSubheading, setThanksSubheading] = useState("");
  const [defaultIntermissionSeconds, setDefaultIntermissionSeconds] = useState(600);

  useEffect(() => {
    if (!Number.isFinite(sessionId)) return;
    fetch(`/api/games/bracket-battle/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((data: Session) => {
        setSession(data);
        setTitle(data.title);
        setVoteMethod(data.vote_method);
        setScoringModel(data.scoring_model);
        setRemoveResleeveSeconds(data.remove_resleeve_seconds);
        setFindRecordSeconds(data.find_record_seconds);
        setCueSeconds(data.cue_seconds);
        setHostBufferSeconds(data.host_buffer_seconds);
        setShowLogo(data.show_logo ?? true);
        setShowTitle(data.show_title);
        setShowRound(data.show_round);
        setShowBracket(data.show_bracket);
        setShowScoreboard(data.show_scoreboard);
        setWelcomeHeading(data.welcome_heading_text ?? "Welcome to Bracket Battle");
        setWelcomeMessage(data.welcome_message_text ?? "Vote for your favourite track in each matchup to advance seeds through the bracket.");
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
      const res = await fetch(`/api/games/bracket-battle/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          vote_method: voteMethod,
          scoring_model: scoringModel,
          remove_resleeve_seconds: removeResleeveSeconds,
          find_record_seconds: findRecordSeconds,
          cue_seconds: cueSeconds,
          host_buffer_seconds: hostBufferSeconds,
          show_logo: showLogo,
          show_title: showTitle,
          show_round: showRound,
          show_bracket: showBracket,
          show_scoreboard: showScoreboard,
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
      router.push("/admin/games/bracket-battle");
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
      <h1 className="mb-6 text-2xl font-black uppercase text-cyan-300">Edit Session — Bracket Battle</h1>

      <div className="space-y-6 max-w-xl">
        {/* Basic */}
        <section className="rounded-2xl border border-stone-700 bg-black/40 p-4 space-y-4">
          <h2 className="text-sm font-bold uppercase text-cyan-400">Session Info</h2>
          <label className="block text-sm">
            Title
            <input
              className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Vote Method
            <select
              className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              value={voteMethod}
              onChange={(e) => setVoteMethod(e.target.value as "hands" | "slips")}
            >
              <option value="hands">Hands</option>
              <option value="slips">Slips</option>
            </select>
          </label>
          <label className="block text-sm">
            Scoring Model
            <select
              className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-white"
              value={scoringModel}
              onChange={(e) => setScoringModel(e.target.value as "round_weighted" | "flat_per_hit")}
            >
              <option value="round_weighted">Round Weighted</option>
              <option value="flat_per_hit">Flat per Hit</option>
            </select>
          </label>
        </section>

        {/* Timers */}
        <section className="rounded-2xl border border-stone-700 bg-black/40 p-4 space-y-4">
          <h2 className="text-sm font-bold uppercase text-cyan-400">Timers</h2>
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
        </section>

        {/* Display flags */}
        <section className="rounded-2xl border border-stone-700 bg-black/40 p-4 space-y-3">
          <h2 className="text-sm font-bold uppercase text-cyan-400">Display Flags</h2>
          {(
            [
              ["Show Logo", showLogo, setShowLogo],
              ["Show Title", showTitle, setShowTitle],
              ["Show Round", showRound, setShowRound],
              ["Show Bracket", showBracket, setShowBracket],
              ["Show Scoreboard", showScoreboard, setShowScoreboard],
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
          <h2 className="text-sm font-bold uppercase text-cyan-400">Overlay Text</h2>
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

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            className="rounded-xl bg-cyan-700 px-5 py-2 font-bold text-white disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            className="rounded-xl border border-stone-600 px-5 py-2 text-stone-300"
            onClick={() => router.push("/admin/games/bracket-battle")}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
