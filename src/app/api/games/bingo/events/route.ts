import { NextResponse } from "next/server";
import { getBingoDb } from "src/lib/bingoDb";

export const runtime = "nodejs";

type EventRow = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  venue_logo_url: string | null;
};

export async function GET() {
  const db = getBingoDb();

  const { data, error } = await db
    .from("events")
    .select("id, title, date, time, location, venue_logo_url")
    .order("date", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: (data ?? []) as EventRow[] }, { status: 200 });
}
