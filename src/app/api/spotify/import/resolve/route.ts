import { NextResponse } from 'next/server';
import { getAuthHeader, supabaseServer } from 'src/lib/supabaseServer';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const playlistId = Number(body?.playlistId ?? 0);
    const trackKey = String(body?.trackKey ?? '').trim();
    const sourceTitle = String(body?.sourceTitle ?? '').trim();
    const sourceArtist = String(body?.sourceArtist ?? '').trim();

    if (!Number.isFinite(playlistId) || playlistId <= 0) {
      return NextResponse.json({ error: 'playlistId is required' }, { status: 400 });
    }
    if (!trackKey) {
      return NextResponse.json({ error: 'trackKey is required' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseServer(getAuthHeader(req)) as any;

    const { data: existing } = await db
      .from('collection_playlist_items')
      .select('id')
      .eq('playlist_id', playlistId)
      .eq('track_key', trackKey)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json({ ok: true, alreadyPresent: true });
    }

    const { data: maxSortRow } = await db
      .from('collection_playlist_items')
      .select('sort_order')
      .eq('playlist_id', playlistId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSortOrder =
      maxSortRow && typeof maxSortRow.sort_order === 'number' ? maxSortRow.sort_order + 1 : 0;

    const { error: insertError } = await db
      .from('collection_playlist_items')
      .insert({
        playlist_id: playlistId,
        track_key: trackKey,
        sort_order: nextSortOrder,
      });

    if (insertError) throw insertError;

    return NextResponse.json({
      ok: true,
      playlistId,
      trackKey,
      sourceTitle: sourceTitle || null,
      sourceArtist: sourceArtist || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resolve import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
