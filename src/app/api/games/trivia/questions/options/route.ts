import { NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";
import { TRIVIA_BANK_ENABLED } from "src/lib/triviaBankApi";

export const runtime = "nodejs";

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

export async function GET() {
  if (!TRIVIA_BANK_ENABLED) return NextResponse.json({ error: "Trivia bank disabled" }, { status: 404 });

  const db = getTriviaDb();
  const [{ data: defaults, error: defaultsError }, { data: facets, error: facetsError }, { data: tags, error: tagsError }] = await Promise.all([
    db.from("trivia_questions").select("default_category").limit(3000),
    db.from("trivia_question_facets").select("category").limit(3000),
    db.from("trivia_question_tags").select("tag").limit(3000),
  ]);

  if (defaultsError) return NextResponse.json({ error: defaultsError.message }, { status: 500 });
  if (facetsError) return NextResponse.json({ error: facetsError.message }, { status: 500 });
  if (tagsError) return NextResponse.json({ error: tagsError.message }, { status: 500 });

  const categories = uniqueSorted([
    "General Music",
    ...(defaults ?? []).map((row) => row.default_category),
    ...(facets ?? []).map((row) => row.category),
  ]);
  const normalizedTags = uniqueSorted((tags ?? []).map((row) => row.tag));

  return NextResponse.json({
    categories,
    tags: normalizedTags,
    difficulties: ["easy", "medium", "hard"],
  }, { status: 200 });
}
