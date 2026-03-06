"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatSecondsClock, parseCueTimeToSeconds } from "src/lib/triviaBank";

type QuestionStatus = "draft" | "published" | "archived";
type Difficulty = "easy" | "medium" | "hard";
type CueSourceType = "inventory_track" | "uploaded_clip";
type TriviaAssetRole = "clue_primary" | "clue_secondary" | "answer_visual" | "explanation_media";
type TriviaAssetType = "image" | "audio" | "video";

type InventoryTrackResult = {
  inventory_id: number;
  release_id: number | null;
  release_track_id: number | null;
  artist: string;
  album: string;
  title: string;
  side: string | null;
  position: string | null;
  track_key?: string | null;
  score?: number | null;
};

type TriviaQuestionAsset = {
  id: number;
  asset_role: TriviaAssetRole;
  asset_type: TriviaAssetType;
  bucket: string;
  object_path: string;
  mime_type?: string | null;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  sort_order: number;
  created_at?: string;
};

type QuestionListRow = {
  id: number;
  question_code: string;
  status: QuestionStatus;
  prompt_text: string;
  default_category: string;
  default_difficulty: Difficulty;
  updated_at: string;
  tags?: string[];
  facets: {
    has_required_cue?: boolean;
    has_media?: boolean;
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
  cue_source_type: CueSourceType | null;
  cue_source_payload: Record<string, unknown>;
  primary_cue_start_seconds: number | null;
  primary_cue_end_seconds: number | null;
  primary_cue_instruction: string | null;
  cue_notes_text: string | null;
  assets: TriviaQuestionAsset[];
};

type TaxonomyPayload = {
  categories?: string[];
  tags?: string[];
};

type FormState = {
  question_text: string;
  correct_answer: string;
  alternate_answers_text: string;
  category: string;
  difficulty: Difficulty;
  selected_tags: string[];
  cue_source_mode: CueSourceType;
  cue_start_text: string;
  cue_end_text: string;
  cue_instruction: string;
  cue_notes_text: string;
  selected_track: InventoryTrackResult | null;
  selected_clip_asset_id: number | null;
};

const DEFAULT_FORM: FormState = {
  question_text: "",
  correct_answer: "",
  alternate_answers_text: "",
  category: "General Music",
  difficulty: "medium",
  selected_tags: [],
  cue_source_mode: "inventory_track",
  cue_start_text: "0:30",
  cue_end_text: "",
  cue_instruction: "",
  cue_notes_text: "",
  selected_track: null,
  selected_clip_asset_id: null,
};

const DIFFICULTY_OPTIONS: Difficulty[] = ["easy", "medium", "hard"];
const ASSET_ROLE_OPTIONS: Array<{ value: TriviaAssetRole; label: string }> = [
  { value: "clue_primary", label: "Primary clue" },
  { value: "clue_secondary", label: "Secondary clue" },
  { value: "answer_visual", label: "Answer visual" },
  { value: "explanation_media", label: "Explanation media" },
];

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

function inferAssetType(file: File): TriviaAssetType {
  const mime = file.type.toLowerCase();
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "image";
}

function parseNumericId(value: unknown): number | null {
  const typed = Number(value);
  if (!Number.isFinite(typed) || typed <= 0) return null;
  return typed;
}

function mapDetailToForm(detail: QuestionDetail): FormState {
  const payload = detail.cue_source_payload && typeof detail.cue_source_payload === "object"
    ? detail.cue_source_payload
    : {};

  const selectedTrack: InventoryTrackResult | null = detail.cue_source_type === "inventory_track"
    ? {
        inventory_id: Number(payload.inventory_id),
        release_id: parseNumericId(payload.release_id),
        release_track_id: parseNumericId(payload.release_track_id),
        artist: typeof payload.artist === "string" ? payload.artist : "",
        album: typeof payload.album === "string" ? payload.album : "",
        title: typeof payload.title === "string" ? payload.title : "",
        side: typeof payload.side === "string" ? payload.side : null,
        position: typeof payload.position === "string" ? payload.position : null,
      }
    : null;

  const clipAssetIdFromPayload = parseNumericId(payload.asset_id);
  const clipPathFromPayload = typeof payload.object_path === "string" ? payload.object_path : "";
  const selectedClipAsset = clipAssetIdFromPayload
    ? detail.assets.find((asset) => asset.id === clipAssetIdFromPayload)
    : detail.assets.find((asset) => clipPathFromPayload && asset.object_path === clipPathFromPayload);

  const alternateAnswers = (detail.accepted_answers ?? []).filter((answer) => answer !== detail.answer_key);

  return {
    question_text: detail.prompt_text,
    correct_answer: detail.answer_key,
    alternate_answers_text: alternateAnswers.join("\n"),
    category: detail.default_category,
    difficulty: detail.default_difficulty,
    selected_tags: detail.tags ?? [],
    cue_source_mode: detail.cue_source_type ?? "inventory_track",
    cue_start_text: detail.primary_cue_start_seconds !== null ? formatSecondsClock(detail.primary_cue_start_seconds) : "",
    cue_end_text: detail.primary_cue_end_seconds !== null ? formatSecondsClock(detail.primary_cue_end_seconds) : "",
    cue_instruction: detail.primary_cue_instruction ?? "",
    cue_notes_text: detail.cue_notes_text ?? "",
    selected_track: selectedTrack,
    selected_clip_asset_id: selectedClipAsset?.id ?? null,
  };
}

export default function MusicTriviaBankPage() {
  const [rows, setRows] = useState<QuestionListRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<QuestionDetail | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | QuestionStatus>("");

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [tagSearch, setTagSearch] = useState("");

  const [taxonomyCategories, setTaxonomyCategories] = useState<string[]>(["General Music"]);
  const [taxonomyTags, setTaxonomyTags] = useState<string[]>([]);

  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryLimitText, setInventoryLimitText] = useState("");
  const [inventoryResults, setInventoryResults] = useState<InventoryTrackResult[]>([]);

  const [assetRoleDraft, setAssetRoleDraft] = useState<TriviaAssetRole>("clue_primary");

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const inventorySearchRequestRef = useRef(0);

  const setFormField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const categoryOptions = useMemo(() => {
    const values = new Set(taxonomyCategories);
    if (form.category.trim()) values.add(form.category.trim());
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [form.category, taxonomyCategories]);

  const tagOptions = useMemo(() => {
    const values = new Set(taxonomyTags);
    for (const tag of form.selected_tags) values.add(tag);
    const sorted = Array.from(values).sort((a, b) => a.localeCompare(b));
    const query = tagSearch.trim().toLowerCase();
    if (!query) return sorted;
    return sorted.filter((tag) => tag.toLowerCase().includes(query));
  }, [form.selected_tags, tagSearch, taxonomyTags]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [rows]
  );

  const clipCueAssetOptions = useMemo(
    () => (selectedDetail?.assets ?? []).filter((asset) => asset.asset_type === "audio" || asset.asset_type === "video"),
    [selectedDetail?.assets]
  );

  const selectedClipCueAsset = useMemo(
    () => clipCueAssetOptions.find((asset) => asset.id === form.selected_clip_asset_id) ?? null,
    [clipCueAssetOptions, form.selected_clip_asset_id]
  );

  const validationMessage = useMemo(() => {
    if (!form.question_text.trim()) return "Question text is required.";
    if (!form.correct_answer.trim()) return "Correct answer is required.";

    const startSeconds = parseCueTimeToSeconds(form.cue_start_text);
    if (startSeconds === null) return "Cue start time is required (use m:ss).";

    if (form.cue_end_text.trim()) {
      const endSeconds = parseCueTimeToSeconds(form.cue_end_text);
      if (endSeconds === null) return "Cue end time is invalid.";
      if (endSeconds < startSeconds) return "Cue end time must be after cue start time.";
    }

    if (form.cue_source_mode === "inventory_track") {
      if (!form.selected_track) return "Pick a vinyl track for cue source.";
      return null;
    }

    if (!selectedId) return "Save this question first, then attach and select a clip cue.";
    if (!form.selected_clip_asset_id) return "Select an uploaded audio/video clip for cue source.";
    return null;
  }, [form, selectedId]);

  const loadTaxonomy = useCallback(async () => {
    try {
      const res = await fetch("/api/games/trivia/questions/options");
      if (!res.ok) return;
      const payload = (await res.json()) as TaxonomyPayload;
      const categories = Array.isArray(payload.categories) ? payload.categories.filter(Boolean) : [];
      const tags = Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : [];
      if (categories.length > 0) setTaxonomyCategories(Array.from(new Set(["General Music", ...categories])));
      if (tags.length > 0) setTaxonomyTags(Array.from(new Set(tags)));
    } catch {
      // No-op; bank still works with defaults.
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "250");

      const res = await fetch(`/api/games/trivia/questions?${params.toString()}`);
      if (!res.ok) return;

      const payload = await res.json();
      setRows(Array.isArray(payload.data) ? payload.data : []);
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
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadTaxonomy();
  }, [loadTaxonomy]);

  const resetForNew = () => {
    setSelectedId(null);
    setSelectedDetail(null);
    setForm(DEFAULT_FORM);
    setTagSearch("");
    setInventoryQuery("");
    setInventoryResults([]);
  };

  const searchInventory = useCallback(async (queryOverride?: string) => {
    const query = (queryOverride ?? inventoryQuery).trim();
    if (!query) {
      inventorySearchRequestRef.current += 1;
      setInventoryResults([]);
      return;
    }

    const params = new URLSearchParams({ q: query });
    const requestedLimit = Number(inventoryLimitText);
    if (Number.isFinite(requestedLimit) && requestedLimit > 0) {
      params.set("limit", String(Math.floor(requestedLimit)));
    }

    const requestId = inventorySearchRequestRef.current + 1;
    inventorySearchRequestRef.current = requestId;
    setSearching(true);
    try {
      const res = await fetch(`/api/games/trivia/inventory-search?${params.toString()}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Search failed");
      if (inventorySearchRequestRef.current === requestId) {
        setInventoryResults(Array.isArray(payload.data) ? payload.data : []);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Search failed");
      if (inventorySearchRequestRef.current === requestId) {
        setInventoryResults([]);
      }
    } finally {
      if (inventorySearchRequestRef.current === requestId) {
        setSearching(false);
      }
    }
  }, [inventoryLimitText, inventoryQuery]);

  useEffect(() => {
    const query = inventoryQuery.trim();
    if (!query) {
      inventorySearchRequestRef.current += 1;
      setSearching(false);
      setInventoryResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void searchInventory(query);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [inventoryQuery, searchInventory]);

  const saveQuestion = async (publish: boolean) => {
    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    const cueSourceMode = form.cue_source_mode;
    const selectedTrack = form.selected_track;
    const selectedClip = selectedClipCueAsset;

    const cueSourcePayload = cueSourceMode === "inventory_track"
      ? {
          inventory_id: selectedTrack?.inventory_id,
          release_id: selectedTrack?.release_id,
          release_track_id: selectedTrack?.release_track_id,
          artist: selectedTrack?.artist,
          album: selectedTrack?.album,
          title: selectedTrack?.title,
          side: selectedTrack?.side,
          position: selectedTrack?.position,
        }
      : {
          asset_id: selectedClip?.id,
          bucket: selectedClip?.bucket,
          object_path: selectedClip?.object_path,
        };

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
          tags: form.selected_tags,
          cue_source_type: cueSourceMode,
          cue_source_payload: cueSourcePayload,
          primary_cue_start_seconds: form.cue_start_text,
          primary_cue_end_seconds: form.cue_end_text || null,
          primary_cue_instruction: form.cue_instruction || null,
          cue_notes_text: form.cue_notes_text || null,
          explanation_text: null,
          source_note: cueSourceMode === "inventory_track"
            ? `Bank cue source: ${formatTrackLabel(selectedTrack)}`
            : `Bank cue source: uploaded clip ${selectedClip?.object_path ?? ""}`,
          publish,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to save question");

      const nextId = selectedId ?? Number(payload.id);
      await Promise.all([loadList(), loadTaxonomy()]);
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

  const uploadAssets = async (files: FileList | null) => {
    if (!selectedId) {
      alert("Save the question first, then upload media.");
      return;
    }
    if (!files || files.length === 0) return;

    setUploadingAssets(true);
    try {
      for (const file of Array.from(files)) {
        const assetType = inferAssetType(file);

        const tokenRes = await fetch("/api/games/trivia/assets/upload-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_id: selectedId,
            filename: file.name,
            asset_type: assetType,
          }),
        });
        const tokenPayload = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok) throw new Error(tokenPayload.error ?? `Unable to prepare upload for ${file.name}`);

        const uploadRes = await fetch(String(tokenPayload.signed_url), {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });
        if (!uploadRes.ok) {
          throw new Error(`Upload failed for ${file.name}`);
        }

        const attachRes = await fetch(`/api/games/trivia/questions/${selectedId}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_role: assetRoleDraft,
            asset_type: assetType,
            bucket: tokenPayload.bucket,
            object_path: tokenPayload.object_path,
            mime_type: file.type || null,
          }),
        });

        const attachPayload = await attachRes.json().catch(() => ({}));
        if (!attachRes.ok) throw new Error(attachPayload.error ?? `Failed to attach ${file.name}`);
      }

      await loadDetail(selectedId);
      await loadList();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to upload media");
    } finally {
      setUploadingAssets(false);
    }
  };

  const removeAsset = async (assetId: number) => {
    if (!selectedId) return;
    const yes = confirm("Remove this media file from the question?");
    if (!yes) return;

    const res = await fetch(`/api/games/trivia/questions/${selectedId}/assets/${assetId}`, { method: "DELETE" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(payload.error ?? "Failed to remove media");
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
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Question Bank</p>
              <h1 className="text-3xl font-black uppercase text-emerald-100">Create Trivia Questions</h1>
              <p className="mt-1 text-sm text-stone-300">Simple flow: write question, set answer, pick vinyl cue, upload media, save.</p>
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
                  placeholder="Prompt, answer, source note, or code"
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                />
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

            <div className="mt-3 max-h-[70vh] space-y-2 overflow-auto pr-1 text-xs">
              {loading ? <p className="text-stone-400">Loading...</p> : null}
              {sortedRows.map((row) => (
                <button key={row.id} onClick={() => loadDetail(row.id)} className={`w-full rounded border p-2 text-left ${row.id === selectedId ? "border-emerald-600 bg-emerald-950/20" : "border-stone-800 bg-stone-950/60"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-emerald-200">{row.question_code}</p>
                    <p className="rounded bg-stone-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone-300">{row.status}</p>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-stone-100">{row.prompt_text}</p>
                  <p className="mt-1 text-[11px] text-stone-300">{row.default_category} | {row.default_difficulty.toUpperCase()}</p>
                  <p className="mt-1 text-[11px] text-stone-400">
                    Cue: {row.facets?.has_required_cue ? "ready" : "missing"}
                    {" · "}
                    Media: {row.facets?.has_media ? "attached" : "none"}
                  </p>
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
                <textarea className="mt-1 h-28 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.question_text} onChange={(e) => setFormField("question_text", e.target.value)} />
              </label>

              <label className="block">Correct Answer (required)
                <textarea className="mt-1 h-16 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.correct_answer} onChange={(e) => setFormField("correct_answer", e.target.value)} />
              </label>

              <label className="block">Alternate Answers (one per line or comma-separated)
                <textarea className="mt-1 h-16 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.alternate_answers_text} onChange={(e) => setFormField("alternate_answers_text", e.target.value)} />
              </label>

              <label className="block">Category
                <div className="mt-1">
                  <select className="rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.category} onChange={(e) => setFormField("category", e.target.value)}>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="block">Difficulty
                <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.difficulty} onChange={(e) => setFormField("difficulty", (e.target.value as Difficulty) ?? "medium")}>
                  {DIFFICULTY_OPTIONS.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>{difficulty}</option>
                  ))}
                </select>
              </label>

              <div className="block lg:col-span-2">
                <p>Tags (collection master tags)</p>
                <div className="mt-1 grid gap-2 lg:grid-cols-[1fr,1fr]">
                  <div>
                    <input
                      className="w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      placeholder="Filter tags"
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                    />
                    <select
                      multiple
                      size={6}
                      className="mt-1 h-32 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={form.selected_tags}
                      onChange={(event) => {
                        const values = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                        const hiddenSelections = form.selected_tags.filter((tag) => !tagOptions.includes(tag));
                        setFormField("selected_tags", Array.from(new Set([...hiddenSelections, ...values])));
                      }}
                    >
                      {tagOptions.map((tag) => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                    {tagOptions.length === 0 ? <p className="mt-1 text-[11px] text-amber-300">No master tags found yet.</p> : null}
                  </div>
                  <div>
                    <div className="rounded border border-stone-700 bg-stone-950/60 p-2">
                      <p className="text-[11px] uppercase tracking-wide text-stone-400">Selected tags</p>
                      <div className="mt-2 flex min-h-12 flex-wrap gap-1">
                        {form.selected_tags.length === 0 ? <span className="text-stone-500">No tags selected</span> : null}
                        {form.selected_tags.map((tag) => (
                          <button key={tag} className="rounded border border-cyan-700 bg-cyan-950/40 px-2 py-0.5 text-[11px]" onClick={() => setFormField("selected_tags", form.selected_tags.filter((value) => value !== tag))}>
                            {tag} ×
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <section className="mt-4 rounded border border-cyan-900/60 bg-cyan-950/20 p-3 text-xs">
              <p className="font-semibold text-cyan-200">Cue Source (required)</p>

              <label className="mt-2 block">
                Cue source type
                <select
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                  value={form.cue_source_mode}
                  onChange={(e) => setFormField("cue_source_mode", (e.target.value as CueSourceType) ?? "inventory_track")}
                >
                  <option value="inventory_track">Vinyl inventory track (default)</option>
                  <option value="uploaded_clip">Uploaded clip (fallback)</option>
                </select>
              </label>

              {form.cue_source_mode === "inventory_track" ? (
                <div className="mt-2 space-y-2">
                  <div className="grid gap-2 lg:grid-cols-[1fr,120px,auto]">
                    <input
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={inventoryQuery}
                      onChange={(e) => setInventoryQuery(e.target.value)}
                      placeholder="Search inventory by artist / album / title"
                    />
                    <input
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1"
                      value={inventoryLimitText}
                      onChange={(e) => setInventoryLimitText(e.target.value)}
                      placeholder="No limit"
                      inputMode="numeric"
                    />
                    <button
                      className="rounded border border-cyan-700 px-3 py-1"
                      disabled={searching}
                      onClick={() => {
                        void searchInventory(inventoryQuery);
                      }}
                    >
                      {searching ? "Searching..." : "Refresh"}
                    </button>
                  </div>

                  <p className="text-[11px] text-cyan-100/70">Live search uses the collection index as you type. Set an optional result limit or leave it blank.</p>

                  {inventoryResults.length > 0 ? (
                    <div className="max-h-56 overflow-auto rounded border border-stone-800 bg-stone-950/70">
                      {inventoryResults.map((track) => {
                        const isSelected = form.selected_track
                          && form.selected_track.inventory_id === track.inventory_id
                          && form.selected_track.title === track.title
                          && form.selected_track.position === track.position;
                        return (
                          <button
                            key={`${track.inventory_id}-${track.track_key ?? ""}-${track.title}-${track.position ?? ""}`}
                            className={`block w-full border-b border-stone-900 px-2 py-2 text-left last:border-b-0 ${isSelected ? "bg-cyan-900/30" : "hover:bg-stone-800"}`}
                            onClick={() => setFormField("selected_track", track)}
                          >
                            <p className="truncate text-stone-100">
                              {track.artist || "-"} | {track.album || "-"} | {track.title || "-"} | {(track.position || track.side || "-").toUpperCase()} | #{track.inventory_id}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 space-y-2 rounded border border-stone-800 bg-stone-950/40 p-2">
                  {selectedId ? null : <p className="text-amber-300">Save this question first, then upload a clip and select it here.</p>}
                  {clipCueAssetOptions.length === 0 ? <p className="text-stone-400">No audio/video assets uploaded yet.</p> : null}
                  {clipCueAssetOptions.map((asset) => (
                    <label key={asset.id} className="flex items-start gap-2 rounded border border-stone-800 p-2">
                      <input
                        type="radio"
                        name="uploaded_clip_cue"
                        checked={form.selected_clip_asset_id === asset.id}
                        onChange={() => setFormField("selected_clip_asset_id", asset.id)}
                      />
                      <span>
                        <span className="block text-stone-100">{asset.asset_type.toUpperCase()} · {asset.asset_role}</span>
                        <span className="block text-[11px] text-stone-400">{asset.object_path}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}

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
                {form.cue_source_mode === "inventory_track" ? (
                  <p className="mt-1 text-stone-100">{formatTrackLabel(form.selected_track)}</p>
                ) : (
                  <p className="mt-1 text-stone-100">{selectedClipCueAsset ? `Uploaded clip: ${selectedClipCueAsset.object_path}` : "No uploaded clip selected"}</p>
                )}
                <p className="mt-1 text-stone-200">Cue: {parseCueTimeToSeconds(form.cue_start_text) !== null ? formatSecondsClock(parseCueTimeToSeconds(form.cue_start_text)) : "--:--"}</p>
                {form.cue_instruction.trim() ? <p className="mt-1 text-stone-300">Instruction: {form.cue_instruction.trim()}</p> : null}
              </div>

              {validationMessage ? <p className="mt-2 text-amber-300">{validationMessage}</p> : null}
            </section>

            <section className="mt-4 rounded border border-violet-900/60 bg-violet-950/20 p-3 text-xs">
              <div className="flex flex-wrap items-end gap-2">
                <label className="block">
                  Media role
                  <select className="mt-1 rounded border border-stone-700 bg-stone-950 px-2 py-1" value={assetRoleDraft} onChange={(e) => setAssetRoleDraft((e.target.value as TriviaAssetRole) ?? "clue_primary")}>
                    {ASSET_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  Upload image/audio/video
                  <input
                    type="file"
                    multiple
                    className="mt-1 block"
                    onChange={(e) => {
                      void uploadAssets(e.currentTarget.files);
                      e.currentTarget.value = "";
                    }}
                    disabled={!selectedId || uploadingAssets}
                  />
                </label>
              </div>

              {!selectedId ? <p className="mt-2 text-amber-300">Save draft first to attach media files.</p> : null}
              {uploadingAssets ? <p className="mt-2 text-cyan-200">Uploading media...</p> : null}

              <div className="mt-3 rounded border border-stone-800 bg-stone-950/60 p-2">
                <p className="font-semibold text-violet-200">Attached media</p>
                {(selectedDetail?.assets ?? []).length === 0 ? <p className="mt-1 text-stone-400">No media attached yet.</p> : null}
                <div className="mt-2 space-y-2">
                  {(selectedDetail?.assets ?? []).map((asset) => (
                    <div key={asset.id} className="rounded border border-stone-800 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-stone-100">#{asset.id} · {asset.asset_type.toUpperCase()} · {asset.asset_role}</p>
                        <div className="flex flex-wrap gap-2">
                          {(asset.asset_type === "audio" || asset.asset_type === "video") ? (
                            <button
                              className="rounded border border-cyan-700 px-2 py-0.5"
                              onClick={() => {
                                setFormField("cue_source_mode", "uploaded_clip");
                                setFormField("selected_clip_asset_id", asset.id);
                              }}
                            >
                              Use As Cue Clip
                            </button>
                          ) : null}
                          <button className="rounded border border-stone-700 px-2 py-0.5" onClick={() => removeAsset(asset.id)}>Remove</button>
                        </div>
                      </div>
                      <p className="mt-1 break-all text-[11px] text-stone-300">{asset.bucket}/{asset.object_path}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </section>
        </section>
      </div>
    </div>
  );
}
