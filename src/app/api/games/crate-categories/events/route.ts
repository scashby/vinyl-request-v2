import { NextResponse } from "next/server";
import { getCrateCategoriesDb } from "src/lib/crateCategoriesDb";

export const runtime = "nodejs";

type EventRow = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
};

export async function GET() {
  const db = getCrateCategoriesDb();

  const { data, error } = await db
    .from("events")
    .select("id, title, date, time, location")
    .order("date", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: (data ?? []) as EventRow[] }, { status: 200 });
}
