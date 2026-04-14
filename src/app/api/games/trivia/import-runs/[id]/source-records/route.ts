import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb, type TriviaDatabase } from "src/lib/triviaDb";

export const runtime = "nodejs";

function parseRunId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
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

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runId = parseRunId(id);
  if (!runId) return NextResponse.json({ error: "Invalid import run id" }, { status: 400 });

  const db = getTriviaDb();
  const { data, error } = await db
    .from("trivia_source_records")
    .select("id, import_run_id, source_kind, source_url, source_domain, source_title, excerpt_text, claim_text, verification_status, verification_notes, fetched_at, published_at, content_hash, metadata_payload, created_by, created_at, updated_at")
    .eq("import_run_id", runId)
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runId = parseRunId(id);
  if (!runId) return NextResponse.json({ error: "Invalid import run id" }, { status: 400 });

  try {
    const db = getTriviaDb();
    const body = (await request.json()) as Record<string, unknown>;
    const sourceUrl = asNullableString(body.source_url);
    const sourceTitle = asNullableString(body.source_title);
    const excerptText = asNullableString(body.excerpt_text);
    const claimText = asNullableString(body.claim_text);

    if (!sourceUrl && !sourceTitle && !excerptText && !claimText) {
      return NextResponse.json({ error: "Enter at least one source field." }, { status: 400 });
    }

    const sourceKindRaw = asString(body.source_kind).toLowerCase();
    const sourceKind = sourceKindRaw === "manual" || sourceKindRaw === "api" || sourceKindRaw === "reference"
      ? sourceKindRaw
      : "editorial";
    const verificationStatusRaw = asString(body.verification_status).toLowerCase();
    const verificationStatus = verificationStatusRaw === "approved" || verificationStatusRaw === "rejected" || verificationStatusRaw === "superseded"
      ? verificationStatusRaw
      : "unreviewed";
    const now = new Date().toISOString();
    const metadataPayload = (body.metadata_payload && typeof body.metadata_payload === "object" ? body.metadata_payload : {}) as TriviaDatabase["public"]["Tables"]["trivia_source_records"]["Insert"]["metadata_payload"];

    const { data, error } = await db
      .from("trivia_source_records")
      .insert({
        import_run_id: runId,
        source_kind: sourceKind,
        source_url: sourceUrl,
        source_domain: normalizeDomain(asNullableString(body.source_domain), sourceUrl),
        source_title: sourceTitle,
        excerpt_text: excerptText,
        claim_text: claimText,
        verification_status: verificationStatus,
        verification_notes: asNullableString(body.verification_notes),
        fetched_at: asNullableString(body.fetched_at),
        published_at: asNullableString(body.published_at),
        content_hash: asNullableString(body.content_hash),
        metadata_payload: metadataPayload,
        created_by: asNullableString(body.created_by) ?? "admin",
        created_at: now,
        updated_at: now,
      })
      .select("id, import_run_id, source_kind, source_url, source_domain, source_title, excerpt_text, claim_text, verification_status, verification_notes, fetched_at, published_at, content_hash, metadata_payload, created_by, created_at, updated_at")
      .single();

    if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed to create source record" }, { status: 500 });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}