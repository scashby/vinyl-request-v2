"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { generateBingoCardsPdf } from "src/lib/bingoCardsPdf";
import { generateBingoCallSheetPdf } from "src/lib/bingoCallSheetPdf";
import { formatBallLabel } from "src/lib/bingoBall";

type Session = {
  id: number;
  session_code: string;
  playlist_name: string;
  current_round: number;
  round_count: number;
  card_layout: "2-up" | "4-up";
  status: string;
};

type Call = {
  id: number;
  call_index: number;
  ball_number: number | null;
  column_letter: string;
  track_title: string;
  artist_name: string;
  album_name: string | null;
  side: string | null;
  position: string | null;
  status: string;
};

type ApiCardRow = {
  id: number;
  card_number: number;
  has_free_space: boolean;
  grid: unknown;
};

export default function BingoPrepPage() {
  const sessionId = Number(useSearchParams().get("sessionId"));
  const [session, setSession] = useState<Session | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);

  const [preflight, setPreflight] = useState({
    cratePulled: false,
    callSheetPrinted: false,
    cardsPrinted: false,
    sparesReady: false,
  });

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/games/bingo/sessions/${sessionId}`),
      fetch(`/api/games/bingo/sessions/${sessionId}/calls`),
    ]);

    if (sRes.ok) setSession(await sRes.json());
    if (cRes.ok) {
      const payload = await cRes.json();
      setCalls(payload.data ?? []);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const pulledCount = useMemo(() => calls.length, [calls.length]);
  const preflightComplete = useMemo(() => Object.values(preflight).every(Boolean), [preflight]);

  const downloadCratePullSheet = async () => {
    const res = await fetch(`/api/games/bingo/sessions/${sessionId}/calls`);
    if (!res.ok) return;
    const payload = await res.json();
    const title = session ? `Crate Pull Order · ${session.playlist_name} · ${session.session_code}` : `Crate Pull Order · Session ${sessionId}`;
    const doc = generateBingoCallSheetPdf(payload.data ?? [], title);
    doc.save(`bingo-${sessionId}-crate-pull.pdf`);
  };

  const downloadCards = async (layout: "2-up" | "4-up") => {
    const res = await fetch(`/api/games/bingo/cards?sessionId=${sessionId}`);
    if (!res.ok) return;
    const payload = await res.json();
    const apiRows = (payload.data ?? []) as ApiCardRow[];
    const cards = apiRows.map((row) => {
      const gridSource = Array.isArray(row.grid) ? row.grid : [];
      const grid = gridSource
        .filter((cell) => typeof cell === "object" && cell !== null)
        .map((cell) => {
          const typed = cell as Record<string, unknown>;
          return {
            row: Number(typed.row ?? 0),
            col: Number(typed.col ?? 0),
            label: String(typed.label ?? ""),
          };
        });
      return { card_number: row.card_number, grid };
    });

    const doc = generateBingoCardsPdf(cards, layout, `Music Bingo · ${session?.session_code ?? sessionId}`);
    doc.save(`bingo-${sessionId}-cards-${layout}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_35%_0%,#2b0f0d,transparent_45%),linear-gradient(180deg,#0b0b0b,#121212)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-amber-900/50 bg-black/45 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Pre-Game Prep</p>
              <h1 className="mt-1 text-4xl font-black uppercase text-amber-100">Crate Pull</h1>
              <p className="mt-2 text-sm text-stone-300">
                {session?.playlist_name ?? "Loading…"} · {session?.session_code ?? ""} · Round {session?.current_round ?? 1} of {session?.round_count ?? 3}
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
              <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">Crate (Call Order)</h2>
              <p className="text-xs text-stone-400">{pulledCount} items</p>
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
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-t border-stone-800 align-top">
                      <td className="py-2 text-stone-400">{call.call_index}</td>
                      <td className="py-2 font-bold text-amber-300">{formatBallLabel(call.ball_number, call.column_letter)}</td>
                      <td className="py-2">{call.artist_name}</td>
                      <td className="py-2 text-stone-300">{call.album_name ?? ""}</td>
                      <td className="py-2 text-stone-400">{call.side ?? "-"}</td>
                      <td className="py-2 text-stone-400">{call.position ?? "-"}</td>
                      <td className="py-2">{call.track_title}</td>
                    </tr>
                  ))}
                  {calls.length === 0 ? (
                    <tr>
                      <td className="py-4 text-xs text-stone-500" colSpan={7}>No calls loaded.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-stone-700 bg-black/45 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-amber-200">Downloads</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button onClick={downloadCratePullSheet} className="rounded bg-amber-700 px-3 py-2">Crate Pull PDF</button>
                <button onClick={() => downloadCards("2-up")} className="rounded bg-stone-800 px-3 py-2">Cards PDF (2-up)</button>
                <button onClick={() => downloadCards("4-up")} className="rounded bg-stone-800 px-3 py-2">Cards PDF (4-up)</button>
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
    </div>
  );
}
