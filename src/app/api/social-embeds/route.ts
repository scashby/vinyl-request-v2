// src/app/api/social-embeds/route.ts
import { supabaseAdmin } from 'src/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('social_embeds')
    .select('id, platform, embed_html, visible')
    .order('platform', { ascending: true });

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
    const { id, platform, embed_html, visible } = body;
    const supabase = supabaseAdmin();

    const { error } = await supabase
      .from("social_embeds")
      .update({ platform, embed_html, visible })
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