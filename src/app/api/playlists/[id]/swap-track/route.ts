import { NextRequest, NextResponse } from "next/server";
import { propagatePlaylistTrackSwap } from "src/lib/playlistTrackSwapPropagation";

export const runtime = "nodejs";

type SwapTrackBody = {
  fromTrackKey?: string;
  toTrackKey?: string;
  dryRun?: boolean;
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const playlistId = Number(id);
  if (!Number.isFinite(playlistId) || playlistId <= 0) {
    return NextResponse.json({ error: "Invalid playlist id" }, { status: 400 });
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
    const result = await propagatePlaylistTrackSwap({
      playlistId,
      fromTrackKey,
      toTrackKey,
      dryRun: body.dryRun === true,
    });

    if (result.failures.length > 0) {
      return NextResponse.json(
        {
          ...result,
          warning: "Swap completed with some session propagation failures",
        },
        { status: 207 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Track swap failed" },
      { status: 500 }
    );
  }
}
