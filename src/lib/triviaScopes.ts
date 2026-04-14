import { getTriviaDb } from "src/lib/triviaDb";

export type TriviaQuestionScopeType = "playlist" | "crate" | "format" | "artist" | "album" | "track";

export type TriviaQuestionScopeInput = {
  scope_type?: string;
  scope_ref_id?: number | null;
  scope_value?: string | null;
  display_label?: string | null;
};

export type TriviaQuestionScopeRecord = {
  id: number;
  question_id?: number;
  scope_type: TriviaQuestionScopeType;
  scope_ref_id: number | null;
  scope_value: string | null;
  display_label: string | null;
  sort_order: number;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function asPositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function normalizeScopeType(value: unknown): TriviaQuestionScopeType | null {
  const text = asString(value).toLowerCase();
  if (text === "playlist" || text === "crate" || text === "format" || text === "artist" || text === "album" || text === "track") {
    return text;
  }
  return null;
}

export function normalizeQuestionScopes(value: unknown): TriviaQuestionScopeInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
      if (!item) return null;

      const scopeType = normalizeScopeType(item.scope_type);
      if (!scopeType) return null;

      const scopeRefId = asPositiveNumber(item.scope_ref_id);
      const scopeValue = asNullableString(item.scope_value);
      const displayLabel = asNullableString(item.display_label) ?? scopeValue;
      if (!scopeRefId && !scopeValue && !displayLabel) return null;

      return {
        scope_type: scopeType,
        scope_ref_id: scopeRefId,
        scope_value: scopeValue,
        display_label: displayLabel,
      } satisfies TriviaQuestionScopeInput;
    })
    .filter(Boolean) as TriviaQuestionScopeInput[];
}

export async function loadQuestionScopes(questionId: number): Promise<TriviaQuestionScopeRecord[]> {
  const db = getTriviaDb();
  const { data, error } = await db
    .from("trivia_question_scopes")
    .select("id, question_id, scope_type, scope_ref_id, scope_value, display_label, sort_order")
    .eq("question_id", questionId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<TriviaQuestionScopeRecord>).map((row) => ({
    ...row,
    scope_type: normalizeScopeType(row.scope_type) ?? "artist",
  }));
}

export async function replaceQuestionScopes(questionId: number, value: unknown, updatedBy: string) {
  const db = getTriviaDb();
  const normalizedScopes = normalizeQuestionScopes(value);
  const now = new Date().toISOString();

  const { error: deleteError } = await db.from("trivia_question_scopes").delete().eq("question_id", questionId);
  if (deleteError) throw new Error(deleteError.message);

  if (normalizedScopes.length === 0) return [];

  const rows = normalizedScopes.map((scope, index) => ({
    question_id: questionId,
    scope_type: scope.scope_type ?? "artist",
    scope_ref_id: scope.scope_ref_id ?? null,
    scope_value: scope.scope_value ?? null,
    display_label: scope.display_label ?? null,
    sort_order: index,
    created_by: updatedBy,
    created_at: now,
    updated_at: now,
  }));

  const { error: insertError } = await db.from("trivia_question_scopes").insert(rows);
  if (insertError) throw new Error(insertError.message);

  return loadQuestionScopes(questionId);
}