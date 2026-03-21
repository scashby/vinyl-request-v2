import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { gameBlueprints, type GameStatus } from "src/lib/gameBlueprints";

export const runtime = "nodejs";

const ALLOWED_STATUSES: GameStatus[] = ["in_production", "in_development", "needs_workshopping", "undeveloped"];

type PatchBody = {
  title?: unknown;
  status?: unknown;
  notes?: unknown;
  pullSizeGuidance?: unknown;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const blueprint = gameBlueprints.find((game) => game.slug === slug);
  if (!blueprint) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as PatchBody;

  const override: Record<string, string> = {};

  if (typeof body.title === "string" && body.title.trim()) {
    override.title = body.title.trim();
  }
  if (typeof body.status === "string" && ALLOWED_STATUSES.includes(body.status as GameStatus)) {
    override.status = body.status;
  }
  if (body.notes !== undefined) {
    override.notes = typeof body.notes === "string" ? body.notes.trim() : "";
  }
  if (typeof body.pullSizeGuidance === "string") {
    override.pullSizeGuidance = body.pullSizeGuidance.trim();
  }

  if (Object.keys(override).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  // Read existing override and merge
  const { data: existing } = await supabaseAdmin
    .from("admin_settings")
    .select("value")
    .eq("key", `game:blueprint:${slug}`)
    .maybeSingle();

  const existingOverride = existing?.value ? (JSON.parse(existing.value as string) as Record<string, string>) : {};
  const merged = { ...existingOverride, ...override };

  const { error } = await supabaseAdmin
    .from("admin_settings")
    .upsert({ key: `game:blueprint:${slug}`, value: JSON.stringify(merged), updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, override: merged }, { status: 200 });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const blueprint = gameBlueprints.find((game) => game.slug === slug);
  if (!blueprint) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("admin_settings")
    .delete()
    .eq("key", `game:blueprint:${slug}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
