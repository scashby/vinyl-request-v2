"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { generateVbCardsPdf } from "src/lib/vbCardsPdf";
import { generateVbCallSheetPdf } from "src/lib/vbCallSheetPdf";

type Template = {
  id: number;
  name: string;
  description?: string | null;
  setlist_mode: boolean;
  track_count: number;
};

type Session = {
  id: number;
  session_code: string;
  game_mode: string;
  status: string;
  created_at: string;
};

export default function VinylBingoSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");

  const [templates, setTemplates] = useState<Template[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [gameMode, setGameMode] = useState("single_line");
  const [cardCount, setCardCount] = useState(40);
  const [roundCount, setRoundCount] = useState(3);
  const [secondsToNextCall, setSecondsToNextCall] = useState(45);
  const [setlistMode, setSetlistMode] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [tRes, sRes] = await Promise.all([
      fetch("/api/vb/templates"),
      fetch(`/api/vb/sessions${eventId ? `?eventId=${eventId}` : ""}`),
    ]);

    if (tRes.ok) {
      const t = await tRes.json();
      setTemplates(t.data ?? []);
    }

    if (sRes.ok) {
      const s = await sRes.json();
      setSessions(s.data ?? []);
    }
  };

  useEffect(() => {
    load();
  }, [eventId]);

  useEffect(() => {
    if (!templateId) return;
    const template = templates.find((t) => t.id === templateId);
    if (template) setSetlistMode(Boolean(template.setlist_mode));
  }, [templateId, templates]);

  const createSession = async () => {
    if (!templateId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/vb/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          event_id: eventId ? Number(eventId) : null,
          game_mode: gameMode,
          card_count: cardCount,
          round_count: roundCount,
          seconds_to_next_call: secondsToNextCall,
          setlist_mode: setlistMode,
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Failed to create session");
      }

      const payload = await res.json();
      router.push(`/admin/games/bingo/host?sessionId=${payload.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create session";
      alert(message);
    } finally {
      setCreating(false);
      await load();
    }
  };

  const downloadCards = async (sessionId: number, layout: "2-up" | "4-up") => {
    const res = await fetch(`/api/vb/cards?sessionId=${sessionId}`);
    if (!res.ok) return;
    const payload = await res.json();
    const cards = (payload.data ?? []).map((row: any) => ({ index: row.card_number, cells: row.grid }));
    const doc = generateVbCardsPdf(cards, `Vinyl Bingo Session ${sessionId}`, { layout });
    doc.save(`vinyl-bingo-${sessionId}-cards-${layout}.pdf`);
  };

  const downloadCallSheet = async (sessionId: number) => {
    const res = await fetch(`/api/vb/sessions/${sessionId}/calls`);
    if (!res.ok) return;
    const payload = await res.json();
    const items = (payload.data ?? []).map((row: any) => ({
      index: row.call_index,
      column: row.column_letter,
      track: row.track_title,
      artist: row.artist_name,
      album: row.album_name,
    }));
    const doc = generateVbCallSheetPdf(items, `Vinyl Bingo Session ${sessionId} Call Sheet`);
    doc.save(`vinyl-bingo-${sessionId}-call-sheet.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#f2e9dc] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-stone-300 bg-white p-5">
          <h1 className="text-3xl font-black text-stone-900">Vinyl Bingo Setup</h1>
          <p className="mt-1 text-sm text-stone-700">Analog-first, vinyl-only game control.</p>
        </header>

        <section className="rounded-2xl border border-stone-300 bg-white p-5">
          <h2 className="text-lg font-bold text-stone-900">Create Session</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm text-stone-700">
              Playlist
              <select
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                value={templateId ?? ""}
                onChange={(e) => setTemplateId(Number(e.target.value) || null)}
              >
                <option value="">Select playlist</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.track_count})</option>
                ))}
              </select>
            </label>

            <label className="text-sm text-stone-700">
              Game Mode
              <select className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2" value={gameMode} onChange={(e) => setGameMode(e.target.value)}>
                <option value="single_line">Single Line</option>
                <option value="double_line">Double Line</option>
                <option value="triple_line">Triple Line</option>
                <option value="criss_cross">Criss-Cross</option>
                <option value="four_corners">Four Corners</option>
                <option value="blackout">Blackout</option>
                <option value="death">Death</option>
              </select>
            </label>

            <label className="text-sm text-stone-700">Card Count
              <input className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2" type="number" min={1} value={cardCount} onChange={(e) => setCardCount(Number(e.target.value) || 1)} />
            </label>

            <label className="text-sm text-stone-700">Rounds
              <input className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2" type="number" min={1} value={roundCount} onChange={(e) => setRoundCount(Number(e.target.value) || 1)} />
            </label>

            <label className="text-sm text-stone-700">Seconds to Next Call
              <input className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2" type="number" min={10} value={secondsToNextCall} onChange={(e) => setSecondsToNextCall(Number(e.target.value) || 45)} />
            </label>
          </div>

          <label className="mt-4 inline-flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={setlistMode} onChange={(e) => setSetlistMode(e.target.checked)} />
            Setlist mode (ordered calls)
          </label>

          <div className="mt-5">
            <button
              type="button"
              onClick={createSession}
              disabled={!templateId || creating}
              className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Session"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-300 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">Existing Sessions</h2>
            <button onClick={load} className="rounded border border-stone-300 px-3 py-1 text-sm text-stone-700">Refresh</button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-stone-600">No sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div key={s.id} className="rounded-xl border border-stone-200 p-3">
                  <div className="text-sm text-stone-800">Code: <span className="font-bold">{s.session_code}</span> | {s.game_mode} | {s.status}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => router.push(`/admin/games/bingo/host?sessionId=${s.id}`)} className="rounded border border-stone-300 px-2 py-1 text-xs">Host</button>
                    <button onClick={() => router.push(`/admin/games/bingo/assistant?sessionId=${s.id}`)} className="rounded border border-stone-300 px-2 py-1 text-xs">Assistant</button>
                    <button onClick={() => router.push(`/admin/games/bingo/jumbotron?sessionId=${s.id}`)} className="rounded border border-stone-300 px-2 py-1 text-xs">Jumbotron</button>
                    <button onClick={() => downloadCards(s.id, "2-up")} className="rounded border border-stone-300 px-2 py-1 text-xs">Cards 2-up</button>
                    <button onClick={() => downloadCards(s.id, "4-up")} className="rounded border border-stone-300 px-2 py-1 text-xs">Cards 4-up</button>
                    <button onClick={() => downloadCallSheet(s.id)} className="rounded border border-stone-300 px-2 py-1 text-xs">Call Sheet</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
