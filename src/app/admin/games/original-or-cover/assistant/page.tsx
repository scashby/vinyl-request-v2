"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  id: number;
  title: string;
  session_code: string;
  current_round: number;
  round_count: number;
  current_call_index: number;
  status: "pending" | "running" | "paused" | "completed";
  points_correct_call: number;
  bonus_original_artist_points: number;
  remaining_seconds: number;
  target_gap_seconds: number;
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  source_label: string | null;
  spin_artist: string;
  track_title: string;
  original_artist: string;
  alt_accept_original_artist: string | null;
  is_cover: boolean;
  host_notes: string | null;
  status: "pending" | "asked" | "revealed" | "scored" | "skipped";
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  correct_calls: number;
  artist_bonus_hits: number;
};

type ScoreDraft = Record<
  number,
  {
    called_original: "" | "original" | "cover";
    named_original_artist: string;
    awarded_points: string;
  }
>;

function canonicalizeArtistName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAcceptedOriginalArtistNames(call: Call | null): Set<string> {
  if (!call) return new Set();

  const names = [call.original_artist, call.alt_accept_original_artist]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(/[;,|]/).map((part) => part.trim()))
    .map(canonicalizeArtistName)
    .filter(Boolean);

  return new Set(names);
}

function toCalledOriginal(value: "" | "original" | "cover"): boolean | null {
  if (value === "original") return true;
  if (value === "cover") return false;
  return null;
}

export default function OriginalOrCoverAssistantPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;

    const [sessionRes, callsRes, leaderboardRes] = await Promise.all([
      fetch(`/api/games/original-or-cover/sessions/${sessionId}`),
      fetch(`/api/games/original-or-cover/sessions/${sessionId}/calls`),
      fetch(`/api/games/original-or-cover/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) setSession(await sessionRes.json());
    if (callsRes.ok) {
      const payload = await callsRes.json();
      setCalls(payload.data ?? []);
    }
    if (leaderboardRes.ok) {
      const payload = await leaderboardRes.json();
      setLeaderboard(payload.data ?? []);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 4000);
    return () => clearInterval(poll);
  }, [load]);

  const currentCall = useMemo(() => {
    if (!session) return null;
    return calls.find((call) => call.call_index === session.current_call_index) ?? null;
  }, [calls, session]);

  const nextPendingCall = useMemo(() => calls.find((call) => call.status === "pending") ?? null, [calls]);
  const callForControls = currentCall ?? nextPendingCall;

  useEffect(() => {
    const draft: ScoreDraft = {};
    for (const row of leaderboard) {
      draft[row.team_id] = { called_original: "", named_original_artist: "", awarded_points: "" };
    }
    setScoreDraft(draft);
  }, [callForControls?.id, leaderboard]);

  const acceptedOriginalArtistNames = useMemo(
    () => getAcceptedOriginalArtistNames(callForControls),
    [callForControls]
  );

  const submitScores = async () => {
    if (!callForControls) return;
    setSaving(true);
    setErrorText(null);

    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? {
          called_original: "" as const,
          named_original_artist: "",
          awarded_points: "",
        };
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: team.team_id,
          called_original: toCalledOriginal(draft.called_original),
          named_original_artist: draft.named_original_artist,
          awarded_points:
            Number.isFinite(parsedPoints) && draft.awarded_points !== ""
              ? parsedPoints
              : undefined,
        };
      });

      const res = await fetch(`/api/games/original-or-cover/sessions/${sessionId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: callForControls.id,
          awards,
          scored_by: "assistant",
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to save scores");
      }

      await load();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to save scores");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#17130c,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-amber-900/50 bg-black/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black uppercase text-amber-100">Original or Cover Assistant</h1>
            <p className="mt-1 text-sm text-stone-300">
              {session?.title} · {session?.session_code} · Round {session?.current_round} of {session?.round_count} · Status: {session?.status}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.open(`/admin/games/original-or-cover/host?sessionId=${sessionId}`, "original_or_cover_host", "width=1280,height=900")} className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Host</button>
            <button type="button" onClick={() => window.open(`/admin/games/original-or-cover/jumbotron?sessionId=${sessionId}`, "original_or_cover_jumbotron", "width=1920,height=1080")} className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Jumbotron</button>
            <Link href="/admin/games/original-or-cover" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Setup</Link>
          </div>
        </div>

        {errorText ? <div className="mt-3 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200">{errorText}</div> : null}

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Current Call Snapshot</h2>
          {callForControls ? (
            <div className="mt-3 text-sm text-stone-200">
              <p className="font-semibold">#{callForControls.call_index} · Round {callForControls.round_number}</p>
              <p className="mt-1">{callForControls.spin_artist} - {callForControls.track_title}</p>
              <p className="mt-1 text-stone-400">Status: {callForControls.status} · Source: {callForControls.source_label ?? "Unlabeled"}</p>
              {(callForControls.status === "revealed" || callForControls.status === "scored") ? (
                <p className="mt-2 text-amber-300">Answer: {callForControls.is_cover ? "COVER" : "ORIGINAL"} · Original artist: {callForControls.original_artist}</p>
              ) : (
                <p className="mt-2 text-stone-400">Answer hidden until host reveal.</p>
              )}
              {callForControls.host_notes ? <p className="mt-2 text-xs text-stone-400">Host note: {callForControls.host_notes}</p> : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-400">No active call yet.</p>
          )}
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Score Helper</h2>
          <p className="mt-2 text-xs text-stone-400">Default points: +{session?.points_correct_call ?? 0} for a correct call and +{session?.bonus_original_artist_points ?? 0} for the right original artist. Gap target: {session?.target_gap_seconds ?? 0}s · Remaining: {session?.remaining_seconds ?? 0}s.</p>
          <div className="mt-3 space-y-2 text-xs">
            {leaderboard.map((row) => {
              const draft = scoreDraft[row.team_id] ?? {
                called_original: "" as const,
                named_original_artist: "",
                awarded_points: "",
              };

              const calledOriginal = toCalledOriginal(draft.called_original);
              const callCorrect = calledOriginal !== null && callForControls
                ? calledOriginal === !callForControls.is_cover
                : false;

              const artistGuess = canonicalizeArtistName(draft.named_original_artist);
              const artistBonus = callCorrect && artistGuess.length > 0 && acceptedOriginalArtistNames.has(artistGuess);
              const suggestedPoints =
                (callCorrect ? session?.points_correct_call ?? 0 : 0) +
                (artistBonus ? session?.bonus_original_artist_points ?? 0 : 0);

              return (
                <div key={row.team_id} className="grid grid-cols-[1fr,130px,150px,96px] items-center gap-2 rounded border border-stone-800 bg-stone-900/60 p-2">
                  <div>
                    <p className="font-semibold">{row.team_name}</p>
                    <p className="text-[11px] text-stone-400">{row.total_points} pts · Correct calls: {row.correct_calls} · Artist bonuses: {row.artist_bonus_hits}</p>
                  </div>
                  <select
                    className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                    value={draft.called_original}
                    onChange={(event) =>
                      setScoreDraft((current) => ({
                        ...current,
                        [row.team_id]: {
                          ...(current[row.team_id] ?? { named_original_artist: "", awarded_points: "" }),
                          called_original: event.target.value as "" | "original" | "cover",
                        },
                      }))
                    }
                  >
                    <option value="">No call</option>
                    <option value="original">Called ORIGINAL</option>
                    <option value="cover">Called COVER</option>
                  </select>
                  <input
                    className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                    value={draft.named_original_artist}
                    onChange={(event) =>
                      setScoreDraft((current) => ({
                        ...current,
                        [row.team_id]: {
                          ...(current[row.team_id] ?? { called_original: "", awarded_points: "" }),
                          named_original_artist: event.target.value,
                        },
                      }))
                    }
                    placeholder="Original artist guess"
                  />
                  <input
                    className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
                    value={draft.awarded_points}
                    onChange={(event) =>
                      setScoreDraft((current) => ({
                        ...current,
                        [row.team_id]: {
                          ...(current[row.team_id] ?? { called_original: "", named_original_artist: "" }),
                          awarded_points: event.target.value,
                        },
                      }))
                    }
                    placeholder={`${suggestedPoints}`}
                    inputMode="numeric"
                  />
                </div>
              );
            })}
            {leaderboard.length === 0 ? <p className="text-stone-400">No scores yet.</p> : null}
          </div>
          <button
            disabled={saving || !callForControls}
            onClick={submitScores}
            className="mt-3 rounded bg-yellow-700 px-3 py-2 text-xs font-semibold uppercase disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Scores for Current Call"}
          </button>
        </section>

        <section className="mt-4 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Live Leaderboard</h2>
          <div className="mt-3 space-y-2 text-sm">
            {leaderboard.length === 0 ? (
              <p className="text-stone-400">No scores yet.</p>
            ) : (
              leaderboard.map((row) => (
                <div key={row.team_id} className="rounded border border-stone-800 bg-stone-900/60 px-3 py-2">
                  <p className="font-semibold">{row.team_name}</p>
                  <p className="text-xs text-stone-400">{row.total_points} pts · Correct calls: {row.correct_calls} · Artist bonuses: {row.artist_bonus_hits}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
