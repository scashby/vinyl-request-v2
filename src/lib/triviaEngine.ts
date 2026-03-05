import type { TriviaDbClient } from "src/lib/triviaDb";
import type { BingoDbClient } from "src/lib/bingoDb";
import { parseTrackKey, resolvePlaylistTracks } from "src/lib/bingoEngine";

export type TriviaSessionStatus = "pending" | "running" | "paused" | "completed";
export type TriviaCallStatus = "pending" | "asked" | "answer_revealed" | "scored" | "skipped";
export type TriviaDifficulty = "easy" | "medium" | "hard";
export type TriviaScoreMode = "standard" | "difficulty_bonus_static";
export type TriviaPrepStatus = "draft" | "ready";
export type TriviaDisplayElementType = "song" | "artist" | "album" | "cover_art" | "vinyl_label";

export type TriviaSessionCountdownRow = {
  status: TriviaSessionStatus;
  target_gap_seconds: number;
  countdown_started_at: string | null;
  paused_remaining_seconds: number | null;
  paused_at: string | null;
};

export type CreateTriviaCallsInput = {
  sessionId: number;
  playlistId: number;
  roundCount: number;
  questionsPerRound: number;
  tieBreakerCount: number;
  categories: string[];
  scoreMode: TriviaScoreMode;
  difficultyTargets?: Partial<Record<TriviaDifficulty, number>>;
  questionDeck?: TriviaQuestionDeckEntry[];
};

export type TriviaQuestionDeckEntry = {
  questionText: string;
  answerKey: string;
  acceptedAnswers?: string[];
  category?: string;
  difficulty?: TriviaDifficulty;
  displayElementType?: TriviaDisplayElementType;
  sourceNote?: string | null;
  prepStatus?: TriviaPrepStatus;
};

type TriviaCallInsertRow = {
  session_id: number;
  round_number: number;
  call_index: number;
  playlist_track_key: string | null;
  question_id: number | null;
  question_type: "free_response" | "multiple_choice" | "true_false" | "ordering";
  is_tiebreaker: boolean;
  category: string;
  difficulty: TriviaDifficulty;
  question_text: string;
  answer_key: string;
  accepted_answers: string[];
  options_payload: JsonValue;
  answer_payload: JsonValue;
  explanation_text: string | null;
  reveal_payload: JsonValue;
  source_note: string | null;
  cue_notes_text: string | null;
  cue_payload: JsonValue;
  prep_status: TriviaPrepStatus;
  display_element_type: TriviaDisplayElementType;
  display_image_override_url: string | null;
  auto_cover_art_url: string | null;
  auto_vinyl_label_url: string | null;
  source_artist: string | null;
  source_title: string | null;
  source_album: string | null;
  source_side: string | null;
  source_position: string | null;
  base_points: number;
  bonus_points: number;
  status: TriviaCallStatus;
};

type TrackArtworkSeed = {
  playlistTrackKey: string;
  sourceArtist: string | null;
  sourceTitle: string | null;
  sourceAlbum: string | null;
  sourceSide: string | null;
  sourcePosition: string | null;
  autoCoverArtUrl: string | null;
  autoVinylLabelUrl: string | null;
};

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue | undefined } | JsonValue[];

const DEFAULT_CATEGORIES = [
  "General Music",
  "Classic Rock",
  "Soul & Funk",
  "Hip-Hop",
  "80s",
  "90s",
  "One-Hit Wonders",
];

const DISPLAY_ELEMENT_SEQUENCE: TriviaDisplayElementType[] = [
  "song",
  "artist",
  "album",
  "cover_art",
  "vinyl_label",
];

function normalizeCategories(categories: string[]): string[] {
  const cleaned = categories.map((value) => value.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : DEFAULT_CATEGORIES;
}

function normalizePositionKey(position: string | null | undefined): string | null {
  const raw = String(position ?? "").trim();
  if (!raw) return null;
  return raw.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildDifficultyStack(
  totalQuestions: number,
  difficultyTargets?: Partial<Record<TriviaDifficulty, number>>
): TriviaDifficulty[] {
  const easyTarget = Math.max(0, difficultyTargets?.easy ?? 2);
  const mediumTarget = Math.max(0, difficultyTargets?.medium ?? 2);
  const hardTarget = Math.max(0, difficultyTargets?.hard ?? 1);
  const seed: TriviaDifficulty[] = [
    ...Array.from({ length: easyTarget }, () => "easy" as const),
    ...Array.from({ length: mediumTarget }, () => "medium" as const),
    ...Array.from({ length: hardTarget }, () => "hard" as const),
  ];
  const fallback: TriviaDifficulty[] = ["easy", "medium", "medium", "hard"];
  const source = seed.length > 0 ? seed : fallback;

  return Array.from({ length: totalQuestions }, (_, index) => source[index % source.length] ?? "medium");
}

function getBonusPoints(scoreMode: TriviaScoreMode, difficulty: TriviaDifficulty): number {
  if (scoreMode !== "difficulty_bonus_static") return 0;
  return difficulty === "hard" ? 1 : 0;
}

export function computeTriviaBonusPoints(scoreMode: TriviaScoreMode, difficulty: TriviaDifficulty): number {
  return getBonusPoints(scoreMode, difficulty);
}

function normalizeAcceptedAnswers(answerKey: string, values: string[] | undefined): string[] {
  const cleaned = (values ?? []).map((value) => value.trim()).filter(Boolean);
  return Array.from(new Set([answerKey, ...cleaned]));
}

function applyDeckEntry(
  row: TriviaCallInsertRow,
  scoreMode: TriviaScoreMode,
  entry: TriviaQuestionDeckEntry | undefined
): TriviaCallInsertRow {
  if (!entry) return row;
  const questionText = entry.questionText.trim();
  const answerKey = entry.answerKey.trim();
  if (!questionText || !answerKey) return row;

  const category = entry.category?.trim() || row.category;
  const difficulty = entry.difficulty ?? row.difficulty;
  const displayElementType = entry.displayElementType ?? row.display_element_type;
  const sourceNote =
    entry.sourceNote === undefined
      ? row.source_note
      : (entry.sourceNote?.trim() || null);

  return {
    ...row,
    category,
    difficulty,
    question_text: questionText,
    answer_key: answerKey,
    accepted_answers: normalizeAcceptedAnswers(answerKey, entry.acceptedAnswers),
    answer_payload: {
      ...(row.answer_payload && typeof row.answer_payload === "object" && !Array.isArray(row.answer_payload)
        ? row.answer_payload as Record<string, JsonValue>
        : {}),
      type: "free_response",
      canonical: answerKey,
    },
    source_note: sourceNote,
    prep_status: entry.prepStatus ?? "ready",
    display_element_type: displayElementType,
    bonus_points: getBonusPoints(scoreMode, difficulty),
  };
}

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function parseVinylLabelUrl(credits: JsonValue | null): string | null {
  if (!credits || typeof credits !== "object" || Array.isArray(credits)) return null;
  const root = credits as Record<string, unknown>;
  const artwork = (root.artwork ?? root.album_artwork ?? root.albumArtwork) as Record<string, unknown> | undefined;
  if (!artwork || typeof artwork !== "object") return null;
  const vinylImages = asStringArray(artwork.vinyl_label_images);
  return vinylImages[0] ?? null;
}

function buildQuestionTemplate(args: {
  category: string;
  difficulty: TriviaDifficulty;
  elementType: TriviaDisplayElementType;
  callIndex: number;
  isTiebreaker: boolean;
}): string {
  const prefix = `[${args.category} • ${args.difficulty.toUpperCase()}]`;
  const tiePrefix = args.isTiebreaker ? "Tie-breaker template: " : "Template: ";

  const prompt =
    args.elementType === "song"
      ? "Name the song title for this spin."
      : args.elementType === "artist"
        ? "Name the primary artist for this spin."
        : args.elementType === "album"
          ? "Name the album for this spin."
          : args.elementType === "cover_art"
            ? "Using the displayed cover art, name the album."
            : "Using the displayed vinyl label, name the album.";

  return `${prefix} ${tiePrefix}${prompt} (Q${args.callIndex})`;
}

function buildAnswerTemplate(track: TrackArtworkSeed, elementType: TriviaDisplayElementType, callIndex: number): string {
  if (elementType === "song") return firstNonEmpty([track.sourceTitle]) ?? `Answer ${callIndex}`;
  if (elementType === "artist") return firstNonEmpty([track.sourceArtist]) ?? `Answer ${callIndex}`;
  return firstNonEmpty([track.sourceAlbum, track.sourceTitle, track.sourceArtist]) ?? `Answer ${callIndex}`;
}

function getDisplayElementType(index: number): TriviaDisplayElementType {
  return DISPLAY_ELEMENT_SEQUENCE[index % DISPLAY_ELEMENT_SEQUENCE.length] ?? "song";
}

async function buildTrackSeeds(db: TriviaDbClient, playlistId: number, requiredCount: number): Promise<TrackArtworkSeed[]> {
  const bingoDb = db as unknown as BingoDbClient;
  const tracks = shuffle(await resolvePlaylistTracks(bingoDb, playlistId));
  if (tracks.length < requiredCount) {
    throw new Error(`Selected playlist has ${tracks.length} playable tracks. At least ${requiredCount} are required.`);
  }

  const selected = tracks.slice(0, requiredCount);
  const parsed = selected.map((track) => ({
    track,
    parsedKey: parseTrackKey(track.trackKey),
  }));

  const inventoryIds = Array.from(
    new Set(parsed.map((row) => row.parsedKey.inventoryId).filter((value): value is number => Number.isFinite(value)))
  );
  const releaseTrackIds = Array.from(
    new Set(parsed.map((row) => row.parsedKey.releaseTrackId).filter((value): value is number => Number.isFinite(value)))
  );
  const directRecordingIds = Array.from(
    new Set(parsed.map((row) => row.parsedKey.recordingId).filter((value): value is number => Number.isFinite(value)))
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;
  const { data: inventoryRows, error: inventoryError } = inventoryIds.length
    ? await dbAny.from("inventory").select("id, release_id").in("id", inventoryIds)
    : { data: [], error: null };
  if (inventoryError) throw new Error(inventoryError.message);

  const inventoryById = new Map<number, { id: number; release_id: number | null }>(
    ((inventoryRows ?? []) as Array<{ id: number; release_id: number | null }>).map((row) => [row.id, row])
  );

  const releaseIds = Array.from(
    new Set(
      ((inventoryRows ?? []) as Array<{ id: number; release_id: number | null }>)
        .map((row) => row.release_id)
        .filter((value): value is number => Number.isFinite(value))
    )
  );

  const { data: releaseRows, error: releaseError } = releaseIds.length
    ? await dbAny.from("releases").select("id, master_id").in("id", releaseIds)
    : { data: [], error: null };
  if (releaseError) throw new Error(releaseError.message);

  const releaseById = new Map<number, { id: number; master_id: number | null }>(
    ((releaseRows ?? []) as Array<{ id: number; master_id: number | null }>).map((row) => [row.id, row])
  );

  const masterIds = Array.from(
    new Set(
      ((releaseRows ?? []) as Array<{ id: number; master_id: number | null }>)
        .map((row) => row.master_id)
        .filter((value): value is number => Number.isFinite(value))
    )
  );

  const { data: masterRows, error: masterError } = masterIds.length
    ? await dbAny.from("masters").select("id, cover_image_url").in("id", masterIds)
    : { data: [], error: null };
  if (masterError) throw new Error(masterError.message);

  const masterCoverById = new Map<number, string | null>(
    ((masterRows ?? []) as Array<{ id: number; cover_image_url: string | null }>).map((row) => [row.id, row.cover_image_url ?? null])
  );

  const { data: releaseTracksById, error: releaseTracksByIdError } = releaseTrackIds.length
    ? await dbAny
        .from("release_tracks")
        .select("id, release_id, recording_id, side, position")
        .in("id", releaseTrackIds)
    : { data: [], error: null };
  if (releaseTracksByIdError) throw new Error(releaseTracksByIdError.message);

  const needsPositionLookup = parsed.some((row) => row.parsedKey.releaseTrackId === null && row.parsedKey.fallbackPosition);
  const { data: releaseTracksByRelease, error: releaseTracksByReleaseError } =
    needsPositionLookup && releaseIds.length
      ? await dbAny
          .from("release_tracks")
          .select("id, release_id, recording_id, side, position")
          .in("release_id", releaseIds)
      : { data: [], error: null };
  if (releaseTracksByReleaseError) throw new Error(releaseTracksByReleaseError.message);

  const releaseTracks = [
    ...((releaseTracksById ?? []) as Array<{ id: number; release_id: number | null; recording_id: number | null; side: string | null; position: string }>),
    ...((releaseTracksByRelease ?? []) as Array<{ id: number; release_id: number | null; recording_id: number | null; side: string | null; position: string }>),
  ];

  const releaseTrackById = new Map<number, { id: number; release_id: number | null; recording_id: number | null; side: string | null; position: string }>(
    releaseTracks.map((row) => [row.id, row])
  );
  const releaseTrackByReleasePosition = new Map<string, { id: number; release_id: number | null; recording_id: number | null; side: string | null; position: string }>();
  for (const row of releaseTracks) {
    if (!Number.isFinite(row.release_id)) continue;
    const positionKey = normalizePositionKey(row.position);
    if (!positionKey) continue;
    releaseTrackByReleasePosition.set(`${row.release_id}:${positionKey}`, row);
  }

  const inferredRecordingIds = Array.from(
    new Set(releaseTracks.map((row) => row.recording_id).filter((value): value is number => Number.isFinite(value)))
  );
  const recordingIds = Array.from(new Set([...directRecordingIds, ...inferredRecordingIds]));

  const { data: recordingRows, error: recordingError } = recordingIds.length
    ? await dbAny.from("recordings").select("id, credits").in("id", recordingIds)
    : { data: [], error: null };
  if (recordingError) throw new Error(recordingError.message);

  const recordingCreditsById = new Map<number, JsonValue | null>(
    ((recordingRows ?? []) as Array<{ id: number; credits: JsonValue | null }>).map((row) => [row.id, row.credits ?? null])
  );

  return parsed.map(({ track, parsedKey }): TrackArtworkSeed => {
    const inventory = parsedKey.inventoryId ? inventoryById.get(parsedKey.inventoryId) : undefined;
    const releaseId = inventory?.release_id ?? null;
    const release = releaseId ? releaseById.get(releaseId) : undefined;
    const masterCover = release?.master_id ? masterCoverById.get(release.master_id) ?? null : null;

    const releaseTrack =
      (parsedKey.releaseTrackId ? releaseTrackById.get(parsedKey.releaseTrackId) : undefined) ??
      (releaseId && parsedKey.fallbackPosition
        ? releaseTrackByReleasePosition.get(`${releaseId}:${normalizePositionKey(parsedKey.fallbackPosition) ?? ""}`)
        : undefined);

    const recordingId = releaseTrack?.recording_id ?? parsedKey.recordingId ?? null;
    const recordingCredits = recordingId ? recordingCreditsById.get(recordingId) ?? null : null;

    return {
      playlistTrackKey: track.trackKey,
      sourceArtist: firstNonEmpty([track.artistName]),
      sourceTitle: firstNonEmpty([track.trackTitle]),
      sourceAlbum: firstNonEmpty([track.albumName]),
      sourceSide: firstNonEmpty([track.side, releaseTrack?.side]),
      sourcePosition: firstNonEmpty([track.position, releaseTrack?.position, parsedKey.fallbackPosition]),
      autoCoverArtUrl: masterCover,
      autoVinylLabelUrl: parseVinylLabelUrl(recordingCredits),
    };
  });
}

export function computeTriviaRemainingSeconds(session: TriviaSessionCountdownRow): number {
  if (session.paused_at) {
    return Math.max(0, session.paused_remaining_seconds ?? session.target_gap_seconds);
  }
  if (!session.countdown_started_at) return session.target_gap_seconds;

  const started = new Date(session.countdown_started_at).getTime();
  if (!Number.isFinite(started)) return session.target_gap_seconds;
  const elapsed = Math.floor((Date.now() - started) / 1000);
  return Math.max(0, session.target_gap_seconds - elapsed);
}

export function getDefaultAwardedPoints(params: {
  scoreMode: TriviaScoreMode;
  difficulty: TriviaDifficulty;
  basePoints: number;
  bonusPoints: number;
  correct: boolean;
}): number {
  if (!params.correct) return 0;
  if (params.scoreMode === "difficulty_bonus_static") {
    return params.basePoints + getBonusPoints(params.scoreMode, params.difficulty);
  }
  return params.basePoints + Math.max(0, params.bonusPoints);
}

export async function generateTriviaSessionCalls(db: TriviaDbClient, input: CreateTriviaCallsInput): Promise<void> {
  const mainQuestionCount = Math.max(1, input.roundCount * input.questionsPerRound);
  const tieBreakerCount = Math.max(0, input.tieBreakerCount);
  const totalQuestions = mainQuestionCount + tieBreakerCount;
  const categories = normalizeCategories(input.categories);
  const difficulties = buildDifficultyStack(mainQuestionCount, input.difficultyTargets);
  const trackSeeds = await buildTrackSeeds(db, input.playlistId, totalQuestions);

  const mainRows: TriviaCallInsertRow[] = Array.from({ length: mainQuestionCount }, (_, index) => {
    const callIndex = index + 1;
    const roundNumber = Math.floor(index / input.questionsPerRound) + 1;
    const category = categories[index % categories.length] ?? "General Music";
    const difficulty = difficulties[index] ?? "medium";
    const track = trackSeeds[index];
    const displayElementType = getDisplayElementType(index);
    const answerKey = buildAnswerTemplate(track, displayElementType, callIndex);

    const row: TriviaCallInsertRow = {
      session_id: input.sessionId,
      round_number: roundNumber,
      call_index: callIndex,
      playlist_track_key: track.playlistTrackKey,
      question_id: null,
      question_type: "free_response",
      is_tiebreaker: false,
      category,
      difficulty,
      question_text: buildQuestionTemplate({
        category,
        difficulty,
        elementType: displayElementType,
        callIndex,
        isTiebreaker: false,
      }),
      answer_key: answerKey,
      accepted_answers: [answerKey],
      options_payload: [],
      answer_payload: {
        type: "free_response",
        canonical: answerKey,
      },
      explanation_text: null,
      reveal_payload: {},
      source_note: "Template stub auto-seeded from playlist metadata",
      cue_notes_text: null,
      cue_payload: { segments: [] },
      prep_status: "draft",
      display_element_type: displayElementType,
      display_image_override_url: null,
      auto_cover_art_url: track.autoCoverArtUrl,
      auto_vinyl_label_url: track.autoVinylLabelUrl,
      source_artist: track.sourceArtist,
      source_title: track.sourceTitle,
      source_album: track.sourceAlbum,
      source_side: track.sourceSide,
      source_position: track.sourcePosition,
      base_points: 1,
      bonus_points: getBonusPoints(input.scoreMode, difficulty),
      status: "pending",
    };

    return applyDeckEntry(row, input.scoreMode, input.questionDeck?.[index]);
  });

  const tieBreakerRows: TriviaCallInsertRow[] = Array.from({ length: tieBreakerCount }, (_, index) => {
    const callIndex = mainQuestionCount + index + 1;
    const track = trackSeeds[callIndex - 1];
    const displayElementType = getDisplayElementType(callIndex - 1);
    const difficulty: TriviaDifficulty = "hard";
    const answerKey = buildAnswerTemplate(track, displayElementType, callIndex);

    const row: TriviaCallInsertRow = {
      session_id: input.sessionId,
      round_number: input.roundCount + 1,
      call_index: callIndex,
      playlist_track_key: track.playlistTrackKey,
      question_id: null,
      question_type: "free_response",
      is_tiebreaker: true,
      category: "Tie-Breaker",
      difficulty,
      question_text: buildQuestionTemplate({
        category: "Tie-Breaker",
        difficulty,
        elementType: displayElementType,
        callIndex,
        isTiebreaker: true,
      }),
      answer_key: answerKey,
      accepted_answers: [answerKey],
      options_payload: [],
      answer_payload: {
        type: "free_response",
        canonical: answerKey,
      },
      explanation_text: null,
      reveal_payload: {},
      source_note: "Tie-breaker template stub auto-seeded from playlist metadata",
      cue_notes_text: null,
      cue_payload: { segments: [] },
      prep_status: "draft",
      display_element_type: displayElementType,
      display_image_override_url: null,
      auto_cover_art_url: track.autoCoverArtUrl,
      auto_vinyl_label_url: track.autoVinylLabelUrl,
      source_artist: track.sourceArtist,
      source_title: track.sourceTitle,
      source_album: track.sourceAlbum,
      source_side: track.sourceSide,
      source_position: track.sourcePosition,
      base_points: 1,
      bonus_points: getBonusPoints(input.scoreMode, difficulty),
      status: "pending",
    };

    return applyDeckEntry(row, input.scoreMode, input.questionDeck?.[mainQuestionCount + index]);
  });

  const rows = [...mainRows, ...tieBreakerRows];

  const { error } = await db.from("trivia_session_calls").insert(rows);
  if (error) throw new Error(error.message);
}
