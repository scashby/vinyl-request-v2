import { NextRequest, NextResponse } from "next/server";
import { getOriginalOrCoverDb } from "src/lib/originalOrCoverDb";

export const runtime = "nodejs";

type OverlayMode = "none" | "welcome" | "countdown" | "intermission" | "thanks";

const VALID_MODES: OverlayMode[] = ["none", "welcome", "countdown", "intermission", "thanks"];

function parseSessionId(id: string) {
  const sessionId = Number(id);
  return Number.isFinite(sessionId) ? sessionId : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = parseSessionId(id);
  if (!sessionId) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { mode?: string; duration_seconds?: number };
  const mode = (body.mode ?? "none") as OverlayMode;

  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: "Invalid overlay mode" }, { status: 400 });
  }

  const durationSeconds = Math.max(0, Number(body.duration_seconds ?? 0));
  const startedAt = new Date();
  const endsAt = durationSeconds > 0 ? new Date(startedAt.getTime() + durationSeconds * 1000) : null;

  const payload = {
    mode,
    duration_seconds: durationSeconds,
    started_at: startedAt.toISOString(),
    ends_at: endsAt?.toISOString() ?? null,
  };

  const db = getOriginalOrCoverDb();
  const { error } = await db.from("ooc_session_events").insert({
    session_id: sessionId,
    event_type: "overlay_set",
    payload,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data: payload }, { status: 200 });
}
