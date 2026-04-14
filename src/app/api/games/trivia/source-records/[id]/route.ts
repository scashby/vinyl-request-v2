import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb, type TriviaDatabase } from "src/lib/triviaDb";

export const runtime = "nodejs";

function parseSourceRecordId(raw: string): number | null {
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sourceRecordId = parseSourceRecordId(id);
  if (!sourceRecordId) return NextResponse.json({ error: "Invalid source record id" }, { status: 400 });

  try {
    const db = getTriviaDb();
    const body = (await request.json()) as Record<string, unknown>;
    const now = new Date().toISOString();
    const patch: TriviaDatabase["public"]["Tables"]["trivia_source_records"]["Update"] = {
      updated_at: now,
    };

    if (Object.prototype.hasOwnProperty.call(body, "source_kind")) {
      const sourceKindRaw = asString(body.source_kind).toLowerCase();
      patch.source_kind = sourceKindRaw === "manual" || sourceKindRaw === "api" || sourceKindRaw === "reference"
        ? sourceKindRaw
        : "editorial";
    }
    if (Object.prototype.hasOwnProperty.call(body, "source_url")) {
      patch.source_url = asNullableString(body.source_url);
    }
    if (Object.prototype.hasOwnProperty.call(body, "source_domain") || Object.prototype.hasOwnProperty.call(body, "source_url")) {
      patch.source_domain = normalizeDomain(asNullableString(body.source_domain), patch.source_url ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(body, "source_title")) patch.source_title = asNullableString(body.source_title);
    if (Object.prototype.hasOwnProperty.call(body, "excerpt_text")) patch.excerpt_text = asNullableString(body.excerpt_text);
    if (Object.prototype.hasOwnProperty.call(body, "claim_text")) patch.claim_text = asNullableString(body.claim_text);
    if (Object.prototype.hasOwnProperty.call(body, "verification_notes")) patch.verification_notes = asNullableString(body.verification_notes);
    if (Object.prototype.hasOwnProperty.call(body, "content_hash")) patch.content_hash = asNullableString(body.content_hash);
    if (Object.prototype.hasOwnProperty.call(body, "metadata_payload")) {
      patch.metadata_payload = (body.metadata_payload && typeof body.metadata_payload === "object" ? body.metadata_payload : {}) as TriviaDatabase["public"]["Tables"]["trivia_source_records"]["Update"]["metadata_payload"];
    }
    if (Object.prototype.hasOwnProperty.call(body, "verification_status")) {
      const verificationStatusRaw = asString(body.verification_status).toLowerCase();
      patch.verification_status = verificationStatusRaw === "approved" || verificationStatusRaw === "rejected" || verificationStatusRaw === "superseded"
        ? verificationStatusRaw
        : "unreviewed";
    }

    const { data, error } = await db
      .from("trivia_source_records")
      .update(patch)
      .eq("id", sourceRecordId)
      .select("id, import_run_id, source_kind, source_url, source_domain, source_title, excerpt_text, claim_text, verification_status, verification_notes, fetched_at, published_at, content_hash, metadata_payload, created_by, created_at, updated_at")
      .single();

    if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed to update source record" }, { status: 500 });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}