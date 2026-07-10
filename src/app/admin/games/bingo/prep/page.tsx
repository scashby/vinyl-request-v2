"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { type PrintableCard } from "src/lib/bingoCardPrintPack";
import { generateBingoCardsPdf } from "src/lib/bingoCardsPdf";
import { generateBingoCallSheetPdf, type RoundCallSection } from "src/lib/bingoCallSheetPdf";
import { generateBingoRoundIndexPdf } from "src/lib/bingoRoundIndexPdf";
import { formatBallLabel, getBingoColumnTextClass } from "src/lib/bingoBall";

type Session = {
  id: number;
  session_code: string;
  playlist_name: string;
  card_count: number;
  current_round: number;
  round_count: number;
  card_layout: "2-up" | "4-up";
  status: string;
  is_sandbox?: boolean;
  sandbox_expires_at?: string | null;
};

type Call = {
  id: number;
  call_index: number;
  ball_number: number | null;
  column_letter: string;
  playlist_track_key: string | null;
  track_title: string;
  artist_name: string;
  album_name: string | null;
  side: string | null;
  position: string | null;
  status: string;
};

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

type ApiCardRow = {
  id: number;
  card_number: number;
  card_identifier?: string;
  has_free_space: boolean;
  grid: unknown;
};

export default function BingoPrepPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedRound, setSelectedRound] = useState(1);
  const [creatingSandbox, setCreatingSandbox] = useState(false);
  const [swapTargetCall, setSwapTargetCall] = useState<Call | null>(null);
  const [swapQuery, setSwapQuery] = useState("");
  const [swapResults, setSwapResults] = useState<InventorySearchCandidate[]>([]);
  const [swapSearching, setSwapSearching] = useState(false);
  const [swapApplyingTrackKey, setSwapApplyingTrackKey] = useState<string | null>(null);
  const [swapMessage, setSwapMessage] = useState<string | null>(null);

  const [preflight, setPreflight] = useState({
    cratePulled: false,
    callSheetPrinted: false,
    cardsPrinted: false,
    sparesReady: false,
  });

  const loadSession = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    const sRes = await fetch(`/api/games/bingo/sessions/${sessionId}`);

    if (sRes.ok) {
      const loadedSession = (await sRes.json()) as Session;
      setSession(loadedSession);
      const roundCount = Math.max(1, loadedSession.round_count ?? 1);
      setSelectedRound((current) => {
        if (!Number.isFinite(current) || current < 1) return 1;
        return Math.min(current, roundCount);
      });
    }
  }, [sessionId]);

  const loadRoundCalls = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    const round = Math.max(1, Math.floor(selectedRound || 1));
    const cRes = await fetch(`/api/games/bingo/sessions/${sessionId}/calls?round=${round}`);
    if (!cRes.ok) {
      setCalls([]);
      return;
    }
    const payload = await cRes.json();
    setCalls(payload.data ?? []);
  }, [selectedRound, sessionId]);

  const searchSwapCandidates = useCallback(async () => {
    const query = swapQuery.trim();
    if (query.length < 2) {
      setSwapResults([]);
      return;
    }

    setSwapSearching(true);
    try {
      const url = new URL('/api/library/tracks/search', window.location.origin);
      url.searchParams.set('q', query);
      url.searchParams.set('limit', '12');

      const response = await fetch(url.toString(), { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as { results?: Array<Record<string, unknown>>; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Track search failed (${response.status})`);
      }

      const mapped = Array.isArray(payload.results)
        ? payload.results
            .map((row) => ({
              track_key: String(row.track_key ?? '').trim(),
              inventory_id: typeof row.inventory_id === 'number' ? row.inventory_id : null,
              title: String(row.track_title ?? row.title ?? '').trim(),
              artist: String(row.track_artist ?? row.artist ?? '').trim(),
              album_title: typeof row.album_title === 'string' ? row.album_title : null,
              side: typeof row.side === 'string' ? row.side : null,
              position: typeof row.position === 'string' ? row.position : null,
              score: typeof row.score === 'number' ? row.score : 0,
            }))
            .filter((row) => row.track_key.length > 0)
        : [];

      setSwapResults(mapped);
    } catch (error) {
      setSwapMessage(error instanceof Error ? error.message : 'Track search failed');
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
      const response = await fetch(`/api/games/bingo/sessions/${sessionId}/swap-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromTrackKey: swapTargetCall.playlist_track_key,
          toTrackKey: candidate.track_key,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        counts?: { updated_bingo_session_calls?: number; updated_bingo_cards?: number };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? `Swap failed (${response.status})`);
      }

      const callsUpdated = payload.counts?.updated_bingo_session_calls ?? 0;
      const cardsUpdated = payload.counts?.updated_bingo_cards ?? 0;
      setSwapMessage(`Swap complete. Calls updated: ${callsUpdated}. Cards updated: ${cardsUpdated}.`);
      setSwapTargetCall(null);
      setSwapQuery('');
      setSwapResults([]);
      await loadRoundCalls();
      await loadSession();
    } catch (error) {
      setSwapMessage(error instanceof Error ? error.message : 'Swap failed');
    } finally {
      setSwapApplyingTrackKey(null);
    }
  }, [loadRoundCalls, loadSession, sessionId, swapTargetCall]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    void loadRoundCalls();
  }, [loadRoundCalls]);

  const pulledCount = useMemo(() => calls.length, [calls.length]);
  const preflightComplete = useMemo(() => Object.values(preflight).every(Boolean), [preflight]);

  const downloadCratePullSheet = async () => {
    const totalRounds = session?.round_count ?? 1;
    const roundSections: RoundCallSection[] = [];

    for (let r = 1; r <= totalRounds; r++) {
      const res = await fetch(`/api/games/bingo/sessions/${sessionId}/calls?round=${r}`);
      if (!res.ok) continue;
      const payload = await res.json();
      roundSections.push({ roundNumber: r, calls: payload.data ?? [] });
    }

    const title = session
      ? `Crate Pull Order · ${session.playlist_name} · ${session.session_code}`
      : `Crate Pull Order · Session ${sessionId}`;
    const doc = generateBingoCallSheetPdf(roundSections, title);
    doc.save(`bingo-${sessionId}-crate-pull.pdf`);
  };

  const downloadRoundIndex = async () => {
    const totalRounds = session?.round_count ?? 1;
    const roundSections: RoundCallSection[] = [];

    for (let r = 1; r <= totalRounds; r++) {
      const res = await fetch(`/api/games/bingo/sessions/${sessionId}/calls?round=${r}`);
      if (!res.ok) continue;
      const payload = await res.json();
      roundSections.push({ roundNumber: r, calls: payload.data ?? [] });
    }

    const title = session
      ? `Round Draw Index · ${session.playlist_name} · ${session.session_code}`
      : `Round Draw Index · Session ${sessionId}`;
    const doc = generateBingoRoundIndexPdf(roundSections, title);
    doc.save(`bingo-${sessionId}-round-index.pdf`);
  };

  const downloadCards = async (layout: "2-up" | "4-up") => {
    const cardsRes = await fetch(`/api/games/bingo/cards?sessionId=${sessionId}`);
    if (!cardsRes.ok) return;
    const payload = await cardsRes.json();
    const apiRows = (payload.data ?? []) as ApiCardRow[];
    const baseCards = apiRows.map((row) => ({
      card_number: row.card_number,
      card_identifier: row.card_identifier ?? "",
      grid: Array.isArray(row.grid)
        ? (row.grid as Array<Record<string, unknown>>)
            .filter((cell) => typeof cell === "object" && cell !== null)
            .map((cell) => ({
              row: Number(cell.row ?? 0),
              col: Number(cell.col ?? 0),
              label: String(cell.label ?? ""),
            }))
        : [],
    })) as PrintableCard[];

    const doc = generateBingoCardsPdf(baseCards, layout, `Music Bingo · ${session?.session_code ?? sessionId}`);
    doc.save(`bingo-${sessionId}-cards-${layout}.pdf`);
  };

  const createAdditionalCards = async () => {
    const additionalCount = Math.max(1, session?.round_count ?? 1) * 100;
    const response = await fetch(`/api/games/bingo/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, count: additionalCount }),
    });
    if (!response.ok) return;
    await loadSession();
    await loadRoundCalls();
  };

  const startSandboxDryRun = async () => {
    if (!Number.isFinite(sessionId) || creatingSandbox) return;
    setCreatingSandbox(true);
    try {
      const response = await fetch(`/api/games/bingo/sessions/${sessionId}/sandbox`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        id?: number;
        error?: string;
      };

      if (!response.ok || !payload.id) {
        alert(payload.error ?? "Failed to start sandbox dry run");
        return;
      }

      const sandboxSessionId = payload.id;
      window.open(`/admin/games/bingo/host?sessionId=${sandboxSessionId}`, `bingo_sandbox_host_${sandboxSessionId}`, "width=1280,height=960,left=0,top=0,noopener,noreferrer");
      window.open(`/admin/games/bingo/assistant?sessionId=${sandboxSessionId}`, `bingo_sandbox_assistant_${sandboxSessionId}`, "width=1024,height=800,left=1300,top=0,noopener,noreferrer");
      window.open(`/admin/games/bingo/jumbotron?sessionId=${sandboxSessionId}`, `bingo_sandbox_jumbotron_${sandboxSessionId}`, "width=1920,height=1080,noopener,noreferrer");
    } finally {
      setCreatingSandbox(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_35%_0%,#2b0f0d,transparent_45%),linear-gradient(180deg,#0b0b0b,#121212)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-amber-900/50 bg-black/45 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Pre-Game Prep</p>
              <h1 className="mt-1 text-4xl font-black uppercase text-amber-100">Crate Pull</h1>
              {session?.is_sandbox ? (
                <p className="mt-2 inline-flex items-center rounded border border-amber-500/70 bg-amber-950/40 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">
                  Sandbox Dry Run {session.sandbox_expires_at ? `· Expires ${new Date(session.sandbox_expires_at).toLocaleString()}` : ""}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-stone-300">
                {session?.playlist_name ?? "Loading…"} · {session?.session_code ?? ""} · Prep View Round {selectedRound} of {session?.round_count ?? 3}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link className="rounded border border-stone-700 px-3 py-1" href="/admin/games/bingo">Back to Setup</Link>
              <Link className="rounded border border-stone-700 px-3 py-1" href={`/admin/games/bingo/host?sessionId=${sessionId}`}>Host Console</Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">Call Order (Game Playlist)</h2>
              <div className="flex items-center gap-3">
                <label className="text-xs text-stone-300">
                  Round
                  <select
                    className="ml-2 rounded border border-stone-700 bg-stone-950 px-2 py-1 text-xs text-stone-200"
                    value={selectedRound}
                    onChange={(event) => setSelectedRound(Number(event.target.value))}
                  >
                    {Array.from({ length: Math.max(1, session?.round_count ?? 1) }, (_, idx) => idx + 1).map((round) => (
                      <option key={round} value={round}>Round {round}</option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-stone-400">{pulledCount} items</p>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-300">
                    <th className="pb-2">Draw</th>
                    <th className="pb-2">Ball</th>
                    <th className="pb-2">Artist</th>
                    <th className="pb-2">Album</th>
                    <th className="pb-2">Side</th>
                    <th className="pb-2">Pos</th>
                    <th className="pb-2">Track</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => {
                    const ballLabel = formatBallLabel(call.ball_number, call.column_letter);
                    const ballToneClass = getBingoColumnTextClass(call.column_letter, call.ball_number);

                    return (
                      <tr key={call.id} className="border-t border-stone-800 align-top">
                        <td className="py-2 text-stone-400">{call.call_index}</td>
                        <td className={`py-2 font-bold ${ballToneClass}`}>{ballLabel}</td>
                        <td className="py-2">{call.artist_name}</td>
                        <td className="py-2 text-stone-300">{call.album_name ?? ""}</td>
                        <td className="py-2 text-stone-400">{call.side ?? "-"}</td>
                        <td className="py-2 text-stone-400">{call.position ?? "-"}</td>
                        <td className="py-2">{call.track_title}</td>
                        <td className="py-2">
                          <button
                            disabled={!call.playlist_track_key}
                            onClick={() => {
                              setSwapTargetCall(call);
                              setSwapQuery('');
                              setSwapResults([]);
                              setSwapMessage(null);
                            }}
                            className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                              call.playlist_track_key
                                ? 'border-cyan-700/70 bg-cyan-950/30 text-cyan-200 hover:bg-cyan-900/45'
                                : 'cursor-not-allowed border-stone-800 bg-stone-900 text-stone-500'
                            }`}
                          >
                            Swap
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {calls.length === 0 ? (
                    <tr>
                      <td className="py-4 text-xs text-stone-500" colSpan={8}>No calls loaded.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {swapMessage ? <p className="mt-3 text-xs text-cyan-200">{swapMessage}</p> : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">Downloads</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button onClick={downloadCratePullSheet} className="rounded bg-amber-700 px-3 py-2">Crate Pull PDF</button>
                <button onClick={downloadRoundIndex} className="rounded bg-amber-700 px-3 py-2">Round Index PDF</button>
                <button onClick={createAdditionalCards} className="rounded bg-stone-800 px-3 py-2">Add {Math.max(1, session?.round_count ?? 1) * 100} Cards</button>
                <button onClick={() => downloadCards("4-up")} className="rounded bg-stone-800 px-3 py-2">Cards Pack PDF (4-up)</button>
                {!session?.is_sandbox ? (
                  <button
                    onClick={startSandboxDryRun}
                    disabled={creatingSandbox}
                    className="rounded border border-cyan-700/70 bg-cyan-950/30 px-3 py-2 font-semibold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingSandbox ? "Starting Sandbox..." : "Start Sandbox Dry Run"}
                  </button>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-stone-400">
                Prep goal: pull and stack records by <span className="font-semibold text-stone-200">Draw</span> order (1 → 75). The <span className="font-semibold text-stone-200">Ball</span> label is what you announce/show during gameplay.
              </p>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">Event Prep Checklist</h2>
              <div className="mt-3 space-y-2 text-xs">
                {(
                  [
                    ["cratePulled", "Crate pulled + stacked (Draw order)"],
                    ["callSheetPrinted", "Crate pull sheet printed"],
                    ["cardsPrinted", "Cards printed / distributed"],
                    ["sparesReady", "Spare records (optional) ready"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-stone-200">
                    <input
                      type="checkbox"
                      checked={preflight[key]}
                      onChange={(e) => setPreflight((s) => ({ ...s, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-stone-400">{preflightComplete ? "Ready for gameplay." : "Finish prep before gameplay."}</p>
                <Link
                  href={`/admin/games/bingo/host?sessionId=${sessionId}`}
                  className={`rounded px-3 py-2 text-xs ${preflightComplete ? "bg-emerald-700" : "bg-stone-800"}`}
                >
                  Go to Host Console
                </Link>
              </div>
            </div>
          </div>
        </section>
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
                  Replacing: <span className="font-semibold">{swapTargetCall.track_title}</span> - {swapTargetCall.artist_name}
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
                  if (event.key === 'Enter') {
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
                  swapSearching ? 'bg-stone-700 text-stone-300' : 'bg-cyan-800 text-white hover:bg-cyan-700'
                }`}
              >
                {swapSearching ? 'Searching...' : 'Search'}
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
                          {row.album_title ?? 'Unknown Album'}
                          {row.position ? ` · ${row.position}` : ''}
                          {row.inventory_id ? ` · #${row.inventory_id}` : ''}
                        </p>
                      </div>
                      <button
                        disabled={swapApplyingTrackKey === row.track_key || row.track_key === swapTargetCall.playlist_track_key}
                        onClick={() => void runSessionSwap(row)}
                        className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${
                          swapApplyingTrackKey === row.track_key || row.track_key === swapTargetCall.playlist_track_key
                            ? 'bg-stone-700 text-stone-300'
                            : 'bg-emerald-700 text-white hover:bg-emerald-600'
                        }`}
                      >
                        {swapApplyingTrackKey === row.track_key ? 'Applying...' : row.track_key === swapTargetCall.playlist_track_key ? 'Current' : 'Swap To This'}
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
