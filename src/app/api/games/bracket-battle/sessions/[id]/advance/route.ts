import { NextRequest, NextResponse } from "next/server";
import { getBracketBattleDb } from "src/lib/bracketBattleDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  current_round: number;
  current_matchup_index: number;
  started_at: string | null;
};

type MatchupRow = {
  id: number;
  matchup_index: number;
  status: "pending" | "active" | "voting_locked" | "scored" | "skipped";
};

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  const db = getBracketBattleDb();
  const { data: session, error: sessionError } = await db
    .from("bb_sessions")
    .select("id, current_round, current_matchup_index, started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const typedSession = session as SessionRow;
  const { data: roundMatchups, error: matchupError } = await db
    .from("bb_session_matchups")
    .select("id, matchup_index, status")
    .eq("session_id", sessionId)
    .eq("round_number", typedSession.current_round)
    .order("matchup_index", { ascending: true });

  if (matchupError) return NextResponse.json({ error: matchupError.message }, { status: 500 });

  const typedMatchups = (roundMatchups ?? []) as MatchupRow[];
  const currentIndex = Math.max(0, typedSession.current_matchup_index);
  const nextMatchup = currentIndex <= 0
    ? typedMatchups[0] ?? null
    : typedMatchups.find((matchup) => matchup.matchup_index > currentIndex) ?? null;

  const now = new Date().toISOString();

  if (!nextMatchup) {
    const { error: completeError } = await db
      .from("bb_sessions")
      .update({
        status: "completed",
        ended_at: now,
      })
      .eq("id", sessionId);

    if (completeError) return NextResponse.json({ error: completeError.message }, { status: 500 });

    await db
      .from("bb_session_rounds")
      .update({ status: "closed", closed_at: now })
      .eq("session_id", sessionId)
      .eq("round_number", typedSession.current_round);

    return NextResponse.json({ ok: true, completed: true }, { status: 200 });
  }

  const { error: matchupUpdateError } = await db
    .from("bb_session_matchups")
    .update({
      status: nextMatchup.status === "pending" ? "active" : nextMatchup.status,
      opened_at: now,
    })
    .eq("id", nextMatchup.id)
    .eq("session_id", sessionId);

  if (matchupUpdateError) return NextResponse.json({ error: matchupUpdateError.message }, { status: 500 });

  const { error: sessionUpdateError } = await db
    .from("bb_sessions")
    .update({
      current_matchup_index: nextMatchup.matchup_index,
      status: "running",
      started_at: typedSession.started_at ?? now,
      ended_at: null,
    })
    .eq("id", sessionId);

  if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

  await db
    .from("bb_session_rounds")
    .update({ status: "active", opened_at: now })
    .eq("session_id", sessionId)
    .eq("round_number", typedSession.current_round);

  return NextResponse.json(
    { ok: true, completed: false, current_round: typedSession.current_round, current_matchup_index: nextMatchup.matchup_index },
    { status: 200 }
  );
}