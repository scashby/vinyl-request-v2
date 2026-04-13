import { NextRequest, NextResponse } from "next/server";
import { getNeedleDropRouletteDb } from "src/lib/needleDropRouletteDb";

export const runtime = "nodejs";

type OverlayMode = "none" | "welcome" | "countdown" | "intermission" | "thanks";

type OverlayBody = {
  mode?: OverlayMode;
  duration_seconds?: number;
};

const ALLOWED_MODES = new Set<OverlayMode>(["none", "welcome", "countdown", "intermission", "thanks"]);

function normalizeDurationSeconds(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(7200, Math.floor(parsed)));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json()) as OverlayBody;
  const mode = body.mode;
  if (!mode || !ALLOWED_MODES.has(mode)) {
    return NextResponse.json({ error: "mode must be one of: none, welcome, countdown, intermission, thanks" }, { status: 400 });
  }

  const durationSeconds = normalizeDurationSeconds(body.duration_seconds);
  const nowIso = new Date().toISOString();
  const endsAtIso =
    (mode === "countdown" || mode === "intermission") && durationSeconds > 0
      ? new Date(Date.now() + durationSeconds * 1000).toISOString()
      : null;

  const payload = {
    mode,
    duration_seconds: durationSeconds,
    started_at: nowIso,
    ends_at: endsAtIso,
  };

  const db = getNeedleDropRouletteDb();
  const { error } = await db.from("ndr_session_events").insert({
    session_id: sessionId,
    event_type: "overlay_set",
    payload,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
