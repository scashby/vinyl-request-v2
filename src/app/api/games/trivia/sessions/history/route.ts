import { NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  session_code: string;
  title: string;
  status: string;
  current_call_index: number;
  created_at: string;
};

type TeamCountRow = { session_id: number };

export async function GET() {
  const db = getTriviaDb();

  const { data: sessions, error } = await db
    .from("trivia_sessions")
    .select("id, session_code, title, status, current_call_index, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (sessions ?? []) as SessionRow[];
  const sessionIds = rows.map((row) => row.id);

  const [{ data: teams }, { data: scores }] = await Promise.all([
    sessionIds.length
      ? db.from("trivia_session_teams").select("session_id").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as TeamCountRow[], error: null }),
    sessionIds.length
      ? db.from("trivia_team_scores").select("session_id, call_id").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: number; call_id: number }>, error: null }),
  ]);

  const teamCount = new Map<number, number>();
  for (const row of (teams ?? []) as TeamCountRow[]) {
    teamCount.set(row.session_id, (teamCount.get(row.session_id) ?? 0) + 1);
  }

  const scoredCallsBySession = new Map<number, Set<number>>();
  for (const row of (scores ?? []) as Array<{ session_id: number; call_id: number }>) {
    const set = scoredCallsBySession.get(row.session_id) ?? new Set<number>();
    set.add(row.call_id);
    scoredCallsBySession.set(row.session_id, set);
  }

  return NextResponse.json(
    {
      data: rows.map((row) => ({
        ...row,
        teams: teamCount.get(row.id) ?? 0,
        questions_asked: row.current_call_index,
        questions_scored: scoredCallsBySession.get(row.id)?.size ?? 0,
      })),
    },
    { status: 200 }
  );
}
