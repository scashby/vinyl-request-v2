import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Enrichment stats are disabled in V3 schema.' },
    { status: 501 }
  );
}
