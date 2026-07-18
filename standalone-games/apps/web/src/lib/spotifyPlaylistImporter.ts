import type { ImportedTrackInput } from "@/lib/importToTenantPlaylist";

export interface SpotifyPlaylistImportResult {
  playlistName: string;
  providerPlaylistId: string;
  tracks: ImportedTrackInput[];
}

interface SpotifyPlaylistMeta {
  name?: string;
}

interface SpotifyPlaylistItemsResponse {
  items?: Array<{
    track?: {
      id?: string;
      uri?: string;
      name?: string;
      artists?: Array<{ name?: string }>;
      album?: { name?: string };
    } | null;
    item?: {
      type?: string;
      id?: string;
      uri?: string;
      name?: string;
      artists?: Array<{ name?: string }>;
      album?: { name?: string };
    } | null;
  }>;
  next?: string | null;
}

function sanitizePlaylistName(value?: string): string {
  const cleaned = String(value ?? "").trim();
  if (!cleaned) return "Spotify Import";
  return cleaned.slice(0, 80);
}

async function spotifyGet<T>(accessToken: string, path: string): Promise<T> {
  const normalizedPath = path.startsWith("/v1/") ? path.slice(3) : path;
  const response = await fetch(`https://api.spotify.com/v1${normalizedPath}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Spotify API failed (${response.status}): ${body.slice(0, 200)}`);
  }

  return (await response.json()) as T;
}

function mapPageItems(items: SpotifyPlaylistItemsResponse["items"]): ImportedTrackInput[] {
  const result: ImportedTrackInput[] = [];

  for (const entry of items ?? []) {
    const trackNode = entry?.track ?? (entry?.item?.type === "track" ? entry.item : null);
    const trackTitle = String(trackNode?.name ?? "").trim();
    const artistName = String(trackNode?.artists?.[0]?.name ?? "").trim();
    if (!trackTitle || !artistName) continue;

    result.push({
      trackTitle,
      artistName,
      albumName: String(trackNode?.album?.name ?? "").trim() || null,
      externalTrackId: String(trackNode?.id ?? "").trim() || null,
      displayTitle: null,
    });
  }

  return result;
}

export async function importSpotifyPlaylistTracks(params: {
  accessToken: string;
  providerPlaylistId: string;
  maxTracks?: number;
}): Promise<SpotifyPlaylistImportResult> {
  const providerPlaylistId = params.providerPlaylistId.trim();
  if (!providerPlaylistId) {
    throw new Error("providerPlaylistId is required.");
  }

  const maxTracks = Math.max(1, Math.min(1000, params.maxTracks ?? 500));

  const meta = await spotifyGet<SpotifyPlaylistMeta>(
    params.accessToken,
    `/playlists/${encodeURIComponent(providerPlaylistId)}?fields=name`
  );

  const tracks: ImportedTrackInput[] = [];
  let nextPath =
    `/playlists/${encodeURIComponent(providerPlaylistId)}` +
    `/items?limit=100&additional_types=track&market=from_token`;

  while (nextPath && tracks.length < maxTracks) {
    const page = await spotifyGet<SpotifyPlaylistItemsResponse>(params.accessToken, nextPath);
    tracks.push(...mapPageItems(page.items));

    if (!page.next) {
      nextPath = "";
    } else {
      const nextUrl = new URL(page.next);
      const normalizedPath = nextUrl.pathname.startsWith("/v1/")
        ? nextUrl.pathname.slice(3)
        : nextUrl.pathname;
      nextPath = `${normalizedPath}${nextUrl.search}`;
    }
  }

  return {
    playlistName: sanitizePlaylistName(meta.name),
    providerPlaylistId,
    tracks: tracks.slice(0, maxTracks),
  };
}
