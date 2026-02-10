import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

type CreateItemPayload = {
  templateId?: number;
  inventoryId?: number | null;
  recordingId?: number | null;
  title?: string;
  artist?: string;
  side?: string | null;
  position?: string | null;
};

export async function POST(request: NextRequest) {
  let payload: CreateItemPayload = {};

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const templateId = Number(payload.templateId);
  if (!templateId || Number.isNaN(templateId)) {
    return NextResponse.json({ error: "templateId is required." }, { status: 400 });
  }

  const title = payload.title?.trim();
  const artist = payload.artist?.trim();

  if (!title || !artist) {
    return NextResponse.json({ error: "title and artist are required." }, { status: 400 });
  }

  const { data: lastItem, error: lastError } = await supabaseAdmin
    .from("game_template_items")
    .select("sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastError) {
    return NextResponse.json({ error: lastError.message }, { status: 500 });
  }

  const nextSortOrder = (lastItem?.sort_order ?? 0) + 1;

  const { data, error } = await supabaseAdmin
    .from("game_template_items")
    .insert({
      template_id: templateId,
      inventory_id: payload.inventoryId ?? null,
      recording_id: payload.recordingId ?? null,
      title,
      artist,
      side: payload.side ?? null,
      position: payload.position ?? null,
      sort_order: nextSortOrder,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
