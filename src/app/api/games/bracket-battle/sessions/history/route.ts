import { NextRequest, NextResponse } from "next/server";
import { getBracketBattleDb } from "src/lib/bracketBattleDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  session_code: string;
  title: string;
  status: string;
  current_round: number;
  current_matchup_index: number;
  created_at: string;
};

type EventRow = { id: number; title: string };

export async function GET(request: NextRequest) {
  const db = getBracketBattleDb();
  const eventId = request.nextUrl.searchParams.get("eventId");

  let query = db
    .from("bb_sessions")
    .select("id, event_id, session_code, title, status, current_round, current_matchup_index, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (eventId) query = query.eq("event_id", Number(eventId));

  const { data: sessions, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (sessions ?? []) as SessionRow[];
  const sessionIds = rows.map((row) => row.id);

  const [{ data: teams }, { data: matchups }, { data: picks }] = await Promise.all([
    sessionIds.length
      ? db.from("bb_session_teams").select("session_id").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: number }> }),
    sessionIds.length
      ? db.from("bb_session_matchups").select("session_id, id").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: number; id: number }> }),
    sessionIds.length
      ? db.from("bb_bracket_picks").select("session_id").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: number }> }),
  ]);

  const teamCountBySession = new Map<number, number>();
  for (const row of (teams ?? []) as Array<{ session_id: number }>) {
    teamCountBySession.set(row.session_id, (teamCountBySession.get(row.session_id) ?? 0) + 1);
  }

  const matchupCountBySession = new Map<number, number>();
  for (const row of (matchups ?? []) as Array<{ session_id: number }>) {
    matchupCountBySession.set(row.session_id, (matchupCountBySession.get(row.session_id) ?? 0) + 1);
  }

  const pickCountBySession = new Map<number, number>();
  for (const row of (picks ?? []) as Array<{ session_id: number }>) {
    pickCountBySession.set(row.session_id, (pickCountBySession.get(row.session_id) ?? 0) + 1);
  }

  const eventIds = Array.from(new Set(rows.map((row) => row.event_id).filter((value): value is number => Number.isFinite(value))));
  const { data: events } = eventIds.length
    ? await db.from("events").select("id, title").in("id", eventIds)
    : { data: [] as EventRow[] };

  const eventsById = new Map<number, string>(((events ?? []) as EventRow[]).map((row) => [row.id, row.title]));

  return NextResponse.json(
    {
      data: rows.map((row) => ({
        ...row,
        event_title: row.event_id ? eventsById.get(row.event_id) ?? null : null,
        teams: teamCountBySession.get(row.id) ?? 0,
        matchups_total: matchupCountBySession.get(row.id) ?? 0,
        picks_logged: pickCountBySession.get(row.id) ?? 0,
      })),
    },
    { status: 200 }
  );
}
