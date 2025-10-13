import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { collection_id, album_1001_id, confidence, notes } = body || {};
  if (!collection_id || !album_1001_id) {
    return NextResponse.json({ error: 'collection_id and album_1001_id are required' }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { error: upsertErr } = await db
    .from('collection_1001_review')
    .upsert({
      collection_id,
      album_1001_id,
      status: 'approved',
      confidence: typeof confidence === 'number' ? confidence : null,
      notes: typeof notes === 'string' ? notes : null,
    }, { onConflict: 'collection_id' });
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  const { error: updErr } = await db
    .from('collection')
    .update({ is_1001: true })
    .eq('id', collection_id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
