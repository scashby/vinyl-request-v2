import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '100'), 500);
  const offset = Math.max(Number(searchParams.get('offset') ?? '0'), 0);

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('v_1001_candidates')
    .select('*')
    .order('artist_similarity', { ascending: false, nullsFirst: false })
    .order('year_diff', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [], limit, offset });
}
