import { NextRequest, NextResponse } from "next/server";
import { getNameThatTuneDb } from "src/lib/nameThatTuneDb";

export const runtime = "nodejs";

type SessionRow = {
  id: number;
  event_id: number | null;
  session_code: string;
  title: string;
  status: string;
  current_call_index: number;
  created_at: string;
};

type EventRow = { id: number; title: string };

export async function GET(request: NextRequest) {
  const db = getNameThatTuneDb();
  const eventId = request.nextUrl.searchParams.get("eventId");

  let query = db
    .from("ntt_sessions")
    .select("id, event_id, session_code, title, status, current_call_index, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (eventId) query = query.eq("event_id", Number(eventId));

  const { data: sessions, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (sessions ?? []) as SessionRow[];
  const sessionIds = rows.map((row) => row.id);

  const [{ data: teams }, { data: scores }] = await Promise.all([
    sessionIds.length
      ? db.from("ntt_session_teams").select("session_id").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: number }> }),
    sessionIds.length
      ? db.from("ntt_team_scores").select("session_id, call_id").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: number; call_id: number }> }),
  ]);

  const teamCountBySession = new Map<number, number>();
  for (const row of (teams ?? []) as Array<{ session_id: number }>) {
    teamCountBySession.set(row.session_id, (teamCountBySession.get(row.session_id) ?? 0) + 1);
  }

  const scoredCallsBySession = new Map<number, Set<number>>();
  for (const row of (scores ?? []) as Array<{ session_id: number; call_id: number }>) {
    const set = scoredCallsBySession.get(row.session_id) ?? new Set<number>();
    set.add(row.call_id);
    scoredCallsBySession.set(row.session_id, set);
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
        calls_asked: row.current_call_index,
        calls_scored: scoredCallsBySession.get(row.id)?.size ?? 0,
      })),
    },
    { status: 200 }
  );
}
