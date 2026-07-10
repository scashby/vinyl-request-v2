"use client";
import Image from "next/image";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Session = {
  id: number;
  title: string;
  session_code: string;
  status: string;
  round_count: number;
  questions_per_round: number;
  tie_breaker_count: number;
  prep_ready_main: number;
  prep_ready_tiebreakers: number;
  prep_total_main: number;
  prep_total_tiebreakers: number;
  playlist: {
    id: number;
    name: string;
  } | null;
};

type Call = {
  id: number;
  call_index: number;
  round_number: number;
  playlist_track_key: string | null;
  is_tiebreaker: boolean;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  question_text: string;
  answer_key: string;
  accepted_answers: string[];
  source_note: string | null;
  prep_status: "draft" | "ready";
  display_element_type: "song" | "artist" | "album" | "cover_art" | "vinyl_label";
  display_image_override_url: string | null;
  auto_cover_art_url: string | null;
  auto_vinyl_label_url: string | null;
  source_artist: string | null;
  source_title: string | null;
  source_album: string | null;
  source_side: string | null;
  source_position: string | null;
  effective_display_image_url: string | null;
  status: "pending" | "asked" | "answer_revealed" | "scored" | "skipped";
};

type ScopeFilter = "all" | "main" | "tiebreaker";

type InventorySearchCandidate = {
  track_key: string;
  inventory_id: number | null;
  title: string;
  artist: string;
  album_title: string | null;
  side: string | null;
  position: string | null;
  score: number;
};

function toAnswersText(values: string[]): string {
  return values.join(", ");
}

function fromAnswersText(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
}

export default function MusicTriviaPrepPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [needsPrepOnly, setNeedsPrepOnly] = useState(false);
  const [missingImageOnly, setMissingImageOnly] = useState(false);
  const [savingCallId, setSavingCallId] = useState<number | null>(null);
  const [swapTargetCall, setSwapTargetCall] = useState<Call | null>(null);
  const [swapQuery, setSwapQuery] = useState("");
  const [swapResults, setSwapResults] = useState<InventorySearchCandidate[]>([]);
  const [swapSearching, setSwapSearching] = useState(false);
  const [swapApplyingTrackKey, setSwapApplyingTrackKey] = useState<string | null>(null);
  const [swapMessage, setSwapMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    const [sessionRes, callsRes] = await Promise.all([
      fetch(`/api/games/trivia/sessions/${sessionId}`),
      fetch(`/api/games/trivia/sessions/${sessionId}/calls`),
    ]);

    if (sessionRes.ok) {
      setSession(await sessionRes.json());
    }

    if (callsRes.ok) {
      const payload = await callsRes.json();
      setCalls(payload.data ?? []);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateCallLocal = (callId: number, patch: Partial<Call>) => {
    setCalls((current) => current.map((call) => (call.id === callId ? { ...call, ...patch } : call)));
  };

  const saveCall = async (call: Call, patchOverride?: Partial<Call>) => {
    setSavingCallId(call.id);
    const next: Call = { ...call, ...(patchOverride ?? {}) };
    try {
      const res = await fetch(`/api/games/trivia/calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_text: next.question_text,
          answer_key: next.answer_key,
          accepted_answers: next.accepted_answers,
          source_note: next.source_note,
          prep_status: next.prep_status,
          display_element_type: next.display_element_type,
          display_image_override_url: next.display_image_override_url,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to save call");
      }
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save call");
    } finally {
      setSavingCallId(null);
    }
  };

  const toggleReady = async (call: Call) => {
    const nextStatus = call.prep_status === "ready" ? "draft" : "ready";
    await saveCall(call, { prep_status: nextStatus });
  };

  const searchSwapCandidates = useCallback(async () => {
    const query = swapQuery.trim();
    if (query.length < 2) {
      setSwapResults([]);
      return;
    }

    setSwapSearching(true);
    try {
      const url = new URL("/api/library/tracks/search", window.location.origin);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "12");

      const response = await fetch(url.toString(), { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as { results?: Array<Record<string, unknown>>; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Track search failed (${response.status})`);
      }

      const mapped = Array.isArray(payload.results)
        ? payload.results
            .map((row) => ({
              track_key: String(row.track_key ?? "").trim(),
              inventory_id: typeof row.inventory_id === "number" ? row.inventory_id : null,
              title: String(row.track_title ?? row.title ?? "").trim(),
              artist: String(row.track_artist ?? row.artist ?? "").trim(),
              album_title: typeof row.album_title === "string" ? row.album_title : null,
              side: typeof row.side === "string" ? row.side : null,
              position: typeof row.position === "string" ? row.position : null,
              score: typeof row.score === "number" ? row.score : 0,
            }))
            .filter((row) => row.track_key.length > 0)
        : [];

      setSwapResults(mapped);
    } catch (error) {
      setSwapMessage(error instanceof Error ? error.message : "Track search failed");
      setSwapResults([]);
    } finally {
      setSwapSearching(false);
    }
  }, [swapQuery]);

  const runSessionSwap = useCallback(async (candidate: InventorySearchCandidate) => {
    if (!swapTargetCall?.playlist_track_key) return;

    setSwapApplyingTrackKey(candidate.track_key);
    setSwapMessage(null);
    try {
      const response = await fetch(`/api/games/trivia/sessions/${sessionId}/swap-track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromTrackKey: swapTargetCall.playlist_track_key,
          toTrackKey: candidate.track_key,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        counts?: { updated_session_calls?: number };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? `Swap failed (${response.status})`);
      }

      const callsUpdated = payload.counts?.updated_session_calls ?? 0;
      setSwapMessage(`Swap complete. Calls updated: ${callsUpdated}.`);
      setSwapTargetCall(null);
      setSwapQuery("");
      setSwapResults([]);
      await load();
    } catch (error) {
      setSwapMessage(error instanceof Error ? error.message : "Swap failed");
    } finally {
      setSwapApplyingTrackKey(null);
    }
  }, [load, sessionId, swapTargetCall]);

  const filteredCalls = useMemo(() => {
    return calls.filter((call) => {
      if (scope === "main" && call.is_tiebreaker) return false;
      if (scope === "tiebreaker" && !call.is_tiebreaker) return false;

      if (needsPrepOnly) {
        const hasCore = call.question_text.trim().length > 0 && call.answer_key.trim().length > 0;
        if (call.prep_status === "ready" && hasCore) return false;
      }

      if (missingImageOnly && call.effective_display_image_url) return false;

      return true;
    });
  }, [calls, missingImageOnly, needsPrepOnly, scope]);

  const mainTotal = session?.prep_total_main ?? calls.filter((call) => !call.is_tiebreaker).length;
  const mainReady = session?.prep_ready_main ?? calls.filter((call) => !call.is_tiebreaker && call.prep_status === "ready").length;
  const tieTotal = session?.prep_total_tiebreakers ?? calls.filter((call) => call.is_tiebreaker).length;
  const tieReady = session?.prep_ready_tiebreakers ?? calls.filter((call) => call.is_tiebreaker && call.prep_status === "ready").length;
  const incompleteCount = (mainTotal - mainReady) + (tieTotal - tieReady);
  const missingImageCount = calls.filter((call) => !call.effective_display_image_url).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_0%,#123643,transparent_42%),linear-gradient(180deg,#0a0a0a,#141414)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-cyan-900/40 bg-black/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Prep Console</p>
              <h1 className="text-3xl font-black uppercase">Music Trivia Prep</h1>
              <p className="text-sm text-stone-400">
                {session?.title ?? "Session"} · {session?.session_code ?? ""} · Playlist {session?.playlist?.name ?? "(none)"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-3 py-1" href="/admin/games/music-trivia">Setup</Link>
              <Link className="rounded border border-stone-700 px-3 py-1" href={`/admin/games/music-trivia/host?sessionId=${sessionId}`}>Host</Link>
              <Link className="rounded border border-stone-700 px-3 py-1" href={`/admin/games/music-trivia/jumbotron?sessionId=${sessionId}`}>Jumbotron</Link>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Prep Readiness</p>
          <p className="mt-1 text-sm text-stone-300">
            Main ready: <span className="font-bold text-cyan-200">{mainReady}/{mainTotal}</span> · Tie-breakers ready: <span className="font-bold text-cyan-200">{tieReady}/{tieTotal}</span> · Missing images: <span className="font-bold text-amber-300">{missingImageCount}</span>
          </p>
          <p className={`mt-1 text-xs ${incompleteCount > 0 ? "text-amber-300" : "text-emerald-300"}`}>
            {incompleteCount > 0
              ? `Soft gate: ${incompleteCount} calls still incomplete. Host is still available, but prep is not fully ready.`
              : "All calls are prep-ready."}
          </p>
        </section>

        <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-2">
              Scope
              <select
                className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                value={scope}
                onChange={(e) => setScope((e.target.value as ScopeFilter) ?? "all")}
              >
                <option value="all">All calls</option>
                <option value="main">Main only</option>
                <option value="tiebreaker">Tie-breakers only</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={needsPrepOnly} onChange={(e) => setNeedsPrepOnly(e.target.checked)} />
              Needs prep only
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={missingImageOnly} onChange={(e) => setMissingImageOnly(e.target.checked)} />
              Missing image only
            </label>
            <button onClick={load} className="rounded border border-stone-700 px-3 py-1">Refresh</button>
          </div>
        </section>

        <section className="space-y-3">
          {filteredCalls.map((call) => (
            <article key={call.id} className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">
                    Q{call.call_index} · {call.is_tiebreaker ? "Tie-Breaker" : `Round ${call.round_number}`} · {call.category}
                  </p>
                  <p className="mt-1 text-xs text-stone-400">Difficulty: {call.difficulty.toUpperCase()} · Runtime status: {call.status}</p>
                </div>
                <button
                  disabled={savingCallId === call.id}
                  onClick={() => toggleReady(call)}
                  className={`rounded px-3 py-1 text-xs font-semibold ${call.prep_status === "ready" ? "bg-emerald-700" : "bg-stone-800"}`}
                >
                  {call.prep_status === "ready" ? "Marked Ready" : "Mark Ready"}
                </button>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr,1fr]">
                <div className="space-y-2">
                  <label className="block text-xs">
                    Question
                    <textarea
                      className="mt-1 h-20 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={call.question_text}
                      onChange={(e) => updateCallLocal(call.id, { question_text: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs">
                    Answer Key
                    <input
                      className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={call.answer_key}
                      onChange={(e) => updateCallLocal(call.id, { answer_key: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs">
                    Accepted Answers (comma separated)
                    <input
                      className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={toAnswersText(call.accepted_answers)}
                      onChange={(e) => updateCallLocal(call.id, { accepted_answers: fromAnswersText(e.target.value) })}
                    />
                  </label>
                  <label className="block text-xs">
                    Source Note
                    <input
                      className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={call.source_note ?? ""}
                      onChange={(e) => updateCallLocal(call.id, { source_note: e.target.value })}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs">
                    Display Element
                    <select
                      className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={call.display_element_type}
                      onChange={(e) =>
                        updateCallLocal(call.id, {
                          display_element_type: (e.target.value as Call["display_element_type"]) ?? "song",
                        })
                      }
                    >
                      <option value="song">song</option>
                      <option value="artist">artist</option>
                      <option value="album">album</option>
                      <option value="cover_art">cover_art</option>
                      <option value="vinyl_label">vinyl_label</option>
                    </select>
                  </label>
                  <label className="block text-xs">
                    Image Override URL (optional)
                    <input
                      className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={call.display_image_override_url ?? ""}
                      onChange={(e) => updateCallLocal(call.id, { display_image_override_url: e.target.value || null })}
                    />
                  </label>

                  <div className="rounded border border-stone-700 bg-stone-950/70 p-2 text-xs">
                    <p>Source: {call.source_artist ?? "-"} · {call.source_title ?? "-"} · {call.source_album ?? "-"}</p>
                    <p className="text-stone-400">Side/Pos: {call.source_side ?? "-"} / {call.source_position ?? "-"}</p>
                    <p className="text-stone-400">Auto cover: {call.auto_cover_art_url ? "yes" : "no"} · Auto vinyl label: {call.auto_vinyl_label_url ? "yes" : "no"}</p>
                  </div>

                  {call.effective_display_image_url ? (
                    <Image unoptimized width={1200} height={1200}
                      alt={`Trivia display asset for question ${call.call_index}`}
                      className="h-32 w-full rounded border border-stone-700 object-cover"
                      src={call.effective_display_image_url}
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded border border-amber-700/70 bg-amber-950/20 text-xs text-amber-200">
                      No resolved image
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  disabled={savingCallId === call.id}
                  onClick={() => saveCall(call)}
                  className="rounded bg-cyan-700 px-3 py-1 disabled:opacity-50"
                >
                  {savingCallId === call.id ? "Saving..." : "Save Call"}
                </button>
                <button
                  disabled={!call.playlist_track_key}
                  onClick={() => {
                    setSwapTargetCall(call);
                    setSwapQuery("");
                    setSwapResults([]);
                    setSwapMessage(null);
                  }}
                  className={`rounded border px-3 py-1 font-semibold ${
                    call.playlist_track_key
                      ? "border-cyan-700/70 bg-cyan-950/30 text-cyan-200 hover:bg-cyan-900/45"
                      : "cursor-not-allowed border-stone-800 bg-stone-900 text-stone-500"
                  }`}
                >
                  Swap Track
                </button>
              </div>
            </article>
          ))}
          {filteredCalls.length === 0 ? (
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4 text-sm text-stone-400">No calls match the current filters.</div>
          ) : null}
        </section>
        {swapMessage ? (
          <section className="rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-3 text-xs text-cyan-100">{swapMessage}</section>
        ) : null}
      </div>

      {swapTargetCall ? (
        <div className="fixed inset-0 z-[5000] bg-black/70 p-4" onClick={() => setSwapTargetCall(null)}>
          <div
            className="mx-auto mt-10 w-full max-w-3xl rounded-2xl border border-cyan-900/60 bg-[#0a121d] p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Swap Track</p>
                <p className="mt-1 text-sm text-stone-200">
                  Replacing: <span className="font-semibold">{swapTargetCall.source_title ?? "(untitled)"}</span> - {swapTargetCall.source_artist ?? "(unknown artist)"}
                </p>
              </div>
              <button
                onClick={() => setSwapTargetCall(null)}
                className="rounded border border-stone-700 px-2 py-1 text-xs text-stone-300 hover:bg-stone-900"
              >
                Close
              </button>
            </div>

            <div className="flex gap-2">
              <input
                value={swapQuery}
                onChange={(event) => setSwapQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchSwapCandidates();
                  }
                }}
                placeholder="Search replacement track by title / artist"
                className="w-full rounded border border-cyan-900/60 bg-[#0d1a2b] px-3 py-2 text-sm text-white"
              />
              <button
                onClick={() => void searchSwapCandidates()}
                disabled={swapSearching}
                className={`rounded px-3 py-2 text-xs font-semibold ${
                  swapSearching ? "bg-stone-700 text-stone-300" : "bg-cyan-800 text-white hover:bg-cyan-700"
                }`}
              >
                {swapSearching ? "Searching..." : "Search"}
              </button>
            </div>

            <div className="mt-3 max-h-[420px] overflow-y-auto rounded border border-cyan-950/60">
              {swapResults.length === 0 ? (
                <div className="px-3 py-6 text-xs text-stone-400">No results yet. Search to find a replacement track.</div>
              ) : (
                <div className="divide-y divide-cyan-950/40">
                  {swapResults.map((row) => (
                    <div key={row.track_key} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-stone-100">{row.title} - {row.artist}</p>
                        <p className="truncate text-[11px] text-stone-400">
                          {row.album_title ?? "Unknown Album"}
                          {row.position ? ` · ${row.position}` : ""}
                          {row.inventory_id ? ` · #${row.inventory_id}` : ""}
                        </p>
                      </div>
                      <button
                        disabled={swapApplyingTrackKey === row.track_key || row.track_key === swapTargetCall.playlist_track_key}
                        onClick={() => void runSessionSwap(row)}
                        className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${
                          swapApplyingTrackKey === row.track_key || row.track_key === swapTargetCall.playlist_track_key
                            ? "bg-stone-700 text-stone-300"
                            : "bg-emerald-700 text-white hover:bg-emerald-600"
                        }`}
                      >
                        {swapApplyingTrackKey === row.track_key ? "Applying..." : row.track_key === swapTargetCall.playlist_track_key ? "Current" : "Swap To This"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
