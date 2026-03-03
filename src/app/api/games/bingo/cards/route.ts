import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { autoSyncSessionPlaylistMetadata } from "src/lib/playlistMetadataSync";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionId = Number(request.nextUrl.searchParams.get("sessionId"));
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const db = getBingoDb();
  try {
    await autoSyncSessionPlaylistMetadata("bingo", sessionId);
  } catch {
    // Fail-open for card rendering.
  }
  const { data: session } = await db
    .from("bingo_sessions")
    .select("id, card_label_mode")
    .eq("id", sessionId)
    .maybeSingle();

  const labelMode = (session?.card_label_mode ?? "track_artist") as "track_artist" | "track_only";

  const { data: calls } = await db
    .from("bingo_session_calls")
    .select("id, playlist_track_key, track_title, artist_name, album_name, side, position")
    .eq("session_id", sessionId);

  const typedCalls = (calls ?? []) as Array<{
    id: number;
    playlist_track_key: string | null;
    track_title: string;
    artist_name: string;
    album_name: string | null;
    side: string | null;
    position: string | null;
  }>;

  const { data, error } = await db
    .from("bingo_cards")
    .select("id, session_id, card_number, has_free_space, grid, created_at")
    .eq("session_id", sessionId)
    .order("card_number", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const callById = new Map<number, (typeof typedCalls)[number]>(typedCalls.map((c) => [c.id, c]));

  const hydrated = (data ?? []).map((row) => {
    const grid = Array.isArray((row as { grid?: unknown }).grid) ? ((row as { grid: unknown[] }).grid as unknown[]) : [];
    const nextGrid = grid.map((cell) => {
      if (!cell || typeof cell !== "object") return cell;
      const typed = cell as Record<string, unknown>;
      const free = Boolean(typed.free);
      if (free) return cell;
      const callId = typeof typed.call_id === "number" ? typed.call_id : null;
      if (!callId) return cell;
      const call = callById.get(callId);
      if (!call) return cell;
      const nextLabel = labelMode === "track_only" ? call.track_title : `${call.track_title} - ${call.artist_name}`;
      return {
        ...typed,
        track_title: call.track_title,
        artist_name: call.artist_name,
        label: nextLabel,
      };
    });
    return { ...row, grid: nextGrid };
  });

  return NextResponse.json({ data: hydrated }, { status: 200 });
}
