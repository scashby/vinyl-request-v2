import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET() {
  const { data, error } = await supabase
    .from('playlists')
    .select('platform, embed_url')
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
  const { platform, embed_url } = body;

  const { error } = await supabase
    .from("playlists")
    .update({ platform, embed_url })
    .eq("platform", platform);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
