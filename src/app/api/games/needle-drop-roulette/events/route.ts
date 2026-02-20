import { NextResponse } from "next/server";
import { getNeedleDropRouletteDb } from "src/lib/needleDropRouletteDb";

export const runtime = "nodejs";

type EventRow = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
};

export async function GET() {
  const db = getNeedleDropRouletteDb();

  const { data, error } = await db
    .from("events")
    .select("id, title, date, time, location")
    .order("date", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: (data ?? []) as EventRow[] }, { status: 200 });
}
