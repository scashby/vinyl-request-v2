import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { buildInventoryIndex, fetchInventoryTracks, matchTracks, sanitizePlaylistName } from '../../../../lib/vinylPlaylistImport';
import { getSpotifyAccessTokenFromCookies, spotifyApiGet, spotifyApiGetByUrl } from '../../../../lib/spotifyUser';

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

type SpotifyPlaylistMeta = {
  name?: string;
  tracks?: {
    items?: SpotifyTrackItem[];
    total?: number;
    next?: string | null;
  };
};

export async function POST(req: Request) {
  let step = 'init';
  let spotifyScope = '';
  try {
    step = 'parse-body';
    const body = await req.json();
    const playlistId = String(body?.playlistId ?? '').trim();
    const playlistName = sanitizePlaylistName(String(body?.playlistName ?? ''));
    if (!playlistId) {
      return NextResponse.json({ error: 'playlistId is required' }, { status: 400 });
    }

    step = 'spotify-token';
    const tokenData = await getSpotifyAccessTokenFromCookies();
    if (!tokenData.accessToken) {
      return NextResponse.json({ error: 'Not connected to Spotify' }, { status: 401 });
    }
    spotifyScope = tokenData.scope ?? '';

    step = 'spotify-tracks';
    const rows: Array<{ title?: string; artist?: string }> = [];
    let sourceTotal: number | null = null;
    let partialImport = false;
    let importSource: 'playlist_items' | 'playlist_fallback' = 'playlist_items';

    const appendRows = (items: SpotifyTrackItem[] = []) => {
      for (const item of items) {
        const title = item.track?.name;
        const artist = (item.track?.artists ?? []).map((a) => a.name).filter(Boolean).join(', ');
        if (title) rows.push({ title, artist });
      }
    };

    const playlist = await spotifyApiGet<SpotifyPlaylistMeta>(
      tokenData.accessToken,
      `/playlists/${playlistId}?fields=name,tracks(total,next,items(track(name,artists(name))))`
    );

    sourceTotal =
      typeof playlist.tracks?.total === 'number'
        ? playlist.tracks.total
        : null;
    appendRows(playlist.tracks?.items ?? []);

    let nextUrl = playlist.tracks?.next ?? null;
    while (nextUrl) {
      try {
        const nextPage = await spotifyApiGetByUrl<SpotifyPlaylistTracksResponse>(
          tokenData.accessToken,
          nextUrl
        );
        appendRows(nextPage.items ?? []);
        nextUrl = nextPage.next ?? null;
      } catch (tracksError) {
        const message = tracksError instanceof Error ? tracksError.message : String(tracksError);
        if (message.toLowerCase().includes('failed (403)')) {
          // Keep the rows gathered so far instead of hard-failing the import.
          partialImport = true;
          importSource = 'playlist_fallback';
          nextUrl = null;
          break;
        }
        throw tracksError;
      }
    }

    if (rows.length === 0 && (sourceTotal === null || sourceTotal > 0)) {
      return NextResponse.json(
        {
          error:
            'Spotify returned no accessible track items for this playlist. This playlist cannot be imported through the current API permissions.',
          scope: spotifyScope,
          step,
        },
        { status: 403 }
      );
    }

    step = 'inventory-index';
    const inventoryTracks = await fetchInventoryTracks();
    const index = buildInventoryIndex(inventoryTracks);
    const { matched, missing } = matchTracks(rows, index);

    step = 'create-playlist';
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

    step = 'insert-playlist-items';
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

    step = 'build-response';
    const response = NextResponse.json({
      ok: true,
      playlistId: inserted.id,
      playlistName,
      sourceCount: rows.length,
      sourceTotal,
      importSource,
      partialImport,
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
      response.cookies.set('spotify_scope', tokenData.refreshed.scope ?? tokenData.scope ?? '', {
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
    const lowered = message.toLowerCase();
    if (lowered.includes('failed (403)') || lowered.includes('insufficient') || lowered.includes('forbidden')) {
      return NextResponse.json(
        {
          error:
            'Spotify denied access to playlist tracks (403). Reconnect Spotify to refresh permissions, then retry.',
          details: message,
          scope: spotifyScope,
          step,
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: message, step }, { status: 500 });
  }
}
