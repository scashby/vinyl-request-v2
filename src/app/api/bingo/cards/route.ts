import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';

type BingoRequest = {
  crateId?: number;
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
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON payload.' },
      { status: 400 }
    );
  }

  const crateId = Number(payload.crateId);
  if (!crateId || Number.isNaN(crateId)) {
    return NextResponse.json(
      { error: 'crateId is required.' },
      { status: 400 }
    );
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
