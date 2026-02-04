import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Apple Music lyrics import is disabled in V3 schema.' },
    { status: 501 }
  );
}
