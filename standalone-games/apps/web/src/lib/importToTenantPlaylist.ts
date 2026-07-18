import { getTenantPlaylistsRepository } from "@/lib/tenantPlaylistsRepositoryFactory";
import { getTenantPlaylistSnapshotsRepository } from "@/lib/tenantPlaylistSnapshotsRepositoryFactory";
import type { TenantPlaylistProvider } from "@/lib/tenantPlaylistsRepo";

export interface ImportedTrackInput {
  trackTitle: string;
  artistName: string;
  albumName?: string | null;
  canonicalTrackId?: string | null;
  externalTrackId?: string | null;
  displayTitle?: string | null;
}

export interface ImportPlaylistInput {
  tenantId: string;
  userId: string;
  provider: TenantPlaylistProvider;
  providerPlaylistId?: string | null;
  playlistName: string;
  description?: string | null;
  snapshotName?: string | null;
  tracks: ImportedTrackInput[];
}

export async function importTracksToTenantPlaylist(input: ImportPlaylistInput) {
  const playlistRepo = getTenantPlaylistsRepository();
  const snapshotRepo = getTenantPlaylistSnapshotsRepository();

  const playlist = await playlistRepo.create({
    tenantId: input.tenantId,
    provider: input.provider,
    providerPlaylistId: input.providerPlaylistId ?? null,
    name: input.playlistName,
    description: input.description ?? null,
    createdByUserId: input.userId,
  });

  const snapshot = await snapshotRepo.create({
    tenantId: input.tenantId,
    tenantPlaylistId: playlist.id,
    snapshotName: input.snapshotName ?? `${playlist.name} Snapshot`,
    snapshotPayload: {
      playlistName: playlist.name,
      provider: playlist.provider,
      providerPlaylistId: playlist.providerPlaylistId,
      itemCount: input.tracks.length,
      items: input.tracks.map((track, index) => ({
        index,
        trackTitle: track.trackTitle,
        artistName: track.artistName,
        albumName: track.albumName ?? null,
        canonicalTrackId: track.canonicalTrackId ?? null,
        externalTrackId: track.externalTrackId ?? null,
        displayTitle: track.displayTitle ?? null,
      })),
    },
    createdByUserId: input.userId,
  });

  return { playlist, snapshot };
}
