"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatSecondsClock, parseCueTimeToSeconds } from "src/lib/triviaBank";

type QuestionStatus = "draft" | "published" | "archived";
type Difficulty = "easy" | "medium" | "hard";
type CueSourceType = "inventory_track" | "uploaded_clip" | "none";
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

type TrackAppearance = {
  inventory_id: number;
  release_id: number;
  release_track_id: number;
  master_id: number | null;
  album: string;
  format: string | null;
  side: string | null;
  position: string | null;
};

type TrackSearchResult = {
  recording_id: number;
  title: string;
  artist: string;
  artist_id: number | null;
  appearances: TrackAppearance[];
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

type TriviaQuestionSource = {
  id?: number;
  source_record_id?: number;
  relationship_type?: string;
  is_primary?: boolean;
  citation_excerpt?: string | null;
  claim_text?: string | null;
  verification_notes?: string | null;
  source_kind?: string;
  source_url?: string | null;
  source_domain?: string | null;
  source_title?: string | null;
  excerpt_text?: string | null;
  source_claim_text?: string | null;
  verification_status?: string;
};
type TriviaQuestionScope = {
  id?: number;
  scope_type?: "playlist" | "crate" | "format" | "artist" | "album" | "track";
  scope_ref_id?: number | null;
  scope_value?: string | null;
  display_label?: string | null;
};

type ScopeOption = {
  id: number;
  name: string;
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
  source_note?: string | null;
  assets: TriviaQuestionAsset[];
  sources?: TriviaQuestionSource[];
  scopes?: TriviaQuestionScope[];
};

const STATUS_TABS: Array<{ value: "" | QuestionStatus; label: string }> = [
  { value: "", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

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
  sources: TriviaQuestionSource[];
  scopes: TriviaQuestionScope[];
};
const DEFAULT_SOURCE: TriviaQuestionSource = {
  source_kind: "editorial",
  source_url: "",
  source_domain: "",
  source_title: "",
  excerpt_text: "",
  source_claim_text: "",
  citation_excerpt: "",
  verification_notes: "",
  verification_status: "unreviewed",
  relationship_type: "research",
  is_primary: true,
};

const DEFAULT_FORM: FormState = {
  question_text: "",
  correct_answer: "",
  alternate_answers_text: "",
  category: "General Music",
  difficulty: "medium",
  selected_tags: [],
  cue_source_mode: "none",
  cue_start_text: "",
  cue_end_text: "",
  cue_instruction: "",
  cue_notes_text: "",
  selected_track: null,
  selected_clip_asset_id: null,
  sources: [],
  scopes: [],
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

  // Auto-populate sources for API/AI questions that have no manual sources yet
  let autoSources: TriviaQuestionSource[] = [];
  if (!Array.isArray(detail.sources) || detail.sources.length === 0) {
    if (typeof detail.source_note === "string" && detail.source_note.startsWith("trivia-api:")) {
      autoSources = [{
        ...DEFAULT_SOURCE,
        source_kind: "api",
        source_url: "https://the-trivia-api.com",
        source_title: "The Trivia API",
        source_domain: "the-trivia-api.com",
        excerpt_text: `Question ID: ${detail.source_note}`,
        verification_status: "approved",
        is_primary: true,
      }];
    } else if ((detail.tags ?? []).includes("ai-generated")) {
      autoSources = [{
        ...DEFAULT_SOURCE,
        source_kind: "api",
        source_url: "",
        source_title: "AI Generated (Claude Sonnet)",
        source_domain: "anthropic.com",
        verification_status: "unreviewed",
        is_primary: true,
      }];
    }
  }

  return {
    question_text: detail.prompt_text,
    correct_answer: detail.answer_key,
    alternate_answers_text: alternateAnswers.join("\n"),
    category: detail.default_category,
    difficulty: detail.default_difficulty,
    selected_tags: detail.tags ?? [],
    cue_source_mode: (detail.cue_source_type ?? "none") as CueSourceType,
    cue_start_text: detail.primary_cue_start_seconds !== null ? formatSecondsClock(detail.primary_cue_start_seconds) : "",
    cue_end_text: detail.primary_cue_end_seconds !== null ? formatSecondsClock(detail.primary_cue_end_seconds) : "",
    cue_instruction: detail.primary_cue_instruction ?? "",
    cue_notes_text: detail.cue_notes_text ?? "",
    selected_track: selectedTrack,
    selected_clip_asset_id: selectedClipAsset?.id ?? null,
    sources: Array.isArray(detail.sources) && detail.sources.length > 0
      ? detail.sources.map((source, index) => ({
          ...DEFAULT_SOURCE,
          ...source,
          is_primary: source.is_primary ?? index === 0,
          source_url: source.source_url ?? "",
          source_domain: source.source_domain ?? "",
          source_title: source.source_title ?? "",
          excerpt_text: source.excerpt_text ?? "",
          source_claim_text: source.source_claim_text ?? source.claim_text ?? "",
          citation_excerpt: source.citation_excerpt ?? "",
          verification_notes: source.verification_notes ?? "",
          verification_status: source.verification_status ?? "unreviewed",
          relationship_type: source.relationship_type ?? "research",
          source_kind: source.source_kind ?? "editorial",
        }))
      : autoSources,
    scopes: Array.isArray(detail.scopes)
      ? detail.scopes.map((scope) => ({
          id: scope.id,
          scope_type: scope.scope_type,
          scope_ref_id: scope.scope_ref_id ?? null,
          scope_value: scope.scope_value ?? "",
          display_label: scope.display_label ?? scope.scope_value ?? "",
        }))
      : [],
  };
}

export default function MusicTriviaBankPage() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<QuestionListRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<QuestionDetail | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | QuestionStatus>("");
  const [tagFilter, setTagFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<"" | Difficulty>("");

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [tagSearch, setTagSearch] = useState("");

  const [taxonomyCategories, setTaxonomyCategories] = useState<string[]>(["General Music"]);
  const [taxonomyTags, setTaxonomyTags] = useState<string[]>([]);
  const [playlistOptions, setPlaylistOptions] = useState<ScopeOption[]>([]);
  const [crateOptions, setCrateOptions] = useState<ScopeOption[]>([]);

  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryLimitText, setInventoryLimitText] = useState("");
  const [inventoryResults, setInventoryResults] = useState<InventoryTrackResult[]>([]);

  const [assetRoleDraft, setAssetRoleDraft] = useState<TriviaAssetRole>("clue_primary");

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const inventorySearchRequestRef = useRef(0);

  // Collection links entity search
  const [artistLinkQ, setArtistLinkQ] = useState("");
  const [artistLinkResults, setArtistLinkResults] = useState<Array<{ id: number; label: string }>>([]);
  const [albumLinkQ, setAlbumLinkQ] = useState("");
  const [albumLinkResults, setAlbumLinkResults] = useState<Array<{ id: number; label: string }>>([]);
  const [trackLinkQ, setTrackLinkQ] = useState("");
  const [trackLinkResults, setTrackLinkResults] = useState<TrackSearchResult[]>([]);

  const setFormField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateScope = (index: number, patch: Partial<TriviaQuestionScope>) => {
    setForm((current) => ({
      ...current,
      scopes: current.scopes.map((scope, scopeIndex) => scopeIndex === index ? { ...scope, ...patch } : scope),
    }));
  };

  const removeScope = (index: number) => {
    setForm((current) => ({
      ...current,
      scopes: current.scopes.filter((_, scopeIndex) => scopeIndex !== index),
    }));
  };

  const addScope = (scope: TriviaQuestionScope) => {
    setForm((current) => ({
      ...current,
      scopes: [...current.scopes, scope],
    }));
  };

  const searchArtistLinks = useCallback(async (q: string) => {
    if (!q.trim()) { setArtistLinkResults([]); return; }
    const res = await fetch(`/api/games/trivia/search-artists?q=${encodeURIComponent(q.trim())}`);
    if (!res.ok) return;
    const payload = await res.json().catch(() => ({}));
    setArtistLinkResults(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  const searchAlbumLinks = useCallback(async (q: string) => {
    if (!q.trim()) { setAlbumLinkResults([]); return; }
    const res = await fetch(`/api/games/trivia/search-albums?q=${encodeURIComponent(q.trim())}`);
    if (!res.ok) return;
    const payload = await res.json().catch(() => ({}));
    setAlbumLinkResults(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => { void searchArtistLinks(artistLinkQ); }, 250);
    return () => window.clearTimeout(t);
  }, [artistLinkQ, searchArtistLinks]);

  useEffect(() => {
    const t = window.setTimeout(() => { void searchAlbumLinks(albumLinkQ); }, 250);
    return () => window.clearTimeout(t);
  }, [albumLinkQ, searchAlbumLinks]);

  const searchTrackLinks = useCallback(async (q: string) => {
    if (!q.trim()) { setTrackLinkResults([]); return; }
    const res = await fetch(`/api/games/trivia/search-tracks?q=${encodeURIComponent(q.trim())}`);
    if (!res.ok) return;
    const payload = await res.json().catch(() => ({}));
    setTrackLinkResults(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => { void searchTrackLinks(trackLinkQ); }, 250);
    return () => window.clearTimeout(t);
  }, [trackLinkQ, searchTrackLinks]);

  const setSourceField = (index: number, key: keyof TriviaQuestionSource, value: string | boolean) => {
    setForm((current) => ({
      ...current,
      sources: current.sources.map((source, sourceIndex) => {
        if (sourceIndex !== index) {
          return key === "is_primary" && value === true ? { ...source, is_primary: false } : source;
        }
        return { ...source, [key]: value };
      }),
    }));
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

    // Cue validation only applies when cue is actually configured
    if (form.cue_source_mode !== "none") {
      if (form.cue_start_text.trim()) {
        const startSeconds = parseCueTimeToSeconds(form.cue_start_text);
        if (startSeconds === null) return "Cue start time format is invalid (use m:ss).";

        if (form.cue_end_text.trim()) {
          const endSeconds = parseCueTimeToSeconds(form.cue_end_text);
          if (endSeconds === null) return "Cue end time is invalid.";
          if (endSeconds < startSeconds) return "Cue end time must be after cue start time.";
        }
      }

      if (form.cue_source_mode === "uploaded_clip" && !selectedId) {
        return "Save this question first, then attach and select a clip cue.";
      }
    }

    return null;
  }, [form, selectedId]);

  const loadTaxonomy = useCallback(async () => {
    try {
      const [optionsRes, playlistsRes, cratesRes] = await Promise.all([
        fetch("/api/games/trivia/questions/options"),
        fetch("/api/games/playlists"),
        fetch("/api/games/trivia/crates"),
      ]);

      if (!optionsRes.ok) return;
      const payload = (await optionsRes.json()) as TaxonomyPayload;
      const categories = Array.isArray(payload.categories) ? payload.categories.filter(Boolean) : [];
      const tags = Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : [];
      if (categories.length > 0) setTaxonomyCategories(Array.from(new Set(["General Music", ...categories])));
      if (tags.length > 0) setTaxonomyTags(Array.from(new Set(tags)));

      if (playlistsRes.ok) {
        const playlistsPayload = await playlistsRes.json().catch(() => ({}));
        setPlaylistOptions(Array.isArray(playlistsPayload.data)
          ? playlistsPayload.data.map((row: { id: number; name: string }) => ({ id: Number(row.id), name: row.name }))
          : []);
      }

      if (cratesRes.ok) {
        const cratesPayload = await cratesRes.json().catch(() => ({}));
        setCrateOptions(Array.isArray(cratesPayload.data)
          ? cratesPayload.data.map((row: { id: number; name: string }) => ({ id: Number(row.id), name: row.name }))
          : []);
      }
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
      if (tagFilter.trim()) params.set("tag", tagFilter.trim());
      if (difficultyFilter) params.set("difficulty", difficultyFilter);
      params.set("limit", "250");

      const res = await fetch(`/api/games/trivia/questions?${params.toString()}`);
      if (!res.ok) return;

      const payload = await res.json();
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter, tagFilter, difficultyFilter]);

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

  useEffect(() => {
    const raw = searchParams.get("questionId");
    if (!raw) return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    void loadDetail(parsed);
  }, [loadDetail, searchParams]);

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

    const hasCue = cueSourceMode !== "none";
    const cueSourceType = hasCue ? cueSourceMode : null;
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
      : cueSourceMode === "uploaded_clip"
        ? {
            asset_id: selectedClip?.id,
            bucket: selectedClip?.bucket,
            object_path: selectedClip?.object_path,
          }
        : {};

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
          cue_source_type: cueSourceType,
          cue_source_payload: cueSourcePayload,
          primary_cue_start_seconds: hasCue ? (form.cue_start_text || null) : null,
          primary_cue_end_seconds: hasCue ? (form.cue_end_text || null) : null,
          primary_cue_instruction: hasCue ? (form.cue_instruction || null) : null,
          cue_notes_text: hasCue ? (form.cue_notes_text || null) : null,
          explanation_text: null,
          sources: form.sources,
          scopes: form.scopes,
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

  const restoreQuestion = async () => {
    if (!selectedId) return;

    const res = await fetch(`/api/games/trivia/questions/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(payload.error ?? "Failed to restore question");
      return;
    }

    await loadList();
    await loadDetail(selectedId);
  };

  const quickPublish = async (id: number) => {
    const res = await fetch(`/api/games/trivia/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(payload.error ?? "Failed to publish question");
      return;
    }
    await loadList();
    if (selectedId === id) await loadDetail(id);
  };

  const publishAllVisible = async () => {
    const draftIds = sortedRows.filter((row) => row.status === "draft").map((row) => row.id);
    if (draftIds.length === 0) {
      alert("No draft questions visible to publish.");
      return;
    }
    const yes = confirm(`Publish ${draftIds.length} draft question${draftIds.length !== 1 ? "s" : ""}?`);
    if (!yes) return;
    let count = 0;
    for (const id of draftIds) {
      const res = await fetch(`/api/games/trivia/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (res.ok) count++;
    }
    await loadList();
    alert(`Published ${count} of ${draftIds.length} questions.`);
  };

  const deleteQuestion = async () => {
    if (!selectedId) return;
    const yes = confirm("Permanently delete this question? This cannot be undone.");
    if (!yes) return;

    if (selectedDetail?.status !== "archived") {
      const archiveRes = await fetch(`/api/games/trivia/questions/${selectedId}/archive`, { method: "POST" });
      const archivePayload = await archiveRes.json().catch(() => ({}));
      if (!archiveRes.ok) {
        alert(archivePayload.error ?? "Failed to archive question before deletion");
        return;
      }
    }

    const res = await fetch(`/api/games/trivia/questions/${selectedId}`, { method: "DELETE" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const usage = payload.usage && typeof payload.usage === "object"
        ? payload.usage as { deck_usage_count?: number; session_usage_count?: number }
        : null;
      const usageDetail = usage
        ? `\nDecks: ${usage.deck_usage_count ?? 0} · Sessions: ${usage.session_usage_count ?? 0}`
        : "";
      alert(`${payload.error ?? "Failed to delete question"}${usageDetail}`);
      return;
    }

    resetForNew();
    await loadList();
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
              <Link href="/admin/games/music-trivia/imports" className="rounded border border-stone-700 px-3 py-1">Imports Queue</Link>
              <Link href="/admin/games/music-trivia/decks" className="rounded border border-stone-700 px-3 py-1">Deck Builder</Link>
              <button className="rounded border border-emerald-700 px-3 py-1" onClick={resetForNew}>New Question</button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[360px,1fr]">
          <aside className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <div className="space-y-2 text-xs">
              {/* Status tabs */}
              <div className="flex flex-wrap gap-1">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.label}
                    className={`rounded border px-2 py-1 ${statusFilter === tab.value ? "border-emerald-600 bg-emerald-950/40 text-emerald-100" : "border-stone-700 text-stone-300"}`}
                    onClick={() => setStatusFilter(tab.value)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Text search */}
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search question text, code, answer…"
                className="w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
              />

              {/* Difficulty filter */}
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-stone-500">Difficulty</p>
                <div className="flex gap-1">
                  {(["", "easy", "medium", "hard"] as const).map((d) => (
                    <button key={d || "any"}
                      onClick={() => setDifficultyFilter(d)}
                      className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        difficultyFilter === d
                          ? d === "easy" ? "border-emerald-600 bg-emerald-950/40 text-emerald-200"
                            : d === "medium" ? "border-amber-600 bg-amber-950/40 text-amber-200"
                            : d === "hard" ? "border-rose-600 bg-rose-950/40 text-rose-200"
                            : "border-emerald-600 bg-emerald-950/40 text-emerald-100"
                          : "border-stone-700 text-stone-400"
                      }`}>
                      {d || "Any"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tag filter chips */}
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-stone-500">Tag</p>
                <div className="flex flex-wrap gap-1">
                  {["trivia-api", "ai-generated"].map((tag) => (
                    <button key={tag}
                      onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                      className={`rounded border px-2 py-0.5 text-[10px] ${
                        tagFilter === tag ? "border-fuchsia-600 bg-fuchsia-950/40 text-fuchsia-200" : "border-stone-700 text-stone-400"
                      }`}>
                      {tag}
                    </button>
                  ))}
                  {tagFilter && !["trivia-api", "ai-generated"].includes(tagFilter) && (
                    <button onClick={() => setTagFilter("")}
                      className="rounded border border-fuchsia-600 bg-fuchsia-950/40 px-2 py-0.5 text-[10px] text-fuchsia-200">
                      {tagFilter} ×
                    </button>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button className="rounded border border-stone-700 px-2 py-1" onClick={loadList}>Refresh</button>
                <button className="rounded border border-cyan-800 px-2 py-1 text-cyan-300" onClick={publishAllVisible}>
                  Publish All Drafts
                </button>
              </div>
            </div>

            <div className="mt-3 max-h-[70vh] space-y-2 overflow-auto pr-1 text-xs">
              {loading ? <p className="text-stone-400">Loading...</p> : null}
              {sortedRows.map((row) => {
                const diffColor = { easy: "text-emerald-400", medium: "text-amber-400", hard: "text-rose-400" }[row.default_difficulty] ?? "text-stone-400";
                return (
                  <div key={row.id} className={`rounded border ${row.id === selectedId ? "border-emerald-600 bg-emerald-950/20" : "border-stone-800 bg-stone-950/60"}`}>
                    <button className="w-full p-2 text-left" onClick={() => loadDetail(row.id)}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-emerald-200">{row.question_code}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                          row.status === "published" ? "bg-emerald-950/60 text-emerald-300"
                          : row.status === "archived" ? "bg-stone-900 text-stone-500"
                          : "bg-stone-900 text-stone-300"
                        }`}>{row.status}</span>
                        <span className={`text-[10px] font-semibold uppercase ${diffColor}`}>{row.default_difficulty}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 break-words text-stone-100">{row.prompt_text}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-stone-400">{row.default_category}</span>
                        {row.facets?.has_required_cue && <span className="text-[10px] text-cyan-400">♪ cue</span>}
                        {row.facets?.has_media && <span className="text-[10px] text-stone-400">🖼 media</span>}
                        {row.tags?.includes("trivia-api") && <span className="rounded bg-fuchsia-950/50 px-1 text-[10px] text-fuchsia-400">trivia-api</span>}
                        {row.tags?.includes("ai-generated") && <span className="rounded bg-violet-950/50 px-1 text-[10px] text-violet-400">ai</span>}
                      </div>
                    </button>
                    {row.status === "draft" && (
                      <div className="border-t border-stone-800/60 px-2 py-1">
                        <button
                          className="rounded border border-cyan-800 px-2 py-0.5 text-[10px] text-cyan-300 hover:bg-cyan-950/30"
                          onClick={(e) => { e.stopPropagation(); void quickPublish(row.id); }}
                        >
                          Publish →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
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
                <button className="rounded border border-amber-700 px-3 py-1" disabled={!selectedId || selectedDetail?.status !== "archived" || saving} onClick={restoreQuestion}>Restore to Draft</button>
                <button className="rounded border border-rose-700 px-3 py-1" disabled={!selectedId || saving} onClick={deleteQuestion}>Delete</button>
              </div>
            </div>

            {selectedDetail?.status === "archived" ? (
              <p className="mb-3 rounded border border-amber-800/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                Archived questions stay editable for review, but must be restored before they can return to active use. Delete is only allowed when the question is not used by any deck or session.
              </p>
            ) : null}

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

            <section className="mt-4 rounded border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs">
              <div className="mb-3">
                <p className="font-semibold text-emerald-200">Collection Links</p>
                <p className="mt-0.5 text-[11px] text-emerald-100/60">
                  Link this question to artists, albums, playlists, or crates in your collection.
                  Questions linked to artists/albums you own will be surfaced during collection-scoped trivia rounds.
                  You can also link to artists you <em>don&apos;t</em> own yet — those questions stay in the bank until you do.
                </p>
                <p className="mt-1.5 text-[11px] text-emerald-100/40">
                  Scope guide: use <strong className="text-emerald-100/60">Track</strong> for song-level questions (artist and albums are implied) — use <strong className="text-emerald-100/60">Album + Artist</strong> for album-level questions — use <strong className="text-emerald-100/60">Artist</strong> alone for discography or career questions. Add as many as apply.
                </p>
              </div>

              {/* Current scopes */}
              {form.scopes.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {form.scopes.map((scope, index) => {
                    const inCollection = scope.scope_ref_id !== null && scope.scope_ref_id !== undefined;
                    const label = scope.display_label || scope.scope_value || scope.scope_type;
                    const typeColor: Record<string, string> = {
                      artist: "border-emerald-700 bg-emerald-950/50 text-emerald-200",
                      album: "border-cyan-700 bg-cyan-950/50 text-cyan-200",
                      track: "border-violet-700 bg-violet-950/50 text-violet-200",
                      playlist: "border-amber-700 bg-amber-950/50 text-amber-200",
                      crate: "border-amber-700 bg-amber-950/50 text-amber-200",
                      format: "border-stone-600 bg-stone-900/50 text-stone-300",
                    };
                    return (
                      <span key={`${scope.scope_type ?? "scope"}-${scope.id ?? index}-${index}`}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${typeColor[scope.scope_type ?? ""] ?? "border-stone-600 bg-stone-900 text-stone-300"}`}>
                        <span className="text-[9px] uppercase tracking-wide opacity-70">{scope.scope_type}</span>
                        <span>{label}</span>
                        {inCollection
                          ? <span title="In your collection" className="text-emerald-400">✓</span>
                          : <span title="Not yet in collection" className="text-amber-400">○</span>
                        }
                        <button onClick={() => removeScope(index)} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
                      </span>
                    );
                  })}
                </div>
              )}

              {form.scopes.length === 0 && (
                <p className="mb-3 text-stone-500">No collection links yet. Add below.</p>
              )}

              {/* Add artist */}
              <div className="space-y-2 rounded border border-stone-800 bg-stone-950/40 p-2">
                <p className="font-semibold text-stone-300">+ Artist</p>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                    value={artistLinkQ}
                    onChange={(e) => setArtistLinkQ(e.target.value)}
                    placeholder="Type artist name to search collection…"
                  />
                  <button
                    className="rounded border border-stone-700 px-2 py-1 text-stone-400 hover:text-stone-200"
                    onClick={() => {
                      if (artistLinkQ.trim()) {
                        addScope({ scope_type: "artist", scope_ref_id: null, scope_value: artistLinkQ.trim(), display_label: artistLinkQ.trim() });
                        setArtistLinkQ("");
                        setArtistLinkResults([]);
                      }
                    }}
                    title="Add without collection link (not in collection yet)"
                  >
                    Add unlinked
                  </button>
                </div>
                {artistLinkResults.length > 0 && (
                  <div className="max-h-36 overflow-auto rounded border border-stone-800">
                    {artistLinkResults.map((r) => (
                      <button key={r.id}
                        className="block w-full border-b border-stone-900 px-3 py-1.5 text-left text-stone-200 hover:bg-emerald-950/30 last:border-b-0"
                        onClick={() => {
                          addScope({ scope_type: "artist", scope_ref_id: r.id, scope_value: r.label, display_label: r.label });
                          setArtistLinkQ("");
                          setArtistLinkResults([]);
                        }}
                      >
                        <span>{r.label}</span>
                        <span className="ml-2 text-[10px] text-emerald-400">✓ in collection</span>
                      </button>
                    ))}
                  </div>
                )}
                {artistLinkQ.trim() && artistLinkResults.length === 0 && (
                  <p className="text-[11px] text-amber-400">Not found in collection — use &quot;Add unlinked&quot; to save anyway</p>
                )}
              </div>

              {/* Add album */}
              <div className="mt-2 space-y-2 rounded border border-stone-800 bg-stone-950/40 p-2">
                <p className="font-semibold text-stone-300">+ Album</p>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded border border-stone-700 bg-stone-950 px-2 py-1"
                    value={albumLinkQ}
                    onChange={(e) => setAlbumLinkQ(e.target.value)}
                    placeholder="Type album title to search collection…"
                  />
                  <button
                    className="rounded border border-stone-700 px-2 py-1 text-stone-400 hover:text-stone-200"
                    onClick={() => {
                      if (albumLinkQ.trim()) {
                        addScope({ scope_type: "album", scope_ref_id: null, scope_value: albumLinkQ.trim(), display_label: albumLinkQ.trim() });
                        setAlbumLinkQ("");
                        setAlbumLinkResults([]);
                      }
                    }}
                    title="Add without collection link"
                  >
                    Add unlinked
                  </button>
                </div>
                {albumLinkResults.length > 0 && (
                  <div className="max-h-36 overflow-auto rounded border border-stone-800">
                    {albumLinkResults.map((r) => (
                      <button key={r.id}
                        className="block w-full border-b border-stone-900 px-3 py-1.5 text-left text-stone-200 hover:bg-cyan-950/30 last:border-b-0"
                        onClick={() => {
                          addScope({ scope_type: "album", scope_ref_id: r.id, scope_value: r.label, display_label: r.label });
                          setAlbumLinkQ("");
                          setAlbumLinkResults([]);
                        }}
                      >
                        <span>{r.label}</span>
                        <span className="ml-2 text-[10px] text-cyan-400">✓ in collection</span>
                      </button>
                    ))}
                  </div>
                )}
                {albumLinkQ.trim() && albumLinkResults.length === 0 && (
                  <p className="text-[11px] text-amber-400">Not found in collection — use &quot;Add unlinked&quot; to save anyway</p>
                )}
              </div>

              {/* Add track */}
              <div className="mt-2 space-y-2 rounded border border-stone-800 bg-stone-950/40 p-2">
                <p className="font-semibold text-stone-300">+ Track</p>
                <input
                  className="w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                  value={trackLinkQ}
                  onChange={(e) => setTrackLinkQ(e.target.value)}
                  placeholder="Type song title to search collection…"
                />
                {trackLinkResults.length > 0 && (
                  <div className="max-h-56 overflow-auto rounded border border-stone-800">
                    {trackLinkResults.map((song) => (
                      <button
                        key={song.recording_id}
                        className="block w-full border-b border-stone-900 px-3 py-2 text-left hover:bg-violet-950/30 last:border-b-0"
                        onClick={() => {
                          const existing = form.scopes;
                          const has = (type: string, refId: number | null) =>
                            existing.some((s) => s.scope_type === type && s.scope_ref_id === refId);

                          // Track
                          if (!has("track", song.recording_id)) {
                            addScope({ scope_type: "track", scope_ref_id: song.recording_id, scope_value: song.title, display_label: `${song.title} — ${song.artist}` });
                          }
                          // Artist
                          if (song.artist_id && !has("artist", song.artist_id)) {
                            addScope({ scope_type: "artist", scope_ref_id: song.artist_id, scope_value: song.artist, display_label: song.artist });
                          }
                          // Album — one per unique master
                          const seenMasters = new Set<number>();
                          for (const a of song.appearances) {
                            if (a.master_id && !seenMasters.has(a.master_id) && !has("album", a.master_id)) {
                              seenMasters.add(a.master_id);
                              addScope({ scope_type: "album", scope_ref_id: a.master_id, scope_value: a.album, display_label: a.album });
                            }
                          }
                          setTrackLinkQ("");
                          setTrackLinkResults([]);
                        }}
                      >
                        <div>
                          <span className="text-stone-200">{song.title}</span>
                          <span className="ml-2 text-[11px] text-stone-400">{song.artist}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {song.appearances.map((a) => (
                            <span key={a.release_track_id} className="rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-stone-400">
                              {a.album}{a.format ? ` (${a.format})` : ""}{a.position ? ` · ${a.position}` : ""}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {trackLinkQ.trim() && trackLinkResults.length === 0 && (
                  <p className="text-[11px] text-stone-500">No tracks found — try a different search term.</p>
                )}
              </div>

              {/* Add format */}
              <div className="mt-2 rounded border border-stone-800 bg-stone-950/40 p-2">
                <p className="mb-1 font-semibold text-stone-300">+ Format</p>
                <div className="flex flex-wrap gap-1.5">
                  {["vinyl", '12"', '7"', '10"', "CD", "cassette", "digital"].map((fmt) => {
                    const already = form.scopes.some((s) => s.scope_type === "format" && s.scope_value === fmt);
                    return (
                      <button
                        key={fmt}
                        disabled={already}
                        onClick={() => addScope({ scope_type: "format", scope_ref_id: null, scope_value: fmt, display_label: fmt })}
                        className={`rounded border px-2 py-0.5 text-[11px] ${already ? "border-stone-800 text-stone-600 cursor-not-allowed" : "border-stone-600 text-stone-300 hover:border-stone-400"}`}
                      >
                        {already ? `${fmt} ✓` : `+ ${fmt}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add playlist/crate */}
              <div className="mt-2 flex flex-wrap gap-2">
                <div className="flex-1 min-w-[160px]">
                  <p className="mb-1 font-semibold text-stone-300">+ Playlist</p>
                  <select
                    className="w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                    value=""
                    onChange={(e) => {
                      const selected = playlistOptions.find((o) => o.id === Number(e.target.value));
                      if (selected) addScope({ scope_type: "playlist", scope_ref_id: selected.id, scope_value: selected.name, display_label: selected.name });
                    }}
                  >
                    <option value="">Choose playlist…</option>
                    {playlistOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <p className="mb-1 font-semibold text-stone-300">+ Crate</p>
                  <select
                    className="w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                    value=""
                    onChange={(e) => {
                      const selected = crateOptions.find((o) => o.id === Number(e.target.value));
                      if (selected) addScope({ scope_type: "crate", scope_ref_id: selected.id, scope_value: selected.name, display_label: selected.name });
                    }}
                  >
                    <option value="">Choose crate…</option>
                    {crateOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section className="mt-4 rounded border border-cyan-900/60 bg-cyan-950/20 p-3 text-xs">
              <p className="font-semibold text-cyan-200">Vinyl Cue <span className="font-normal text-stone-400">(optional — for knowledge questions, leave as No cue)</span></p>

              <label className="mt-2 block">
                Cue source
                <select
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1"
                  value={form.cue_source_mode}
                  onChange={(e) => setFormField("cue_source_mode", (e.target.value as CueSourceType) ?? "none")}
                >
                  <option value="none">No cue — knowledge question</option>
                  <option value="inventory_track">Vinyl inventory track</option>
                  <option value="uploaded_clip">Uploaded clip</option>
                </select>
              </label>

              {form.cue_source_mode !== "none" && form.cue_source_mode === "inventory_track" ? (
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
              ) : form.cue_source_mode === "uploaded_clip" ? (
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
              ) : null}

              {form.cue_source_mode === "none" ? (
                <p className="mt-2 text-stone-500">No vinyl cue — this is a knowledge question. The host asks it verbally; no record needs to be cued.</p>
              ) : (
                <>
                  <div className="mt-2 grid gap-2 lg:grid-cols-3">
                    <label>Start (m:ss) — optional
                      <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={form.cue_start_text} onChange={(e) => setFormField("cue_start_text", e.target.value)} placeholder="e.g. 0:30" />
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
                    {form.cue_start_text.trim() && <p className="mt-1 text-stone-200">Cue: {parseCueTimeToSeconds(form.cue_start_text) !== null ? formatSecondsClock(parseCueTimeToSeconds(form.cue_start_text)!) : "invalid time"}</p>}
                    {form.cue_instruction.trim() ? <p className="mt-1 text-stone-300">Instruction: {form.cue_instruction.trim()}</p> : null}
                  </div>
                </>
              )}

              {validationMessage ? <p className="mt-2 text-amber-300">{validationMessage}</p> : null}
            </section>
            <section className="mt-4 rounded border border-amber-900/60 bg-amber-950/20 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-amber-200">Sources & Provenance</p>
                  <p className="text-[11px] text-amber-100/70">Add citations for manually researched or imported trivia so review and future imports stay auditable.</p>
                </div>
                <button
                  className="rounded border border-amber-700 px-3 py-1"
                  onClick={() => setFormField("sources", [...form.sources, { ...DEFAULT_SOURCE, is_primary: form.sources.length === 0 }])}
                >
                  Add Source
                </button>
              </div>

              {form.sources.length === 0 ? <p className="mt-2 text-stone-400">No sources attached yet. Manual trivia can still be saved, but sourced questions should carry provenance.</p> : null}

              <div className="mt-3 space-y-3">
                {form.sources.map((source, index) => (
                  <div key={`${source.id ?? "new"}-${index}`} className="rounded border border-stone-800 bg-stone-950/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-stone-100">Source {index + 1}</p>
                      <div className="flex flex-wrap gap-2">
                        <label className="flex items-center gap-2 text-[11px] text-stone-300">
                          <input
                            type="radio"
                            name="primary-source"
                            checked={source.is_primary === true}
                            onChange={() => setSourceField(index, "is_primary", true)}
                          />
                          Primary
                        </label>
                        <button
                          className="rounded border border-stone-700 px-2 py-0.5"
                          onClick={() => setFormField("sources", form.sources.filter((_, sourceIndex) => sourceIndex !== index).map((entry, entryIndex) => ({ ...entry, is_primary: entry.is_primary ?? entryIndex === 0 })))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                      <label>Source URL
                        <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={source.source_url ?? ""} onChange={(e) => setSourceField(index, "source_url", e.target.value)} placeholder="https://..." />
                      </label>
                      <label>Source Title
                        <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={source.source_title ?? ""} onChange={(e) => setSourceField(index, "source_title", e.target.value)} placeholder="Article, interview, database entry" />
                      </label>
                      <label>Source Kind
                        <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={source.source_kind ?? "editorial"} onChange={(e) => setSourceField(index, "source_kind", e.target.value)}>
                          <option value="editorial">editorial</option>
                          <option value="manual">manual</option>
                          <option value="api">api</option>
                          <option value="reference">reference</option>
                        </select>
                      </label>
                      <label>Verification Status
                        <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={source.verification_status ?? "unreviewed"} onChange={(e) => setSourceField(index, "verification_status", e.target.value)}>
                          <option value="unreviewed">unreviewed</option>
                          <option value="approved">approved</option>
                          <option value="rejected">rejected</option>
                          <option value="superseded">superseded</option>
                        </select>
                      </label>
                      <label>Relationship
                        <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={source.relationship_type ?? "research"} onChange={(e) => setSourceField(index, "relationship_type", e.target.value)}>
                          <option value="research">research</option>
                          <option value="verification">verification</option>
                          <option value="inspiration">inspiration</option>
                          <option value="manual_note">manual_note</option>
                        </select>
                      </label>
                    </div>

                    <label className="mt-2 block">Excerpt
                      <textarea className="mt-1 h-20 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={source.excerpt_text ?? ""} onChange={(e) => setSourceField(index, "excerpt_text", e.target.value)} placeholder="Relevant quoted or paraphrased source excerpt" />
                    </label>

                    <label className="mt-2 block">Claim / Fact
                      <textarea className="mt-1 h-16 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={source.source_claim_text ?? ""} onChange={(e) => setSourceField(index, "source_claim_text", e.target.value)} placeholder="Normalized factual claim extracted from the source" />
                    </label>

                    <label className="mt-2 block">Citation Excerpt Used For This Question
                      <textarea className="mt-1 h-16 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={source.citation_excerpt ?? ""} onChange={(e) => setSourceField(index, "citation_excerpt", e.target.value)} placeholder="Short excerpt or summary used in the final question" />
                    </label>

                    <label className="mt-2 block">Verification Notes
                      <textarea className="mt-1 h-16 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={source.verification_notes ?? ""} onChange={(e) => setSourceField(index, "verification_notes", e.target.value)} placeholder="Why this source is trustworthy, any caveats, editorial notes" />
                    </label>
                  </div>
                ))}
              </div>
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
