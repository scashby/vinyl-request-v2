"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatSecondsClock, parseCueTimeToSeconds } from "src/lib/triviaBank";

type QuestionStatus = "draft" | "published" | "archived";
type Difficulty = "easy" | "medium" | "hard";

type InventoryTrackResult = {
  inventory_id: number;
  release_id: number | null;
  release_track_id: number | null;
  artist: string;
  album: string;
  title: string;
  side: string | null;
  position: string | null;
};

type QuestionListRow = {
  id: number;
  question_code: string;
  status: QuestionStatus;
  prompt_text: string;
  default_category: string;
  default_difficulty: Difficulty;
  updated_at: string;
  facets: {
    has_required_cue?: boolean;
  } | null;
};

type QuestionDetail = {
  id: number;
  question_code: string;
  status: QuestionStatus;
  prompt_text: string;
  answer_key: string;
  accepted_answers: string[];
  default_category: string;
  default_difficulty: Difficulty;
  tags: string[];
  cue_source_type: "inventory_track" | "uploaded_clip" | null;
  cue_source_payload: Record<string, unknown>;
  primary_cue_start_seconds: number | null;
  primary_cue_end_seconds: number | null;
  primary_cue_instruction: string | null;
  cue_notes_text: string | null;
};

type FormState = {
  question_text: string;
  correct_answer: string;
  alternate_answers_text: string;
  category: string;
  difficulty: Difficulty;
  tags_text: string;
  cue_start_text: string;
  cue_end_text: string;
  cue_instruction: string;
  cue_notes_text: string;
  selected_track: InventoryTrackResult | null;
};

const DEFAULT_FORM: FormState = {
  question_text: "",
  correct_answer: "",
  alternate_answers_text: "",
  category: "General Music",
  difficulty: "medium",
  tags_text: "",
  cue_start_text: "0:30",
  cue_end_text: "",
  cue_instruction: "",
  cue_notes_text: "",
  selected_track: null,
};

function parseDelimitedText(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function formatTrackLabel(track: InventoryTrackResult | null): string {
  if (!track) return "No vinyl track selected";
  const sidePosition = [track.side, track.position].filter(Boolean).join(" ");
  return `${track.artist} - ${track.album} - ${track.title}${sidePosition ? ` (${sidePosition})` : ""}`;
}

function mapDetailToForm(detail: QuestionDetail): FormState {
  const payload = detail.cue_source_payload && typeof detail.cue_source_payload === "object"
    ? detail.cue_source_payload
    : {};

  const selectedTrack: InventoryTrackResult | null = detail.cue_source_type === "inventory_track"
    ? {
        inventory_id: Number(payload.inventory_id),
        release_id: Number.isFinite(Number(payload.release_id)) ? Number(payload.release_id) : null,
        release_track_id: Number.isFinite(Number(payload.release_track_id)) ? Number(payload.release_track_id) : null,
        artist: typeof payload.artist === "string" ? payload.artist : "",
        album: typeof payload.album === "string" ? payload.album : "",
        title: typeof payload.title === "string" ? payload.title : "",
        side: typeof payload.side === "string" ? payload.side : null,
        position: typeof payload.position === "string" ? payload.position : null,
      }
    : null;

  const alternateAnswers = (detail.accepted_answers ?? []).filter((answer) => answer !== detail.answer_key);

  return {
    question_text: detail.prompt_text,
    correct_answer: detail.answer_key,
    alternate_answers_text: alternateAnswers.join(", "),
    category: detail.default_category,
    difficulty: detail.default_difficulty,
    tags_text: (detail.tags ?? []).join(", "),
    cue_start_text: detail.primary_cue_start_seconds !== null ? formatSecondsClock(detail.primary_cue_start_seconds) : "",
    cue_end_text: detail.primary_cue_end_seconds !== null ? formatSecondsClock(detail.primary_cue_end_seconds) : "",
    cue_instruction: detail.primary_cue_instruction ?? "",
    cue_notes_text: detail.cue_notes_text ?? "",
    selected_track: selectedTrack,
  };
}

export default function MusicTriviaBankPage() {
  const [rows, setRows] = useState<QuestionListRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<QuestionDetail | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | QuestionStatus>("");

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryResults, setInventoryResults] = useState<InventoryTrackResult[]>([]);

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "150");

      const res = await fetch(`/api/games/trivia/questions?${params.toString()}`);
      if (!res.ok) return;

      const payload = await res.json();
      setRows(payload.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  const loadDetail = useCallback(async (id: number) => {
    const res = await fetch(`/api/games/trivia/questions/${id}`);
    if (!res.ok) return;

    const payload = (await res.json()) as QuestionDetail;
    setSelectedId(payload.id);
    setSelectedDetail(payload);
    setForm(mapDetailToForm(payload));

    const cuePayload = payload.cue_source_payload && typeof payload.cue_source_payload === "object"
      ? payload.cue_source_payload
      : {};
    const searchSeed = [cuePayload.artist, cuePayload.album, cuePayload.title]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
      .join(" ");
    setInventoryQuery(searchSeed);
    setInventoryResults([]);
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [rows]
  );

  const validationMessage = useMemo(() => {
    if (!form.question_text.trim()) return "Question text is required.";
    if (!form.correct_answer.trim()) return "Correct answer is required.";
    if (!form.selected_track) return "Pick a vinyl track for cue source.";

    const startSeconds = parseCueTimeToSeconds(form.cue_start_text);
    if (startSeconds === null) return "Cue start time is required (use m:ss).";

    if (form.cue_end_text.trim()) {
      const endSeconds = parseCueTimeToSeconds(form.cue_end_text);
      if (endSeconds === null) return "Cue end time is invalid.";
      if (endSeconds < startSeconds) return "Cue end time must be after cue start time.";
    }

    return null;
  }, [form]);

  const setFormField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetForNew = () => {
    setSelectedId(null);
    setSelectedDetail(null);
    setForm(DEFAULT_FORM);
    setInventoryQuery("");
    setInventoryResults([]);
  };

  const searchInventory = async () => {
    const query = inventoryQuery.trim();
    if (!query) {
      setInventoryResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/games/trivia/inventory-search?q=${encodeURIComponent(query)}&limit=10`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Search failed");
      setInventoryResults(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Search failed");
      setInventoryResults([]);
    } finally {
      setSearching(false);
    }
  };

  const saveQuestion = async (publish: boolean) => {
    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    const selectedTrack = form.selected_track;
    if (!selectedTrack) {
      alert("Pick a vinyl track for cue source.");
      return;
    }

    setSaving(true);
    try {
      const endpoint = selectedId
        ? `/api/games/trivia/questions/${selectedId}/quick`
        : "/api/games/trivia/questions/quick";
      const method = selectedId ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_text: form.question_text,
          correct_answer: form.correct_answer,
          alternate_answers: parseDelimitedText(form.alternate_answers_text),
          category: form.category,
          difficulty: form.difficulty,
          tags: parseDelimitedText(form.tags_text),
          cue_source_type: "inventory_track",
          cue_source_payload: {
            inventory_id: selectedTrack.inventory_id,
            release_id: selectedTrack.release_id,
            release_track_id: selectedTrack.release_track_id,
            artist: selectedTrack.artist,
            album: selectedTrack.album,
            title: selectedTrack.title,
            side: selectedTrack.side,
            position: selectedTrack.position,
          },
          primary_cue_start_seconds: form.cue_start_text,
          primary_cue_end_seconds: form.cue_end_text || null,
          primary_cue_instruction: form.cue_instruction || null,
          cue_notes_text: form.cue_notes_text || null,
          explanation_text: null,
          source_note: `Bank cue source: ${formatTrackLabel(selectedTrack)}`,
          publish,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to save question");

      const nextId = selectedId ?? Number(payload.id);
      await loadList();
      if (Number.isFinite(nextId) && nextId > 0) {
        await loadDetail(nextId);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  const archiveQuestion = async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/games/trivia/questions/${selectedId}/archive`, { method: "POST" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(payload.error ?? "Failed to archive question");
      return;
    }
    await loadList();
    await loadDetail(selectedId);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#0b3a31,transparent_45%),linear-gradient(180deg,#080808,#121212)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-emerald-900/45 bg-black/45 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Question Bank</p>
              <h1 className="text-3xl font-black uppercase text-emerald-100">Create Trivia Questions</h1>
              <p className="mt-1 text-sm text-stone-300">Simple flow: write question, set answer, pick vinyl cue, save.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link href="/admin/games/music-trivia" className="rounded border border-stone-700 px-3 py-1">Setup</Link>
              <Link href="/admin/games/music-trivia/decks" className="rounded border border-stone-700 px-3 py-1">Deck Builder</Link>
              <button className="rounded border border-emerald-700 px-3 py-1" onClick={resetForNew}>New Question</button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[340px,1fr]">
          <aside className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <div className="space-y-2 text-xs">
              <label className="block">
                Search
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Prompt or code" className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" />
              </label>
              <label className="block">
                Status
                <select value={statusFilter} onChange={(e) => setStatusFilter((e.target.value as "" | QuestionStatus) ?? "")} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1">
                  <option value="">All</option>
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="archived">archived</option>
                </select>
              </label>
              <button className="rounded border border-stone-700 px-2 py-1" onClick={loadList}>Refresh</button>
            </div>

            <div className="mt-3 max-h-[65vh] space-y-2 overflow-auto pr-1 text-xs">
              {loading ? <p className="text-stone-400">Loading...</p> : null}
              {sortedRows.map((row) => (
                <button key={row.id} onClick={() => loadDetail(row.id)} className={`w-full rounded border p-2 text-left ${row.id === selectedId ? "border-emerald-600 bg-emerald-950/20" : "border-stone-800 bg-stone-950/60"}`}>
                  <p className="font-semibold text-emerald-200">{row.question_code} - {row.status}</p>
                  <p className="mt-1 line-clamp-2 text-stone-200">{row.prompt_text}</p>
                  <p className="mt-1 text-[11px] text-stone-400">{row.default_category} - {row.default_difficulty.toUpperCase()} - {row.facets?.has_required_cue ? "cue ready" : "missing cue"}</p>
                </button>
              ))}
              {!loading && sortedRows.length === 0 ? <p className="text-stone-400">No questions found.</p> : null}
            </div>
          </aside>

          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-emerald-200">{selectedDetail ? `${selectedDetail.question_code} - ${selectedDetail.status}` : "New Question"}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <button className="rounded border border-emerald-700 px-3 py-1" disabled={saving} onClick={() => saveQuestion(false)}>{saving ? "Saving..." : "Save Draft"}</button>
                <button className="rounded border border-cyan-700 px-3 py-1" disabled={saving} onClick={() => saveQuestion(true)}>Publish</button>
                <button className="rounded border border-stone-700 px-3 py-1" disabled={!selectedId || saving} onClick={archiveQuestion}>Archive</button>
              </div>
            </div>

            <div className="grid gap-3 text-xs lg:grid-cols-2">
              <label className="block lg:col-span-2">Question (required)
                <textarea className="mt-1 h-24 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.question_text} onChange={(e) => setFormField("question_text", e.target.value)} />
              </label>
              <label className="block">Correct Answer (required)
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.correct_answer} onChange={(e) => setFormField("correct_answer", e.target.value)} />
              </label>
              <label className="block">Alternate Answers (comma)
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.alternate_answers_text} onChange={(e) => setFormField("alternate_answers_text", e.target.value)} />
              </label>
              <label className="block">Category
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.category} onChange={(e) => setFormField("category", e.target.value)} />
              </label>
              <label className="block">Difficulty
                <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.difficulty} onChange={(e) => setFormField("difficulty", (e.target.value as Difficulty) ?? "medium")}>
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
              </label>
              <label className="block lg:col-span-2">Tags (comma)
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.tags_text} onChange={(e) => setFormField("tags_text", e.target.value)} />
              </label>
            </div>

            <section className="mt-4 rounded border border-cyan-900/60 bg-cyan-950/20 p-3 text-xs">
              <p className="font-semibold text-cyan-200">Cue Source (required)</p>
              <div className="mt-2 grid gap-2 lg:grid-cols-[1fr,auto]">
                <input className="rounded border border-stone-700 bg-stone-950 px-2 py-1" value={inventoryQuery} onChange={(e) => setInventoryQuery(e.target.value)} placeholder="Search inventory by artist / album / title" onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchInventory();
                  }
                }} />
                <button className="rounded border border-cyan-700 px-3 py-1" disabled={searching} onClick={searchInventory}>{searching ? "Searching..." : "Search"}</button>
              </div>

              {inventoryResults.length > 0 ? (
                <div className="mt-2 max-h-44 overflow-auto rounded border border-stone-800 bg-stone-950/70 p-2">
                  {inventoryResults.map((track) => (
                    <button key={`${track.inventory_id}-${track.side ?? ""}-${track.position ?? ""}-${track.title}`} className="block w-full rounded px-2 py-1 text-left hover:bg-stone-800" onClick={() => setFormField("selected_track", track)}>
                      {track.artist} - {track.album} - {track.title}
                      {(track.side || track.position) ? ` (${[track.side, track.position].filter(Boolean).join(" ")})` : ""}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-2 grid gap-2 lg:grid-cols-3">
                <label>Start (m:ss)
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.cue_start_text} onChange={(e) => setFormField("cue_start_text", e.target.value)} />
                </label>
                <label>End (optional)
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.cue_end_text} onChange={(e) => setFormField("cue_end_text", e.target.value)} />
                </label>
                <label>Instruction
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.cue_instruction} onChange={(e) => setFormField("cue_instruction", e.target.value)} placeholder="Cue original at 1:23" />
                </label>
              </div>

              <label className="mt-2 block">Extra cue notes
                <textarea className="mt-1 h-16 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.cue_notes_text} onChange={(e) => setFormField("cue_notes_text", e.target.value)} placeholder="Play any song on album, start at 2:30" />
              </label>

              <div className="mt-2 rounded border border-cyan-800/70 bg-cyan-950/30 p-2">
                <p className="font-semibold uppercase tracking-wide text-cyan-200">Host Pull Card Preview</p>
                <p className="mt-1 text-stone-100">{formatTrackLabel(form.selected_track)}</p>
                <p className="mt-1 text-stone-200">Cue: {parseCueTimeToSeconds(form.cue_start_text) !== null ? formatSecondsClock(parseCueTimeToSeconds(form.cue_start_text)) : "--:--"}</p>
                {form.cue_instruction.trim() ? <p className="mt-1 text-stone-300">Instruction: {form.cue_instruction.trim()}</p> : null}
              </div>

              {validationMessage ? <p className="mt-2 text-amber-300">{validationMessage}</p> : null}
            </section>
          </section>
        </section>
      </div>
    </div>
  );
}
