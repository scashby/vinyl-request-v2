import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';

type CreatePayload = {
  eventId?: number;
  crateId?: number | null;
  gameType?: string;
  triviaQuestions?: Array<{
    prompt?: string;
    answer?: string;
    artist?: string;
    title?: string;
    coverImage?: string;
  }>;
};

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('game_sessions')
    .select('id, event_id, crate_id, game_type, game_state, created_at, events ( id, title, date )')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  let payload: CreatePayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload.' },
      { status: 400 }
    );
  }

  const eventId = Number(payload.eventId);
  if (!eventId || Number.isNaN(eventId)) {
    return NextResponse.json(
      { error: 'eventId is required.' },
      { status: 400 }
    );
  }

  const gameType = payload.gameType?.trim();
  if (!gameType) {
    return NextResponse.json(
      { error: 'gameType is required.' },
      { status: 400 }
    );
  }

  const crateId =
    payload.crateId === null || payload.crateId === undefined
      ? null
      : Number(payload.crateId);

  const triviaQuestions = payload.triviaQuestions ?? [];

  const gameState =
    gameType === 'trivia'
      ? {
          trivia: {
            currentIndex: 0,
            reveal: false,
            questions: triviaQuestions,
          },
        }
      : {};

  const { data, error } = await supabaseAdmin
    .from('game_sessions')
    .insert({
      event_id: eventId,
      crate_id: crateId,
      game_type: gameType,
      game_state: gameState,
    })
    .select('id, event_id, crate_id, game_type, game_state, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
