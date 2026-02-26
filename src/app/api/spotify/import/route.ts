import { NextResponse } from 'next/server';
import { getAuthHeader, supabaseServer } from 'src/lib/supabaseServer';
import { getCachedInventoryIndex, matchTracks, sanitizePlaylistName } from '../../../../lib/vinylPlaylistImport';
import { getSpotifyAccessTokenFromCookies, spotifyApiGet, spotifyApiGetByUrl, SpotifyApiError } from '../../../../lib/spotifyUser';

type SpotifyTrackItem = {
  item?: {
    type?: string;
    name?: string;
    artists?: Array<{ name?: string }>;
  };
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
  owner?: {
    id?: string;
  };
  tracks?: {
    items?: SpotifyTrackItem[];
    total?: number;
    href?: string;
    next?: string | null;
  };
};

type SpotifyMe = {
  id?: string;
};

function isForbiddenSpotifyError(message: string) {
  const lowered = message.toLowerCase();
  return lowered.includes('failed (403)') || lowered.includes('forbidden');
}

const getIndexStats = (index: Awaited<ReturnType<typeof getCachedInventoryIndex>>) => {
  let trackCount = 0;
  for (const list of index.titleOnly.values()) trackCount += list.length;
  return {
    trackCount,
    exactKeys: index.exact.size,
    titleKeys: index.titleOnly.size,
    tokenKeys: index.byToken.size,
  };
};

export async function POST(req: Request) {
  let step = 'init';
  let spotifyScope = '';
  let spotifyUserId = '';
  let playlistOwnerId = '';
  let resumeOffset = 0;
  let spotifyPlaylistId = '';
  let spotifySnapshotId = '';
  let localPlaylistId: number | null = null;
  const trackFetchErrors: Array<{ path: string; error: string }> = [];
  const metaFetchErrors: Array<{ path: string; error: string }> = [];
  let metaItemsRawCount = 0;
  let metaItemsParsedCount = 0;
  let attemptedTrackPageCalls = 0;
  let inventoryIndexStats: ReturnType<typeof getIndexStats> | null = null;
  try {
    step = 'parse-body';
    const body = await req.json();
    const playlistId = String(body?.playlistId ?? '').trim();
    const playlistName = sanitizePlaylistName(String(body?.playlistName ?? ''));
    const existingPlaylistId = Number(body?.existingPlaylistId ?? 0);
    const startOffset = Number(body?.offset ?? 0);
    const maxPages = Math.min(5, Math.max(1, Number(body?.maxPages ?? 2)));
    const providedSnapshotId = String(body?.snapshotId ?? '').trim();
    if (!playlistId) {
      return NextResponse.json({ error: 'playlistId is required' }, { status: 400 });
    }
    spotifyPlaylistId = playlistId;
    resumeOffset = Number.isFinite(startOffset) && startOffset >= 0 ? startOffset : 0;

    step = 'spotify-token';
    const tokenData = await getSpotifyAccessTokenFromCookies();
    if (!tokenData.accessToken) {
      return NextResponse.json({ error: 'Not connected to Spotify' }, { status: 401 });
    }
    spotifyScope = tokenData.scope ?? '';

    step = 'spotify-user';
    const me = await spotifyApiGet<SpotifyMe>(tokenData.accessToken, '/me');
    spotifyUserId = me.id ?? '';

    step = 'spotify-playlist-meta';
    const rows: Array<{ title?: string; artist?: string }> = [];
    let sourceTotal: number | null = null;
    let partialImport = false;
    let importSource: 'playlist_items' | 'playlist_fallback' = 'playlist_items';
    let pagesFetched = 0;

    const extractRows = (items: SpotifyTrackItem[] = []) => {
      const parsed: Array<{ title?: string; artist?: string }> = [];
      for (const item of items) {
        const trackNode = item.track ?? (item.item?.type === 'track' ? item.item : undefined);
        const title = trackNode?.name;
        const artist = (trackNode?.artists ?? [])[0]?.name;
        if (title) parsed.push({ title, artist });
      }
      return parsed;
    };

    let playlist: SpotifyPlaylistMeta | null = null;
    const playlistMetaPaths = [
      `/playlists/${playlistId}?fields=name,owner(id),tracks(total,next,items(item(type,name,artists(name)),track(name,artists(name))))&market=from_token`,
      `/playlists/${playlistId}?fields=name,owner(id),snapshot_id,tracks(total,href)&market=from_token`,
      `/playlists/${playlistId}?fields=name,owner(id),tracks(total,next,items(item(type,name,artists(name)),track(name,artists(name))))`,
      `/playlists/${playlistId}?fields=name,owner(id),snapshot_id,tracks(total,href)`,
      `/playlists/${playlistId}?market=from_token`,
      `/playlists/${playlistId}`,
    ];
    let lastPlaylistMetaError: unknown = null;
    for (const path of playlistMetaPaths) {
      try {
        playlist = await spotifyApiGet<SpotifyPlaylistMeta>(tokenData.accessToken, path);
        break;
      } catch (err) {
        lastPlaylistMetaError = err;
        const message = err instanceof Error ? err.message : String(err);
        metaFetchErrors.push({ path, error: message });
        if (!isForbiddenSpotifyError(message)) throw err;
      }
    }
    if (!playlist) {
      throw lastPlaylistMetaError instanceof Error ? lastPlaylistMetaError : new Error('Failed to fetch Spotify playlist metadata');
    }

    playlistOwnerId = playlist.owner?.id ?? '';
    spotifySnapshotId = (playlist as unknown as { snapshot_id?: string }).snapshot_id ?? '';
    sourceTotal =
      typeof playlist.tracks?.total === 'number'
        ? playlist.tracks.total
        : null;
    const metaItems = playlist.tracks?.items ?? [];
    const metaParsedRows = extractRows(metaItems);
    metaItemsRawCount = metaItems.length;
    metaItemsParsedCount = metaParsedRows.length;
    rows.push(...metaParsedRows);

    step = 'spotify-tracks';
    let offset = resumeOffset;
    let shouldProbeFirstPage = rows.length === 0;
    const totalToFetch = sourceTotal ?? Number.MAX_SAFE_INTEGER;
    while ((shouldProbeFirstPage || offset < totalToFetch) && pagesFetched < maxPages) {
      shouldProbeFirstPage = false;
      const trackPagePaths = [
        `/playlists/${playlistId}/items?limit=50&offset=${offset}&market=from_token&additional_types=track&fields=items(item(type,name,artists(name)),track(name,artists(name))),next`,
        `/playlists/${playlistId}/items?limit=50&offset=${offset}&market=from_token&fields=items(item(type,name,artists(name)),track(name,artists(name))),next`,
        `/playlists/${playlistId}/items?limit=50&offset=${offset}&fields=items(item(type,name,artists(name)),track(name,artists(name))),next`,
        `/playlists/${playlistId}/items?limit=50&offset=${offset}&market=from_token`,
        `/playlists/${playlistId}/items?limit=50&offset=${offset}`,
      ];
      let pageLoaded = false;
      let forbiddenOnAllVariants = true;
      let lastTrackPageError: unknown = null;

      for (const path of trackPagePaths) {
        try {
          attemptedTrackPageCalls += 1;
          const nextPage = await spotifyApiGet<SpotifyPlaylistTracksResponse>(tokenData.accessToken, path);
          const pageItems = nextPage.items ?? [];
          const parsedRows = extractRows(pageItems);

          // Some field selections can return non-empty items with no usable track payload.
          // In that case, try the next fallback shape for the same offset.
          if (pageItems.length > 0 && parsedRows.length === 0) {
            trackFetchErrors.push({
              path,
              error: 'Response contained items but no parseable track objects; trying fallback shape',
            });
            continue;
          }

          rows.push(...parsedRows);
          pagesFetched += 1;
          if (pageItems.length === 0 || parsedRows.length === 0) {
            offset = totalToFetch;
          } else {
            offset += pageItems.length;
          }
          pageLoaded = true;
          break;
        } catch (tracksError) {
          lastTrackPageError = tracksError;
          const message = tracksError instanceof Error ? tracksError.message : String(tracksError);
          trackFetchErrors.push({ path, error: message });
          if (!isForbiddenSpotifyError(message)) {
            throw tracksError;
          }
          forbiddenOnAllVariants = true;
        }
      }

      if (pageLoaded) continue;
      if (forbiddenOnAllVariants) {
        // Keep the rows gathered so far instead of hard-failing the import.
        partialImport = true;
        importSource = 'playlist_fallback';
        break;
      }
      throw lastTrackPageError instanceof Error ? lastTrackPageError : new Error('Failed to fetch Spotify playlist tracks');
    }

    if (rows.length === 0 && playlist.tracks?.href) {
      const hrefPaths = [
        `${playlist.tracks.href}?limit=50&offset=0`,
        playlist.tracks.href,
      ];
      for (const href of hrefPaths) {
        try {
          const page = await spotifyApiGetByUrl<SpotifyPlaylistTracksResponse>(tokenData.accessToken, href);
          const parsedRows = extractRows(page.items ?? []);
          rows.push(...parsedRows);
          if (rows.length > 0) {
            partialImport = true;
            importSource = 'playlist_fallback';
            break;
          }
        } catch (hrefError) {
          const message = hrefError instanceof Error ? hrefError.message : String(hrefError);
          trackFetchErrors.push({ path: href, error: message });
        }
      }
    }

    if (rows.length === 0 && (sourceTotal === null || sourceTotal > 0)) {
      return NextResponse.json(
        {
          error:
            'Spotify returned no accessible track items for this playlist. This playlist cannot be imported through the current API permissions.',
          scope: spotifyScope,
          spotifyUserId,
          playlistOwnerId,
          step,
          sourceTotal,
          sourceCount: rows.length,
          resume: {
            spotifyPlaylistId,
            snapshotId: spotifySnapshotId || providedSnapshotId || null,
            nextOffset: resumeOffset,
            maxPages,
          },
          debug: {
            metaItemsRawCount,
            metaItemsParsedCount,
            attemptedTrackPageCalls,
            metaFetchErrors: metaFetchErrors.slice(-10),
            trackFetchErrors: trackFetchErrors.slice(-20),
          },
        },
        { status: 403 }
      );
    }

    step = 'inventory-index';
    const index = await getCachedInventoryIndex();
    inventoryIndexStats = getIndexStats(index);
    if (inventoryIndexStats.trackCount < 25) {
      throw new Error(
        `Inventory index unexpectedly small (${inventoryIndexStats.trackCount} tracks). Check Supabase publishable key permissions / RLS.`
      );
    }
    const { matched, missing, fuzzyMatchedCount } = matchTracks(rows, index);

    step = 'create-playlist';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseServer(getAuthHeader(req)) as any;
    if (Number.isFinite(existingPlaylistId) && existingPlaylistId > 0) {
      localPlaylistId = existingPlaylistId;
    } else {
      const { data: maxSortRow } = await db
        .from('collection_playlists')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      const maxSortOrder =
        maxSortRow && typeof maxSortRow.sort_order === 'number' ? maxSortRow.sort_order : -1;
      const nextSortOrder = maxSortOrder + 1;

      const { data: inserted, error: insertError } = await db
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
      localPlaylistId = inserted.id;
    }

    step = 'insert-playlist-items';
    const trackKeys = matched
      .filter((row) => row.inventory_id && row.position)
      .map((row) => `${row.inventory_id}:${row.position}`);
    const dedupedTrackKeys = Array.from(new Set(trackKeys));

    if (dedupedTrackKeys.length > 0) {
      const records = dedupedTrackKeys.map((trackKey, idx) => ({
        playlist_id: localPlaylistId,
        track_key: trackKey,
        sort_order: idx,
      }));
      const { error: itemsError } = await db
        .from('collection_playlist_items')
        .insert(records);
      if (itemsError) throw itemsError;
    }

    step = 'build-response';
    const moreAvailable = sourceTotal !== null ? offset < sourceTotal : pagesFetched >= maxPages;
    const response = NextResponse.json({
      ok: true,
      playlistId: localPlaylistId,
      playlistName,
      sourceCount: rows.length,
      sourceTotal,
      importSource,
      partialImport,
      matchedCount: dedupedTrackKeys.length,
      fuzzyMatchedCount,
      unmatchedCount: missing.length,
      unmatchedSample: missing.slice(0, 25),
      debug: {
        supabase_mode: 'publishable',
        inventoryIndex: inventoryIndexStats,
      },
      resume: {
        spotifyPlaylistId,
        snapshotId: spotifySnapshotId || providedSnapshotId || null,
        nextOffset: moreAvailable ? offset : null,
        maxPages,
      },
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
    if (error instanceof SpotifyApiError && error.status === 429) {
      return NextResponse.json(
        {
          error: 'Spotify rate limit reached. Please retry after a short wait.',
          details: message,
          retryAfterSeconds: error.retryAfterSeconds ?? 3,
          scope: spotifyScope,
          spotifyUserId,
          playlistOwnerId,
          step,
          debug: {
            supabase_mode: 'publishable',
            inventoryIndex: inventoryIndexStats,
          },
          resume: {
            spotifyPlaylistId,
            snapshotId: spotifySnapshotId || null,
            nextOffset: resumeOffset,
            existingPlaylistId: localPlaylistId,
          },
        },
        { status: 429 }
      );
    }
    const lowered = message.toLowerCase();
    if (lowered.includes('failed (403)') || lowered.includes('insufficient') || lowered.includes('forbidden')) {
      return NextResponse.json(
        {
          error:
            'Spotify denied access to playlist tracks (403). Reconnect Spotify to refresh permissions, then retry.',
          details: message,
          scope: spotifyScope,
          spotifyUserId,
          playlistOwnerId,
          step,
          debug: {
            supabase_mode: 'publishable',
            inventoryIndex: inventoryIndexStats,
            metaItemsRawCount,
            metaItemsParsedCount,
            attemptedTrackPageCalls,
            metaFetchErrors: metaFetchErrors.slice(-10),
            trackFetchErrors: trackFetchErrors.slice(-20),
          },
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        error: message,
        step,
        debug: {
          supabase_mode: 'publishable',
          inventoryIndex: inventoryIndexStats,
        },
      },
      { status: 500 }
    );
  }
}
