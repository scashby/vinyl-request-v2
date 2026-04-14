import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb, type TriviaDatabase } from "src/lib/triviaDb";
import { deterministicShuffle, hasRequiredCueSource, type JsonValue } from "src/lib/triviaBank";
import { TRIVIA_BANK_ENABLED } from "src/lib/triviaBankApi";
import { loadQuestionSnapshotsByIds } from "src/lib/triviaDeckSnapshots";

export const runtime = "nodejs";

type QuestionStatus = "draft" | "published" | "archived";
type QuestionType = "free_response" | "multiple_choice" | "true_false" | "ordering";
type QuestionDifficulty = "easy" | "medium" | "hard";

type BuildBody = {
  target_count?: number;
  round_count?: number;
  questions_per_round?: number;
  tie_breaker_count?: number;
  seed?: string;
  include_cooled_down?: boolean;
  allow_partial?: boolean;
  preserve_existing?: boolean;
  cooldown_days?: number;
  build_mode?: "manual" | "hybrid" | "rule";
  manual_question_ids?: number[];
  filters?: Record<string, unknown>;
  diversity?: Record<string, unknown>;
  rules_payload?: Record<string, unknown>;
};

type DeckRow = {
  id: number;
  deck_code: string;
  status: "draft" | "ready" | "archived";
  playlist_id: number | null;
  build_mode: "manual" | "hybrid" | "rule";
  cooldown_days: number;
  rules_payload: JsonValue;
};

type DeckItemRow = {
  id: number;
  item_index: number;
  round_number: number;
  is_tiebreaker: boolean;
  question_id: number | null;
  snapshot_payload: JsonValue;
};

type QuestionCandidate = {
  id: number;
  status: QuestionStatus;
  question_type: QuestionType;
  default_category: string;
  default_difficulty: QuestionDifficulty;
  is_tiebreaker_eligible: boolean;
};

function parseDeckId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (text === "true" || text === "1" || text === "yes") return true;
    if (text === "false" || text === "0" || text === "no") return false;
  }
  return fallback;
}

function asInt(value: unknown, fallback: number, min = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => String(entry).trim())
        .filter(Boolean)
    )
  );
}

function asNumberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry) && entry > 0)
        .map((entry) => Math.floor(entry))
    )
  );
}

function intersectIds(current: Set<number> | null, incoming: Iterable<number>): Set<number> {
  const nextIncoming = new Set(Array.from(incoming).filter((value) => Number.isFinite(value)));
  if (current === null) return nextIncoming;

  const next = new Set<number>();
  for (const id of current) {
    if (nextIncoming.has(id)) next.add(id);
  }
  return next;
}

function applyDiversitySelection(params: {
  pool: QuestionCandidate[];
  desiredCount: number;
  maxPerCategory: number;
  maxPerDifficulty: number;
  seed: string;
}) {
  const shuffled = deterministicShuffle(params.pool, params.seed);
  const selected: QuestionCandidate[] = [];
  const categoryCounts = new Map<string, number>();
  const difficultyCounts = new Map<string, number>();

  const strictPassRejected: QuestionCandidate[] = [];

  for (const candidate of shuffled) {
    if (selected.length >= params.desiredCount) break;

    const categoryCount = categoryCounts.get(candidate.default_category) ?? 0;
    const difficultyCount = difficultyCounts.get(candidate.default_difficulty) ?? 0;
    const prevCategory = selected.length > 0 ? selected[selected.length - 1]?.default_category : null;

    const exceedsCategory = params.maxPerCategory > 0 && categoryCount >= params.maxPerCategory;
    const exceedsDifficulty = params.maxPerDifficulty > 0 && difficultyCount >= params.maxPerDifficulty;
    const sameAsPrevious = prevCategory !== null && prevCategory === candidate.default_category;

    if (exceedsCategory || exceedsDifficulty || sameAsPrevious) {
      strictPassRejected.push(candidate);
      continue;
    }

    selected.push(candidate);
    categoryCounts.set(candidate.default_category, categoryCount + 1);
    difficultyCounts.set(candidate.default_difficulty, difficultyCount + 1);
  }

  if (selected.length < params.desiredCount) {
    for (const candidate of strictPassRejected) {
      if (selected.length >= params.desiredCount) break;
      selected.push(candidate);
    }
  }

  const selectedIds = new Set(selected.map((candidate) => candidate.id));
  const remaining = shuffled.filter((candidate) => !selectedIds.has(candidate.id));

  return {
    selected,
    remaining,
  };
}

function snapshotHasPromptAnswerAndCue(snapshotPayload: JsonValue): boolean {
  if (!snapshotPayload || typeof snapshotPayload !== "object" || Array.isArray(snapshotPayload)) return false;
  const snapshot = snapshotPayload as Record<string, unknown>;
  const promptText = typeof snapshot.prompt_text === "string" ? snapshot.prompt_text.trim() : "";
  const answerKey = typeof snapshot.answer_key === "string" ? snapshot.answer_key.trim() : "";
  if (!promptText || !answerKey) return false;

  return hasRequiredCueSource({
    cueSourceType: snapshot.cue_source_type,
    cueSourcePayload: snapshot.cue_source_payload,
    primaryCueStartSeconds: snapshot.primary_cue_start_seconds,
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!TRIVIA_BANK_ENABLED) return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });

  const { id } = await params;
  const deckId = parseDeckId(id);
  if (!deckId) return NextResponse.json({ error: "Invalid deck id" }, { status: 400 });

  const db = getTriviaDb();
  const { data: rawDeck, error: deckError } = await db
    .from("trivia_decks")
    .select("id, deck_code, status, playlist_id, build_mode, cooldown_days, rules_payload")
    .eq("id", deckId)
    .maybeSingle();
  if (deckError) return NextResponse.json({ error: deckError.message }, { status: 500 });
  if (!rawDeck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

  const deck = rawDeck as DeckRow;
  if (deck.status === "archived") {
    return NextResponse.json({ error: "Archived decks cannot be rebuilt" }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as BuildBody;
  const deckRules = asObject(deck.rules_payload);
  const bodyRules = asObject(body.rules_payload);
  const mergedRules = {
    ...deckRules,
    ...bodyRules,
  };

  const filters = {
    ...asObject(mergedRules.filters),
    ...asObject(body.filters),
  };
  const diversity = {
    ...asObject(mergedRules.diversity),
    ...asObject(body.diversity),
  };

  const roundCount = asInt(body.round_count ?? mergedRules.round_count, 3, 1);
  const questionsPerRound = asInt(body.questions_per_round ?? mergedRules.questions_per_round, 5, 1);
  const tieBreakerCount = asInt(body.tie_breaker_count ?? mergedRules.tie_breaker_count, 0, 0);
  const mainTarget = asInt(body.target_count ?? mergedRules.target_count, roundCount * questionsPerRound, 1);
  const totalTarget = mainTarget + tieBreakerCount;

  const includeCooledDown = asBoolean(body.include_cooled_down ?? mergedRules.include_cooled_down, false);
  const allowPartial = asBoolean(body.allow_partial ?? mergedRules.allow_partial, false);
  const preserveExisting = asBoolean(body.preserve_existing ?? mergedRules.preserve_existing, true);
  const cooldownDays = asInt(body.cooldown_days ?? mergedRules.cooldown_days, deck.cooldown_days, 0);

  const explicitSeed = asString(body.seed) || asString(mergedRules.seed);
  const seed = explicitSeed || `${deck.deck_code}:${new Date().toISOString().slice(0, 10)}`;

  const maxPerCategory = asInt(diversity.max_per_category, 0, 0);
  const maxPerDifficulty = asInt(diversity.max_per_difficulty, 0, 0);

  const statuses = asStringList(filters.statuses)
    .map((value) => value.toLowerCase())
    .filter((value): value is QuestionStatus => value === "draft" || value === "published" || value === "archived");
  const questionTypes = asStringList(filters.question_types)
    .map((value) => value.toLowerCase())
    .filter((value): value is QuestionType => value === "free_response" || value === "multiple_choice" || value === "true_false" || value === "ordering");
  const categories = asStringList(filters.categories);
  const difficulties = asStringList(filters.difficulties)
    .map((value) => value.toLowerCase())
    .filter((value): value is QuestionDifficulty => value === "easy" || value === "medium" || value === "hard");
  const tags = asStringList(filters.tags);

  const facetCategory = asStringList(filters.facet_categories);
  const facetDifficulty = asStringList(filters.facet_difficulties)
    .map((value) => value.toLowerCase())
    .filter((value): value is QuestionDifficulty => value === "easy" || value === "medium" || value === "hard");
  const facetEra = asStringList(filters.eras);
  const facetGenre = asStringList(filters.genres);
  const facetDecade = asStringList(filters.decades);
  const facetRegion = asStringList(filters.regions);
  const facetLanguage = asStringList(filters.languages);
  const explicitPlaylistIds = asNumberList(filters.playlist_ids);
  const hasMedia = typeof filters.has_media === "boolean" ? filters.has_media : null;
  const hasRequiredCue = typeof filters.has_required_cue === "boolean" ? filters.has_required_cue : true;
  const effectivePlaylistIds = explicitPlaylistIds.length > 0
    ? explicitPlaylistIds
    : (Number.isFinite(Number(deck.playlist_id)) && Number(deck.playlist_id) > 0 ? [Number(deck.playlist_id)] : []);

  const manualQuestionIds = asNumberList(body.manual_question_ids ?? mergedRules.manual_question_ids);

  let constrainedIds: Set<number> | null = null;

  if (tags.length > 0) {
    const { data: tagRows, error: tagsError } = await db
      .from("trivia_question_tags")
      .select("question_id")
      .in("tag", tags);
    if (tagsError) return NextResponse.json({ error: tagsError.message }, { status: 500 });
    constrainedIds = intersectIds(constrainedIds, (tagRows ?? []).map((row) => row.question_id));
  }

  let facetQuery = db.from("trivia_question_facets").select("question_id");
  if (facetCategory.length > 0) facetQuery = facetQuery.in("category", facetCategory);
  if (facetDifficulty.length > 0) facetQuery = facetQuery.in("difficulty", facetDifficulty);
  if (facetEra.length > 0) facetQuery = facetQuery.in("era", facetEra);
  if (facetGenre.length > 0) facetQuery = facetQuery.in("genre", facetGenre);
  if (facetDecade.length > 0) facetQuery = facetQuery.in("decade", facetDecade);
  if (facetRegion.length > 0) facetQuery = facetQuery.in("region", facetRegion);
  if (facetLanguage.length > 0) facetQuery = facetQuery.in("language", facetLanguage);
  if (hasMedia !== null) facetQuery = facetQuery.eq("has_media", hasMedia);
  facetQuery = facetQuery.eq("has_required_cue", hasRequiredCue);
  const { data: facetRows, error: facetsError } = await facetQuery;
  if (facetsError) return NextResponse.json({ error: facetsError.message }, { status: 500 });
  constrainedIds = intersectIds(constrainedIds, (facetRows ?? []).map((row) => row.question_id));

  if (constrainedIds && constrainedIds.size === 0) {
    return NextResponse.json(
      {
        error: "No questions match current filters",
        deficit_report: {
          required_total: totalTarget,
          selected_total: 0,
          shortfall_total: totalTarget,
        },
      },
      { status: 409 }
    );
  }

  let questionQuery = db
    .from("trivia_questions")
    .select("id, status, question_type, default_category, default_difficulty, is_tiebreaker_eligible");

  if (statuses.length > 0) {
    questionQuery = questionQuery.in("status", statuses);
  } else {
    questionQuery = questionQuery.eq("status", "published");
  }
  if (questionTypes.length > 0) questionQuery = questionQuery.in("question_type", questionTypes);
  if (categories.length > 0) questionQuery = questionQuery.in("default_category", categories);
  if (difficulties.length > 0) questionQuery = questionQuery.in("default_difficulty", difficulties);
  if (constrainedIds) questionQuery = questionQuery.in("id", Array.from(constrainedIds));

  const { data: questionRows, error: questionError } = await questionQuery;
  if (questionError) return NextResponse.json({ error: questionError.message }, { status: 500 });

  let pool = (questionRows ?? []) as QuestionCandidate[];

  if (effectivePlaylistIds.length > 0 && pool.length > 0) {
    const { data: playlistScopeRows, error: playlistScopeError } = await db
      .from("trivia_question_scopes")
      .select("question_id, scope_ref_id")
      .eq("scope_type", "playlist")
      .in("question_id", pool.map((candidate) => candidate.id));

    if (playlistScopeError) return NextResponse.json({ error: playlistScopeError.message }, { status: 500 });

    const playlistScopeMap = new Map<number, Set<number>>();
    for (const row of playlistScopeRows ?? []) {
      const questionId = Number(row.question_id);
      const playlistId = Number(row.scope_ref_id);
      if (!Number.isFinite(questionId) || questionId <= 0 || !Number.isFinite(playlistId) || playlistId <= 0) continue;
      const scopedIds = playlistScopeMap.get(questionId) ?? new Set<number>();
      scopedIds.add(playlistId);
      playlistScopeMap.set(questionId, scopedIds);
    }

    pool = pool.filter((candidate) => {
      const scopedIds = playlistScopeMap.get(candidate.id);
      if (!scopedIds || scopedIds.size === 0) return true;
      return effectivePlaylistIds.some((playlistId) => scopedIds.has(playlistId));
    });
  }

  const { data: existingRows, error: existingError } = await db
    .from("trivia_deck_items")
    .select("id, item_index, round_number, is_tiebreaker, question_id, snapshot_payload")
    .eq("deck_id", deckId)
    .order("item_index", { ascending: true });
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  const existingItems = (existingRows ?? []) as DeckItemRow[];

  const existingQuestionIds = new Set(
    existingItems
      .map((item) => item.question_id)
      .filter((questionId): questionId is number => Number.isFinite(questionId))
  );

  const preservedItems = preserveExisting ? [...existingItems] : [];
  const manualNewQuestionIds = manualQuestionIds.filter((questionId) => !existingQuestionIds.has(questionId));

  const excludedIds = new Set<number>([
    ...existingQuestionIds,
    ...manualQuestionIds,
  ]);

  const buildPool = pool.filter((candidate) => !excludedIds.has(candidate.id));

  const cutoffIso = cooldownDays > 0
    ? new Date(Date.now() - (cooldownDays * 24 * 60 * 60 * 1000)).toISOString()
    : null;

  let recentQuestionIds = new Set<number>();
  if (cutoffIso) {
    const { data: recentRows, error: recentError } = await db
      .from("trivia_session_calls")
      .select("question_id")
      .not("question_id", "is", null)
      .gte("created_at", cutoffIso);
    if (recentError) return NextResponse.json({ error: recentError.message }, { status: 500 });
    recentQuestionIds = new Set(
      (recentRows ?? [])
        .map((row) => row.question_id)
        .filter((value): value is number => Number.isFinite(value))
    );
  }

  const freshPool = buildPool.filter((candidate) => !recentQuestionIds.has(candidate.id));
  const cooledPool = buildPool.filter((candidate) => recentQuestionIds.has(candidate.id));
  const effectivePool = includeCooledDown ? [...freshPool, ...cooledPool] : freshPool;

  const slotsRemaining = Math.max(0, totalTarget - preservedItems.length - manualNewQuestionIds.length);
  const desiredMainFromFill = Math.max(0, mainTarget - Math.min(mainTarget, preservedItems.length + manualNewQuestionIds.length));
  const desiredTieFromFill = Math.max(0, tieBreakerCount - Math.max(0, (preservedItems.length + manualNewQuestionIds.length) - mainTarget));

  const mainSelection = applyDiversitySelection({
    pool: effectivePool,
    desiredCount: Math.min(slotsRemaining, desiredMainFromFill),
    maxPerCategory,
    maxPerDifficulty,
    seed: `${seed}:main`,
  });

  let remainingPool = mainSelection.remaining;
  const tieEligiblePool = remainingPool.filter((candidate) => candidate.is_tiebreaker_eligible);
  const tieSelectionEligible = deterministicShuffle(tieEligiblePool, `${seed}:tie-eligible`).slice(0, desiredTieFromFill);
  const tieEligibleSet = new Set(tieSelectionEligible.map((candidate) => candidate.id));
  remainingPool = remainingPool.filter((candidate) => !tieEligibleSet.has(candidate.id));

  const remainingTieNeeded = Math.max(0, desiredTieFromFill - tieSelectionEligible.length);
  const tieSelectionFallback = deterministicShuffle(remainingPool, `${seed}:tie-fallback`).slice(0, remainingTieNeeded);

  const selectedCandidates = [
    ...mainSelection.selected,
    ...tieSelectionEligible,
    ...tieSelectionFallback,
  ];

  const selectedFillQuestionIds = selectedCandidates.map((candidate) => candidate.id);
  const selectedTotal = preservedItems.length + manualNewQuestionIds.length + selectedFillQuestionIds.length;
  const shortfallTotal = Math.max(0, totalTarget - selectedTotal);

  if (shortfallTotal > 0 && !allowPartial) {
    return NextResponse.json(
      {
        error: includeCooledDown
          ? "Not enough questions match current rule set"
          : "Not enough questions after cooldown filter",
        deficit_report: {
          required_total: totalTarget,
          selected_total: selectedTotal,
          shortfall_total: shortfallTotal,
          cooldown_days: cooldownDays,
          cooled_down_available: cooledPool.length,
          include_cooled_down_supported: !includeCooledDown,
        },
      },
      { status: 409 }
    );
  }

  const neededSnapshotQuestionIds = [
    ...manualNewQuestionIds,
    ...selectedFillQuestionIds,
  ];
  const snapshotByQuestionId = await loadQuestionSnapshotsByIds(db, neededSnapshotQuestionIds);

  const finalItems: Array<{
    question_id: number | null;
    snapshot_payload: JsonValue;
  }> = [];

  for (const existing of preservedItems) {
    const asObject = existing.snapshot_payload && typeof existing.snapshot_payload === "object" && !Array.isArray(existing.snapshot_payload)
      ? (existing.snapshot_payload as Record<string, unknown>)
      : {};
    const hasPrompt = typeof asObject.prompt_text === "string" && asObject.prompt_text.trim().length > 0;
    const hasAnswer = typeof asObject.answer_key === "string" && asObject.answer_key.trim().length > 0;

    if (hasPrompt && hasAnswer && snapshotHasPromptAnswerAndCue(existing.snapshot_payload)) {
      finalItems.push({
        question_id: existing.question_id,
        snapshot_payload: existing.snapshot_payload,
      });
      continue;
    }

    const fallbackQuestionId = Number(existing.question_id);
    if (Number.isFinite(fallbackQuestionId) && fallbackQuestionId > 0) {
      const snapshot = snapshotByQuestionId.get(fallbackQuestionId);
      if (snapshot && snapshotHasPromptAnswerAndCue(snapshot as unknown as JsonValue)) {
        finalItems.push({
          question_id: fallbackQuestionId,
          snapshot_payload: snapshot as unknown as JsonValue,
        });
      }
    }
  }

  for (const questionId of manualNewQuestionIds) {
    const snapshot = snapshotByQuestionId.get(questionId);
    if (!snapshot || !snapshotHasPromptAnswerAndCue(snapshot as unknown as JsonValue)) continue;
    finalItems.push({
      question_id: questionId,
      snapshot_payload: snapshot as unknown as JsonValue,
    });
  }

  for (const questionId of selectedFillQuestionIds) {
    const snapshot = snapshotByQuestionId.get(questionId);
    if (!snapshot || !snapshotHasPromptAnswerAndCue(snapshot as unknown as JsonValue)) continue;
    finalItems.push({
      question_id: questionId,
      snapshot_payload: snapshot as unknown as JsonValue,
    });
  }

  const trimmedFinalItems = finalItems.slice(0, totalTarget);
  const finalMainCount = Math.min(mainTarget, trimmedFinalItems.length);

  const now = new Date().toISOString();
  const rows: TriviaDatabase["public"]["Tables"]["trivia_deck_items"]["Insert"][] = trimmedFinalItems.map((item, index) => {
    const isTieBreaker = index >= finalMainCount;
    const roundNumber = isTieBreaker
      ? Math.max(1, roundCount + 1)
      : Math.max(1, Math.floor(index / questionsPerRound) + 1);

    return {
      deck_id: deckId,
      item_index: index + 1,
      round_number: roundNumber,
      is_tiebreaker: isTieBreaker,
      question_id: item.question_id,
      snapshot_payload: item.snapshot_payload,
      locked: false,
      created_at: now,
      updated_at: now,
    };
  });

  const { error: deleteError } = await db.from("trivia_deck_items").delete().eq("deck_id", deckId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (rows.length > 0) {
    const { error: insertError } = await db.from("trivia_deck_items").insert(rows);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const nextBuildMode = body.build_mode === "manual" || body.build_mode === "hybrid" || body.build_mode === "rule"
    ? body.build_mode
    : deck.build_mode;

  const nextRulesPayload = {
    ...deckRules,
    ...bodyRules,
    filters,
    diversity,
    target_count: mainTarget,
    round_count: roundCount,
    questions_per_round: questionsPerRound,
    tie_breaker_count: tieBreakerCount,
    cooldown_days: cooldownDays,
    preserve_existing: preserveExisting,
  } as unknown as JsonValue;

  const { error: updateError } = await db
    .from("trivia_decks")
    .update({
      build_mode: nextBuildMode,
      rules_payload: nextRulesPayload,
      cooldown_days: cooldownDays,
      updated_at: now,
    })
    .eq("id", deckId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json(
    {
      ok: true,
      data: {
        deck_id: deckId,
        target_total: totalTarget,
        selected_total: rows.length,
        manual_preserved: preservedItems.length,
        manual_added: manualNewQuestionIds.length,
        filled_total: selectedFillQuestionIds.length,
        shortfall_total: Math.max(0, totalTarget - rows.length),
        include_cooled_down: includeCooledDown,
        cooldown_days: cooldownDays,
        playlist_scope_ids: effectivePlaylistIds,
      },
    },
    { status: 200 }
  );
}
