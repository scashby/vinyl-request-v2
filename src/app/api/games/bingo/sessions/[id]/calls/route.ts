import { NextRequest, NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";
import { resolveTrackKeys, type ResolvedTrackKey } from "src/lib/bingoEngine";

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

  const calls = (data ?? []) as Array<{
    id: number;
    playlist_track_key: string | null;
    track_title: string;
    artist_name: string;
    album_name: string | null;
    side: string | null;
    position: string | null;
  }>;

  const needsHydration = calls.some(
    (call) => !!call.playlist_track_key && (/^Track\b/i.test(call.track_title) || call.artist_name === "Unknown Artist")
  );

  if (needsHydration) {
    try {
      const keys = calls.map((c) => c.playlist_track_key).filter((v): v is string => typeof v === "string" && v.length > 0);
      const resolved = await resolveTrackKeys(db, keys);
      const updates: Array<{ id: number; patch: ResolvedTrackKey }> = [];
      for (const call of calls) {
        if (!call.playlist_track_key) continue;
        const patch = resolved.get(call.playlist_track_key);
        if (!patch) continue;
        if (!/^Track\b/i.test(call.track_title) && call.artist_name !== "Unknown Artist") continue;
        updates.push({ id: call.id, patch });
      }

      for (const { id: callId, patch } of updates) {
        await db
          .from("bingo_session_calls")
          .update({
            track_title: patch.track_title,
            artist_name: patch.artist_name,
            album_name: patch.album_name,
            side: patch.side,
            position: patch.position,
          })
          .eq("id", callId);

        const local = calls.find((c) => c.id === callId);
        if (local) Object.assign(local, patch);
      }
    } catch {
      // Fail-open: returning calls is better than blocking the host console.
    }
  }

  return NextResponse.json({ data: calls }, { status: 200 });
}
