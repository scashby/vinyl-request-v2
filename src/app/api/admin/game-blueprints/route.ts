import path from "node:path";
import { existsSync } from "node:fs";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { gameBlueprints, type GameStatus } from "src/lib/gameBlueprints";

export const runtime = "nodejs";

type GameOverride = {
  title?: string;
  status?: GameStatus;
  notes?: string;
  pullSizeGuidance?: string;
};

export async function GET() {
  const { data: rows, error } = await supabaseAdmin
    .from("admin_settings")
    .select("key, value")
    .like("key", "game:blueprint:%");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const overrideMap = new Map<string, GameOverride>();
  for (const row of rows ?? []) {
    const slug = (row.key as string).replace("game:blueprint:", "");
    try {
      overrideMap.set(slug, JSON.parse(row.value as string) as GameOverride);
    } catch {
      // Ignore malformed overrides
    }
  }

  const merged = gameBlueprints.map((blueprint) => {
    const override = overrideMap.get(blueprint.slug) ?? {};
    const hasConcreteModule = existsSync(
      path.join(process.cwd(), "src", "app", "admin", "games", blueprint.slug, "page.tsx")
    );
    return {
      ...blueprint,
      ...override,
      hasConcreteModule,
    };
  });

  return NextResponse.json({ data: merged }, { status: 200 });
}
