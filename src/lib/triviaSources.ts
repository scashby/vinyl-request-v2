import { getTriviaDb } from "src/lib/triviaDb";

export type TriviaQuestionSourceInput = {
  source_kind?: string;
  source_url?: string | null;
  source_domain?: string | null;
  source_title?: string | null;
  excerpt_text?: string | null;
  claim_text?: string | null;
  source_claim_text?: string | null;
  verification_status?: string;
  verification_notes?: string | null;
  relationship_type?: string;
  is_primary?: boolean;
  citation_excerpt?: string | null;
};

export type TriviaQuestionSourceRecord = {
  id: number;
  source_record_id: number;
  relationship_type: string;
  is_primary: boolean;
  sort_order: number;
  citation_excerpt: string | null;
  claim_text: string | null;
  verification_notes: string | null;
  source_kind: string;
  source_url: string | null;
  source_domain: string | null;
  source_title: string | null;
  excerpt_text: string | null;
  source_claim_text: string | null;
  verification_status: string;
  fetched_at: string | null;
  published_at: string | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeDomain(value: string | null, urlValue: string | null): string | null {
  if (value) return value;
  if (!urlValue) return null;
  try {
    return new URL(urlValue).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function normalizeQuestionSources(value: unknown): TriviaQuestionSourceInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
      if (!item) return null;

      const sourceUrl = asNullableString(item.source_url);
      const sourceTitle = asNullableString(item.source_title);
      const excerptText = asNullableString(item.excerpt_text);
      const claimText = asNullableString(item.source_claim_text ?? item.claim_text);
      const citationExcerpt = asNullableString(item.citation_excerpt);
      const verificationNotes = asNullableString(item.verification_notes);
      const sourceKind = asString(item.source_kind) || "editorial";
      const verificationStatus = asString(item.verification_status) || "unreviewed";
      const relationshipType = asString(item.relationship_type) || "research";

      if (!sourceUrl && !sourceTitle && !excerptText && !claimText && !citationExcerpt && !verificationNotes) {
        return null;
      }

      return {
        source_kind: sourceKind,
        source_url: sourceUrl,
        source_domain: normalizeDomain(asNullableString(item.source_domain), sourceUrl),
        source_title: sourceTitle,
        excerpt_text: excerptText,
        claim_text: claimText,
        source_claim_text: claimText,
        verification_status: verificationStatus,
        verification_notes: verificationNotes,
        relationship_type: relationshipType,
        is_primary: asBoolean(item.is_primary),
        citation_excerpt: citationExcerpt,
      } satisfies TriviaQuestionSourceInput;
    })
    .filter(Boolean) as TriviaQuestionSourceInput[];
}

export async function loadQuestionSources(questionId: number): Promise<TriviaQuestionSourceRecord[]> {
  const db = getTriviaDb();
  const { data: links, error: linksError } = await db
    .from("trivia_question_sources")
    .select("id, source_record_id, relationship_type, is_primary, sort_order, citation_excerpt, claim_text, verification_notes")
    .eq("question_id", questionId)
    .order("sort_order", { ascending: true });

  if (linksError) throw new Error(linksError.message);

  const typedLinks = (links ?? []) as Array<{
    id: number;
    source_record_id: number;
    relationship_type: string;
    is_primary: boolean;
    sort_order: number;
    citation_excerpt: string | null;
    claim_text: string | null;
    verification_notes: string | null;
  }>;

  if (typedLinks.length === 0) return [];

  const sourceRecordIds = typedLinks.map((link) => link.source_record_id);
  const { data: sourceRecords, error: sourceRecordsError } = await db
    .from("trivia_source_records")
    .select("id, source_kind, source_url, source_domain, source_title, excerpt_text, claim_text, verification_status, verification_notes, fetched_at, published_at")
    .in("id", sourceRecordIds);

  if (sourceRecordsError) throw new Error(sourceRecordsError.message);

  const sourceRecordById = new Map(
    ((sourceRecords ?? []) as Array<{
      id: number;
      source_kind: string;
      source_url: string | null;
      source_domain: string | null;
      source_title: string | null;
      excerpt_text: string | null;
      claim_text: string | null;
      verification_status: string;
      verification_notes: string | null;
      fetched_at: string | null;
      published_at: string | null;
    }>).map((record) => [record.id, record])
  );

  return typedLinks.map((link) => {
    const sourceRecord = sourceRecordById.get(link.source_record_id);
    return {
      id: link.id,
      source_record_id: link.source_record_id,
      relationship_type: link.relationship_type,
      is_primary: link.is_primary,
      sort_order: link.sort_order,
      citation_excerpt: link.citation_excerpt,
      claim_text: link.claim_text,
      verification_notes: link.verification_notes,
      source_kind: sourceRecord?.source_kind ?? "editorial",
      source_url: sourceRecord?.source_url ?? null,
      source_domain: sourceRecord?.source_domain ?? null,
      source_title: sourceRecord?.source_title ?? null,
      excerpt_text: sourceRecord?.excerpt_text ?? null,
      source_claim_text: sourceRecord?.claim_text ?? null,
      verification_status: sourceRecord?.verification_status ?? "unreviewed",
      fetched_at: sourceRecord?.fetched_at ?? null,
      published_at: sourceRecord?.published_at ?? null,
    } satisfies TriviaQuestionSourceRecord;
  });
}

export async function replaceQuestionSources(questionId: number, value: unknown, updatedBy: string) {
  const db = getTriviaDb();
  const normalizedSources = normalizeQuestionSources(value);

  const { error: deleteLinksError } = await db.from("trivia_question_sources").delete().eq("question_id", questionId);
  if (deleteLinksError) throw new Error(deleteLinksError.message);

  if (normalizedSources.length === 0) return [];

  const now = new Date().toISOString();
  const sourceRecordsToInsert = normalizedSources.map((source) => ({
    source_kind: source.source_kind ?? "editorial",
    source_url: source.source_url ?? null,
    source_domain: source.source_domain ?? null,
    source_title: source.source_title ?? null,
    excerpt_text: source.excerpt_text ?? null,
    claim_text: source.claim_text ?? null,
    verification_status: source.verification_status ?? "unreviewed",
    verification_notes: source.verification_notes ?? null,
    created_by: updatedBy,
    created_at: now,
    updated_at: now,
  }));

  const { data: insertedSourceRecords, error: insertSourceRecordsError } = await db
    .from("trivia_source_records")
    .insert(sourceRecordsToInsert)
    .select("id");

  if (insertSourceRecordsError) throw new Error(insertSourceRecordsError.message);

  const primaryIndex = normalizedSources.findIndex((source) => source.is_primary);
  const linksToInsert = normalizedSources.map((source, index) => ({
    question_id: questionId,
    source_record_id: Number((insertedSourceRecords ?? [])[index]?.id),
    relationship_type: source.relationship_type ?? "research",
    is_primary: primaryIndex === -1 ? index === 0 : index === primaryIndex,
    sort_order: index,
    citation_excerpt: source.citation_excerpt ?? null,
    claim_text: source.claim_text ?? null,
    verification_notes: source.verification_notes ?? null,
    created_by: updatedBy,
    created_at: now,
    updated_at: now,
  }));

  const { error: insertLinksError } = await db.from("trivia_question_sources").insert(linksToInsert);
  if (insertLinksError) throw new Error(insertLinksError.message);

  return loadQuestionSources(questionId);
}