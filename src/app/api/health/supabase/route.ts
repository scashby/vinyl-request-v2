// src/app/api/health/supabase/route.ts
import { NextResponse } from 'next/server';
import { getAuthHeader, supabaseServer } from 'src/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = supabaseServer(getAuthHeader(request));

  const { data, error, status } = await supabase
    .from('now_playing')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ status, error, data });
}
