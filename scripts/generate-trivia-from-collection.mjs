#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const QUESTION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length) {
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += QUESTION_CODE_ALPHABET[Math.floor(Math.random() * QUESTION_CODE_ALPHABET.length)] ?? "X";
  }
  return output;
}

function generateTriviaQuestionCode() {
  return `TQ-${randomCode(7)}`;
}

function parseArgs(argv) {
  const args = {
    apply: false,
    source: "collection",
    playlistIds: [],
    limit: 25,
    seed: "",
    createdBy: "collection-trivia-generator",
    difficulty: "medium",
    category: "Collection Generator",
    output: "",
  };

  for (const token of argv.slice(2)) {
    if (token === "--apply") args.apply = true;
    if (token.startsWith("--source=")) args.source = token.slice("--source=".length).trim();
    if (token.startsWith("--playlist-ids=")) {
      args.playlistIds = token
        .slice("--playlist-ids=".length)
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);
    }
    if (token.startsWith("--limit=")) {
      const parsed = Number(token.slice("--limit=".length));
      if (Number.isFinite(parsed) && parsed > 0) args.limit = Math.floor(parsed);
    }
    if (token.startsWith("--seed=")) args.seed = token.slice("--seed=".length).trim();
    if (token.startsWith("--created-by=")) args.createdBy = token.slice("--created-by=".length).trim() || args.createdBy;
    if (token.startsWith("--difficulty=")) args.difficulty = token.slice("--difficulty=".length).trim() || args.difficulty;
    if (token.startsWith("--category=")) args.category = token.slice("--category=".length).trim() || args.category;
    if (token.startsWith("--output=")) args.output = token.slice("--output=".length).trim();
  }

  return args;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function formatError(error) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

async function fetchAllRows(queryBuilderFactory, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await queryBuilderFactory().range(from, to);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function isValidYear(value) {
  return Number.isInteger(value) && value > 0;
}

function normalizePositionKey(position) {
  const raw = normalizeText(position);
  if (!raw) return null;
  return raw.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function buildPositionLookupKeys(position, side) {
  const keys = new Set();
  const normalizedPosition = normalizePositionKey(position);
  const normalizedSide = normalizePositionKey(side)?.slice(0, 1) ?? null;

  if (normalizedPosition) {
    keys.add(normalizedPosition);
    const numericPart = normalizedPosition.replace(/^[A-Z]+/, "");
    if (numericPart) keys.add(numericPart);
    if (normalizedSide) {
      keys.add(`${normalizedSide}${numericPart || normalizedPosition}`);
    }
  }

  return Array.from(keys);
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeCandidateKey(track) {
  return [track.track_key, track.inventory_id, track.release_track_id, track.recording_id].map((value) => String(value ?? "")).join("::");
}

function parseTrackKey(trackKey) {
  const parts = String(trackKey ?? "").split(":");
  const inventoryIdRaw = Number.parseInt(parts[0] ?? "", 10);
  const inventoryId = Number.isFinite(inventoryIdRaw) ? inventoryIdRaw : null;

  if (parts.length === 2 && inventoryId !== null) {
    const position = (parts[1] ?? "").trim();
    if (position) {
      return { inventoryId, releaseTrackId: null, recordingId: null, fallbackPosition: position };
    }
  }

  if (parts[1] === "fallback") {
    const releaseTrackIdRaw = Number.parseInt(parts[2] ?? "", 10);
    const recordingIdRaw = Number.parseInt(parts[3] ?? "", 10);
    return {
      inventoryId,
      releaseTrackId: Number.isFinite(releaseTrackIdRaw) ? releaseTrackIdRaw : null,
      recordingId: Number.isFinite(recordingIdRaw) ? recordingIdRaw : null,
      fallbackPosition: null,
    };
  }

  const releaseTrackIdRaw = Number.parseInt(parts[1] ?? "", 10);
  const recordingIdRaw = Number.parseInt(parts[2] ?? "", 10);
  return {
    inventoryId,
    releaseTrackId: Number.isFinite(releaseTrackIdRaw) ? releaseTrackIdRaw : null,
    recordingId: Number.isFinite(recordingIdRaw) ? recordingIdRaw : null,
    fallbackPosition: null,
  };
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return function next() {
    value |= 0;
    value = (value + 0x6D2B79F5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeededRandom(seedText) {
  if (!seedText) return Math.random;
  let seed = 0;
  for (const char of seedText) {
    seed = ((seed * 31) + char.charCodeAt(0)) >>> 0;
  }
  return mulberry32(seed || 1);
}

function shuffle(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function chooseWrongTitle(track, pool) {
  const targetArtist = normalizeText(track.track_artist).toLowerCase();
  const targetTitle = normalizeText(track.track_title).toLowerCase();
  return pool.find((candidate) => {
    return normalizeText(candidate.track_artist).toLowerCase() === targetArtist && normalizeText(candidate.track_title).toLowerCase() !== targetTitle;
  }) ?? pool.find((candidate) => normalizeText(candidate.track_title).toLowerCase() !== targetTitle) ?? null;
}

function chooseWrongArtist(track, pool) {
  const targetArtist = normalizeText(track.track_artist).toLowerCase();
  const targetTitle = normalizeText(track.track_title).toLowerCase();
  return pool.find((candidate) => {
    return normalizeText(candidate.track_title).toLowerCase() === targetTitle && normalizeText(candidate.track_artist).toLowerCase() !== targetArtist;
  }) ?? pool.find((candidate) => normalizeText(candidate.track_artist).toLowerCase() !== targetArtist) ?? null;
}

function chooseYearNeighbor(track, pool) {
  if (!isValidYear(track.year_int)) return null;
  return pool.find((candidate) => isValidYear(candidate.year_int) && Math.abs(candidate.year_int - track.year_int) >= 2) ?? null;
}

function buildQuestionCandidates(track, pool, context) {
  const candidates = [];
  const artist = normalizeText(track.track_artist || track.album_artist);
  const title = normalizeText(track.track_title);
  const album = normalizeText(track.album_title);
  const label = normalizeText(track.label);
  const year = isValidYear(track.year_int) ? track.year_int : null;
  const decade = Number.isFinite(track.decade) ? track.decade : year !== null ? Math.floor(year / 10) * 10 : null;

  const wrongTitle = chooseWrongTitle(track, pool);
  if (artist && title && wrongTitle && normalizeText(wrongTitle.track_title)) {
    candidates.push({
      category: "Artist and Title",
      question_type: "multiple_choice",
      prompt_text: `Which track title belongs to ${artist}?`,
      answer_key: title,
      accepted_answers: [title],
      options_payload: shuffle([title, normalizeText(wrongTitle.track_title), album || `Another ${artist} track`].filter(Boolean), context.random),
      explanation_text: `${artist} recorded ${title}${album ? ` on ${album}` : ""}.`,
      source_note: `Generated from ${context.sourceLabel}`,
      default_category: context.category,
      default_difficulty: context.difficulty,
      cue_source_type: "inventory_track",
      cue_source_payload: {
        inventory_id: track.inventory_id,
        release_id: track.release_id,
        release_track_id: track.release_track_id,
        artist,
        album,
        title,
        side: track.side,
        position: track.position,
      },
      primary_cue_start_seconds: 0,
      primary_cue_end_seconds: null,
      primary_cue_instruction: null,
      cue_notes_text: null,
      cue_payload: { segments: [] },
      reveal_payload: {},
      display_element_type: "song",
      tags: ["collection-generated", "artist-title", slugify(context.sourceLabel)].filter(Boolean),
      facet_category: "Artist and Title",
      facet_difficulty: context.difficulty,
      genre: Array.isArray(track.genres) ? track.genres[0] ?? null : null,
      decade: decade !== null ? `${decade}s` : null,
      era: decade !== null ? `${decade}s` : null,
      language: null,
      region: normalizeText(track.country) || null,
      has_media: false,
      is_tiebreaker_eligible: true,
    });
  }

  const wrongArtist = chooseWrongArtist(track, pool);
  if (artist && title && wrongArtist && normalizeText(wrongArtist.track_artist || wrongArtist.album_artist)) {
    candidates.push({
      category: "Who Recorded It",
      question_type: "multiple_choice",
      prompt_text: `Who recorded \"${title}\"?`,
      answer_key: artist,
      accepted_answers: [artist],
      options_payload: shuffle([artist, normalizeText(wrongArtist.track_artist || wrongArtist.album_artist), normalizeText(track.album_artist)].filter(Boolean), context.random),
      explanation_text: `${artist} recorded \"${title}\"${album ? ` on ${album}` : ""}.`,
      source_note: `Generated from ${context.sourceLabel}`,
      default_category: context.category,
      default_difficulty: context.difficulty,
      cue_source_type: "inventory_track",
      cue_source_payload: {
        inventory_id: track.inventory_id,
        release_id: track.release_id,
        release_track_id: track.release_track_id,
        artist,
        album,
        title,
        side: track.side,
        position: track.position,
      },
      primary_cue_start_seconds: 0,
      primary_cue_end_seconds: null,
      primary_cue_instruction: null,
      cue_notes_text: null,
      cue_payload: { segments: [] },
      reveal_payload: {},
      display_element_type: "artist",
      tags: ["collection-generated", "who-recorded-it", slugify(context.sourceLabel)].filter(Boolean),
      facet_category: "Who Recorded It",
      facet_difficulty: context.difficulty,
      genre: Array.isArray(track.genres) ? track.genres[0] ?? null : null,
      decade: decade !== null ? `${decade}s` : null,
      era: decade !== null ? `${decade}s` : null,
      language: null,
      region: normalizeText(track.country) || null,
      has_media: false,
      is_tiebreaker_eligible: true,
    });
  }

  const yearNeighbor = chooseYearNeighbor(track, pool);
  if (title && year !== null && yearNeighbor && Number.isFinite(yearNeighbor.year_int)) {
    const yearAnswer = String(year);
    const decoyA = String(yearNeighbor.year_int);
    const decoyB = decade !== null ? String(decade) : String(year + 1);
    candidates.push({
      category: "Release Year",
      question_type: "multiple_choice",
      prompt_text: `In what year was \"${title}\" released?`,
      answer_key: yearAnswer,
      accepted_answers: [yearAnswer],
      options_payload: shuffle(Array.from(new Set([yearAnswer, decoyA, decoyB])).filter(Boolean), context.random),
      explanation_text: `${artist || "This track"} was released in ${yearAnswer}${album ? ` on ${album}` : ""}.`,
      source_note: `Generated from ${context.sourceLabel}`,
      default_category: context.category,
      default_difficulty: context.difficulty,
      cue_source_type: "inventory_track",
      cue_source_payload: {
        inventory_id: track.inventory_id,
        release_id: track.release_id,
        release_track_id: track.release_track_id,
        artist,
        album,
        title,
        side: track.side,
        position: track.position,
      },
      primary_cue_start_seconds: 0,
      primary_cue_end_seconds: null,
      primary_cue_instruction: null,
      cue_notes_text: null,
      cue_payload: { segments: [] },
      reveal_payload: {},
      display_element_type: "album",
      tags: ["collection-generated", "release-year", slugify(context.sourceLabel)].filter(Boolean),
      facet_category: "Release Year",
      facet_difficulty: context.difficulty,
      genre: Array.isArray(track.genres) ? track.genres[0] ?? null : null,
      decade: decade !== null ? `${decade}s` : null,
      era: decade !== null ? `${decade}s` : null,
      language: null,
      region: normalizeText(track.country) || null,
      has_media: false,
      is_tiebreaker_eligible: true,
    });
  }

  if (artist && label) {
    candidates.push({
      category: "Label Match",
      question_type: "free_response",
      prompt_text: `Which label released \"${title}\" by ${artist}?`,
      answer_key: label,
      accepted_answers: [label, ...(Array.isArray(track.labels) ? track.labels.map((entry) => normalizeText(entry)).filter(Boolean) : [])],
      options_payload: [],
      explanation_text: `${artist}${album ? ` released ${title} on ${album}` : ` released ${title}`} via ${label}.`,
      source_note: `Generated from ${context.sourceLabel}`,
      default_category: context.category,
      default_difficulty: context.difficulty,
      cue_source_type: "inventory_track",
      cue_source_payload: {
        inventory_id: track.inventory_id,
        release_id: track.release_id,
        release_track_id: track.release_track_id,
        artist,
        album,
        title,
        side: track.side,
        position: track.position,
      },
      primary_cue_start_seconds: 0,
      primary_cue_end_seconds: null,
      primary_cue_instruction: null,
      cue_notes_text: null,
      cue_payload: { segments: [] },
      reveal_payload: {},
      display_element_type: "album",
      tags: ["collection-generated", "label-match", slugify(context.sourceLabel)].filter(Boolean),
      facet_category: "Label Match",
      facet_difficulty: context.difficulty,
      genre: Array.isArray(track.genres) ? track.genres[0] ?? null : null,
      decade: decade !== null ? `${decade}s` : null,
      era: decade !== null ? `${decade}s` : null,
      language: null,
      region: normalizeText(track.country) || null,
      has_media: false,
      is_tiebreaker_eligible: true,
    });
  }

  return candidates;
}

async function generateUniqueQuestionCode(db) {
  for (let index = 0; index < 20; index += 1) {
    const code = generateTriviaQuestionCode();
    const { data } = await db.from("trivia_questions").select("id").eq("question_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique question code");
}

async function fetchPlaylistRows(db, playlistIds) {
  if (playlistIds.length === 0) return [];
  const { data, error } = await db
    .from("collection_playlists")
    .select("id, name, is_smart, smart_rules, match_rules")
    .in("id", playlistIds)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Failed to load playlists: ${error.message}`);
  return data ?? [];
}

async function fetchInventoryTracks(db) {
  try {
    return await fetchAllRows(
      () => db
        .from("inventory")
        .select("id, release_id, release:releases(id, label, country, release_year, master:masters(title, artist:artists(name)))")
        .order("id", { ascending: true })
    );
  } catch (error) {
    throw new Error(`Failed to load inventory: ${formatError(error)}`);
  }
}

async function fetchReleaseTracks(db, releaseIds) {
  if (releaseIds.length === 0) return [];
  try {
    const rows = [];
    for (const releaseIdChunk of chunkArray(releaseIds, 250)) {
      const chunkRows = await fetchAllRows(
        () => db
          .from("release_tracks")
          .select("id, release_id, recording_id, position, side, title_override")
          .in("release_id", releaseIdChunk)
          .order("id", { ascending: true })
      );
      rows.push(...chunkRows);
    }
    return rows;
  } catch (error) {
    throw new Error(`Failed to load release tracks: ${formatError(error)}`);
  }
}

async function fetchRecordings(db, recordingIds) {
  if (recordingIds.length === 0) return [];
  try {
    const rows = [];
    for (const recordingIdChunk of chunkArray(recordingIds, 250)) {
      const chunkRows = await fetchAllRows(
        () => db
          .from("recordings")
          .select("id, title, track_artist, credits, lyrics, lyrics_url")
          .in("id", recordingIdChunk)
          .order("id", { ascending: true })
      );
      rows.push(...chunkRows);
    }
    return rows;
  } catch (error) {
    throw new Error(`Failed to load recordings: ${formatError(error)}`);
  }
}

async function fetchPlaylistItems(db, playlistIds) {
  if (playlistIds.length === 0) return [];
  try {
    return await fetchAllRows(
      () => db
        .from("collection_playlist_items")
        .select("playlist_id, track_key, sort_order")
        .in("playlist_id", playlistIds)
        .order("sort_order", { ascending: true })
    );
  } catch (error) {
    throw new Error(`Failed to load playlist items: ${formatError(error)}`);
  }
}

function indexBy(items, keyName) {
  const map = new Map();
  for (const item of items) {
    map.set(item[keyName], item);
  }
  return map;
}

async function resolveTrackPool(db, args) {
  const inventoryRows = await fetchInventoryTracks(db);
  const inventoryById = indexBy(inventoryRows, "id");
  const releaseIds = Array.from(new Set(inventoryRows.map((row) => row.release_id).filter((value) => Number.isFinite(value) && value > 0)));
  const releaseTrackRows = await fetchReleaseTracks(db, releaseIds);
  const releaseTrackById = indexBy(releaseTrackRows, "id");
  const releaseTrackByReleaseAndPosition = new Map();
  for (const releaseTrack of releaseTrackRows) {
    if (!releaseTrack.release_id) continue;
    for (const key of buildPositionLookupKeys(releaseTrack.position, releaseTrack.side)) {
      releaseTrackByReleaseAndPosition.set(`${releaseTrack.release_id}:${key}`, releaseTrack);
    }
  }
  const recordingIds = Array.from(new Set(releaseTrackRows.map((row) => row.recording_id).filter((value) => Number.isFinite(value) && value > 0)));
  const recordingRows = await fetchRecordings(db, recordingIds);
  const recordingById = indexBy(recordingRows, "id");

  const getInventoryContext = (inventory) => {
    const release = inventory?.release ?? null;
    const master = release?.master ?? null;
    const artist = master?.artist ?? null;
    return {
      albumTitle: normalizeText(master?.title),
      albumArtist: normalizeText(artist?.name),
      yearInt: isValidYear(release?.release_year) ? release.release_year : null,
      country: normalizeText(release?.country) || null,
      label: normalizeText(release?.label) || null,
    };
  };

  const buildTrackFromKey = (trackKey, playlistId = null) => {
    const parsed = parseTrackKey(trackKey);
    if (!parsed.inventoryId) return null;
    const inventory = inventoryById.get(parsed.inventoryId);
    if (!inventory) return null;
    const inventoryContext = getInventoryContext(inventory);
    const fallbackKey = parsed.fallbackPosition && inventory.release_id
      ? releaseTrackByReleaseAndPosition.get(`${inventory.release_id}:${normalizePositionKey(parsed.fallbackPosition)}`)
      : null;
    const releaseTrack = parsed.releaseTrackId ? releaseTrackById.get(parsed.releaseTrackId) : fallbackKey;
    const recording = releaseTrack?.recording_id ? recordingById.get(releaseTrack.recording_id) : null;
    const trackTitle = normalizeText(releaseTrack?.title_override || recording?.title);
    const trackArtist = normalizeText(recording?.track_artist || inventoryContext.albumArtist);
    if (!trackTitle || !trackArtist) return null;
    return {
      track_key: trackKey,
      playlist_id: playlistId,
      inventory_id: inventory.id,
      release_id: inventory.release_id,
      release_track_id: releaseTrack?.id ?? null,
      recording_id: releaseTrack?.recording_id ?? null,
      track_title: trackTitle,
      track_artist: trackArtist,
      album_title: inventoryContext.albumTitle,
      album_artist: inventoryContext.albumArtist,
      position: releaseTrack?.position ?? parsed.fallbackPosition,
      side: releaseTrack?.side ?? null,
      year_int: inventoryContext.yearInt,
      decade: isValidYear(inventoryContext.yearInt) ? Math.floor(inventoryContext.yearInt / 10) * 10 : null,
      country: inventoryContext.country,
      label: inventoryContext.label,
      labels: inventoryContext.label ? [inventoryContext.label] : [],
      genres: [],
    };
  };

  if (args.source === "collection") {
    const tracks = [];
    for (const releaseTrack of releaseTrackRows) {
      const inventory = inventoryRows.find((row) => row.release_id === releaseTrack.release_id);
      if (!inventory) continue;
      const inventoryContext = getInventoryContext(inventory);
      const recording = releaseTrack.recording_id ? recordingById.get(releaseTrack.recording_id) : null;
      const trackTitle = normalizeText(releaseTrack.title_override || recording?.title);
      const trackArtist = normalizeText(recording?.track_artist || inventoryContext.albumArtist);
      if (!trackTitle || !trackArtist) continue;
      tracks.push({
        track_key: `${inventory.id}:fallback:${releaseTrack.id}:${releaseTrack.recording_id ?? ""}`,
        playlist_id: null,
        inventory_id: inventory.id,
        release_id: inventory.release_id,
        release_track_id: releaseTrack.id,
        recording_id: releaseTrack.recording_id ?? null,
        track_title: trackTitle,
        track_artist: trackArtist,
        album_title: inventoryContext.albumTitle,
        album_artist: inventoryContext.albumArtist,
        position: releaseTrack.position ?? null,
        side: releaseTrack.side ?? null,
        year_int: inventoryContext.yearInt,
        decade: isValidYear(inventoryContext.yearInt) ? Math.floor(inventoryContext.yearInt / 10) * 10 : null,
        country: inventoryContext.country,
        label: inventoryContext.label,
        labels: inventoryContext.label ? [inventoryContext.label] : [],
        genres: [],
      });
    }
    return { tracks, sourceLabel: "full collection" };
  }

  const playlists = await fetchPlaylistRows(db, args.playlistIds);
  const items = await fetchPlaylistItems(db, args.playlistIds);
  const tracks = items
    .map((item) => buildTrackFromKey(item.track_key, item.playlist_id))
    .filter(Boolean);
  const sourceLabel = playlists.map((playlist) => playlist.name).join(", ") || "selected playlists";
  return { tracks, sourceLabel };
}

function dedupeTracks(tracks) {
  const seen = new Set();
  const output = [];
  for (const track of tracks) {
    const key = makeCandidateKey(track);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(track);
  }
  return output;
}

function buildDraftPayloads(tracks, args, sourceLabel) {
  const random = createSeededRandom(args.seed);
  const shuffled = shuffle(dedupeTracks(tracks), random);
  const limited = shuffled.slice(0, Math.max(args.limit, 1));
  const payloads = [];

  for (const track of limited) {
    const candidates = buildQuestionCandidates(track, shuffled, {
      random,
      category: args.category,
      difficulty: args.difficulty,
      sourceLabel,
    });
    for (const candidate of candidates) {
      payloads.push(candidate);
    }
  }

  return payloads;
}

async function insertDraftQuestions(db, payloads, createdBy) {
  const inserted = [];
  for (const payload of payloads) {
    const questionCode = await generateUniqueQuestionCode(db);
    const now = new Date().toISOString();
    const { data: question, error: questionError } = await db
      .from("trivia_questions")
      .insert({
        question_code: questionCode,
        status: "draft",
        question_type: payload.question_type,
        prompt_text: payload.prompt_text,
        answer_key: payload.answer_key,
        accepted_answers: payload.accepted_answers,
        answer_payload: {},
        options_payload: payload.options_payload,
        reveal_payload: payload.reveal_payload,
        display_element_type: payload.display_element_type,
        explanation_text: payload.explanation_text,
        default_category: payload.default_category,
        default_difficulty: payload.default_difficulty,
        source_note: payload.source_note,
        is_tiebreaker_eligible: true,
        cue_source_type: payload.cue_source_type,
        cue_source_payload: payload.cue_source_payload,
        primary_cue_start_seconds: payload.primary_cue_start_seconds,
        primary_cue_end_seconds: payload.primary_cue_end_seconds,
        primary_cue_instruction: payload.primary_cue_instruction,
        cue_notes_text: payload.cue_notes_text,
        cue_payload: payload.cue_payload,
        created_by: createdBy,
        updated_by: createdBy,
        created_at: now,
        updated_at: now,
      })
      .select("id, question_code")
      .single();
    if (questionError || !question) {
      throw new Error(questionError?.message ?? `Failed to create question for ${payload.prompt_text}`);
    }

    const { error: facetsError } = await db.from("trivia_question_facets").upsert({
      question_id: question.id,
      era: payload.era,
      genre: payload.genre,
      decade: payload.decade,
      region: payload.region,
      language: payload.language,
      has_media: false,
      has_required_cue: true,
      difficulty: payload.facet_difficulty,
      category: payload.facet_category,
    }, { onConflict: "question_id" });
    if (facetsError) throw new Error(facetsError.message);

    if (payload.tags.length > 0) {
      const { error: tagsError } = await db.from("trivia_question_tags").insert(
        payload.tags.map((tag) => ({ question_id: question.id, tag }))
      );
      if (tagsError) throw new Error(tagsError.message);
    }

    inserted.push({ id: question.id, question_code: question.question_code, prompt_text: payload.prompt_text });
  }
  return inserted;
}

async function main() {
  const args = parseArgs(process.argv);
  const db = getSupabase();

  if (args.source === "playlists" && args.playlistIds.length === 0) {
    throw new Error("--playlist-ids is required when --source=playlists");
  }

  const { tracks, sourceLabel } = await resolveTrackPool(db, args);
  const payloads = buildDraftPayloads(tracks, args, sourceLabel);

  const result = {
    mode: args.apply ? "apply" : "dry-run",
    source: args.source,
    sourceLabel,
    selectedPlaylistIds: args.playlistIds,
    trackCount: tracks.length,
    generatedQuestionCount: payloads.length,
    sample: payloads.slice(0, 10).map((payload) => ({
      category: payload.facet_category,
      prompt_text: payload.prompt_text,
      answer_key: payload.answer_key,
      tags: payload.tags,
    })),
  };

  if (!args.apply) {
    const json = JSON.stringify(result, null, 2);
    if (args.output) {
      await writeFile(args.output, `${json}\n`, "utf8");
      console.log(JSON.stringify({ ...result, output: args.output }, null, 2));
      return;
    }
    console.log(json);
    return;
  }

  const inserted = await insertDraftQuestions(db, payloads, args.createdBy);
  console.log(JSON.stringify({ ...result, insertedCount: inserted.length, inserted: inserted.slice(0, 20) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});