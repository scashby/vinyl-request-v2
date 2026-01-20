// src/app/api/most-wanted/route.ts
import { supabaseAdmin } from 'src/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('most_wanted')
    .select('id, title, url, rank')
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
    const { id, title, url, rank } = body;
    const supabase = supabaseAdmin();

    const { error } = await supabase
      .from("most_wanted")
      .update({ title, url, rank })
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