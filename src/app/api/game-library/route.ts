import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';
import type { Database } from 'types/supabase';

type LibraryPayload = {
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

type GameLibraryInsert = Database['public']['Tables']['game_library_items']['Insert'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gameType = searchParams.get('gameType');
  const itemType = searchParams.get('itemType');
  const query = searchParams.get('q');

  let builder = supabaseAdmin
    .from('game_library_items')
    .select(
      'id, game_type, item_type, title, artist, prompt, answer, cover_image, inventory_id, metadata, created_at, updated_at'
    )
    .order('created_at', { ascending: false });

  if (gameType) {
    builder = builder.eq('game_type', gameType);
  }

  if (itemType) {
    builder = builder.eq('item_type', itemType);
  }

  if (query) {
    builder = builder.or(
      `title.ilike.%${query}%,artist.ilike.%${query}%,prompt.ilike.%${query}%,answer.ilike.%${query}%`
    );
  }

  const { data, error } = await builder;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  let payload: LibraryPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload.' },
      { status: 400 }
    );
  }

  const gameType = payload.gameType?.trim();
  const itemType = payload.itemType?.trim();

  if (!gameType) {
    return NextResponse.json({ error: 'gameType is required.' }, { status: 400 });
  }

  if (!itemType) {
    return NextResponse.json({ error: 'itemType is required.' }, { status: 400 });
  }

  const insertPayload: GameLibraryInsert = {
    game_type: gameType,
    item_type: itemType,
    title: payload.title?.trim() || null,
    artist: payload.artist?.trim() || null,
    prompt: payload.prompt?.trim() || null,
    answer: payload.answer?.trim() || null,
    cover_image: payload.coverImage?.trim() || null,
    inventory_id:
      payload.inventoryId === null || payload.inventoryId === undefined
        ? null
        : Number(payload.inventoryId),
    metadata: payload.metadata ?? {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('game_library_items')
    .insert(insertPayload)
    .select(
      'id, game_type, item_type, title, artist, prompt, answer, cover_image, inventory_id, metadata, created_at, updated_at'
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
