import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';

type CandidatePayload = {
  eventId?: number;
  inventoryId?: number | null;
  artist?: string;
  title?: string;
  coverImage?: string | null;
};

export async function POST(request: NextRequest) {
  let payload: CandidatePayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload.' },
      { status: 400 }
    );
  }

  const eventId = Number(payload.eventId);
  const inventoryId =
    payload.inventoryId === null || payload.inventoryId === undefined
      ? null
      : Number(payload.inventoryId);
  const artist = payload.artist?.trim();
  const title = payload.title?.trim();
  const coverImage = payload.coverImage?.trim() || null;

  if (!eventId || Number.isNaN(eventId)) {
    return NextResponse.json(
      { error: 'eventId is required.' },
      { status: 400 }
    );
  }

  if (!artist || !title) {
    return NextResponse.json(
      { error: 'artist and title are required.' },
      { status: 400 }
    );
  }

  let existingQuery = supabaseAdmin
    .from('tournament_candidates')
    .select('id, vote_count')
    .eq('event_id', eventId);

  if (inventoryId) {
    existingQuery = existingQuery.eq('inventory_id', inventoryId);
  } else {
    existingQuery = existingQuery
      .is('inventory_id', null)
      .eq('artist', artist)
      .eq('title', title);
  }

  const { data: existing, error: existingError } =
    await existingQuery.maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message },
      { status: 500 }
    );
  }

  if (existing) {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('tournament_candidates')
      .update({ vote_count: (existing.vote_count ?? 0) + 1 })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updated }, { status: 200 });
  }

  const { data: created, error: insertError } = await supabaseAdmin
    .from('tournament_candidates')
    .insert({
      event_id: eventId,
      inventory_id: inventoryId,
      artist,
      title,
      cover_image: coverImage,
      vote_count: 1,
      is_write_in: inventoryId === null,
      status: 'pending',
    })
    .select('*')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ data: created }, { status: 201 });
}
