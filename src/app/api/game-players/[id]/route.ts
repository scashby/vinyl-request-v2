import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(_request: NextRequest) {
  return NextResponse.json({ success: true }, { status: 200 });
}
