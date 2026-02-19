import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  return NextResponse.json({ data: [] }, { status: 200 });
}
