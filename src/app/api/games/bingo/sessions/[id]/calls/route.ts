import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getBingoDb();
  const { data, error } = await db
    .from("bingo_session_calls")
    .select("id, session_id, playlist_track_key, call_index, ball_number, column_letter, track_title, artist_name, album_name, side, position, status, prep_started_at, called_at, completed_at, created_at")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}
