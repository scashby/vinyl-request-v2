import { NextResponse } from "next/server";
import { getTriviaDb } from "src/lib/triviaDb";

export const runtime = "nodejs";

type CrateRow = {
  id: number;
  name: string;
  is_smart: boolean;
  live_update: boolean;
  sort_order: number;
};

export async function GET() {
  const dbAny = getTriviaDb() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        order: (column: string, options?: { ascending?: boolean }) => Promise<{ data: CrateRow[] | null; error: { message: string } | null }>;
      };
    };
  };

  const { data, error } = await dbAny
    .from("crates")
    .select("id, name, is_smart, live_update, sort_order")
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}