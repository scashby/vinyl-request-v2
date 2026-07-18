import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "standalone-web",
    version: "v1",
  });
}
