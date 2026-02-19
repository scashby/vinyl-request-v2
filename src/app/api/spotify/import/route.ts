import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { buildInventoryIndex, fetchInventoryTracks, matchTracks, sanitizePlaylistName } from '../../../../lib/vinylPlaylistImport';
import { getSpotifyAccessTokenFromCookies, spotifyApiGet } from '../../../../lib/spotifyUser';

type SpotifyTrackItem = {
  track?: {
    name?: string;
    artists?: Array<{ name?: string }>;
  };
};

type SpotifyPlaylistTracksResponse = {
  items?: SpotifyTrackItem[];
  next?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const playlistId = String(body?.playlistId ?? '').trim();
    const playlistName = sanitizePlaylistName(String(body?.playlistName ?? ''));
    if (!playlistId) {
      return NextResponse.json({ error: 'playlistId is required' }, { status: 400 });
    }

    const tokenData = await getSpotifyAccessTokenFromCookies();
    if (!tokenData.accessToken) {
      return NextResponse.json({ error: 'Not connected to Spotify' }, { status: 401 });
    }

    const rows: Array<{ title?: string; artist?: string }> = [];
    let offset = 0;
    const limit = 100;
    while (true) {
      const data = await spotifyApiGet<SpotifyPlaylistTracksResponse>(
        tokenData.accessToken,
        `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(track(name,artists(name))),next`
      );
      const items = data.items ?? [];
      items.forEach((item) => {
        const title = item.track?.name;
        const artist = (item.track?.artists ?? []).map((a) => a.name).filter(Boolean).join(', ');
        if (title) rows.push({ title, artist });
      });
      if (!data.next || items.length === 0) break;
      offset += limit;
      if (offset > 5000) break;
    }

    const inventoryTracks = await fetchInventoryTracks();
    const index = buildInventoryIndex(inventoryTracks);
    const { matched, missing } = matchTracks(rows, index);

    const { data: maxSortRow } = await (supabaseAdmin as any)
      .from('collection_playlists')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();
    const nextSortOrder = Number(maxSortRow?.sort_order ?? -1) + 1;

    const { data: inserted, error: insertError } = await (supabaseAdmin as any)
      .from('collection_playlists')
      .insert({
        name: playlistName,
        icon: '🎵',
        color: '#1db954',
        sort_order: nextSortOrder,
        is_smart: false,
        smart_rules: null,
        match_rules: 'all',
        live_update: true,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      throw insertError || new Error('Failed to create local playlist');
    }

    const trackKeys = matched
      .filter((row) => row.inventory_id && row.position)
      .map((row) => `${row.inventory_id}:${row.position}`);
    const dedupedTrackKeys = Array.from(new Set(trackKeys));

    if (dedupedTrackKeys.length > 0) {
      const records = dedupedTrackKeys.map((trackKey, idx) => ({
        playlist_id: inserted.id,
        track_key: trackKey,
        sort_order: idx,
      }));
      const { error: itemsError } = await (supabaseAdmin as any)
        .from('collection_playlist_items')
        .insert(records);
      if (itemsError) throw itemsError;
    }

    const response = NextResponse.json({
      ok: true,
      playlistId: inserted.id,
      playlistName,
      sourceCount: rows.length,
      matchedCount: dedupedTrackKeys.length,
      unmatchedCount: missing.length,
      unmatchedSample: missing.slice(0, 25),
    });

    if (tokenData.refreshed) {
      response.cookies.set('spotify_access_token', tokenData.refreshed.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: tokenData.refreshed.expires_in,
      });
      if (tokenData.refreshToken) {
        response.cookies.set('spotify_refresh_token', tokenData.refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 90,
        });
      }
      response.cookies.set('spotify_expires_at', String(Date.now() + tokenData.refreshed.expires_in * 1000), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 90,
      });
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Spotify import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
