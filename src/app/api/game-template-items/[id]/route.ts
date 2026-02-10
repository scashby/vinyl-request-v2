import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  const id = Number(context.params.id);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("game_template_items")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  const id = Number(context.params.id);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
  }

  let payload: { sortOrder?: number } = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  if (!payload.sortOrder) {
    return NextResponse.json({ error: "sortOrder is required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("game_template_items")
    .update({ sort_order: payload.sortOrder })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}
