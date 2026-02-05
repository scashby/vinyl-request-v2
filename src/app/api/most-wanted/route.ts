// src/app/api/most-wanted/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeader, supabaseServer } from 'src/lib/supabaseServer';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const supabase = supabaseServer(getAuthHeader(request));
  const { data, error } = await supabase
    .from('most_wanted')
    .select('id, rank, title, url')
    .order('rank', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, {
    status: 200,
    headers: { 'Cache-Control': 's-maxage=60' }
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, inventory_id, title, url, rank } = body;
    const supabase = supabaseServer(getAuthHeader(request));

    const { error } = await supabase
      .from("most_wanted")
      .update({ title, url, rank, inventory_id })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
// AUDIT: inspected, no changes.
