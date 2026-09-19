import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { clampPostFocus, keyForPostLink, type PostFocus } from "src/lib/dialoguesPostFocus";

export const runtime = "nodejs";

const KEY_PREFIX = "dialogues:post-focus:";

// Returns { [postLinkHashKey]: PostFocus } for every post that has a saved
// override, so the public pages and the admin editor can both merge it in
// by re-deriving the same key from a post's link.
export async function GET() {
  const { data: rows, error } = await supabaseAdmin
    .from("admin_settings")
    .select("key, value")
    .like("key", `${KEY_PREFIX}%`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const focusByKey: Record<string, PostFocus> = {};
  for (const row of rows ?? []) {
    const key = (row.key as string).slice(KEY_PREFIX.length);
    try {
      focusByKey[key] = clampPostFocus(JSON.parse(row.value as string) as PostFocus);
    } catch {
      // Skip malformed rows rather than failing the whole list.
    }
  }

  return NextResponse.json({ data: focusByKey }, {
    status: 200,
    headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=900" },
  });
}

type PatchBody = { link?: unknown; x?: unknown; y?: unknown; zoom?: unknown };

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as PatchBody;

  if (typeof body.link !== "string" || !body.link.trim()) {
    return NextResponse.json({ error: "link is required" }, { status: 400 });
  }

  const focus = clampPostFocus({
    x: typeof body.x === "number" ? body.x : 50,
    y: typeof body.y === "number" ? body.y : 50,
    zoom: typeof body.zoom === "number" ? body.zoom : 1,
  });

  const key = keyForPostLink(body.link);
  const { error } = await supabaseAdmin
    .from("admin_settings")
    .upsert({ key: `${KEY_PREFIX}${key}`, value: JSON.stringify(focus), updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, key, focus }, { status: 200 });
}
