import { NextRequest, NextResponse } from "next/server";
import { getBracketBattleDb } from "src/lib/bracketBattleDb";

export const runtime = "nodejs";

const VALID_MODES = ["none", "welcome", "countdown", "intermission", "thanks"] as const;
type OverlayMode = (typeof VALID_MODES)[number];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json()) as { mode?: string; duration_seconds?: number | null };
  const mode = body.mode as OverlayMode;
  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: `Invalid mode. Must be one of: ${VALID_MODES.join(", ")}` }, { status: 400 });
  }

  const durationSeconds = body.duration_seconds != null ? Number(body.duration_seconds) : null;
  const startedAt = new Date().toISOString();
  const endsAt =
    durationSeconds != null && durationSeconds > 0
      ? new Date(Date.now() + durationSeconds * 1000).toISOString()
      : null;

  const db = getBracketBattleDb();
  const { error } = await db.from("bb_session_events").insert({
    session_id: sessionId,
    event_type: "overlay_set",
    payload: { mode, duration_seconds: durationSeconds, started_at: startedAt, ends_at: endsAt },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, mode, ends_at: endsAt }, { status: 200 });
}
