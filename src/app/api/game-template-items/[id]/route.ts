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
