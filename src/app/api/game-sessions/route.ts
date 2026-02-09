import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';
import type { Database, Json } from 'types/supabase';

type TriviaQuestion = {
  prompt?: string;
  answer?: string;
  artist?: string;
  title?: string;
  coverImage?: string;
};

type CreatePayload = {
  eventId?: number;
  crateId?: number | null;
  gameType?: string;
  templateId?: number | null;
  templateState?: Json;
  triviaQuestions?: TriviaQuestion[];
};

type GameSessionInsert = Database['public']['Tables']['game_sessions']['Insert'];

const normalizeTemplateState = (raw: Json | undefined): Record<string, Json> => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, Json>;
  }
  return {};
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

  let templateState: Record<string, Json> = {};
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

    templateState = normalizeTemplateState(template?.template_state as Json | undefined);
  } else if (payload.templateState) {
    templateState = normalizeTemplateState(payload.templateState);
  }

  const triviaQuestions = payload.triviaQuestions ?? [];
  const normalizedQuestions = triviaQuestions.map((question) => ({
    prompt: question.prompt ?? null,
    answer: question.answer ?? null,
    artist: question.artist ?? null,
    title: question.title ?? null,
    coverImage: question.coverImage ?? null,
  })) as Json[];

  const gameState: Json =
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
              normalizedQuestions.length > 0
                ? normalizedQuestions
                : (templateState as { trivia?: { questions?: Json[] } })
                    ?.trivia?.questions ?? [],
          },
        }
      : {
          ...templateState,
        };

  const insertPayload: GameSessionInsert = {
      event_id: eventId,
      crate_id: crateId,
      game_type: gameType,
      game_state: gameState,
    };

  const { data, error } = await supabaseAdmin
    .from('game_sessions')
    .insert(insertPayload)
    .select('id, event_id, crate_id, game_type, game_state, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
