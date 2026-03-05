"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatSecondsClock, parseCueTimeToSeconds } from "src/lib/triviaBank";

type QuestionStatus = "draft" | "published" | "archived";
type QuestionType = "free_response" | "multiple_choice" | "true_false" | "ordering";
type Difficulty = "easy" | "medium" | "hard";
type CueRole = "primary" | "any_album_track" | "original" | "cover" | "alt";

type CueSegmentDraft = {
  id: string;
  role: CueRole;
  track_label: string;
  start_time: string;
  end_time: string;
  instruction: string;
};

type QuestionAsset = {
  id: number;
  asset_role: "clue_primary" | "clue_secondary" | "answer_visual" | "explanation_media";
  asset_type: "image" | "audio" | "video";
  bucket: string;
  object_path: string;
  sort_order: number;
  mime_type: string | null;
};

type QuestionListRow = {
  id: number;
  question_code: string;
  status: QuestionStatus;
  question_type: QuestionType;
  prompt_text: string;
  answer_key: string;
  default_category: string;
  default_difficulty: Difficulty;
  updated_at: string;
  tags: string[];
  facets: {
    has_media?: boolean;
  } | null;
};

type QuestionDetail = {
  id: number;
  question_code: string;
  status: QuestionStatus;
  question_type: QuestionType;
  prompt_text: string;
  answer_key: string;
  accepted_answers: string[];
  options_payload: unknown;
  answer_payload: unknown;
  explanation_text: string | null;
  reveal_payload: unknown;
  default_category: string;
  default_difficulty: Difficulty;
  source_note: string | null;
  cue_notes_text: string | null;
  cue_payload: {
    segments?: Array<{
      role?: CueRole;
      track_label?: string | null;
      start_seconds?: number;
      end_seconds?: number | null;
      instruction?: string | null;
    }>;
  };
  tags: string[];
  facets: {
    era?: string | null;
    genre?: string | null;
    decade?: string | null;
    region?: string | null;
    language?: string | null;
    has_media?: boolean;
    difficulty?: Difficulty;
    category?: string;
  } | null;
  assets: QuestionAsset[];
};

type QuestionFormState = {
  status: QuestionStatus;
  question_type: QuestionType;
  prompt_text: string;
  answer_key: string;
  accepted_answers_text: string;
  options_payload_text: string;
  answer_payload_text: string;
  explanation_text: string;
  reveal_payload_text: string;
  default_category: string;
  default_difficulty: Difficulty;
  source_note: string;
  cue_notes_text: string;
  tags_text: string;
  facet_era: string;
  facet_genre: string;
  facet_decade: string;
  facet_region: string;
  facet_language: string;
  facet_has_media: boolean;
};

const DEFAULT_FORM: QuestionFormState = {
  status: "draft",
  question_type: "free_response",
  prompt_text: "",
  answer_key: "",
  accepted_answers_text: "",
  options_payload_text: "[]",
  answer_payload_text: "{}",
  explanation_text: "",
  reveal_payload_text: "{}",
  default_category: "General Music",
  default_difficulty: "medium",
  source_note: "",
  cue_notes_text: "",
  tags_text: "",
  facet_era: "",
  facet_genre: "",
  facet_decade: "",
  facet_region: "",
  facet_language: "",
  facet_has_media: false,
};

const CUE_ROLES: CueRole[] = ["primary", "any_album_track", "original", "cover", "alt"];

function nextCueSegmentDraft(): CueSegmentDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    role: "primary",
    track_label: "",
    start_time: "",
    end_time: "",
    instruction: "",
  };
}

function formatJsonText(value: unknown, fallback = "{}"): string {
  try {
    return JSON.stringify(value ?? JSON.parse(fallback), null, 2);
  } catch {
    return fallback;
  }
}

function parseJsonText(text: string, fallback: unknown): unknown {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback;
  }
}

function toCsv(values: string[]): string {
  return values.join(", ");
}

function fromCsv(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function toCueDrafts(detail: QuestionDetail | null): CueSegmentDraft[] {
  if (!detail?.cue_payload?.segments || !Array.isArray(detail.cue_payload.segments)) return [];

  return detail.cue_payload.segments.map((segment) => ({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    role: segment.role ?? "primary",
    track_label: segment.track_label ?? "",
    start_time: Number.isFinite(Number(segment.start_seconds)) ? String(segment.start_seconds) : "",
    end_time: Number.isFinite(Number(segment.end_seconds)) ? String(segment.end_seconds) : "",
    instruction: segment.instruction ?? "",
  }));
}

function mapDetailToForm(detail: QuestionDetail): QuestionFormState {
  return {
    status: detail.status,
    question_type: detail.question_type,
    prompt_text: detail.prompt_text,
    answer_key: detail.answer_key,
    accepted_answers_text: toCsv(detail.accepted_answers ?? []),
    options_payload_text: formatJsonText(detail.options_payload, "[]"),
    answer_payload_text: formatJsonText(detail.answer_payload, "{}"),
    explanation_text: detail.explanation_text ?? "",
    reveal_payload_text: formatJsonText(detail.reveal_payload, "{}"),
    default_category: detail.default_category,
    default_difficulty: detail.default_difficulty,
    source_note: detail.source_note ?? "",
    cue_notes_text: detail.cue_notes_text ?? "",
    tags_text: toCsv(detail.tags ?? []),
    facet_era: detail.facets?.era ?? "",
    facet_genre: detail.facets?.genre ?? "",
    facet_decade: detail.facets?.decade ?? "",
    facet_region: detail.facets?.region ?? "",
    facet_language: detail.facets?.language ?? "",
    facet_has_media: detail.facets?.has_media ?? (detail.assets?.length ?? 0) > 0,
  };
}

export default function MusicTriviaBankPage() {
  const [rows, setRows] = useState<QuestionListRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<QuestionDetail | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | QuestionStatus>("");

  const [form, setForm] = useState<QuestionFormState>(DEFAULT_FORM);
  const [cueSegments, setCueSegments] = useState<CueSegmentDraft[]>([]);

  const [assetRole, setAssetRole] = useState<QuestionAsset["asset_role"]>("clue_primary");
  const [assetType, setAssetType] = useState<QuestionAsset["asset_type"]>("image");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    setCueSegments(toCueDrafts(payload));
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [rows]
  );

  const cueValidationMessage = useMemo(() => {
    for (const row of cueSegments) {
      if (!row.start_time.trim()) continue;

      const start = parseCueTimeToSeconds(row.start_time);
      if (start === null) return "Cue start time is invalid. Use seconds or m:ss.";

      if (row.end_time.trim()) {
        const end = parseCueTimeToSeconds(row.end_time);
        if (end === null) return "Cue end time is invalid. Use seconds or m:ss.";
        if (end < start) return "Cue end time cannot be earlier than start time.";
      }
    }

    return null;
  }, [cueSegments]);

  const resetForNew = () => {
    setSelectedId(null);
    setSelectedDetail(null);
    setForm(DEFAULT_FORM);
    setCueSegments([]);
  };

  const setFormField = <K extends keyof QuestionFormState>(key: K, value: QuestionFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveQuestion = async () => {
    if (!form.prompt_text.trim() || !form.answer_key.trim()) {
      alert("Prompt and answer key are required.");
      return;
    }
    if (cueValidationMessage) {
      alert(cueValidationMessage);
      return;
    }

    setSaving(true);
    try {
      const cueSegmentsPayload = cueSegments
        .filter((segment) => segment.start_time.trim().length > 0)
        .map((segment) => ({
          role: segment.role,
          track_label: segment.track_label.trim() || null,
          start_seconds: segment.start_time.trim(),
          end_seconds: segment.end_time.trim() || null,
          instruction: segment.instruction.trim() || null,
        }));

      const body = {
        status: form.status,
        question_type: form.question_type,
        prompt_text: form.prompt_text,
        answer_key: form.answer_key,
        accepted_answers: fromCsv(form.accepted_answers_text),
        options_payload: parseJsonText(form.options_payload_text, []),
        answer_payload: parseJsonText(form.answer_payload_text, {}),
        explanation_text: form.explanation_text || null,
        reveal_payload: parseJsonText(form.reveal_payload_text, {}),
        default_category: form.default_category,
        default_difficulty: form.default_difficulty,
        source_note: form.source_note || null,
        cue_notes_text: form.cue_notes_text || null,
        cue_payload: {
          segments: cueSegmentsPayload,
        },
        tags: fromCsv(form.tags_text),
        era: form.facet_era || null,
        genre: form.facet_genre || null,
        decade: form.facet_decade || null,
        region: form.facet_region || null,
        language: form.facet_language || null,
        has_media: form.facet_has_media,
        facet_difficulty: form.default_difficulty,
        facet_category: form.default_category,
      };

      const endpoint = selectedId ? `/api/games/trivia/questions/${selectedId}` : "/api/games/trivia/questions";
      const method = selectedId ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to save question");

      const nextId = selectedId ?? payload.id;
      await loadList();
      if (Number.isFinite(Number(nextId))) {
        await loadDetail(Number(nextId));
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (nextStatus: "published" | "archived") => {
    if (!selectedId) return;
    const endpoint = `/api/games/trivia/questions/${selectedId}/${nextStatus === "published" ? "publish" : "archive"}`;

    const res = await fetch(endpoint, { method: "POST" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(payload.error ?? "Failed to update status");
      return;
    }

    await loadList();
    await loadDetail(selectedId);
  };

  const uploadAsset = async () => {
    if (!selectedId) {
      alert("Save the question first, then upload assets.");
      return;
    }
    if (!uploadFile) {
      alert("Choose a file to upload.");
      return;
    }

    setUploading(true);
    try {
      const tokenRes = await fetch("/api/games/trivia/assets/upload-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: selectedId,
          filename: uploadFile.name,
          asset_type: assetType,
        }),
      });
      const tokenPayload = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenPayload.error ?? "Failed to create upload token");

      const uploadRes = await fetch(tokenPayload.signed_url as string, {
        method: "PUT",
        headers: {
          "Content-Type": uploadFile.type || "application/octet-stream",
        },
        body: uploadFile,
      });
      if (!uploadRes.ok) throw new Error("Failed to upload asset");

      const attachRes = await fetch(`/api/games/trivia/questions/${selectedId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_role: assetRole,
          asset_type: assetType,
          bucket: tokenPayload.bucket,
          object_path: tokenPayload.object_path,
          mime_type: uploadFile.type || null,
          sort_order: selectedDetail?.assets?.length ?? 0,
        }),
      });
      const attachPayload = await attachRes.json().catch(() => ({}));
      if (!attachRes.ok) throw new Error(attachPayload.error ?? "Failed to attach asset");

      setUploadFile(null);
      await loadDetail(selectedId);
      await loadList();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeAsset = async (assetId: number) => {
    if (!selectedId) return;

    const res = await fetch(`/api/games/trivia/questions/${selectedId}/assets/${assetId}`, {
      method: "DELETE",
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(payload.error ?? "Failed to delete asset");
      return;
    }

    await loadDetail(selectedId);
    await loadList();
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#0b3a31,transparent_45%),linear-gradient(180deg,#080808,#121212)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-emerald-900/45 bg-black/45 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Trivia Bank</p>
              <h1 className="text-3xl font-black uppercase text-emerald-100">Question Bank</h1>
              <p className="mt-1 text-sm text-stone-300">Reusable multimedia questions with cue notes, facets, and tags.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link href="/admin/games/music-trivia" className="rounded border border-stone-700 px-3 py-1">Setup</Link>
              <Link href="/admin/games/music-trivia/decks" className="rounded border border-stone-700 px-3 py-1">Deck Builder</Link>
              <button className="rounded border border-emerald-700 px-3 py-1" onClick={resetForNew}>New Question</button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[360px,1fr]">
          <aside className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <div className="space-y-2 text-xs">
              <label className="block">
                Search
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Prompt, source note, code"
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                />
              </label>
              <label className="block">
                Status
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter((e.target.value as "" | QuestionStatus) ?? "")}
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                >
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
                <button
                  key={row.id}
                  onClick={() => loadDetail(row.id)}
                  className={`w-full rounded border p-2 text-left ${row.id === selectedId ? "border-emerald-600 bg-emerald-950/20" : "border-stone-800 bg-stone-950/60"}`}
                >
                  <p className="font-semibold text-emerald-200">{row.question_code} · {row.status}</p>
                  <p className="mt-1 line-clamp-2 text-stone-200">{row.prompt_text}</p>
                  <p className="mt-1 text-[11px] text-stone-400">{row.default_category} · {row.default_difficulty.toUpperCase()} · {row.question_type}</p>
                </button>
              ))}
              {!loading && sortedRows.length === 0 ? <p className="text-stone-400">No questions found.</p> : null}
            </div>
          </aside>

          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-emerald-200">
                {selectedDetail ? `${selectedDetail.question_code} · ${selectedDetail.status}` : "New Question"}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <button className="rounded border border-emerald-700 px-3 py-1" onClick={saveQuestion} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
                <button className="rounded border border-stone-700 px-3 py-1" onClick={() => changeStatus("published")} disabled={!selectedId}>Publish</button>
                <button className="rounded border border-stone-700 px-3 py-1" onClick={() => changeStatus("archived")} disabled={!selectedId}>Archive</button>
              </div>
            </div>

            <div className="grid gap-3 text-xs lg:grid-cols-2">
              <label className="block lg:col-span-2">
                Prompt
                <textarea className="mt-1 h-20 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.prompt_text} onChange={(e) => setFormField("prompt_text", e.target.value)} />
              </label>

              <label className="block">
                Question Type
                <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.question_type} onChange={(e) => setFormField("question_type", (e.target.value as QuestionType) ?? "free_response")}>
                  <option value="free_response">free_response</option>
                  <option value="multiple_choice">multiple_choice</option>
                  <option value="true_false">true_false</option>
                  <option value="ordering">ordering</option>
                </select>
              </label>

              <label className="block">
                Status
                <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.status} onChange={(e) => setFormField("status", (e.target.value as QuestionStatus) ?? "draft")}>
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="archived">archived</option>
                </select>
              </label>

              <label className="block">
                Answer Key
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.answer_key} onChange={(e) => setFormField("answer_key", e.target.value)} />
              </label>

              <label className="block">
                Accepted Answers (comma)
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.accepted_answers_text} onChange={(e) => setFormField("accepted_answers_text", e.target.value)} />
              </label>

              <label className="block">
                Category
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.default_category} onChange={(e) => setFormField("default_category", e.target.value)} />
              </label>

              <label className="block">
                Difficulty
                <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.default_difficulty} onChange={(e) => setFormField("default_difficulty", (e.target.value as Difficulty) ?? "medium")}>
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
              </label>

              <label className="block lg:col-span-2">
                Tags (comma)
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.tags_text} onChange={(e) => setFormField("tags_text", e.target.value)} />
              </label>

              <label className="block lg:col-span-2">
                Source Note
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.source_note} onChange={(e) => setFormField("source_note", e.target.value)} />
              </label>
            </div>

            <div className="mt-4 grid gap-3 text-xs lg:grid-cols-2">
              <label className="block">
                Facet Era
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.facet_era} onChange={(e) => setFormField("facet_era", e.target.value)} />
              </label>
              <label className="block">
                Facet Genre
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.facet_genre} onChange={(e) => setFormField("facet_genre", e.target.value)} />
              </label>
              <label className="block">
                Facet Decade
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.facet_decade} onChange={(e) => setFormField("facet_decade", e.target.value)} />
              </label>
              <label className="block">
                Facet Region
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.facet_region} onChange={(e) => setFormField("facet_region", e.target.value)} />
              </label>
              <label className="block">
                Facet Language
                <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.facet_language} onChange={(e) => setFormField("facet_language", e.target.value)} />
              </label>
              <label className="inline-flex items-center gap-2 pt-5">
                <input type="checkbox" checked={form.facet_has_media} onChange={(e) => setFormField("facet_has_media", e.target.checked)} />
                has_media
              </label>
            </div>

            <div className="mt-4 grid gap-3 text-xs lg:grid-cols-2">
              <label className="block">
                Options Payload (JSON)
                <textarea className="mt-1 h-28 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1 font-mono" value={form.options_payload_text} onChange={(e) => setFormField("options_payload_text", e.target.value)} />
              </label>
              <label className="block">
                Answer Payload (JSON)
                <textarea className="mt-1 h-28 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1 font-mono" value={form.answer_payload_text} onChange={(e) => setFormField("answer_payload_text", e.target.value)} />
              </label>
              <label className="block lg:col-span-2">
                Reveal Payload (JSON)
                <textarea className="mt-1 h-28 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1 font-mono" value={form.reveal_payload_text} onChange={(e) => setFormField("reveal_payload_text", e.target.value)} />
              </label>
              <label className="block lg:col-span-2">
                Explanation
                <textarea className="mt-1 h-20 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.explanation_text} onChange={(e) => setFormField("explanation_text", e.target.value)} />
              </label>
            </div>

            <section className="mt-5 rounded border border-emerald-900/40 bg-emerald-950/10 p-3 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-emerald-200">Cue Composer</p>
                <button className="rounded border border-emerald-700 px-2 py-1" onClick={() => setCueSegments((current) => [...current, nextCueSegmentDraft()])}>Add Segment</button>
              </div>

              <label className="mt-2 block">
                Cue Notes (host-facing)
                <textarea className="mt-1 h-16 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.cue_notes_text} onChange={(e) => setFormField("cue_notes_text", e.target.value)} placeholder="Play any song on album, start at 2:30." />
              </label>

              <div className="mt-2 space-y-2">
                {cueSegments.map((segment, index) => {
                  const startSeconds = parseCueTimeToSeconds(segment.start_time);
                  const endSeconds = parseCueTimeToSeconds(segment.end_time);

                  return (
                    <div key={segment.id} className="grid gap-2 rounded border border-stone-800 bg-stone-950/70 p-2 lg:grid-cols-[100px,1.2fr,120px,120px,1.4fr,auto]">
                      <label className="block">
                        Role
                        <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={segment.role} onChange={(e) => setCueSegments((current) => current.map((row) => row.id === segment.id ? { ...row, role: (e.target.value as CueRole) ?? "primary" } : row))}>
                          {CUE_ROLES.map((role) => (<option key={role} value={role}>{role}</option>))}
                        </select>
                      </label>
                      <label className="block">
                        Track Label
                        <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={segment.track_label} onChange={(e) => setCueSegments((current) => current.map((row) => row.id === segment.id ? { ...row, track_label: e.target.value } : row))} />
                      </label>
                      <label className="block">
                        Start
                        <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={segment.start_time} onChange={(e) => setCueSegments((current) => current.map((row) => row.id === segment.id ? { ...row, start_time: e.target.value } : row))} placeholder="2:30" />
                        <p className="mt-1 text-[10px] text-stone-500">{startSeconds === null ? "-" : formatSecondsClock(startSeconds)}</p>
                      </label>
                      <label className="block">
                        End
                        <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={segment.end_time} onChange={(e) => setCueSegments((current) => current.map((row) => row.id === segment.id ? { ...row, end_time: e.target.value } : row))} placeholder="3:05" />
                        <p className="mt-1 text-[10px] text-stone-500">{endSeconds === null ? "-" : formatSecondsClock(endSeconds)}</p>
                      </label>
                      <label className="block">
                        Instruction
                        <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={segment.instruction} onChange={(e) => setCueSegments((current) => current.map((row) => row.id === segment.id ? { ...row, instruction: e.target.value } : row))} placeholder="Cue original at 1:23" />
                      </label>
                      <div className="pt-5">
                        <button className="rounded border border-stone-700 px-2 py-1" onClick={() => setCueSegments((current) => current.filter((row) => row.id !== segment.id))}>Remove</button>
                        <p className="mt-1 text-[10px] text-stone-500">#{index + 1}</p>
                      </div>
                    </div>
                  );
                })}
                {cueSegments.length === 0 ? <p className="text-stone-500">No cue segments yet.</p> : null}
              </div>
              {cueValidationMessage ? <p className="mt-2 text-amber-300">{cueValidationMessage}</p> : null}
            </section>

            <section className="mt-5 rounded border border-cyan-900/45 bg-cyan-950/10 p-3 text-xs">
              <p className="font-semibold text-cyan-200">Assets</p>
              <div className="mt-2 grid gap-2 lg:grid-cols-[150px,120px,1fr,auto]">
                <label className="block">
                  Role
                  <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={assetRole} onChange={(e) => setAssetRole((e.target.value as QuestionAsset["asset_role"]) ?? "clue_primary")}>
                    <option value="clue_primary">clue_primary</option>
                    <option value="clue_secondary">clue_secondary</option>
                    <option value="answer_visual">answer_visual</option>
                    <option value="explanation_media">explanation_media</option>
                  </select>
                </label>
                <label className="block">
                  Type
                  <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={assetType} onChange={(e) => setAssetType((e.target.value as QuestionAsset["asset_type"]) ?? "image")}>
                    <option value="image">image</option>
                    <option value="audio">audio</option>
                    <option value="video">video</option>
                  </select>
                </label>
                <label className="block">
                  File
                  <input type="file" className="mt-1 w-full text-xs" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                </label>
                <div className="pt-5">
                  <button className="rounded border border-cyan-700 px-3 py-1" disabled={uploading || !selectedId} onClick={uploadAsset}>
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {(selectedDetail?.assets ?? []).map((asset) => (
                  <div key={asset.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-stone-800 bg-stone-950/70 px-2 py-1">
                    <div>
                      <p className="text-stone-200">#{asset.id} · {asset.asset_role} · {asset.asset_type}</p>
                      <p className="text-[11px] text-stone-500">{asset.bucket}/{asset.object_path}</p>
                    </div>
                    <button className="rounded border border-stone-700 px-2 py-1" onClick={() => removeAsset(asset.id)}>Delete</button>
                  </div>
                ))}
                {(selectedDetail?.assets?.length ?? 0) === 0 ? <p className="text-stone-500">No assets attached.</p> : null}
              </div>
            </section>
          </section>
        </section>
      </div>
    </div>
  );
}
