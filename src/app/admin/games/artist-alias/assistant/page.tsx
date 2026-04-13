"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  id: number;
  title: string;
  session_code: string;
  status: "pending" | "running" | "paused" | "completed";
  current_round: number;
  round_count: number;
  current_call_index: number;
  stage_one_points: number;
  stage_two_points: number;
  final_reveal_points: number;
  target_gap_seconds: number;
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  source_label: string | null;
  artist_name: string;
  accepted_aliases: string[];
  clue_era: string;
  clue_collaborator: string;
  clue_label_region: string;
  audio_clue_source: string | null;
  host_notes: string | null;
  status: "pending" | "stage_1" | "stage_2" | "final_reveal" | "scored" | "skipped";
  stage_revealed: number;
};

type LeaderboardRow = {
  team_id: number;
  team_name: string;
  total_points: number;
  exact_hits: number;
  stage_1_hits: number;
  stage_2_hits: number;
  stage_3_hits: number;
  audio_clue_uses: number;
};

type ScoreDraft = Record<
  number,
  {
    guessed_artist: string;
    guessed_at_stage: string;
    exact_match: boolean;
    used_audio_clue: boolean;
    awarded_points: string;
    notes: string;
  }
>;

function getDefaultPoints(session: Session | null, exactMatch: boolean, stageValue: string): number {
  if (!session || !exactMatch) return 0;
  const stage = Number(stageValue);
  if (stage === 1) return session.stage_one_points;
  if (stage === 2) return session.stage_two_points;
  if (stage === 3) return session.final_reveal_points;
  return 0;
}

export default function ArtistAliasAssistantPage() {
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
      fetch(`/api/games/artist-alias/sessions/${sessionId}`),
      fetch(`/api/games/artist-alias/sessions/${sessionId}/calls`),
      fetch(`/api/games/artist-alias/sessions/${sessionId}/leaderboard`),
    ]);

    if (sessionRes.ok) setSession(await sessionRes.json());
    if (callsRes.ok) {
      const payload = await callsRes.json();
      setCalls((payload.data ?? []) as Call[]);
    }
    if (leaderboardRes.ok) {
      const payload = await leaderboardRes.json();
      setLeaderboard((payload.data ?? []) as LeaderboardRow[]);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 3000);
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
    const stageValue = String(callForControls?.stage_revealed && callForControls.stage_revealed > 0 ? callForControls.stage_revealed : 3);
    for (const row of leaderboard) {
      draft[row.team_id] = {
        guessed_artist: "",
        guessed_at_stage: stageValue,
        exact_match: false,
        used_audio_clue: false,
        awarded_points: "",
        notes: "",
      };
    }
    setScoreDraft(draft);
  }, [callForControls?.id, callForControls?.stage_revealed, leaderboard]);

  const submitScores = async () => {
    if (!callForControls) return;
    setSaving(true);
    setErrorText(null);
    try {
      const awards = leaderboard.map((team) => {
        const draft = scoreDraft[team.team_id] ?? {
          guessed_artist: "",
          guessed_at_stage: "3",
          exact_match: false,
          used_audio_clue: false,
          awarded_points: "",
          notes: "",
        };
        const parsedPoints = Number(draft.awarded_points);

        return {
          team_id: team.team_id,
          guessed_artist: draft.guessed_artist,
          guessed_at_stage: Number(draft.guessed_at_stage),
          exact_match: draft.exact_match,
          used_audio_clue: draft.used_audio_clue,
          awarded_points:
            Number.isFinite(parsedPoints) && draft.awarded_points !== "" ? parsedPoints : undefined,
          notes: draft.notes || undefined,
        };
      });

      const res = await fetch(`/api/games/artist-alias/sessions/${sessionId}/score`, {
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#120d24,#090909)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-violet-900/50 bg-black/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black uppercase text-violet-100">Artist Alias Assistant</h1>
            <p className="mt-1 text-sm text-stone-300">
              {session?.session_code ?? (Number.isFinite(sessionId) ? sessionId : "(none selected)")} · Round {session?.current_round ?? "-"} / {session?.round_count ?? "-"} · Status: {session?.status ?? "-"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded border border-stone-600 px-3 py-1 text-xs uppercase" type="button" onClick={() => window.open(`/admin/games/artist-alias/host?sessionId=${sessionId}`, "artist_alias_host", "width=1280,height=900")}>Host</button>
            <button className="rounded border border-stone-600 px-3 py-1 text-xs uppercase" type="button" onClick={() => window.open(`/admin/games/artist-alias/jumbotron?sessionId=${sessionId}`, "artist_alias_jumbotron", "width=1920,height=1080")}>Jumbotron</button>
            <Link href="/admin/games/artist-alias" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
          </div>
        </div>

        {errorText ? <div className="mt-3 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200">{errorText}</div> : null}

        <section className="mt-6 rounded-xl border border-violet-800/50 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-200">Current Card Snapshot</h2>
          <p className="mt-2 text-sm text-stone-200">Card #{callForControls?.call_index ?? "-"} · Round {callForControls?.round_number ?? "-"}</p>
          <div className="mt-3 grid gap-2 text-sm">
            <p>Era: {callForControls?.stage_revealed && callForControls.stage_revealed >= 1 ? callForControls.clue_era : "Hidden"}</p>
            <p>Collaborator: {callForControls?.stage_revealed && callForControls.stage_revealed >= 2 ? callForControls.clue_collaborator : "Hidden"}</p>
            <p>Label/Region: {callForControls?.stage_revealed && callForControls.stage_revealed >= 3 ? callForControls.clue_label_region : "Hidden"}</p>
            <p>Answer: {callForControls?.status === "scored" ? callForControls.artist_name : "Hidden until scored"}</p>
            <p>Source: {callForControls?.source_label ?? "-"}</p>
            <p>Audio clue: {callForControls?.audio_clue_source ? "Available" : "None"}</p>
          </div>
          {callForControls?.accepted_aliases?.length ? <p className="mt-3 text-xs text-violet-200">Accepted aliases: {callForControls.accepted_aliases.join(", ")}</p> : null}
          {callForControls?.host_notes ? <p className="mt-2 text-xs text-stone-400">Host note: {callForControls.host_notes}</p> : null}
        </section>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-200">Score Helper</h2>
          <p className="mt-2 text-xs text-stone-400">Point model: {session?.stage_one_points ?? 0}/{session?.stage_two_points ?? 0}/{session?.final_reveal_points ?? 0} by stage · Gap target {session?.target_gap_seconds ?? 0}s</p>
          <div className="mt-3 space-y-2 text-xs">
            {leaderboard.map((row) => {
              const draft = scoreDraft[row.team_id] ?? {
                guessed_artist: "",
                guessed_at_stage: "3",
                exact_match: false,
                used_audio_clue: false,
                awarded_points: "",
                notes: "",
              };
              const suggestedPoints = getDefaultPoints(session, draft.exact_match, draft.guessed_at_stage);

              return (
                <div key={row.team_id} className="space-y-2 rounded border border-stone-800 bg-stone-950/70 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{row.team_name}</p>
                      <p className="text-[11px] text-stone-400">Total: {row.total_points} · Exact: {row.exact_hits} · S1 {row.stage_1_hits} · S2 {row.stage_2_hits} · S3 {row.stage_3_hits}</p>
                    </div>
                    <p className="text-[11px] text-stone-400">Suggested: {suggestedPoints}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      placeholder="Guessed artist"
                      value={draft.guessed_artist}
                      onChange={(event) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [row.team_id]: {
                            ...current[row.team_id],
                            guessed_artist: event.target.value,
                          },
                        }))
                      }
                    />
                    <select
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={draft.guessed_at_stage}
                      onChange={(event) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [row.team_id]: {
                            ...current[row.team_id],
                            guessed_at_stage: event.target.value,
                          },
                        }))
                      }
                    >
                      <option value="1">Stage 1</option>
                      <option value="2">Stage 2</option>
                      <option value="3">Stage 3</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-[auto,auto,110px] items-center gap-2">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={draft.exact_match}
                        onChange={(event) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [row.team_id]: {
                              ...current[row.team_id],
                              exact_match: event.target.checked,
                            },
                          }))
                        }
                      />
                      Exact match
                    </label>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={draft.used_audio_clue}
                        onChange={(event) =>
                          setScoreDraft((current) => ({
                            ...current,
                            [row.team_id]: {
                              ...current[row.team_id],
                              used_audio_clue: event.target.checked,
                            },
                          }))
                        }
                      />
                      Audio clue
                    </label>
                    <input
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      placeholder={`Auto ${suggestedPoints}`}
                      value={draft.awarded_points}
                      onChange={(event) =>
                        setScoreDraft((current) => ({
                          ...current,
                          [row.team_id]: {
                            ...current[row.team_id],
                            awarded_points: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>

                  <input
                    className="w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                    placeholder="Optional note"
                    value={draft.notes}
                    onChange={(event) =>
                      setScoreDraft((current) => ({
                        ...current,
                        [row.team_id]: {
                          ...current[row.team_id],
                          notes: event.target.value,
                        },
                      }))
                    }
                  />
                </div>
              );
            })}
            {leaderboard.length === 0 ? <p className="text-stone-500">No teams found.</p> : null}
          </div>
          <button disabled={!callForControls || saving} onClick={submitScores} className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold disabled:opacity-50">
            {saving ? "Saving..." : "Save Scores for Current Card"}
          </button>
        </section>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-200">Live Scoreboard</h2>
          <div className="mt-3 space-y-2 text-sm">
            {leaderboard.map((row) => (
              <div key={row.team_id} className="flex items-center justify-between rounded border border-stone-800 bg-black/50 px-3 py-2">
                <p>{row.team_name} · Exact {row.exact_hits} · Audio {row.audio_clue_uses}</p>
                <p className="font-black text-violet-200">{row.total_points}</p>
              </div>
            ))}
            {leaderboard.length === 0 ? <p className="text-stone-500">No teams scored yet.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
