import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';

type TemplatePayload = {
  name?: string;
  gameType?: string;
  templateState?: unknown;
};

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('game_templates')
    .select('id, name, game_type, template_state, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
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

  const insertPayload = {
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

  return NextResponse.json({ data }, { status: 201 });
}
