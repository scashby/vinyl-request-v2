// src/app/api/1001-review/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';

type Body = {
  collection_id: number;
  album_1001_id: number;
  confidence?: number | null;
  notes?: string | null;
};

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null;

function parseBody(x: unknown): Body | null {
  if (!isRecord(x)) return null;
  const collection_id = Number(x.collection_id);
  const album_1001_id = Number(x.album_1001_id);
  const confidence = typeof x.confidence === 'number' ? x.confidence : null;
  const notes = typeof x.notes === 'string' ? x.notes : null;
  if (!Number.isFinite(collection_id) || !Number.isFinite(album_1001_id)) return null;
  return { collection_id, album_1001_id, confidence, notes };
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const body = parseBody(json);
  if (!body) {
    return NextResponse.json({ error: 'collection_id and album_1001_id are required' }, { status: 400 });
    }
  const { collection_id, album_1001_id, confidence, notes } = body;

  const db = supabaseAdmin();

  const { error: upsertErr } = await db
    .from('collection_1001_review')
    .upsert(
      {
        collection_id,
        album_1001_id,
        status: 'approved',
        confidence,
        notes,
      },
      { onConflict: 'collection_id' }
    );

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  const { error: updErr } = await db
    .from('collection')
    .update({ is_1001: true })
    .eq('id', collection_id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
