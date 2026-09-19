import path from "node:path";
import { existsSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { getResolvedGameBlueprints, slugify } from "src/lib/resolveGameBlueprints";
import type { GameStatus } from "src/lib/gameBlueprints";

export const runtime = "nodejs";

const CACHE_HEADERS = {
  "Cache-Control": "private, max-age=300, stale-while-revalidate=900",
  Vary: "Cookie, Authorization",
};

const ALLOWED_STATUSES: GameStatus[] = ["in_production", "in_development", "needs_workshopping", "undeveloped"];

export async function GET() {
  const resolved = await getResolvedGameBlueprints();

  const withModuleFlag = resolved.map((game) => ({
    ...game,
    hasConcreteModule: existsSync(
      path.join(process.cwd(), "src", "app", "admin", "games", game.slug, "page.tsx")
    ),
  }));

  return NextResponse.json({ data: withModuleFlag }, { status: 200, headers: CACHE_HEADERS });
}

type CreateBody = {
  title?: unknown;
  status?: unknown;
  tagline?: unknown;
  notes?: unknown;
};

// Adds a brand-new game — one that exists only through the admin, with no
// entry in the static gameBlueprints.ts (development for these now happens
// on a separate site, so there's nothing to build here beyond the public
// listing: title, status, and a short description).
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as CreateBody;

  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const status: GameStatus =
    typeof body.status === "string" && ALLOWED_STATUSES.includes(body.status as GameStatus)
      ? (body.status as GameStatus)
      : "undeveloped";

  const existing = await getResolvedGameBlueprints();
  const existingSlugs = new Set(existing.map((g) => g.slug));

  const base = slugify(body.title);
  let slug = base || "game";
  let suffix = 2;
  while (existingSlugs.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  const value = {
    title: body.title.trim(),
    status,
    tagline: typeof body.tagline === "string" ? body.tagline.trim() : "",
    notes: typeof body.notes === "string" ? body.notes.trim() : "",
    isCustom: true,
  };

  const { error } = await supabaseAdmin
    .from("admin_settings")
    .upsert({ key: `game:blueprint:${slug}`, value: JSON.stringify(value), updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, slug }, { status: 201 });
}
