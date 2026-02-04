import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "MusicBrainz enrichment is disabled for V3 schema alignment." },
    { status: 501 }
  );
}
