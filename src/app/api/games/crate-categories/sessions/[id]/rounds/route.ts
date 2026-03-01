import { NextRequest, NextResponse } from "next/server";
import { getCrateCategoriesDb } from "src/lib/crateCategoriesDb";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getCrateCategoriesDb();
  const { data, error } = await db
    .from("ccat_session_rounds")
    .select(
      "id, session_id, round_number, category_label, prompt_type, tracks_in_round, points_correct, points_bonus, status, opened_at, closed_at, created_at"
    )
    .eq("session_id", sessionId)
    .order("round_number", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}
