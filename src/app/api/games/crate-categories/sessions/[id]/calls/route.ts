import { NextRequest, NextResponse } from "next/server";
import { getCrateCategoriesDb } from "src/lib/crateCategoriesDb";

export const runtime = "nodejs";

type CallRow = {
  id: number;
  session_id: number;
  round_number: number;
  call_index: number;
  track_in_round: number;
  source_label: string | null;
  artist: string;
  title: string;
  release_year: number | null;
  crate_tag: string | null;
  host_notes: string | null;
  status: "pending" | "playing" | "revealed" | "scored" | "skipped";
  asked_at: string | null;
  revealed_at: string | null;
  scored_at: string | null;
  created_at: string;
};

type RoundRow = {
  round_number: number;
  category_label: string;
  prompt_type: "identify-thread" | "odd-one-out" | "belongs-or-bust" | "decade-lock" | "mood-match";
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const db = getCrateCategoriesDb();
  const [{ data: calls, error: callsError }, { data: rounds, error: roundsError }] = await Promise.all([
    db
      .from("ccat_session_calls")
      .select(
        "id, session_id, round_number, call_index, track_in_round, source_label, artist, title, release_year, crate_tag, host_notes, status, asked_at, revealed_at, scored_at, created_at"
      )
      .eq("session_id", sessionId)
      .order("call_index", { ascending: true }),
    db.from("ccat_session_rounds").select("round_number, category_label, prompt_type").eq("session_id", sessionId),
  ]);

  if (callsError) return NextResponse.json({ error: callsError.message }, { status: 500 });
  if (roundsError) return NextResponse.json({ error: roundsError.message }, { status: 500 });

  const roundByNumber = new Map<number, RoundRow>();
  for (const row of (rounds ?? []) as RoundRow[]) {
    roundByNumber.set(row.round_number, row);
  }

  return NextResponse.json(
    {
      data: ((calls ?? []) as CallRow[]).map((call) => {
        const round = roundByNumber.get(call.round_number);
        return {
          ...call,
          category: round?.category_label ?? null,
          prompt_type: round?.prompt_type ?? null,
          detail: round ? `Category: ${round.category_label} | Prompt: ${round.prompt_type} | Slot: ${call.track_in_round}` : null,
        };
      }),
    },
    { status: 200 }
  );
}
