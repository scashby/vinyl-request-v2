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

/** GET /api/games/bingo/theme-contexts/[slug] — all context entries for a theme */
export async function GET(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const db = getBingoDb();
  const { data, error } = await db
    .from("bingo_theme_contexts")
    .select("id, theme_slug, theme_name, playlist_track_key, context_text, created_at, updated_at")
    .eq("theme_slug", slug)
    .order("playlist_track_key", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: (data ?? []) as ThemeContextRow[] }, { status: 200 });
}
