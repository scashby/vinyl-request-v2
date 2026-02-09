import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';

type BracketEntry = {
  id: number | null;
  artist: string | null;
  title: string | null;
  coverImage: string | null;
};

type BracketMatch = {
  id: string;
  round: number;
  order: number;
  red: BracketEntry;
  blue: BracketEntry;
  winner: 'red' | 'blue' | null;
};

type GameState = {
  activeMatchId?: string | null;
  matches?: BracketMatch[];
  trivia?: {
    currentIndex?: number;
    reveal?: boolean;
    questions?: Array<{
      prompt?: string;
      answer?: string;
      artist?: string;
      title?: string;
      coverImage?: string;
    }>;
  };
};

type PatchPayload =
  | { action: 'setActiveMatch'; matchId: string }
  | { action: 'recordWinner'; matchId: string; winner: 'red' | 'blue' }
  | { action: 'initializeBracket' }
  | { action: 'setTriviaIndex'; index: number }
  | { action: 'setTriviaReveal'; reveal: boolean };

const createEmptyEntry = (): BracketEntry => ({
  id: null,
  artist: null,
  title: null,
  coverImage: null,
});

const buildBracketMatches = (
  seeds: Array<{
    id: number | null;
    artist: string;
    title: string;
    cover_image: string | null;
  }>
): BracketMatch[] => {
  const totalRounds = 4;
  const matches: BracketMatch[] = [];

  const seeded = [...seeds];
  const pairingOrder = [0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10];

  const orderedSeeds = pairingOrder
    .map((index) => seeded[index])
    .filter(Boolean);

  for (let i = 0; i < 8; i += 1) {
    const redSeed = orderedSeeds[i * 2];
    const blueSeed = orderedSeeds[i * 2 + 1];

    matches.push({
      id: `r1m${i + 1}`,
      round: 1,
      order: i + 1,
      red: redSeed
        ? {
            id: redSeed.id,
            artist: redSeed.artist,
            title: redSeed.title,
            coverImage: redSeed.cover_image,
          }
        : createEmptyEntry(),
      blue: blueSeed
        ? {
            id: blueSeed.id,
            artist: blueSeed.artist,
            title: blueSeed.title,
            coverImage: blueSeed.cover_image,
          }
        : createEmptyEntry(),
      winner: null,
    });
  }

  for (let round = 2; round <= totalRounds; round += 1) {
    const matchCount = 2 ** (totalRounds - round);
    for (let order = 1; order <= matchCount; order += 1) {
      matches.push({
        id: `r${round}m${order}`,
        round,
        order,
        red: createEmptyEntry(),
        blue: createEmptyEntry(),
        winner: null,
      });
    }
  }

  return matches;
};

const getNextMatchInfo = (match: BracketMatch) => {
  const nextRound = match.round + 1;
  if (nextRound > 4) return null;
  const nextOrder = Math.ceil(match.order / 2);
  const slot = match.order % 2 === 1 ? 'red' : 'blue';
  return { nextRound, nextOrder, slot };
};

const updateWinner = (gameState: GameState, matchId: string, winner: 'red' | 'blue') => {
  const matches = gameState.matches ?? [];
  const currentMatch = matches.find((match) => match.id === matchId);
  if (!currentMatch) return matches;

  currentMatch.winner = winner;
  const winnerEntry = currentMatch[winner];

  const nextInfo = getNextMatchInfo(currentMatch);
  if (!nextInfo) return matches;

  const nextMatch = matches.find(
    (match) => match.round === nextInfo.nextRound && match.order === nextInfo.nextOrder
  );

  if (nextMatch) {
    nextMatch[nextInfo.slot] = { ...winnerEntry };
  }

  return matches;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = Number(params.sessionId);
  if (!sessionId || Number.isNaN(sessionId)) {
    return NextResponse.json({ error: 'Invalid session id.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('game_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = Number(params.sessionId);
  if (!sessionId || Number.isNaN(sessionId)) {
    return NextResponse.json({ error: 'Invalid session id.' }, { status: 400 });
  }

  let payload: PatchPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('game_sessions')
    .select('id, event_id, game_state')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: sessionError?.message ?? 'Session not found.' },
      { status: 404 }
    );
  }

  const currentState: GameState = (session.game_state as GameState) ?? {};

  if (payload.action === 'initializeBracket') {
    if (!session.event_id) {
      return NextResponse.json(
        { error: 'Session is missing event_id.' },
        { status: 400 }
      );
    }

    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from('tournament_candidates')
      .select('id, artist, title, cover_image')
      .eq('event_id', session.event_id)
      .order('vote_count', { ascending: false })
      .limit(16);

    if (candidatesError) {
      return NextResponse.json(
        { error: candidatesError.message },
        { status: 500 }
      );
    }

    const matches = buildBracketMatches(candidates ?? []);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('game_sessions')
      .update({
        game_state: {
          ...currentState,
          matches,
          activeMatchId: matches[0]?.id ?? null,
        },
      })
      .eq('id', sessionId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: updated });
  }

  if (payload.action === 'setActiveMatch') {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('game_sessions')
      .update({
        game_state: {
          ...currentState,
          activeMatchId: payload.matchId,
        },
      })
      .eq('id', sessionId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: updated });
  }

  if (payload.action === 'recordWinner') {
    const matches = updateWinner(currentState, payload.matchId, payload.winner);
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('game_sessions')
      .update({
        game_state: {
          ...currentState,
          matches,
        },
      })
      .eq('id', sessionId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: updated });
  }

  if (payload.action === 'setTriviaIndex') {
    const trivia = currentState.trivia ?? {
      currentIndex: 0,
      reveal: false,
      questions: [],
    };
    const nextIndex = Number.isNaN(payload.index) ? 0 : payload.index;
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('game_sessions')
      .update({
        game_state: {
          ...currentState,
          trivia: {
            ...trivia,
            currentIndex: nextIndex,
          },
        },
      })
      .eq('id', sessionId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: updated });
  }

  if (payload.action === 'setTriviaReveal') {
    const trivia = currentState.trivia ?? {
      currentIndex: 0,
      reveal: false,
      questions: [],
    };
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('game_sessions')
      .update({
        game_state: {
          ...currentState,
          trivia: {
            ...trivia,
            reveal: payload.reveal,
          },
        },
      })
      .eq('id', sessionId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: updated });
  }

  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
}
