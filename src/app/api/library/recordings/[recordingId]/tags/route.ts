import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ recordingId: string }> }) {
  try {
    const { recordingId } = await context.params;
    const id = Number(recordingId);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid recordingId" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, tagName } = body as { action?: string; tagName?: string };

    if (action !== "add" && action !== "remove") {
      return NextResponse.json({ error: "action must be 'add' or 'remove'" }, { status: 400 });
    }
    if (!tagName || typeof tagName !== "string" || !tagName.trim()) {
      return NextResponse.json({ error: "tagName is required" }, { status: 400 });
    }
    const normalizedName = tagName.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    if (action === "add") {
      // Upsert tag into master_tags (idempotent)
      const { data: tag, error: upsertError } = await db
        .from("master_tags")
        .upsert({ name: normalizedName }, { onConflict: "name" })
        .select("id")
        .single();

      if (upsertError || !tag) {
        // Upsert may not return on conflict — try a plain select as fallback
        const { data: existing, error: selectError } = await db
          .from("master_tags")
          .select("id")
          .eq("name", normalizedName)
          .single();
        if (selectError || !existing) {
          return NextResponse.json({ error: "Failed to resolve tag" }, { status: 500 });
        }
        await db
          .from("recording_tag_links")
          .upsert({ recording_id: id, tag_id: existing.id }, { onConflict: "recording_id,tag_id", ignoreDuplicates: true });
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      await db
        .from("recording_tag_links")
        .upsert({ recording_id: id, tag_id: tag.id }, { onConflict: "recording_id,tag_id", ignoreDuplicates: true });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // action === "remove"
    const { data: tag, error: lookupError } = await db
      .from("master_tags")
      .select("id")
      .eq("name", normalizedName)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }
    if (!tag) {
      // Tag doesn't exist — nothing to remove
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const { error: deleteError } = await db
      .from("recording_tag_links")
      .delete()
      .eq("recording_id", id)
      .eq("tag_id", tag.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update recording tag";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
