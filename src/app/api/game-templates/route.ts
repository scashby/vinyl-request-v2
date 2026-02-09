import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';
import type { Database, Json } from 'types/supabase';

type TemplatePayload = {
  name?: string;
  gameType?: string;
  templateState?: Json;
  itemIds?: number[];
  itemPositions?: Record<string, number>;
};

type TemplateInsert = Database['public']['Tables']['game_templates']['Insert'];
type TemplateItemInsert = Database['public']['Tables']['game_template_items']['Insert'];

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('game_templates')
    .select('id, name, game_type, template_state, created_at, game_template_items(count)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const mapped = (data ?? []).map((row) => ({
    ...row,
    items_count: Array.isArray(row.game_template_items)
      ? row.game_template_items[0]?.count ?? 0
      : 0,
  }));

  return NextResponse.json({ data: mapped });
}

export async function POST(request: NextRequest) {
  let payload: TemplatePayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload.' },
      { status: 400 }
    );
  }

  const name = payload.name?.trim();
  if (!name) {
    return NextResponse.json({ error: 'name is required.' }, { status: 400 });
  }

  const gameType = payload.gameType?.trim();
  if (!gameType) {
    return NextResponse.json({ error: 'gameType is required.' }, { status: 400 });
  }

  const templateState = payload.templateState ?? {};
  const itemIds = payload.itemIds ?? [];
  const itemPositions = payload.itemPositions ?? {};

  const insertPayload: TemplateInsert = {
    name,
    game_type: gameType,
    template_state: templateState,
  };

  const { data, error } = await supabaseAdmin
    .from('game_templates' as never)
    .insert(insertPayload as never)
    .select('id, name, game_type, template_state, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (itemIds.length > 0 && data) {
    const templateItems: TemplateItemInsert[] = itemIds.map((itemId, index) => ({
      template_id: data.id,
      library_item_id: itemId,
      position: itemPositions[String(itemId)] ?? index + 1,
      metadata: {},
    }));

    const { error: itemError } = await supabaseAdmin
      .from('game_template_items')
      .insert(templateItems);

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ data }, { status: 201 });
}
