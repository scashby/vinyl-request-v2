import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Standalone Bingo sessions endpoint scaffolded.",
    nextStep: "Implement tenant-scoped session list/create in Phase 4.",
  });
}
