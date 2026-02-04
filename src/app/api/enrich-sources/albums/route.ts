import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Enrichment album list is disabled in V3 schema.' },
    { status: 501 }
  );
}
