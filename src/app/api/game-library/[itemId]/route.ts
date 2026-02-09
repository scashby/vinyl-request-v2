import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';

type UpdatePayload = {
  gameType?: string;
  itemType?: string;
  title?: string | null;
  artist?: string | null;
  prompt?: string | null;
  answer?: string | null;
  coverImage?: string | null;
  inventoryId?: number | null;
  metadata?: unknown;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  const itemId = Number(params.itemId);
  if (!itemId || Number.isNaN(itemId)) {
    return NextResponse.json({ error: 'Invalid item id.' }, { status: 400 });
  }

  let payload: UpdatePayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload.' },
      { status: 400 }
    );
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof payload.gameType === 'string') {
    updatePayload.game_type = payload.gameType.trim();
  }
  if (typeof payload.itemType === 'string') {
    updatePayload.item_type = payload.itemType.trim();
  }
  if (typeof payload.title === 'string' || payload.title === null) {
    updatePayload.title = payload.title?.trim() || null;
  }
  if (typeof payload.artist === 'string' || payload.artist === null) {
    updatePayload.artist = payload.artist?.trim() || null;
  }
  if (typeof payload.prompt === 'string' || payload.prompt === null) {
    updatePayload.prompt = payload.prompt?.trim() || null;
  }
  if (typeof payload.answer === 'string' || payload.answer === null) {
    updatePayload.answer = payload.answer?.trim() || null;
  }
  if (typeof payload.coverImage === 'string' || payload.coverImage === null) {
    updatePayload.cover_image = payload.coverImage?.trim() || null;
  }
  if (payload.inventoryId !== undefined) {
    updatePayload.inventory_id =
      payload.inventoryId === null ? null : Number(payload.inventoryId);
  }
  if (payload.metadata !== undefined) {
    updatePayload.metadata = payload.metadata ?? {};
  }

  const { data, error } = await supabaseAdmin
    .from('game_library_items' as never)
    .update(updatePayload as never)
    .eq('id', itemId)
    .select(
      'id, game_type, item_type, title, artist, prompt, answer, cover_image, inventory_id, metadata, created_at, updated_at'
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  const itemId = Number(params.itemId);
  if (!itemId || Number.isNaN(itemId)) {
    return NextResponse.json({ error: 'Invalid item id.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('game_library_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok' });
}
