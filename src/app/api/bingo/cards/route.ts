import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';

type BingoRequest = {
  crateId?: number;
  templateId?: number;
  sessionId?: number;
};

type BingoItem = {
  id: number;
  title: string;
  artist: string;
};

export async function POST(request: NextRequest) {
  let payload: BingoRequest;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload.' },
      { status: 400 }
    );
  }

  const templateId = payload.templateId ? Number(payload.templateId) : null;
  const sessionId = payload.sessionId ? Number(payload.sessionId) : null;
  const crateId = payload.crateId ? Number(payload.crateId) : null;

  if ((!templateId || Number.isNaN(templateId)) && (!sessionId || Number.isNaN(sessionId)) && (!crateId || Number.isNaN(crateId))) {
    return NextResponse.json(
      { error: 'templateId, sessionId, or crateId is required.' },
      { status: 400 }
    );
  }

  if (templateId && !Number.isNaN(templateId)) {
    const { data, error } = await supabaseAdmin
      .from('game_template_items')
      .select('position, game_library_items ( id, title, artist, prompt )')
      .eq('template_id', templateId)
      .order('position', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items: BingoItem[] =
      data
        ?.map((row) => {
          const item = Array.isArray(row.game_library_items)
            ? row.game_library_items[0]
            : row.game_library_items;
          if (!item) return null;
          const title = item.title?.trim() || item.prompt?.trim();
          const artistName = item.artist?.trim() || '';
          if (!title) return null;
          return { id: item.id, title, artist: artistName };
        })
        .filter((item): item is BingoItem => Boolean(item)) ?? [];

    return NextResponse.json({ items });
  }

  if (sessionId && !Number.isNaN(sessionId)) {
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('game_sessions')
      .select('game_state')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    const templateItems = (session?.game_state as { templateItems?: Array<{ title?: string | null; artist?: string | null }> })?.templateItems ?? [];
    const items: BingoItem[] = templateItems
      .map((item, index) => {
        const title = item.title?.trim();
        if (!title) return null;
        return {
          id: index + 1,
          title,
          artist: item.artist?.trim() || '',
        };
      })
      .filter((item): item is BingoItem => Boolean(item));

    return NextResponse.json({ items });
  }

  const { data, error } = await supabaseAdmin
    .from('crate_items')
    .select(
      'id, inventory:inventory ( id, release:releases ( id, master:masters ( id, title, artist:artists ( id, name ) ) ) )'
    )
    .eq('crate_id', crateId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items: BingoItem[] =
    data
      ?.map((row) => {
        const inventory = Array.isArray(row.inventory)
          ? row.inventory[0]
          : row.inventory;
        const release = Array.isArray(inventory?.release)
          ? inventory?.release[0]
          : inventory?.release;
        const master = Array.isArray(release?.master)
          ? release?.master[0]
          : release?.master;
        const artist = Array.isArray(master?.artist)
          ? master?.artist[0]
          : master?.artist;
        const title = master?.title?.trim();
        const artistName = artist?.name?.trim();

        if (!title || !artistName) {
          return null;
        }

        return {
          id: row.id,
          title,
          artist: artistName,
        };
      })
      .filter((item): item is BingoItem => Boolean(item)) ?? [];

  return NextResponse.json({ items });
}
