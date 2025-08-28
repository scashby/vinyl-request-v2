// src/app/api/social-embeds/route.js
import { supabaseAdmin } from 'src/lib/supabaseAdmin';
export const runtime = 'nodejs';


export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('social_embeds')
    .select('id, platform, embed_html, visible')
    .order('platform', { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Cache-Control': 's-maxage=60' }
  });
}

export async function PUT(request) {
  const body = await request.json();
  const { id, platform, embed_html, visible } = body;
  const supabase = supabaseAdmin();

  const { error } = await supabase
    .from("social_embeds")
    .update({ platform, embed_html, visible })
    .eq("id", id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}