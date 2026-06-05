import { NextResponse } from "next/server";

export const runtime = "nodejs";

// This file should be deleted. The feature it supported was rolled back.
export function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

