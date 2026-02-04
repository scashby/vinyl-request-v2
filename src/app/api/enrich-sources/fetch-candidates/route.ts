import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Enrichment candidate fetch is disabled in V3 schema.' },
    { status: 501 }
  );
}
