import { NextRequest, NextResponse } from "next/server";
import { getBracketBattleDb } from "src/lib/bracketBattleDb";

export const runtime = "nodejs";

type ScoreBody = {
  scores?: Array<{
    team_id: number;
    total_points?: number;
    tie_break_points?: number;
  }>;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const body = (await request.json()) as ScoreBody;
  const scores = Array.isArray(body.scores) ? body.scores : [];
  if (scores.length === 0) return NextResponse.json({ error: "scores are required" }, { status: 400 });

  const rows = scores.map((score) => ({
    session_id: sessionId,
    team_id: Number(score.team_id),
    total_points: Math.max(0, Number(score.total_points ?? 0)),
    tie_break_points: Math.max(0, Number(score.tie_break_points ?? 0)),
    updated_at: new Date().toISOString(),
  }));

  if (rows.some((row) => !Number.isFinite(row.team_id))) {
    return NextResponse.json({ error: "Invalid team_id in scores" }, { status: 400 });
  }

  const db = getBracketBattleDb();
  const { error } = await db
    .from("bb_team_scores")
    .upsert(rows, { onConflict: "session_id,team_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}