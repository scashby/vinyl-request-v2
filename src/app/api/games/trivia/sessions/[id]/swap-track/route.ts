import { NextRequest, NextResponse } from "next/server";
import { swapMusicGameSessionTrack } from "src/lib/musicGameTrackSwap";

export const runtime = "nodejs";

type SwapTrackBody = {
  fromTrackKey?: string;
  toTrackKey?: string;
  dryRun?: boolean;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId) || sessionId <= 0) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  let body: SwapTrackBody;
  try {
    body = (await request.json()) as SwapTrackBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fromTrackKey = String(body.fromTrackKey ?? "").trim();
  const toTrackKey = String(body.toTrackKey ?? "").trim();
  if (!fromTrackKey || !toTrackKey) {
    return NextResponse.json({ error: "fromTrackKey and toTrackKey are required" }, { status: 400 });
  }

  try {
    const result = await swapMusicGameSessionTrack({
      game: "trivia",
      sessionId,
      fromTrackKey,
      toTrackKey,
      dryRun: body.dryRun === true,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Track swap failed" },
      { status: 500 }
    );
  }
}
