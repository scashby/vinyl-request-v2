import { supabaseAdmin as supabase } from 'src/lib/supabaseAdmin';
export const runtime = 'nodejs';


export async function GET() {
  const { data, error } = await supabase
    .from('playlists')
    .select('id, platform, embed_url')
    .order('sort_order', { ascending: true });

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
  const { id, platform, embed_url } = body;

  const { error } = await supabase
    .from("playlists")
    .update({ platform, embed_url })
    .eq("id", id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
