import { NextResponse } from 'next/server';
import { getAuthHeader } from 'src/lib/supabaseServer';
import { importRowsToPlaylist, type SourceRow } from 'src/lib/playlistImportEngine';
import { getSpotifyAccessTokenFromCookies, spotifyApiGet, SpotifyApiError } from '../../../../lib/spotifyUser';

export const runtime = 'nodejs';

type SpotifyTrackItem = {
  item?: {
    type?: string;
    id?: string;
    uri?: string;
    name?: string;
    external_ids?: {
      isrc?: string;
    };
    artists?: Array<{ name?: string }>;
  } | null;
  track?: {
    id?: string;
    uri?: string;
    name?: string;
    external_ids?: {
      isrc?: string;
    };
    artists?: Array<{ name?: string }>;
  } | null;
};

type SpotifyPlaylistItemsResponse = {
  items?: SpotifyTrackItem[];
  next?: string | null;
  total?: number;
};

type SpotifyPlaylistMeta = {
  name?: string;
  snapshot_id?: string;
  owner?: {
    id?: string;
  };
  items?: {
    total?: number;
  };
  tracks?: {
    total?: number;
  };
};

type SpotifyMe = {
  id?: string;
};

const isForbiddenSpotifyError = (message: string) => {
  const lowered = message.toLowerCase();
  return lowered.includes('failed (403)') || lowered.includes('forbidden');
};

const sanitizePlaylistName = (value?: string) => {
  const cleaned = String(value ?? '').trim();
  if (!cleaned) return 'Custom Playlist';
  return cleaned.slice(0, 80);
};

const normalizeIsrc = (value: unknown) => {
  const raw = String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return raw.length >= 10 ? raw : '';
};

const extractRows = (items: SpotifyTrackItem[] = []): SourceRow[] => {
  const rows: SourceRow[] = [];
  for (const item of items) {
    const trackNode = item.track ?? (item.item?.type === 'track' ? item.item : undefined);
    const title = typeof trackNode?.name === 'string' ? trackNode.name.trim() : '';
    const artistRaw = (trackNode?.artists ?? []).map((artist) => String(artist?.name ?? '').trim()).filter(Boolean);
    const artist = artistRaw[0] ?? '';
    const isrc = normalizeIsrc(trackNode?.external_ids?.isrc);
    const spotifyTrackId = typeof trackNode?.id === 'string' ? trackNode.id.trim() : '';
    const spotifyUri = typeof trackNode?.uri === 'string' ? trackNode.uri.trim() : '';
    if (!title) continue;
    rows.push({
      title,
      artist: artist || undefined,
      isrc: isrc || undefined,
      spotifyTrackId: spotifyTrackId || undefined,
      spotifyUri: spotifyUri || undefined,
    });
  }
  return rows;
};

const fetchPlaylistMeta = async (
  accessToken: string,
  playlistId: string,
  debugErrors: Array<{ path: string; error: string }>
): Promise<SpotifyPlaylistMeta> => {
  const paths = [
    `/playlists/${playlistId}?fields=name,snapshot_id,owner(id),items(total),tracks(total)&market=from_token`,
    `/playlists/${playlistId}?fields=name,snapshot_id,owner(id),items(total),tracks(total)`,
    `/playlists/${playlistId}?market=from_token`,
    `/playlists/${playlistId}`,
  ];

  let lastError: unknown = null;
  for (const path of paths) {
    try {
      return await spotifyApiGet<SpotifyPlaylistMeta>(accessToken, path, { maxAttempts: 2 });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      debugErrors.push({ path, error: message });

      const status = error instanceof SpotifyApiError ? error.status : null;
      if (status === 400 || status === 403 || isForbiddenSpotifyError(message)) continue;
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to load Spotify playlist metadata');
};

const fetchPlaylistItemsPage = async (
  accessToken: string,
  playlistId: string,
  offset: number,
  debugErrors: Array<{ path: string; error: string }>
): Promise<{ rows: SourceRow[]; itemCount: number; next: string | null; total: number | null }> => {
  const paths = [
    `/playlists/${playlistId}/items?limit=100&offset=${offset}&additional_types=track&market=from_token&fields=items(item(type,id,uri,name,artists(name))),next,total`,
    `/playlists/${playlistId}/items?limit=100&offset=${offset}&additional_types=track&fields=items(track(id,uri,name,artists(name)),item(type,id,uri,name,artists(name))),next,total`,
    `/playlists/${playlistId}/items?limit=100&offset=${offset}&additional_types=track&market=from_token`,
    `/playlists/${playlistId}/items?limit=100&offset=${offset}&additional_types=track`,
  ];

  let lastError: unknown = null;
  for (const path of paths) {
    try {
      const page = await spotifyApiGet<SpotifyPlaylistItemsResponse>(accessToken, path, { maxAttempts: 2 });
      const items = page.items ?? [];
      const rows = extractRows(items);

      if (items.length > 0 && rows.length === 0) {
        debugErrors.push({ path, error: 'Page had items but no parseable tracks; trying fallback shape' });
        continue;
      }

      return {
        rows,
        itemCount: items.length,
        next: page.next ?? null,
        total: typeof page.total === 'number' ? page.total : null,
      };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      debugErrors.push({ path, error: message });

      const status = error instanceof SpotifyApiError ? error.status : null;
      if (status === 400 || status === 403 || isForbiddenSpotifyError(message)) continue;
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to load Spotify playlist tracks page');
};

export async function POST(req: Request) {
  let step = 'init';
  let spotifyScope = '';
  let spotifyUserId = '';
  let playlistOwnerId = '';
  let spotifyPlaylistId = '';
  let spotifySnapshotId = '';
  let resumeOffset = 0;
  let localPlaylistId: number | null = null;
  const metaFetchErrors: Array<{ path: string; error: string }> = [];
  const trackFetchErrors: Array<{ path: string; error: string }> = [];

  try {
    step = 'parse-body';
    const body = await req.json();
    const playlistId = String(body?.playlistId ?? '').trim();
    const requestedName = String(body?.playlistName ?? '').trim();
    const existingPlaylistId = Number(body?.existingPlaylistId ?? 0);
    const startOffset = Number(body?.offset ?? 0);
    const maxPages = Math.min(8, Math.max(1, Number(body?.maxPages ?? 3)));
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
    const playlist = await fetchPlaylistMeta(tokenData.accessToken, playlistId, metaFetchErrors);
    playlistOwnerId = playlist.owner?.id ?? '';
    spotifySnapshotId = typeof playlist.snapshot_id === 'string' ? playlist.snapshot_id : '';

    let sourceTotal =
      playlist.items && typeof playlist.items.total === 'number'
        ? playlist.items.total
        : playlist.tracks && typeof playlist.tracks.total === 'number'
          ? playlist.tracks.total
          : null;

    const inferredName =
      requestedName && requestedName !== '(resume)'
        ? requestedName
        : String(playlist.name ?? 'Spotify Import');
    const playlistName = sanitizePlaylistName(inferredName);

    step = 'spotify-tracks';
    const rows: SourceRow[] = [];
    let offset = resumeOffset;
    let pagesFetched = 0;
    let lastPageNext: string | null = null;

    while (pagesFetched < maxPages) {
      const page = await fetchPlaylistItemsPage(tokenData.accessToken, playlistId, offset, trackFetchErrors);
      rows.push(...page.rows);
      pagesFetched += 1;
      lastPageNext = page.next;
      if (sourceTotal === null && page.total !== null) {
        sourceTotal = page.total;
      }

      if (page.itemCount <= 0) break;
      offset += page.itemCount;
      if (sourceTotal !== null && offset >= sourceTotal) break;
      if (!page.next) break;
    }

    if (rows.length === 0 && (sourceTotal === null || sourceTotal > resumeOffset)) {
      return NextResponse.json(
        {
          error: 'Spotify returned no track rows that can be imported from this playlist.',
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
            mode: 'publishable',
            metaFetchErrors: metaFetchErrors.slice(-10),
            trackFetchErrors: trackFetchErrors.slice(-20),
          },
        },
        { status: 403 }
      );
    }

    const moreAvailable = sourceTotal !== null ? offset < sourceTotal : !!lastPageNext;

    step = 'import';
    const imported = await importRowsToPlaylist({
      authHeader: getAuthHeader(req),
      rows,
      playlistName,
      existingPlaylistId,
      icon: '🎵',
      color: '#1db954',
    });
    localPlaylistId = imported.playlistId;

    step = 'build-response';
    const response = NextResponse.json({
      ok: true,
      ...imported,
      sourceTotal,
      importSource: 'playlist_items',
      partialImport: moreAvailable,
      resume: {
        spotifyPlaylistId,
        snapshotId: spotifySnapshotId || providedSnapshotId || null,
        nextOffset: moreAvailable ? offset : null,
        maxPages,
      },
      debug: {
        mode: 'publishable',
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
          resume: {
            spotifyPlaylistId,
            snapshotId: spotifySnapshotId || null,
            nextOffset: resumeOffset,
            existingPlaylistId: localPlaylistId,
          },
          debug: {
            mode: 'publishable',
            metaFetchErrors: metaFetchErrors.slice(-10),
            trackFetchErrors: trackFetchErrors.slice(-20),
          },
        },
        { status: 429 }
      );
    }

    const lowered = message.toLowerCase();
    if (isForbiddenSpotifyError(lowered) || lowered.includes('insufficient')) {
      return NextResponse.json(
        {
          error: 'Spotify denied access to this playlist. Reconnect Spotify and retry.',
          details: message,
          scope: spotifyScope,
          spotifyUserId,
          playlistOwnerId,
          step,
          debug: {
            mode: 'publishable',
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
          mode: 'publishable',
          metaFetchErrors: metaFetchErrors.slice(-10),
          trackFetchErrors: trackFetchErrors.slice(-20),
        },
      },
      { status: 500 }
    );
  }
}
