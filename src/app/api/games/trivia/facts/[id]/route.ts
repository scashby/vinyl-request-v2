// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — trivia_facts is not in TriviaDatabase; use getTriviaDb with cast
import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getTriviaDb() as unknown as { from: (t: string) => unknown };
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = ["status", "fact_text", "fact_kind", "confidence"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Validate status
  if (updates.status && !["draft", "approved", "archived"].includes(updates.status as string)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await (db
    .from("trivia_facts")
    .update(updates)
    .eq("id", id)
    .select()
    .single() as unknown as Promise<{ data: unknown; error: { message: string } | null }>);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getTriviaDb() as unknown as { from: (t: string) => unknown };
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { data, error } = await (db
    .from("trivia_facts")
    .select(`
      id, fact_code, entity_type, entity_id, entity_ref, fact_text, fact_kind,
      status, confidence, generation_run_id, source_record_id, created_by, created_at, updated_at,
      trivia_source_records(id, source_url, source_domain, source_title, excerpt_text, verification_status)
    `)
    .eq("id", id)
    .single() as unknown as Promise<{ data: unknown; error: { message: string } | null }>);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
