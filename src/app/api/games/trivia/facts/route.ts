// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — trivia_facts is not in TriviaDatabase; use getTriviaDb with cast
import { NextRequest, NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const db = getTriviaDb() as unknown as { from: (t: string) => unknown };
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status") ?? null;
  const entity_type = searchParams.get("entity_type") ?? null;
  const fact_kind = searchParams.get("fact_kind") ?? null;
  const entity_ref = searchParams.get("entity_ref") ?? null;
  const run_id = searchParams.get("run_id") ? parseInt(searchParams.get("run_id")!, 10) : null;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  let query = db
    .from("trivia_facts")
    .select(
      `id, fact_code, entity_type, entity_id, entity_ref, fact_text, fact_kind,
       status, confidence, generation_run_id, source_record_id, created_by, created_at,
       trivia_source_records(id, source_url, source_domain, source_title, excerpt_text, verification_status)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (entity_type) query = query.eq("entity_type", entity_type);
  if (fact_kind) query = query.eq("fact_kind", fact_kind);
  if (entity_ref) query = query.ilike("entity_ref", `%${entity_ref}%`);
  if (run_id) query = query.eq("generation_run_id", run_id);

  const { data, error, count } = await (query as unknown as Promise<{ data: unknown[] | null; error: { message: string } | null; count: number | null }>);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}
