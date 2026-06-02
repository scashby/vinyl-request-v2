import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";

export const runtime = "nodejs";

type ThemeContextRow = {
  id: number;
  theme_slug: string;
  theme_name: string;
  playlist_track_key: string;
  context_text: string;
  created_at: string;
  updated_at: string;
};

type PostBody = {
  theme_slug: string;
  theme_name: string;
  playlist_track_key: string;
  context_text: string;
};

/** GET /api/games/bingo/theme-contexts — list all unique themes */
export async function GET() {
  const db = getBingoDb();
  const { data, error } = await db
    .from("bingo_theme_contexts")
    .select("theme_slug, theme_name")
    .order("theme_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deduplicate by slug (slug + name are stable per pair)
  const seen = new Set<string>();
  const themes: { theme_slug: string; theme_name: string }[] = [];
  for (const row of (data ?? []) as { theme_slug: string; theme_name: string }[]) {
    if (!seen.has(row.theme_slug)) {
      seen.add(row.theme_slug);
      themes.push({ theme_slug: row.theme_slug, theme_name: row.theme_name });
    }
  }

  return NextResponse.json({ data: themes }, { status: 200 });
}

/** POST /api/games/bingo/theme-contexts — upsert a single context entry */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<PostBody>;

  const theme_slug = typeof body.theme_slug === "string" ? body.theme_slug.trim() : "";
  const theme_name = typeof body.theme_name === "string" ? body.theme_name.trim() : "";
  const playlist_track_key = typeof body.playlist_track_key === "string" ? body.playlist_track_key.trim() : "";
  const context_text = typeof body.context_text === "string" ? body.context_text.trim() : "";

  if (!theme_slug) return NextResponse.json({ error: "theme_slug is required" }, { status: 400 });
  if (!theme_name) return NextResponse.json({ error: "theme_name is required" }, { status: 400 });
  if (!playlist_track_key) return NextResponse.json({ error: "playlist_track_key is required" }, { status: 400 });
  if (!context_text) return NextResponse.json({ error: "context_text is required" }, { status: 400 });

  const db = getBingoDb();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("bingo_theme_contexts")
    .upsert(
      { theme_slug, theme_name, playlist_track_key, context_text, updated_at: now },
      { onConflict: "theme_slug,playlist_track_key" }
    )
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data as ThemeContextRow }, { status: 200 });
}
