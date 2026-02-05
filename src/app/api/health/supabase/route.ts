// src/app/api/health/supabase/route.ts
import { NextResponse } from 'next/server';
import { getAuthHeader, supabaseServer } from 'src/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = supabaseServer(getAuthHeader(request));

  const { data, error, status } = await supabase
    .from('inventory')
    .select('id')
    .limit(1);

  return NextResponse.json({ status, error, data });
}
// AUDIT: inspected, no changes.
