// src/app/api/playlists/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeader, supabaseServer } from 'src/lib/supabaseServer';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const supabase = supabaseServer(getAuthHeader(request));
  const { data, error } = await supabase
    .from('playlists')
    .select('id, platform, embed_url')
    .order('sort_order', { ascending: true });

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
    const { id, platform, embed_url } = body;
    const supabase = supabaseServer(getAuthHeader(request));

    const { error } = await supabase
      .from("playlists")
      .update({ platform, embed_url })
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
