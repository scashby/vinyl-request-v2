import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';

type CreatePayload = {
  eventId?: number;
  crateId?: number | null;
  gameType?: string;
  templateId?: number | null;
  templateState?: unknown;
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

  const templateId =
    payload.templateId === null || payload.templateId === undefined
      ? null
      : Number(payload.templateId);

  let templateState: Record<string, unknown> = {};
  if (templateId) {
    const { data: template, error: templateError } = await supabaseAdmin
      .from('game_templates')
      .select('id, game_type, template_state')
      .eq('id', templateId)
      .single();

    if (templateError) {
      return NextResponse.json({ error: templateError.message }, { status: 500 });
    }

    if (template?.game_type && template.game_type !== gameType) {
      return NextResponse.json(
        { error: 'Template game type does not match the selected game type.' },
        { status: 400 }
      );
    }

    if (template?.template_state && typeof template.template_state === 'object') {
      templateState = template.template_state as Record<string, unknown>;
    }
  } else if (payload.templateState && typeof payload.templateState === 'object') {
    templateState = payload.templateState as Record<string, unknown>;
  }

  const triviaQuestions = payload.triviaQuestions ?? [];

  const gameState =
    gameType === 'trivia'
      ? {
          ...templateState,
          trivia: {
            currentIndex:
              typeof (templateState as { trivia?: { currentIndex?: number } })
                ?.trivia?.currentIndex === 'number'
                ? (templateState as { trivia?: { currentIndex?: number } })
                    ?.trivia?.currentIndex
                : 0,
            reveal:
              typeof (templateState as { trivia?: { reveal?: boolean } })
                ?.trivia?.reveal === 'boolean'
                ? (templateState as { trivia?: { reveal?: boolean } })
                    ?.trivia?.reveal
                : false,
            questions:
              triviaQuestions.length > 0
                ? triviaQuestions
                : (templateState as { trivia?: { questions?: unknown[] } })
                    ?.trivia?.questions ?? [],
          },
        }
      : {
          ...templateState,
        };

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
