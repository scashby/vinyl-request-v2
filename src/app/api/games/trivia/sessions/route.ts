import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb, type TriviaDatabase } from "src/lib/triviaDb";
import { generateTriviaSessionCode } from "src/lib/triviaSessionCode";
import {
  computeTriviaBonusPoints,
  generateTriviaSessionCalls,
  type TriviaDifficulty,
  type TriviaDisplayElementType,
  type TriviaPrepStatus,
  type TriviaQuestionDeckEntry,
  type TriviaScoreMode,
} from "src/lib/triviaEngine";
import { getBingoDb } from "src/lib/bingoDb";
import { getPlaylistTrackCount } from "src/lib/bingoEngine";
import { sanitizeCuePayload, type JsonValue } from "src/lib/triviaBank";

export const runtime = "nodejs";

const TRIVIA_BANK_V1_ENABLED = (process.env.TRIVIA_BANK_V1 ?? "true").toLowerCase() !== "false";

type QuestionDeckEntryBody = {
  question_text?: string;
  answer_key?: string;
  accepted_answers?: string[];
  category?: string;
  difficulty?: TriviaDifficulty;
  display_element_type?: TriviaDisplayElementType;
  source_note?: string | null;
  prep_status?: TriviaPrepStatus;
};

type CreateSessionBody = {
  event_id?: number | null;
  playlist_id?: number;
  deck_id?: number | null;
  title?: string;
  round_count?: number;
  questions_per_round?: number;
  tie_breaker_count?: number;
  score_mode?: TriviaScoreMode;
  remove_resleeve_seconds?: number;
  find_record_seconds?: number;
  cue_seconds?: number;
  host_buffer_seconds?: number;
  show_title?: boolean;
  show_rounds?: boolean;
  show_question_counter?: boolean;
  show_leaderboard?: boolean;
  show_cue_hints?: boolean;
  categories?: string[];
  difficulty_targets?: Partial<Record<TriviaDifficulty, number>>;
  max_teams?: number | null;
  slips_batch_size?: number | null;
  team_names?: string[];
  question_deck?: QuestionDeckEntryBody[];
};

type SessionListRow = {
  id: number;
  event_id: number | null;
  playlist_id: number | null;
  deck_id: number | null;
  session_code: string;
  title: string;
  round_count: number;
  questions_per_round: number;
  tie_breaker_count: number;
  score_mode: TriviaScoreMode;
  current_round: number;
  status: string;
  created_at: string;
};

type EventRow = { id: number; title: string; date: string };
type PlaylistRow = { id: number; name: string };
type DeckRow = { id: number; title: string };
type DeckSeedRow = {
  item_index: number;
  round_number: number;
  is_tiebreaker: boolean;
  question_id: number | null;
  snapshot_payload: JsonValue;
};

function normalizeTeamNames(teamNames: string[] | undefined): string[] {
  const names = (teamNames ?? []).map((name) => name.trim()).filter(Boolean);
  return Array.from(new Set(names));
}

function normalizeCategories(values: string[] | undefined): string[] {
  const categories = (values ?? []).map((value) => value.trim()).filter(Boolean);
  return categories.length > 0 ? categories : ["General Music", "Classic Rock", "Soul & Funk", "Hip-Hop", "80s"];
}

function normalizeQuestionDeck(values: QuestionDeckEntryBody[] | undefined): TriviaQuestionDeckEntry[] {
  if (!Array.isArray(values)) return [];

  return values
    .map((entry) => {
      const questionText = typeof entry.question_text === "string" ? entry.question_text.trim() : "";
      const answerKey = typeof entry.answer_key === "string" ? entry.answer_key.trim() : "";
      if (!questionText || !answerKey) return null;

      const accepted = Array.isArray(entry.accepted_answers)
        ? entry.accepted_answers.map((value) => value.trim()).filter(Boolean)
        : [];
      const acceptedAnswers = Array.from(new Set([answerKey, ...accepted]));
      const category = typeof entry.category === "string" ? entry.category.trim() : "";
      const difficulty =
        entry.difficulty === "easy" || entry.difficulty === "medium" || entry.difficulty === "hard"
          ? entry.difficulty
          : undefined;
      const displayElementType =
        entry.display_element_type === "song" ||
        entry.display_element_type === "artist" ||
        entry.display_element_type === "album" ||
        entry.display_element_type === "cover_art" ||
        entry.display_element_type === "vinyl_label"
          ? entry.display_element_type
          : undefined;
      const sourceNote =
        entry.source_note === null
          ? null
          : (typeof entry.source_note === "string" ? entry.source_note.trim() : undefined);
      const prepStatus = entry.prep_status === "draft" || entry.prep_status === "ready" ? entry.prep_status : undefined;

      const normalized: TriviaQuestionDeckEntry = {
        questionText,
        answerKey,
        acceptedAnswers,
      };
      if (category) normalized.category = category;
      if (difficulty) normalized.difficulty = difficulty;
      if (displayElementType) normalized.displayElementType = displayElementType;
      if (sourceNote !== undefined) normalized.sourceNote = sourceNote || null;
      if (prepStatus) normalized.prepStatus = prepStatus;
      return normalized;
    })
    .filter((entry): entry is TriviaQuestionDeckEntry => Boolean(entry));
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function asDifficulty(value: unknown): TriviaDifficulty {
  const text = asString(value).toLowerCase();
  if (text === "easy" || text === "medium" || text === "hard") return text;
  return "medium";
}

function asQuestionType(value: unknown): "free_response" | "multiple_choice" | "true_false" | "ordering" {
  const text = asString(value).toLowerCase();
  if (text === "free_response" || text === "multiple_choice" || text === "true_false" || text === "ordering") return text;
  return "free_response";
}

function asDisplayElementType(value: unknown): "song" | "artist" | "album" | "cover_art" | "vinyl_label" {
  const text = asString(value).toLowerCase();
  if (text === "song" || text === "artist" || text === "album" || text === "cover_art" || text === "vinyl_label") return text;
  return "song";
}

function asAcceptedAnswers(answerKey: string, value: unknown): string[] {
  const parsed = Array.isArray(value)
    ? value.map((entry) => String(entry).trim()).filter(Boolean)
    : [];
  return Array.from(new Set([answerKey, ...parsed].filter(Boolean)));
}

async function generateUniqueSessionCode() {
  const db = getTriviaDb();
  for (let i = 0; i < 15; i += 1) {
    const code = generateTriviaSessionCode();
    const { data } = await db.from("trivia_sessions").select("id").eq("session_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Unable to generate unique session code");
}

async function seedCallsFromDeck(params: {
  db: ReturnType<typeof getTriviaDb>;
  sessionId: number;
  deckId: number;
  roundCount: number;
  questionsPerRound: number;
  tieBreakerCount: number;
  scoreMode: TriviaScoreMode;
}) {
  const { db, sessionId, deckId, roundCount, questionsPerRound, tieBreakerCount, scoreMode } = params;

  const { data: deck, error: deckError } = await db
    .from("trivia_decks")
    .select("id, status")
    .eq("id", deckId)
    .maybeSingle();
  if (deckError) throw new Error(deckError.message);
  if (!deck) throw new Error("Selected deck not found");
  if (deck.status === "archived") throw new Error("Selected deck is archived");

  const { data: rawItems, error: itemsError } = await db
    .from("trivia_deck_items")
    .select("item_index, round_number, is_tiebreaker, question_id, snapshot_payload")
    .eq("deck_id", deckId)
    .order("item_index", { ascending: true });
  if (itemsError) throw new Error(itemsError.message);

  const requiredCount = (roundCount * questionsPerRound) + tieBreakerCount;
  const items = (rawItems ?? []) as DeckSeedRow[];
  if (items.length < requiredCount) {
    throw new Error(`Selected deck has ${items.length} items but this setup needs ${requiredCount}.`);
  }

  const mainCount = roundCount * questionsPerRound;

  const rows: TriviaDatabase["public"]["Tables"]["trivia_session_calls"]["Insert"][] = items
    .slice(0, requiredCount)
    .map((item, index) => {
      const callIndex = index + 1;
      const defaultTie = callIndex > mainCount;
      const isTiebreaker = item.is_tiebreaker || defaultTie;
      const defaultRound = isTiebreaker ? (roundCount + 1) : (Math.floor((callIndex - 1) / questionsPerRound) + 1);
      const roundNumber = Number.isFinite(item.round_number) && item.round_number > 0
        ? Math.max(1, Number(item.round_number))
        : defaultRound;

      const snapshot = asObject(item.snapshot_payload);
      const questionText = asString(snapshot.prompt_text) || asString(snapshot.question_text);
      const answerKey = asString(snapshot.answer_key);
      if (!questionText || !answerKey) {
        throw new Error(`Deck item #${item.item_index} is missing prompt/answer content.`);
      }

      const difficulty = asDifficulty(snapshot.difficulty);
      const questionType = asQuestionType(snapshot.question_type);
      const displayElementType = asDisplayElementType(snapshot.display_element_type);
      const category = asString(snapshot.category) || "General Music";
      const acceptedAnswers = asAcceptedAnswers(answerKey, snapshot.accepted_answers);
      const cuePayload = sanitizeCuePayload(snapshot.cue_payload);

      const answerPayload = Object.keys(asObject(snapshot.answer_payload)).length > 0
        ? (snapshot.answer_payload as JsonValue)
        : ({ type: questionType, canonical: answerKey } as JsonValue);
      const optionsPayload = Array.isArray(snapshot.options_payload)
        ? (snapshot.options_payload as JsonValue)
        : [];
      const revealPayloadBase = asObject(snapshot.reveal_payload);

      const mediaAssets = Array.isArray(snapshot.media_assets)
        ? snapshot.media_assets
            .map((asset) => asObject(asset))
            .map((asset) => ({
              id: Number(asset.id),
              asset_role: asString(asset.asset_role) || "clue_primary",
              asset_type: asString(asset.asset_type) || "image",
              bucket: asString(asset.bucket) || "trivia-assets",
              object_path: asString(asset.object_path),
              sort_order: Number.isFinite(Number(asset.sort_order)) ? Number(asset.sort_order) : 0,
              mime_type: asNullableString(asset.mime_type),
              width: Number.isFinite(Number(asset.width)) ? Number(asset.width) : null,
              height: Number.isFinite(Number(asset.height)) ? Number(asset.height) : null,
              duration_seconds: Number.isFinite(Number(asset.duration_seconds)) ? Number(asset.duration_seconds) : null,
            }))
            .filter((asset) => asset.object_path.length > 0)
        : [];

      const revealPayload: JsonValue = {
        ...revealPayloadBase,
        media_assets: mediaAssets,
      };

      return {
        session_id: sessionId,
        round_number: roundNumber,
        call_index: callIndex,
        playlist_track_key: asNullableString(snapshot.playlist_track_key),
        question_id: Number.isFinite(Number(item.question_id)) ? Number(item.question_id) : null,
        question_type: questionType,
        is_tiebreaker: isTiebreaker,
        category,
        difficulty,
        question_text: questionText,
        answer_key: answerKey,
        accepted_answers: acceptedAnswers,
        options_payload: optionsPayload,
        answer_payload: answerPayload,
        explanation_text: asNullableString(snapshot.explanation_text),
        reveal_payload: revealPayload,
        source_note: asNullableString(snapshot.source_note),
        cue_notes_text: asNullableString(snapshot.cue_notes_text),
        cue_payload: cuePayload as unknown as JsonValue,
        prep_status: (asString(snapshot.prep_status).toLowerCase() === "draft" ? "draft" : "ready") as TriviaPrepStatus,
        display_element_type: displayElementType,
        display_image_override_url: asNullableString(snapshot.display_image_override_url),
        auto_cover_art_url: asNullableString(snapshot.auto_cover_art_url),
        auto_vinyl_label_url: asNullableString(snapshot.auto_vinyl_label_url),
        source_artist: asNullableString(snapshot.source_artist),
        source_title: asNullableString(snapshot.source_title),
        source_album: asNullableString(snapshot.source_album),
        source_side: asNullableString(snapshot.source_side),
        source_position: asNullableString(snapshot.source_position),
        base_points: 1,
        bonus_points: computeTriviaBonusPoints(scoreMode, difficulty),
        status: "pending",
      };
    });

  const { error } = await db.from("trivia_session_calls").insert(rows);
  if (error) throw new Error(error.message);
}

export async function GET(request: NextRequest) {
  const db = getTriviaDb();
  const eventId = request.nextUrl.searchParams.get("eventId");

  let query = db
    .from("trivia_sessions")
    .select("id, event_id, playlist_id, deck_id, session_code, title, round_count, questions_per_round, tie_breaker_count, score_mode, current_round, status, created_at")
    .order("created_at", { ascending: false });

  if (eventId) query = query.eq("event_id", Number(eventId));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sessions = (data ?? []) as SessionListRow[];
  const eventIds = Array.from(new Set(sessions.map((row) => row.event_id).filter((value): value is number => Number.isFinite(value))));

  const { data: events } = eventIds.length
    ? await db.from("events").select("id, title, date").in("id", eventIds)
    : { data: [] as EventRow[] };
  const eventsById = new Map<number, EventRow>(((events ?? []) as EventRow[]).map((row) => [row.id, row]));

  const playlistIds = Array.from(
    new Set(sessions.map((row) => row.playlist_id).filter((value): value is number => Number.isFinite(value)))
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;
  const { data: playlists } = playlistIds.length
    ? await dbAny.from("collection_playlists").select("id, name").in("id", playlistIds)
    : { data: [] as PlaylistRow[] };
  const playlistById = new Map<number, PlaylistRow>(((playlists ?? []) as PlaylistRow[]).map((row) => [row.id, row]));

  const deckIds = Array.from(new Set(sessions.map((row) => row.deck_id).filter((value): value is number => Number.isFinite(value))));
  const { data: decks } = deckIds.length
    ? await db.from("trivia_decks").select("id, title").in("id", deckIds)
    : { data: [] as DeckRow[] };
  const deckById = new Map<number, DeckRow>(((decks ?? []) as DeckRow[]).map((row) => [row.id, row]));

  const sessionIds = sessions.map((session) => session.id);
  const { data: callRows } = sessionIds.length
    ? await db
      .from("trivia_session_calls")
      .select("session_id, is_tiebreaker, prep_status")
      .in("session_id", sessionIds)
    : { data: [] as Array<{ session_id: number; is_tiebreaker: boolean; prep_status: string }> };

  const prepBySession = new Map<number, {
    mainTotal: number;
    mainReady: number;
    tieTotal: number;
    tieReady: number;
  }>();
  for (const row of (callRows ?? []) as Array<{ session_id: number; is_tiebreaker: boolean; prep_status: string }>) {
    const current = prepBySession.get(row.session_id) ?? {
      mainTotal: 0,
      mainReady: 0,
      tieTotal: 0,
      tieReady: 0,
    };
    if (row.is_tiebreaker) {
      current.tieTotal += 1;
      if (row.prep_status === "ready") current.tieReady += 1;
    } else {
      current.mainTotal += 1;
      if (row.prep_status === "ready") current.mainReady += 1;
    }
    prepBySession.set(row.session_id, current);
  }

  return NextResponse.json(
    {
      data: sessions.map((row) => ({
        ...row,
        event_title: row.event_id ? eventsById.get(row.event_id)?.title ?? null : null,
        playlist_name: row.playlist_id ? playlistById.get(row.playlist_id)?.name ?? null : null,
        deck_title: row.deck_id ? deckById.get(row.deck_id)?.title ?? null : null,
        total_questions: row.round_count * row.questions_per_round,
        prep_main_ready: prepBySession.get(row.id)?.mainReady ?? 0,
        prep_main_total: prepBySession.get(row.id)?.mainTotal ?? 0,
        prep_tiebreaker_ready: prepBySession.get(row.id)?.tieReady ?? 0,
        prep_tiebreaker_total: prepBySession.get(row.id)?.tieTotal ?? 0,
      })),
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const db = getTriviaDb();
    const body = (await request.json()) as CreateSessionBody;

    const rawPlaylistId = Number(body.playlist_id);
    const playlistId = Number.isFinite(rawPlaylistId) && rawPlaylistId > 0 ? rawPlaylistId : null;
    const rawDeckId = Number(body.deck_id);
    const deckId = Number.isFinite(rawDeckId) && rawDeckId > 0 ? rawDeckId : null;

    if (!playlistId && !deckId) {
      return NextResponse.json({ error: "playlist_id is required unless deck_id is provided" }, { status: 400 });
    }
    if (deckId && !TRIVIA_BANK_V1_ENABLED) {
      return NextResponse.json({ error: "Trivia bank/deck flow is disabled" }, { status: 409 });
    }

    const roundCount = Math.max(1, Number(body.round_count ?? 3));
    const questionsPerRound = Math.max(1, Number(body.questions_per_round ?? 5));
    const tieBreakerCount = Math.max(0, Number(body.tie_breaker_count ?? 2));
    const scoreMode = (body.score_mode ?? "difficulty_bonus_static") as TriviaScoreMode;
    const removeResleeveSeconds = Math.max(0, Number(body.remove_resleeve_seconds ?? 20));
    const findRecordSeconds = Math.max(0, Number(body.find_record_seconds ?? 12));
    const cueSeconds = Math.max(0, Number(body.cue_seconds ?? 12));
    const hostBufferSeconds = Math.max(0, Number(body.host_buffer_seconds ?? 8));
    const targetGapSeconds = removeResleeveSeconds + findRecordSeconds + cueSeconds + hostBufferSeconds;

    const categories = normalizeCategories(body.categories);
    const teams = normalizeTeamNames(body.team_names);
    const questionDeck = normalizeQuestionDeck(body.question_deck);

    if (teams.length < 2) {
      return NextResponse.json({ error: "At least 2 teams are required" }, { status: 400 });
    }

    if (!deckId) {
      const requiredTracks = (roundCount * questionsPerRound) + tieBreakerCount;
      const playlistTrackCount = await getPlaylistTrackCount(getBingoDb(), playlistId);
      if (playlistTrackCount < requiredTracks) {
        return NextResponse.json(
          {
            error: `Selected playlist has ${playlistTrackCount} playable tracks. This setup needs at least ${requiredTracks}.`,
          },
          { status: 400 }
        );
      }
    }

    const code = await generateUniqueSessionCode();

    const { data: session, error: sessionError } = await db
      .from("trivia_sessions")
      .insert({
        event_id: body.event_id ?? null,
        playlist_id: playlistId,
        deck_id: deckId,
        session_code: code,
        title: (body.title ?? "Music Trivia Session").trim() || "Music Trivia Session",
        round_count: roundCount,
        questions_per_round: questionsPerRound,
        tie_breaker_count: tieBreakerCount,
        score_mode: scoreMode,
        question_categories: categories,
        difficulty_easy_target: Math.max(0, Number(body.difficulty_targets?.easy ?? 2)),
        difficulty_medium_target: Math.max(0, Number(body.difficulty_targets?.medium ?? 2)),
        difficulty_hard_target: Math.max(0, Number(body.difficulty_targets?.hard ?? 1)),
        remove_resleeve_seconds: removeResleeveSeconds,
        find_record_seconds: findRecordSeconds,
        cue_seconds: cueSeconds,
        host_buffer_seconds: hostBufferSeconds,
        target_gap_seconds: targetGapSeconds,
        show_title: body.show_title ?? true,
        show_rounds: body.show_rounds ?? true,
        show_question_counter: body.show_question_counter ?? true,
        show_leaderboard: body.show_leaderboard ?? true,
        show_cue_hints: body.show_cue_hints ?? false,
        max_teams: body.max_teams ?? null,
        slips_batch_size: body.slips_batch_size ?? null,
        status: "pending",
        current_round: 1,
        current_call_index: 0,
      })
      .select("id, session_code")
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message ?? "Failed to create session" }, { status: 500 });
    }

    try {
      const { error: teamsError } = await db.from("trivia_session_teams").insert(
        teams.map((teamName) => ({
          session_id: session.id,
          team_name: teamName,
          active: true,
        }))
      );
      if (teamsError) throw new Error(teamsError.message);

      if (deckId) {
        await seedCallsFromDeck({
          db,
          sessionId: session.id,
          deckId,
          roundCount,
          questionsPerRound,
          tieBreakerCount,
          scoreMode,
        });
      } else {
        if (!playlistId) throw new Error("playlist_id is required for direct question deck generation");
        await generateTriviaSessionCalls(db, {
          sessionId: session.id,
          playlistId,
          roundCount,
          questionsPerRound,
          tieBreakerCount,
          categories,
          scoreMode,
          questionDeck: questionDeck.length > 0 ? questionDeck : undefined,
          difficultyTargets: {
            easy: Math.max(0, Number(body.difficulty_targets?.easy ?? 2)),
            medium: Math.max(0, Number(body.difficulty_targets?.medium ?? 2)),
            hard: Math.max(0, Number(body.difficulty_targets?.hard ?? 1)),
          },
        });
      }
    } catch (error) {
      await db.from("trivia_sessions").delete().eq("id", session.id);
      const message = error instanceof Error ? error.message : "Failed to generate team/call data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ id: session.id, session_code: session.session_code }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
