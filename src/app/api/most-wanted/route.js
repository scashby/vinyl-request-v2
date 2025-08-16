import { supabaseAdmin as supabase } from 'src/lib/supabaseAdmin';
export const runtime = 'nodejs';


export async function GET() {
  const { data, error } = await supabase
    .from('most_wanted')
    .select('id, title, url, rank')
    .order('rank', { ascending: true });

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
  const { id, title, url, rank } = body;

  const { error } = await supabase
    .from("most_wanted")
    .update({ title, url, rank })
    .eq("id", id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
