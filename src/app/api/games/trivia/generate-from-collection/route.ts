// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — collection tables are not in TriviaDatabase schema; use supabaseAdmin directly
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { getTriviaDb } from "src/lib/triviaDb";
import { generateTriviaQuestionCode } from "src/lib/triviaBank";
import { TRIVIA_BANK_ENABLED } from "src/lib/triviaBankApi";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DifficultyLevel = "easy" | "medium" | "hard";

type TrackContext = {
  track_key: string;
  inventory_id: number;
  release_id: number | null;
  release_track_id: number | null;
  recording_id: number | null;
  track_title: string;
  track_artist: string;
  album_title: string;
  album_artist: string;
  position: string | null;
  side: string | null;
  year_int: number | null;
  decade: number | null;
  country: string | null;
  label: string | null;
  labels: string[];
};

type DraftQuestion = {
  facet_category: string;
  question_type: "multiple_choice" | "free_response";
  prompt_text: string;
  answer_key: string;
  accepted_answers: string[];
  options_payload: string[];
  explanation_text: string;
  source_note: string;
  default_category: string;
  facet_difficulty: DifficultyLevel;
  display_element_type: string;
  tags: string[];
  cue_source_payload: Record<string, unknown>;
  era: string | null;
  genre: string | null;
  decade: string | null;
  region: string | null;
};

type GenerateOptions = {
  source: string;
  playlistIds: number[];
  limit: number;
  seed: string;
  difficulty: DifficultyLevel;
  category: string;
  apply: boolean;
  createdBy: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function isValidYear(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function normalizePositionKey(position: unknown): string | null {
  const raw = normalizeText(position);
  if (!raw) return null;
  return raw.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function buildPositionLookupKeys(position: unknown, side: unknown): string[] {
  const keys = new Set<string>();
  const normalizedPosition = normalizePositionKey(position);
  const normalizedSide = normalizePositionKey(side)?.slice(0, 1) ?? null;
  if (normalizedPosition) {
    keys.add(normalizedPosition);
    const numericPart = normalizedPosition.replace(/^[A-Z]+/, "");
    if (numericPart) keys.add(numericPart);
    if (normalizedSide) keys.add(`${normalizedSide}${numericPart || normalizedPosition}`);
  }
  return Array.from(keys);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return function (): number {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeededRandom(seedText: string): () => number {
  if (!seedText) return Math.random;
  let seed = 0;
  for (const char of seedText) seed = ((seed * 31) + char.charCodeAt(0)) >>> 0;
  return mulberry32(seed || 1);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------------------------------------------------------------------------
// Track-key parsing (matches bingoEngine.ts pattern)
// ---------------------------------------------------------------------------

function parseTrackKey(trackKey: string) {
  const parts = String(trackKey ?? "").split(":");
  const inventoryIdRaw = Number.parseInt(parts[0] ?? "", 10);
  const inventoryId = Number.isFinite(inventoryIdRaw) ? inventoryIdRaw : null;

  if (parts.length === 2 && inventoryId !== null) {
    const position = (parts[1] ?? "").trim();
    if (position) return { inventoryId, releaseTrackId: null, recordingId: null, fallbackPosition: position };
  }

  if (parts[1] === "fallback") {
    const rtRaw = Number.parseInt(parts[2] ?? "", 10);
    const recRaw = Number.parseInt(parts[3] ?? "", 10);
    return {
      inventoryId,
      releaseTrackId: Number.isFinite(rtRaw) ? rtRaw : null,
      recordingId: Number.isFinite(recRaw) ? recRaw : null,
      fallbackPosition: null,
    };
  }

  const rtRaw = Number.parseInt(parts[1] ?? "", 10);
  const recRaw = Number.parseInt(parts[2] ?? "", 10);
  return {
    inventoryId,
    releaseTrackId: Number.isFinite(rtRaw) ? rtRaw : null,
    recordingId: Number.isFinite(recRaw) ? recRaw : null,
    fallbackPosition: null,
  };
}

// ---------------------------------------------------------------------------
// Paged + batched DB helpers
// ---------------------------------------------------------------------------

async function fetchAllRows(queryFactory: () => unknown, pageSize = 1000): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await (queryFactory() as { range: (f: number, t: number) => Promise<{ data: unknown[]; error: unknown }> }).range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const db = supabaseAdmin as unknown as Record<string, unknown> & {
  from: (table: string) => unknown;
};

async function fetchInventory(): Promise<Map<number, unknown>> {
  const rows = await fetchAllRows(
    () => db.from("inventory").select("id, release_id, release:releases(id, label, country, release_year, master:masters(title, artist:artists(name)))").order("id", { ascending: true })
  );
  const map = new Map<number, unknown>();
  for (const row of rows) map.set((row as { id: number }).id, row);
  return map;
}

async function fetchReleaseTracks(releaseIds: number[]): Promise<Map<number, unknown>> {
  if (releaseIds.length === 0) return new Map();
  const rows: unknown[] = [];
  for (const chunk of chunkArray(releaseIds, 250)) {
    const chunkRows = await fetchAllRows(
      () => db.from("release_tracks").select("id, release_id, recording_id, position, side, title_override").in("release_id", chunk).order("id", { ascending: true })
    );
    rows.push(...chunkRows);
  }
  const map = new Map<number, unknown>();
  for (const row of rows) map.set((row as { id: number }).id, row);
  return map;
}

async function fetchRecordings(recordingIds: number[]): Promise<Map<number, unknown>> {
  if (recordingIds.length === 0) return new Map();
  const rows: unknown[] = [];
  for (const chunk of chunkArray(recordingIds, 250)) {
    const chunkRows = await fetchAllRows(
      () => db.from("recordings").select("id, title, track_artist").in("id", chunk).order("id", { ascending: true })
    );
    rows.push(...chunkRows);
  }
  const map = new Map<number, unknown>();
  for (const row of rows) map.set((row as { id: number }).id, row);
  return map;
}

async function fetchPlaylistItems(playlistIds: number[]): Promise<unknown[]> {
  if (playlistIds.length === 0) return [];
  return fetchAllRows(
    () => db.from("collection_playlist_items").select("playlist_id, track_key, sort_order").in("playlist_id", playlistIds).order("sort_order", { ascending: true })
  );
}

async function fetchPlaylistNames(playlistIds: number[]): Promise<string[]> {
  if (playlistIds.length === 0) return [];
  const { data, error } = await (db.from("collection_playlists").select("id, name").in("id", playlistIds).order("sort_order", { ascending: true }) as Promise<{ data: Array<{ name: string }> | null; error: unknown }>);
  if (error) throw error;
  return (data ?? []).map((row) => row.name);
}

// ---------------------------------------------------------------------------
// Track pool resolution
// ---------------------------------------------------------------------------

function getInventoryContext(inventory: unknown): { albumTitle: string; albumArtist: string; yearInt: number | null; country: string | null; label: string | null } {
  const row = inventory as Record<string, unknown>;
  const release = (row.release ?? null) as Record<string, unknown> | null;
  const master = (release?.master ?? null) as Record<string, unknown> | null;
  const artist = (master?.artist ?? null) as Record<string, unknown> | null;
  const releaseYear = release?.release_year;
  return {
    albumTitle: normalizeText(master?.title),
    albumArtist: normalizeText(artist?.name),
    yearInt: isValidYear(releaseYear) ? (releaseYear as number) : null,
    country: normalizeText(release?.country) || null,
    label: normalizeText(release?.label) || null,
  };
}

async function resolveTrackPool(source: string, playlistIds: number[]): Promise<{ tracks: TrackContext[]; sourceLabel: string }> {
  const inventoryById = await fetchInventory();
  const releaseIds = Array.from(
    new Set(
      Array.from(inventoryById.values())
        .map((row) => ((row as Record<string, unknown>).release_id as number | null))
        .filter((id): id is number => Number.isFinite(id) && id > 0)
    )
  );

  const releaseTrackById = await fetchReleaseTracks(releaseIds);
  const releaseTrackRows = Array.from(releaseTrackById.values()) as Array<{ id: number; release_id: number | null; recording_id: number | null; position: string | null; side: string | null; title_override: string | null }>;

  const releaseTrackByReleaseAndPosition = new Map<string, typeof releaseTrackRows[number]>();
  for (const rt of releaseTrackRows) {
    if (!rt.release_id) continue;
    for (const key of buildPositionLookupKeys(rt.position, rt.side)) {
      releaseTrackByReleaseAndPosition.set(`${rt.release_id}:${key}`, rt);
    }
  }

  const recordingIds = Array.from(
    new Set(releaseTrackRows.map((rt) => rt.recording_id).filter((id): id is number => Number.isFinite(id) && id > 0))
  );
  const recordingById = await fetchRecordings(recordingIds);

  const buildFromReleaseTrack = (
    rt: typeof releaseTrackRows[number],
    inventoryRow: unknown
  ): TrackContext | null => {
    const inv = inventoryRow as Record<string, unknown>;
    const ctx = getInventoryContext(inv);
    const recording = rt.recording_id ? ((recordingById.get(rt.recording_id) ?? null) as Record<string, unknown> | null) : null;
    const trackTitle = normalizeText(rt.title_override || recording?.title);
    const trackArtist = normalizeText(recording?.track_artist || ctx.albumArtist);
    if (!trackTitle || !trackArtist) return null;
    return {
      track_key: `${inv.id as number}:fallback:${rt.id}:${rt.recording_id ?? ""}`,
      inventory_id: inv.id as number,
      release_id: inv.release_id as number | null,
      release_track_id: rt.id,
      recording_id: rt.recording_id ?? null,
      track_title: trackTitle,
      track_artist: trackArtist,
      album_title: ctx.albumTitle,
      album_artist: ctx.albumArtist,
      position: rt.position,
      side: rt.side,
      year_int: ctx.yearInt,
      decade: isValidYear(ctx.yearInt) ? Math.floor(ctx.yearInt / 10) * 10 : null,
      country: ctx.country,
      label: ctx.label,
      labels: ctx.label ? [ctx.label] : [],
    };
  };

  if (source === "collection") {
    // Build a fast map: release_id -> inventory row
    const inventoryByRelease = new Map<number, unknown>();
    for (const inv of inventoryById.values()) {
      const releaseId = ((inv as Record<string, unknown>).release_id) as number | null;
      if (Number.isFinite(releaseId) && releaseId > 0) inventoryByRelease.set(releaseId, inv);
    }

    const tracks: TrackContext[] = [];
    for (const rt of releaseTrackRows) {
      if (!rt.release_id) continue;
      const inv = inventoryByRelease.get(rt.release_id);
      if (!inv) continue;
      const track = buildFromReleaseTrack(rt, inv);
      if (track) tracks.push(track);
    }
    return { tracks, sourceLabel: "full collection" };
  }

  // Playlist mode
  const names = await fetchPlaylistNames(playlistIds);
  const items = await fetchPlaylistItems(playlistIds) as Array<{ track_key: string; playlist_id: number }>;
  const tracks: TrackContext[] = [];
  for (const item of items) {
    const parsed = parseTrackKey(item.track_key);
    if (!parsed.inventoryId) continue;
    const inv = inventoryById.get(parsed.inventoryId);
    if (!inv) continue;
    const ctx = getInventoryContext(inv);
    const invRow = inv as Record<string, unknown>;

    let rt: typeof releaseTrackRows[number] | null = null;
    if (parsed.releaseTrackId) {
      rt = (releaseTrackById.get(parsed.releaseTrackId) as typeof releaseTrackRows[number]) ?? null;
    } else if (parsed.fallbackPosition && invRow.release_id) {
      rt = releaseTrackByReleaseAndPosition.get(`${invRow.release_id as number}:${normalizePositionKey(parsed.fallbackPosition) ?? ""}`) ?? null;
    }

    const recording = rt?.recording_id ? ((recordingById.get(rt.recording_id) ?? null) as Record<string, unknown> | null) : null;
    const trackTitle = normalizeText(rt?.title_override || recording?.title);
    const trackArtist = normalizeText(recording?.track_artist || ctx.albumArtist);
    if (!trackTitle || !trackArtist) continue;

    tracks.push({
      track_key: item.track_key,
      inventory_id: parsed.inventoryId,
      release_id: invRow.release_id as number | null,
      release_track_id: rt?.id ?? null,
      recording_id: rt?.recording_id ?? null,
      track_title: trackTitle,
      track_artist: trackArtist,
      album_title: ctx.albumTitle,
      album_artist: ctx.albumArtist,
      position: rt?.position ?? parsed.fallbackPosition,
      side: rt?.side ?? null,
      year_int: ctx.yearInt,
      decade: isValidYear(ctx.yearInt) ? Math.floor(ctx.yearInt / 10) * 10 : null,
      country: ctx.country,
      label: ctx.label,
      labels: ctx.label ? [ctx.label] : [],
    });
  }

  const sourceLabel = names.join(", ") || "selected playlists";
  return { tracks, sourceLabel };
}

// ---------------------------------------------------------------------------
// Question generation
// ---------------------------------------------------------------------------

function chooseWrongTitle(track: TrackContext, pool: TrackContext[]): TrackContext | null {
  const targetArtist = track.track_artist.toLowerCase();
  const targetTitle = track.track_title.toLowerCase();
  return (
    pool.find((c) => c.track_artist.toLowerCase() === targetArtist && c.track_title.toLowerCase() !== targetTitle) ??
    pool.find((c) => c.track_title.toLowerCase() !== targetTitle) ??
    null
  );
}

function chooseWrongArtist(track: TrackContext, pool: TrackContext[]): TrackContext | null {
  const targetArtist = track.track_artist.toLowerCase();
  return pool.find((c) => c.track_artist.toLowerCase() !== targetArtist) ?? null;
}

function chooseYearNeighbor(track: TrackContext, pool: TrackContext[]): TrackContext | null {
  if (!isValidYear(track.year_int)) return null;
  return pool.find((c) => isValidYear(c.year_int) && Math.abs((c.year_int as number) - (track.year_int as number)) >= 2) ?? null;
}

function buildQuestionCandidates(
  track: TrackContext,
  pool: TrackContext[],
  opts: { random: () => number; category: string; difficulty: DifficultyLevel; sourceLabel: string }
): DraftQuestion[] {
  const { random, category, difficulty, sourceLabel } = opts;
  const candidates: DraftQuestion[] = [];
  const artist = normalizeText(track.track_artist || track.album_artist);
  const title = normalizeText(track.track_title);
  const album = normalizeText(track.album_title);
  const label = normalizeText(track.label);
  const year = isValidYear(track.year_int) ? (track.year_int as number) : null;
  const decadeNum = isValidYear(track.decade) ? (track.decade as number) : year !== null ? Math.floor(year / 10) * 10 : null;
  const decadeLabel = decadeNum !== null ? `${decadeNum}s` : null;
  const sourceSlug = slugify(sourceLabel);

  const base = {
    source_note: `Generated from ${sourceLabel}`,
    default_category: category,
    facet_difficulty: difficulty,
    era: decadeLabel,
    genre: null,
    decade: decadeLabel,
    region: normalizeText(track.country) || null,
  };

  const cueSourcePayload = {
    inventory_id: track.inventory_id,
    release_id: track.release_id,
    release_track_id: track.release_track_id,
    artist,
    album,
    title,
    side: track.side,
    position: track.position,
  };

  // Artist and Title
  const wrongTitleTrack = chooseWrongTitle(track, pool);
  if (artist && title && wrongTitleTrack) {
    const wrongTitle = normalizeText(wrongTitleTrack.track_title);
    if (wrongTitle) {
      candidates.push({
        ...base,
        facet_category: "Artist and Title",
        question_type: "multiple_choice",
        prompt_text: `Which track title belongs to ${artist}?`,
        answer_key: title,
        accepted_answers: [title],
        options_payload: shuffle([title, wrongTitle, album || `Another ${artist} track`].filter(Boolean), random),
        explanation_text: `${artist} recorded "${title}"${album ? ` on ${album}` : ""}.`,
        display_element_type: "song",
        tags: ["collection-generated", "artist-title", sourceSlug].filter(Boolean),
        cue_source_payload: cueSourcePayload,
      });
    }
  }

  // Who Recorded It
  const wrongArtistTrack = chooseWrongArtist(track, pool);
  if (artist && title && wrongArtistTrack) {
    const wrongArtist = normalizeText(wrongArtistTrack.track_artist || wrongArtistTrack.album_artist);
    if (wrongArtist) {
      candidates.push({
        ...base,
        facet_category: "Who Recorded It",
        question_type: "multiple_choice",
        prompt_text: `Who recorded "${title}"?`,
        answer_key: artist,
        accepted_answers: [artist],
        options_payload: shuffle([artist, wrongArtist].filter(Boolean), random),
        explanation_text: `${artist} recorded "${title}"${album ? ` on ${album}` : ""}.`,
        display_element_type: "artist",
        tags: ["collection-generated", "who-recorded-it", sourceSlug].filter(Boolean),
        cue_source_payload: cueSourcePayload,
      });
    }
  }

  // Release Year
  const yearNeighbor = chooseYearNeighbor(track, pool);
  if (title && year !== null && yearNeighbor && isValidYear(yearNeighbor.year_int)) {
    const yearAnswer = String(year);
    const decoyA = String(yearNeighbor.year_int);
    const decoyB = decadeNum !== null ? String(decadeNum) : String(year + 2);
    candidates.push({
      ...base,
      facet_category: "Release Year",
      question_type: "multiple_choice",
      prompt_text: `In what year was "${title}" released?`,
      answer_key: yearAnswer,
      accepted_answers: [yearAnswer],
      options_payload: shuffle(Array.from(new Set([yearAnswer, decoyA, decoyB])).filter(Boolean), random),
      explanation_text: `${artist || "This track"} was released in ${yearAnswer}${album ? ` on ${album}` : ""}.`,
      display_element_type: "album",
      tags: ["collection-generated", "release-year", sourceSlug].filter(Boolean),
      cue_source_payload: cueSourcePayload,
    });
  }

  // Label Match
  if (artist && label) {
    candidates.push({
      ...base,
      facet_category: "Label Match",
      question_type: "free_response",
      prompt_text: `Which label released "${title}" by ${artist}?`,
      answer_key: label,
      accepted_answers: Array.from(new Set([label, ...track.labels.map((l) => normalizeText(l)).filter(Boolean)])),
      options_payload: [],
      explanation_text: `${artist} released "${title}"${album ? ` on ${album}` : ""} via ${label}.`,
      display_element_type: "album",
      tags: ["collection-generated", "label-match", sourceSlug].filter(Boolean),
      cue_source_payload: cueSourcePayload,
    });
  }

  return candidates;
}

function dedupeTrackPool(tracks: TrackContext[]): TrackContext[] {
  const seen = new Set<string>();
  const out: TrackContext[] = [];
  for (const t of tracks) {
    const key = [t.track_key, t.inventory_id, t.release_track_id, t.recording_id].map(String).join("::");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

function buildAllPayloads(tracks: TrackContext[], opts: GenerateOptions, sourceLabel: string): DraftQuestion[] {
  const random = createSeededRandom(opts.seed);
  const pool = shuffle(dedupeTrackPool(tracks), random);
  const limited = pool.slice(0, Math.max(opts.limit, 1));
  const payloads: DraftQuestion[] = [];
  for (const track of limited) {
    payloads.push(
      ...buildQuestionCandidates(track, pool, {
        random,
        category: opts.category,
        difficulty: opts.difficulty,
        sourceLabel,
      })
    );
  }
  return payloads;
}

// ---------------------------------------------------------------------------
// Insert
// ---------------------------------------------------------------------------

async function insertQuestions(payloads: DraftQuestion[], createdBy: string): Promise<number> {
  const triviaDb = getTriviaDb();
  let count = 0;
  const now = new Date().toISOString();

  for (const payload of payloads) {
    // Unique code
    let code = "";
    for (let i = 0; i < 20; i += 1) {
      const candidate = generateTriviaQuestionCode();
      const { data } = await triviaDb.from("trivia_questions").select("id").eq("question_code", candidate).maybeSingle();
      if (!data) { code = candidate; break; }
    }
    if (!code) throw new Error("Could not generate unique question code");

    const { data: question, error: qErr } = await triviaDb
      .from("trivia_questions")
      .insert({
        question_code: code,
        status: "draft",
        question_type: payload.question_type,
        prompt_text: payload.prompt_text,
        answer_key: payload.answer_key,
        accepted_answers: payload.accepted_answers,
        answer_payload: {},
        options_payload: payload.options_payload,
        reveal_payload: {},
        display_element_type: payload.display_element_type,
        explanation_text: payload.explanation_text,
        default_category: payload.default_category,
        default_difficulty: payload.facet_difficulty,
        source_note: payload.source_note,
        is_tiebreaker_eligible: true,
        cue_source_type: "inventory_track",
        cue_source_payload: payload.cue_source_payload,
        primary_cue_start_seconds: 0,
        primary_cue_end_seconds: null,
        primary_cue_instruction: null,
        cue_notes_text: null,
        cue_payload: { segments: [] },
        created_by: createdBy,
        updated_by: createdBy,
        created_at: now,
        updated_at: now,
      })
      .select("id, question_code")
      .single();
    if (qErr || !question) throw new Error(qErr?.message ?? "Insert failed");

    const { error: fErr } = await triviaDb.from("trivia_question_facets").upsert({
      question_id: question.id,
      era: payload.era,
      genre: payload.genre,
      decade: payload.decade,
      region: payload.region,
      language: null,
      has_media: false,
      has_required_cue: true,
      difficulty: payload.facet_difficulty,
      category: payload.facet_category,
    }, { onConflict: "question_id" });
    if (fErr) throw new Error(fErr.message);

    if (payload.tags.length > 0) {
      const { error: tErr } = await triviaDb.from("trivia_question_tags").insert(
        payload.tags.map((tag) => ({ question_id: question.id, tag }))
      );
      if (tErr) throw new Error(tErr.message);
    }

    count += 1;
  }

  return count;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

function parseDifficulty(value: unknown): DifficultyLevel {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "easy" || raw === "medium" || raw === "hard") return raw;
  return "medium";
}

export async function POST(request: NextRequest) {
  if (!TRIVIA_BANK_ENABLED) {
    return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const source = String(body.source ?? "collection").trim().toLowerCase();
  if (source !== "collection" && source !== "playlists") {
    return NextResponse.json({ error: "source must be 'collection' or 'playlists'" }, { status: 400 });
  }

  const playlistIds = Array.isArray(body.playlistIds)
    ? (body.playlistIds as unknown[]).map(Number).filter((id) => Number.isFinite(id) && id > 0)
    : [];
  if (source === "playlists" && playlistIds.length === 0) {
    return NextResponse.json({ error: "playlistIds required when source=playlists" }, { status: 400 });
  }

  const limitRaw = Number(body.limit ?? 25);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(200, Math.floor(limitRaw)) : 25;
  const seed = String(body.seed ?? "").trim();
  const difficulty = parseDifficulty(body.difficulty);
  const category = String(body.category ?? "Collection Generator").trim() || "Collection Generator";
  const apply = body.apply === true;
  const createdBy = String(body.createdBy ?? "collection-trivia-generator").trim() || "collection-trivia-generator";

  try {
    const { tracks, sourceLabel } = await resolveTrackPool(source, playlistIds);
    const payloads = buildAllPayloads(tracks, { source, playlistIds, limit, seed, difficulty, category, apply, createdBy }, sourceLabel);

    const sampleQuestions = payloads.slice(0, 20).map((p) => ({
      category: p.facet_category,
      question_type: p.question_type,
      prompt_text: p.prompt_text,
      answer_key: p.answer_key,
      options_payload: p.options_payload,
      tags: p.tags,
    }));

    if (!apply) {
      return NextResponse.json({
        mode: "dry-run",
        source,
        sourceLabel,
        trackCount: tracks.length,
        questionCount: payloads.length,
        questions: sampleQuestions,
      });
    }

    const insertedCount = await insertQuestions(payloads, createdBy);

    return NextResponse.json({
      mode: "apply",
      source,
      sourceLabel,
      trackCount: tracks.length,
      questionCount: payloads.length,
      insertedCount,
      questions: sampleQuestions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate-from-collection]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
