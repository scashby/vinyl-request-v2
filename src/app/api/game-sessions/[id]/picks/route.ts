import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const sessionId = Number(params.id);

  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("game_session_picks")
    .select("id, pick_index, called_at, game_template_items ( id, title, artist )")
    .eq("session_id", sessionId)
    .order("pick_index", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalized = (data ?? []).map((pick) => ({
    id: pick.id,
    pick_index: pick.pick_index,
    status: pick.called_at ? "played" : "pending",
    called_at: pick.called_at,
    column_letter: ["B", "I", "N", "G", "O"][pick.pick_index % 5],
    track_title: pick.game_template_items?.title ?? "",
    artist_name: pick.game_template_items?.artist ?? "",
    album_name: null,
    game_template_items: {
      id: pick.game_template_items?.id ?? null,
      title: pick.game_template_items?.title ?? "",
      artist: pick.game_template_items?.artist ?? "",
      album_name: null,
    },
  }));

  return NextResponse.json({ data: normalized }, { status: 200 });
}
