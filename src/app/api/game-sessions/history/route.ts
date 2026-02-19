import { NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const { data: sessions, error } = await supabaseAdmin
    .from("game_sessions")
    .select("id, created_at, status, game_type, game_templates ( name )")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalized = await Promise.all(
    (sessions ?? []).map(async (session) => {
      const { count } = await supabaseAdmin
        .from("game_session_picks")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id)
        .not("called_at", "is", null);

      return {
        id: session.id,
        created_at: session.created_at,
        songs_played: count ?? 0,
        player_count: 0,
        bingos: 0,
        playback_source: "vinyl",
        playlist_name: session.game_templates?.name ?? "Unknown Playlist",
        playlist_type: "custom",
      };
    })
  );

  return NextResponse.json({ data: normalized }, { status: 200 });
}
