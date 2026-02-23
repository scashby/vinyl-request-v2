import { NextResponse } from 'next/server';
import { getCachedInventoryIndex, searchInventoryCandidates } from '../../../../../lib/vinylPlaylistImport';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? url.searchParams.get('title') ?? '').trim();
    const artist = (url.searchParams.get('artist') ?? '').trim();
    const limitRaw = url.searchParams.get('limit');
    const limit = limitRaw ? Number(limitRaw) : 10;

    if (!q) {
      return NextResponse.json({ error: 'q is required' }, { status: 400 });
    }

    const index = await getCachedInventoryIndex();
    const results = await searchInventoryCandidates({ title: q, artist, limit }, index);
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
