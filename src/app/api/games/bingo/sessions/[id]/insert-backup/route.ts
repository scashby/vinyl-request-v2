import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";

export const runtime = "nodejs";

type InsertBackupBody = {
  track_title?: string;
  artist_name?: string;
  album_name?: string | null;
  column_letter?: "B" | "I" | "N" | "G" | "O";
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json()) as InsertBackupBody;
  if (!body.track_title || !body.artist_name) {
    return NextResponse.json({ error: "track_title and artist_name are required" }, { status: 400 });
  }

  const db = getBingoDb();
  const { data: lastCall } = await db
    .from("bingo_session_calls")
    .select("call_index")
    .eq("session_id", sessionId)
    .order("call_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextIndex = (lastCall?.call_index ?? 0) + 1;

  const { data, error } = await db
    .from("bingo_session_calls")
    .insert({
      session_id: sessionId,
      call_index: nextIndex,
      column_letter: body.column_letter ?? "N",
      track_title: body.track_title,
      artist_name: body.artist_name,
      album_name: body.album_name ?? null,
      status: "pending",
    })
    .select("id, call_index")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
